import type { ToolResult } from '../providers/types.js';
import { executeEngram } from './engram.js';

export const finishTool = {
  name: 'finish',
  description: 'Signal that the current task is complete. Optionally provide learnings to store in engram.',
  input_schema: {
    type: 'object',
    properties: {
      result: { type: 'string', description: 'Summary of what was accomplished' },
      learnings: { type: 'array', items: { type: 'string' }, description: 'Facts learned during this task to store in engram' },
    },
    required: ['result'],
  },
};

export async function executeFinish(input: { result: string; learnings?: string[] }): Promise<ToolResult> {
  // Store learnings in engram if provided — don't let engram failure block task completion
  if (input.learnings && input.learnings.length > 0) {
    for (const learning of input.learnings) {
      try {
        await executeEngram({ action: 'add', body: learning, tags: ['auto-learned'] });
      } catch (_err) {
        // Engram unavailable — skip, don't fail
      }
    }
  }

  return { content: `TASK_COMPLETE: ${input.result}` };
}
