// Plan tracker — writes .grain-plan.json in the task cwd.
// Survives context compaction because it's on disk, not in message history.
// The system prompt instructs the LLM to read and update this file.

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  files?: string[];
  notes?: string;
}

export interface Plan {
  task: string;
  created: string;
  updated: string;
  steps: PlanStep[];
}

function planPath(cwd: string): string {
  return resolve(cwd, '.grain-plan.json');
}

export function writePlan(cwd: string, plan: Plan): void {
  plan.updated = new Date().toISOString();
  writeFileSync(planPath(cwd), JSON.stringify(plan, null, 2), 'utf-8');
}

export function readPlan(cwd: string): Plan | null {
  const p = planPath(cwd);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export function planSummary(plan: Plan): string {
  const done = plan.steps.filter(s => s.status === 'done').length;
  const total = plan.steps.length;
  const inProgress = plan.steps.filter(s => s.status === 'in_progress');
  const pending = plan.steps.filter(s => s.status === 'pending');
  const lines = [
    `Plan: ${plan.task}`,
    `Progress: ${done}/${total} steps complete`,
  ];
  if (inProgress.length) lines.push(`In progress: ${inProgress.map(s => s.description).join(', ')}`);
  if (pending.length) lines.push(`Next: ${pending[0].description}`);
  return lines.join('\n');
}

// Tool exposed to the LLM — read/write plan steps
export const planTool = {
  name: 'plan',
  description: [
    'Manage the task plan stored in .grain-plan.json. This file persists across context compaction.',
    'Use write to create or update the plan. Use read to check current progress.',
    'Always create a plan at task start and update step statuses as you complete them.',
    'The plan is your source of truth — check it whenever you lose track of where you are.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'write', 'update_step'],
        description: 'read: get current plan. write: create/replace plan. update_step: mark a step done/failed.',
      },
      task: {
        type: 'string',
        description: 'For write: the overall task description',
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id:          { type: 'string' },
            description: { type: 'string' },
            status:      { type: 'string', enum: ['pending', 'in_progress', 'done', 'failed'] },
            files:       { type: 'array', items: { type: 'string' } },
            notes:       { type: 'string' },
          },
          required: ['id', 'description', 'status'],
        },
        description: 'For write: the full step list',
      },
      step_id: {
        type: 'string',
        description: 'For update_step: the step id to update',
      },
      status: {
        type: 'string',
        enum: ['pending', 'in_progress', 'done', 'failed'],
        description: 'For update_step: new status',
      },
      notes: {
        type: 'string',
        description: 'For update_step: optional notes on outcome',
      },
    },
    required: ['action'],
  },
};

export function executePlan(
  input: {
    action: 'read' | 'write' | 'update_step';
    task?: string;
    steps?: PlanStep[];
    step_id?: string;
    status?: PlanStep['status'];
    notes?: string;
  },
  cwd?: string,
): { content: string; is_error?: boolean } {
  const workdir = cwd || process.cwd();

  if (input.action === 'read') {
    const plan = readPlan(workdir);
    if (!plan) return { content: 'No plan found. Create one with action=write.' };
    return { content: planSummary(plan) + '\n\nFull plan:\n' + JSON.stringify(plan.steps, null, 2) };
  }

  if (input.action === 'write') {
    if (!input.task || !input.steps) {
      return { content: 'write requires task and steps', is_error: true };
    }
    const plan: Plan = {
      task: input.task,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      steps: input.steps,
    };
    writePlan(workdir, plan);
    return { content: `Plan written: ${input.steps.length} steps for "${input.task}"` };
  }

  if (input.action === 'update_step') {
    const plan = readPlan(workdir);
    if (!plan) return { content: 'No plan found.', is_error: true };
    const step = plan.steps.find(s => s.id === input.step_id);
    if (!step) return { content: `Step ${input.step_id} not found.`, is_error: true };
    if (input.status) step.status = input.status;
    if (input.notes) step.notes = input.notes;
    writePlan(workdir, plan);
    return { content: planSummary(plan) };
  }

  return { content: `Unknown action: ${input.action}`, is_error: true };
}
