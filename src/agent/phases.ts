// Multi-phase agent execution
import type { Message, ContentBlock } from '../providers/types.js';
import { getProvider } from '../providers/index.js';
import { TOOLS, executeTool } from '../tools/index.js';
import { getSystemPrompt } from '../system-prompt.js';
import type { AgentState, AgentPlan, PlanStep, AgentConfig } from '../types/agent.js';
import { engramRetrieve, engramStore } from './context.js';

export interface PhaseContext {
  messages: Message[];
  state: AgentState;
  config: AgentConfig;
}

// Phase 1: UNDERSTAND - Analyze the request and ask clarifying questions if needed
export async function understandPhase(ctx: PhaseContext): Promise<{ needsClarification: boolean; questions?: string[] }> {
  const lastUserMsg = ctx.messages[ctx.messages.length - 1];
  if (!lastUserMsg || lastUserMsg.role !== 'user') {
    return { needsClarification: false };
  }

  const userText = lastUserMsg.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join(' ');

  // Retrieve relevant context from engram
  const engramContext = await engramRetrieve(userText);
  
  // Simple heuristic: if request is vague (<10 words) or contains question marks, might need clarification
  const words = userText.trim().split(/\s+/).length;
  const isVague = words < 10 && !userText.includes('?');
  
  if (isVague) {
    // Could ask LLM to generate clarifying questions here
    // For now, proceed with planning
  }

  return { needsClarification: false };
}

// Phase 2: PLAN - Create a multi-step execution plan
export async function planPhase(ctx: PhaseContext): Promise<AgentPlan> {
  const config = ctx.config;
  const provider = getProvider(config.provider, config.model);
  
  let system = getSystemPrompt();
  system += `\n\nYou are in PLANNING mode. Analyze the user's request and create a detailed step-by-step plan.

Return your plan in this exact format:
PLAN:
1. [Step description]
2. [Step description]
3. [Step description]
...

Be specific about what tools you'll use (read, write, patch, bash, etc.).
Each step should be atomic and testable.`;

  const lastUserMsg = ctx.messages[ctx.messages.length - 1];
  const userText = lastUserMsg?.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join(' ') || '';

  // Add engram context
  const engramContext = await engramRetrieve(userText);
  if (engramContext.trim()) {
    system += `\n\nRelevant context from memory:\n${engramContext}`;
  }

  // Get plan from LLM
  let planText = '';
  for await (const event of provider.stream(ctx.messages, system, [])) {
    if (event.type === 'text_delta') {
      planText += event.text;
    }
  }

  // Parse plan into steps
  const steps = parsePlan(planText);

  return {
    steps,
    currentStepIndex: 0,
    needsApproval: !config.autoApprove,
    approved: config.autoApprove,
  };
}

function parsePlan(planText: string): PlanStep[] {
  const lines = planText.split('\n').filter(l => l.trim());
  const steps: PlanStep[] = [];
  
  let inPlan = false;
  for (const line of lines) {
    if (line.toUpperCase().includes('PLAN:')) {
      inPlan = true;
      continue;
    }
    
    if (!inPlan) continue;
    
    // Match numbered steps: "1. ", "1) ", etc.
    const match = line.match(/^\s*\d+[\.\)]\s*(.+)$/);
    if (match) {
      const description = match[1].trim();
      const tool = extractToolFromDescription(description);
      steps.push({
        id: `step-${steps.length + 1}`,
        description,
        status: 'pending',
        tool,
      });
    }
  }

  // If no steps parsed, create a default step
  if (steps.length === 0) {
    steps.push({
      id: 'step-1',
      description: 'Execute the requested task',
      status: 'pending',
    });
  }

  return steps;
}

function extractToolFromDescription(desc: string): string | undefined {
  const lower = desc.toLowerCase();
  if (lower.includes('read') || lower.includes('check')) return 'read';
  if (lower.includes('write') || lower.includes('create')) return 'write';
  if (lower.includes('modify') || lower.includes('edit') || lower.includes('patch')) return 'patch';
  if (lower.includes('run') || lower.includes('execute') || lower.includes('command')) return 'bash';
  if (lower.includes('search') || lower.includes('find')) return 'grep';
  return undefined;
}

