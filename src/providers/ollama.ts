import type { Provider, Message, Tool, StreamEvent, ContentBlock } from './types.js';

const DEFAULT_MODEL = 'qwen3:32b';
const BASE_URL = 'http://localhost:11434/api/chat';

export class OllamaProvider implements Provider {
  name = 'ollama';
  model: string;

  constructor(model?: string) {
    this.model = model || DEFAULT_MODEL;
  }

  private convertMessages(messages: Message[], system: string): any[] {
    const result: any[] = [{ role: 'system', content: system }];

    for (const m of messages) {
      const textParts: string[] = [];
      const toolCalls: any[] = [];
      const toolResults: any[] = [];

      for (const block of m.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: { name: block.name, arguments: JSON.stringify(block.input) }
          });
        } else if (block.type === 'tool_result') {
          toolResults.push({
            role: 'tool',
            content: block.content,
          });
        }
      }

      if (toolCalls.length > 0) {
        // Assistant message with tool calls
        result.push({
          role: 'assistant',
          content: textParts.join('') || '',
          tool_calls: toolCalls,
        });
      } else if (toolResults.length > 0) {
        // Push any text first if present
        if (textParts.length > 0) {
          result.push({ role: m.role, content: textParts.join('\n') });
        }
        for (const tr of toolResults) {
          result.push(tr);
        }
      } else if (textParts.length > 0) {
        result.push({ role: m.role, content: textParts.join('\n') });
      }
    }

    return result;
  }

  private convertTools(tools: Tool[]): any[] {
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      }
    }));
  }

  async *stream(messages: Message[], system: string, tools: Tool[]): AsyncIterable<StreamEvent> {
    const body: any = {
      model: this.model,
      messages: this.convertMessages(messages, system),
      stream: true,
    };

    if (tools.length > 0) {
      body.tools = this.convertTools(tools);
    }

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      yield { type: 'error', error: `Ollama error: ${response.status} ${await response.text()}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);

          if (parsed.message?.tool_calls) {
            for (const tc of parsed.message.tool_calls) {
              const id = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              yield { type: 'tool_use_start', id, name: tc.function.name };
              yield {
                type: 'tool_use_delta',
                id,
                input_json: typeof tc.function.arguments === 'string'
                  ? tc.function.arguments
                  : JSON.stringify(tc.function.arguments)
              };
              yield { type: 'tool_use_end', id };
            }
          } else if (parsed.message?.content) {
            yield { type: 'text_delta', text: parsed.message.content };
          }

          if (parsed.done) {
            yield { type: 'message_end', stop_reason: parsed.message?.tool_calls ? 'tool_use' : 'end_turn' };
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}
