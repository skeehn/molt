import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import type { Provider, Message, Tool, StreamEvent, ContentBlock } from './types.js';

const DEFAULT_MODEL = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

export class BedrockProvider implements Provider {
  name = 'bedrock';
  model: string;
  private client: AnthropicBedrock;

  constructor(model?: string) {
    this.model = model || DEFAULT_MODEL;
    this.client = new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async *stream(messages: Message[], system: string, tools: Tool[]): AsyncIterable<StreamEvent> {
    const apiMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content.map(block => {
        if (block.type === 'text') return { type: 'text' as const, text: block.text };
        if (block.type === 'tool_use') return { type: 'tool_use' as const, id: block.id, name: block.name, input: block.input };
        if (block.type === 'tool_result') return { type: 'tool_result' as const, tool_use_id: block.tool_use_id, content: block.content, is_error: block.is_error };
        return block as any;
      }),
    }));

    const apiTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as any,
    }));

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 16384,
      system,
      messages: apiMessages,
      tools: apiTools,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = (event as any).content_block;
        if (block.type === 'tool_use') {
          yield { type: 'tool_use_start', id: block.id, name: block.name };
        }
      } else if (event.type === 'content_block_delta') {
        const delta = (event as any).delta;
        if (delta.type === 'text_delta') {
          yield { type: 'text_delta', text: delta.text };
        } else if (delta.type === 'input_json_delta') {
          yield { type: 'tool_use_delta', id: '', input_json: delta.partial_json };
        }
      } else if (event.type === 'content_block_stop') {
        // Check if it was a tool_use block
        yield { type: 'tool_use_end', id: '' };
      } else if (event.type === 'message_stop') {
        yield { type: 'message_end', stop_reason: 'end_turn' };
      } else if (event.type === 'message_delta') {
        const delta = (event as any).delta;
        if (delta.stop_reason) {
          yield { type: 'message_end', stop_reason: delta.stop_reason };
        }
      }
    }
  }
}