// Phase 3: EXECUTE - Run each step of the plan
export async function executePhase(ctx: PhaseContext): Promise<void> {
  if (!ctx.state.plan) return;

  const plan = ctx.state.plan;
  const currentStep = plan.steps[plan.currentStepIndex];
  
  if (!currentStep || currentStep.status !== 'pending') return;

  // Update step to running
  currentStep.status = 'running';

  // Execute the step by calling LLM with tools
  const config = ctx.config;
  const provider = getProvider(config.provider, config.model);
  
  let system = getSystemPrompt();
  system += `\n\nYou are executing step ${plan.currentStepIndex + 1} of your plan:
"${currentStep.description}"

Use the appropriate tools to complete this step. Be precise and thorough.`;

  const assistantBlocks: ContentBlock[] = [];
  let hasToolUse = false;

  try {
    for await (const event of provider.stream(ctx.messages, system, TOOLS)) {
      if (event.type === 'text_delta') {
        // Thinking/reasoning text
        ctx.state.thinking = (ctx.state.thinking || '') + event.text;
      } else if (event.type === 'tool_use_start') {
        hasToolUse = true;
        const block: ContentBlock = {
          type: 'tool_use',
          id: event.id,
          name: event.name,
          input: {},
        };
        assistantBlocks.push(block);
      } else if (event.type === 'tool_use_delta') {
        const block = assistantBlocks.find(b => b.type === 'tool_use' && b.id === event.id) as any;
        if (block) {
          block.input = { ...(block.input || {}), ...event.input };
        }
      }
    }

    // Execute tools
    const toolResults: ContentBlock[] = [];
    for (const block of assistantBlocks) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
        
        currentStep.result = result.slice(0, 200);
        ctx.state.toolOutput = result;
      }
    }

    // Add messages
    ctx.messages.push({
      role: 'assistant',
      content: assistantBlocks,
    });

    if (toolResults.length > 0) {
      ctx.messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    currentStep.status = 'complete';

  } catch (err: any) {
    currentStep.status = 'failed';
    currentStep.error = err.message;
    throw err;
  }
}

// Phase 4: VERIFY - Check that the step completed successfully
export async function verifyPhase(ctx: PhaseContext): Promise<boolean> {
  if (!ctx.state.plan) return true;

  const plan = ctx.state.plan;
  const currentStep = plan.steps[plan.currentStepIndex];
  
  if (!currentStep || currentStep.status !== 'complete') return false;

  // Simple verification: check if result exists and no error
  if (currentStep.error) return false;
  if (!currentStep.result) return true; // No result needed

  // Could add more sophisticated verification here:
  // - For write/patch: read back the file and confirm changes
  // - For bash: check exit code
  // - For read: confirm content retrieved

  return true;
}

// Phase 5: REFLECT - Learn from the execution and store patterns
export async function reflectPhase(ctx: PhaseContext): Promise<void> {
  if (!ctx.state.plan) return;

  const plan = ctx.state.plan;
  const allComplete = plan.steps.every(s => s.status === 'complete');
  const anyFailed = plan.steps.some(s => s.status === 'failed');

  if (allComplete) {
    // Store successful pattern in engram
    const lastUserMsg = ctx.messages.find(m => m.role === 'user');
    const userText = lastUserMsg?.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join(' ') || '';

    const summary = `Successfully completed: ${userText}\nSteps: ${plan.steps.map(s => s.description).join(' → ')}`;
    await engramStore(summary, ['success', 'pattern']);
  } else if (anyFailed) {
    // Store error pattern for future reference
    const failedSteps = plan.steps.filter(s => s.status === 'failed');
    const errorSummary = `Failed steps: ${failedSteps.map(s => `${s.description} (${s.error})`).join('; ')}`;
    await engramStore(errorSummary, ['error', 'failure']);
  }
}
