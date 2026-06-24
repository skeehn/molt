import type { ToolResult } from '../providers/types.js';
import { getProvider } from '../providers/index.js';
import { delegateToClaudeCode, delegateToCodex } from '../providers/subprocess.js';
import { TOOLS, executeTool } from './index.js';
import { getSystemPrompt } from '../system-prompt.js';
import type { Message, ContentBlock, StreamEvent } from '../providers/types.js';

export const delegateTool = {
  name: 'delegate',
  description: 'Delegate a subtask to a child agent. The child runs in isolated context and returns its result.',
  input_schema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Description of the task to delegate' },
      provider: { type: 'string', description: 'Provider to use (bedrock, anthropic, openrouter, ollama, claude-code, codex)' },
      model: { type: 'string', description: 'Model override for the child agent' },
    },
    required: ['task'],
  },
};

export async function executeDelegate(input: { task: string; provider?: string; model?: string }): Promise<ToolResult> {
  const providerName = input.provider || 'bedrock';

  // Handle subprocess providers
  if (providerName === 'claude-code' || providerName === 'claude') {
    try {
      const result = await delegateToClaudeCode(input.task);
      return { content: result.output, is_error: result.exitCode !== 0 };
    } catch (err: any) {
      return { content: `Delegation to claude-code failed: ${err.message}`, is_error: true };
    }
  }

  if (providerName === 'codex') {
    try {
      const result = await delegateToCodex(input.task);
      return { content: result.output, is_error: result.exitCode !== 0 };
    } catch (err: any) {
      return { content: `Delegation to codex failed: ${err.message}`, is_error: true };
    }
  }

  // Standard LLM provider delegation
  try {
    const provider = getProvider(providerName, input.model);
    const system = getSystemPrompt();
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: input.task }] }
    ];

    let fullResponse = '';
    const maxTurns = 20;

    for (let turn = 0; turn < maxTurns; turn++) {
      const assistantBlocks: ContentBlock[] = [];
      let currentToolId = '';
      let currentToolName = '';
      let currentToolInput = '';

      for await (const event of provider.stream(messages, system, TOOLS)) {
        if (event.type === 'text_delta') {
          fullResponse += event.text;
          assistantBlocks.push({ type: 'text', text: event.text });
        } else if (event.type === 'tool_use_start') {
          currentToolId = event.id;
          currentToolName = event.name;
          currentToolInput = '';
        } else if (event.type === 'tool_use_delta') {
          currentToolInput += event.input_json;
        } else if (event.type === 'tool_use_end') {
          if (currentToolName) {
            let parsedInput: any = {};
            try { parsedInput = JSON.parse(currentToolInput); } catch {}
            assistantBlocks.push({ type: 'tool_use', id: currentToolId, name: currentToolName, input: parsedInput });
          }
        } else if (event.type === 'message_end') {
          if (event.stop_reason === 'end_turn') {
            return { content: fullResponse || 'Task completed (no output)' };
          }
        }
      }

      // Execute tools
      messages.push({ role: 'assistant', content: assistantBlocks });
      const toolResults: ContentBlock[] = [];

      for (const block of assistantBlocks) {
        if (block.type === 'tool_use') {
          if (block.name === 'finish') {
            return { content: block.input?.result || fullResponse || 'Task completed' };
          }
          const result = await executeTool(block.name, block.input);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.content, is_error: result.is_error });
        }
      }

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      } else {
        return { content: fullResponse || 'No output from delegate' };
      }
    }

    return { content: fullResponse || 'Delegate reached max turns' };
  } catch (err: any) {
    return { content: `Delegation failed: ${err.message}`, is_error: true };
  }
}
