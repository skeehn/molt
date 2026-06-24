import type { Message, ContentBlock, StreamEvent } from '../providers/types.js';
import { getProvider } from '../providers/index.js';
import { TOOLS, executeTool } from '../tools/index.js';
import { getSystemPrompt } from '../system-prompt.js';
import { loadConfig } from '../config.js';
import { createSession, addMessage, getMessages, getLastSession } from '../session/store.js';
import { needsCompaction, compact, engramRetrieve, engramStore } from './context.js';
import * as renderer from '../tui/renderer.js';

export interface AgentOpts {
  prompt?: string;
  resume?: boolean;
  model?: string;
  provider?: string;
  oneShot?: boolean;
}

export async function agentLoop(opts: AgentOpts): Promise<void> {
  const config = loadConfig();
  const providerName = opts.provider || config.provider;
  const modelName = opts.model || config.model || undefined;
  const provider = getProvider(providerName, modelName);

  renderer.info(`Using ${provider.name} / ${provider.model}`);

  // 1. Load or create session
  let sessionId: string;
  let messages: Message[] = [];

  if (opts.resume) {
    const last = getLastSession();
    if (last) {
      sessionId = last.id;
      messages = getMessages(sessionId);
      renderer.info(`Resumed session: ${last.title}`);
    } else {
      sessionId = createSession();
      renderer.info('No previous session found, starting new.');
    }
  } else {
    sessionId = createSession();
  }

  // If one-shot with prompt
  if (opts.prompt) {
    messages.push({ role: 'user', content: [{ type: 'text', text: opts.prompt }] });
    addMessage(sessionId, 'user', [{ type: 'text', text: opts.prompt }]);
  } else if (messages.length === 0) {
    // Interactive: get first prompt
    const input = await renderer.userPrompt();
    if (!input.trim()) {
      renderer.info('Goodbye!');
      return;
    }
    messages.push({ role: 'user', content: [{ type: 'text', text: input }] });
    addMessage(sessionId, 'user', [{ type: 'text', text: input }]);
  }

  // Stall detection state
  const toolCallHistory: Array<{ name: string; args: string }> = [];

  // Main loop
  while (true) {
    // 2. Engram context injection
    let system = getSystemPrompt();
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === 'user') {
      const userText = lastUserMsg.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join(' ');

      if (userText) {
        const engramContext = await engramRetrieve(userText);
        if (engramContext.trim()) {
          system += `\n\nRelevant context from memory:\n${engramContext}`;
        }
      }
    }

    // Context compaction
    if (needsCompaction(messages)) {
      messages = compact(messages);
      renderer.warn('Context compacted to fit window.');
    }

    // 3. Stream LLM response
    const spin = renderer.spinner();
    const assistantBlocks: ContentBlock[] = [];
    let currentToolId = '';
    let currentToolName = '';
    let currentToolInput = '';
    let hasToolUse = false;
    let textBuffer = '';

    try {
      for await (const event of provider.stream(messages, system, TOOLS)) {
        if (event.type === 'text_delta') {
          spin.stop();
          renderer.streamText(event.text);
          textBuffer += event.text;
        } else if (event.type === 'tool_use_start') {
          spin.stop();
          hasToolUse = true;
          currentToolId = event.id;
          currentToolName = event.name;
          currentToolInput = '';

          // Flush text buffer as a block
          if (textBuffer) {
            assistantBlocks.push({ type: 'text', text: textBuffer });
            textBuffer = '';
          }
        } else if (event.type === 'tool_use_delta') {
          currentToolInput += event.input_json;
        } else if (event.type === 'tool_use_end') {
          if (currentToolName) {
            let parsedInput: any = {};
            try { parsedInput = JSON.parse(currentToolInput); } catch {}
            assistantBlocks.push({
              type: 'tool_use',
              id: currentToolId,
              name: currentToolName,
              input: parsedInput,
            });
            renderer.toolStart(currentToolName, parsedInput);
            currentToolName = '';
          }
        } else if (event.type === 'message_end') {
          // Flush remaining text
          if (textBuffer) {
            assistantBlocks.push({ type: 'text', text: textBuffer });
            textBuffer = '';
          }
        } else if (event.type === 'error') {
          spin.stop();
          renderer.error(event.error);
          return;
        }
      }
    } catch (err: any) {
      spin.stop();
      renderer.error(`Provider error: ${err.message}`);
      return;
    }

    renderer.stopSpinner();
    renderer.newLine();

    // Flush any remaining text
    if (textBuffer) {
      assistantBlocks.push({ type: 'text', text: textBuffer });
    }

    // Save assistant message
    if (assistantBlocks.length > 0) {
      messages.push({ role: 'assistant', content: assistantBlocks });
      addMessage(sessionId, 'assistant', assistantBlocks);
    }

    // 4. Execute tools
    if (hasToolUse) {
      const toolResults: ContentBlock[] = [];

      for (const block of assistantBlocks) {
        if (block.type !== 'tool_use') continue;

        // 6. Stall detection
        const callSig = JSON.stringify({ name: block.name, args: block.input });
        toolCallHistory.push({ name: block.name, args: JSON.stringify(block.input) });
        const recentSame = toolCallHistory.slice(-3).filter(t => t.name === block.name && t.args === JSON.stringify(block.input));
        if (recentSame.length >= 3) {
          renderer.warn('Stall detected: same tool called 3x with same args. Injecting nudge.');
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'STALL DETECTED: You have called this tool 3 times with identical arguments. Try a different approach or use a different tool.',
            is_error: true,
          });
          continue;
        }

        // 7. Handle finish tool
        if (block.name === 'finish') {
          const result = await executeTool('finish', block.input);
          renderer.toolResult(result.content);

          // Auto-learn
          if (block.input?.learnings) {
            for (const learning of block.input.learnings) {
              await engramStore(learning);
            }
          }

          if (opts.oneShot) return;

          // In interactive mode, continue after finish
          renderer.info('Task marked complete.');
          const nextInput = await renderer.userPrompt();
          if (!nextInput.trim()) return;
          messages.push({ role: 'user', content: [{ type: 'text', text: nextInput }] });
          addMessage(sessionId, 'user', [{ type: 'text', text: nextInput }]);
          continue;
        }

        // Execute the tool
        const result = await executeTool(block.name, block.input);
        renderer.toolResult(result.content, result.is_error);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result.content,
          is_error: result.is_error,
        });
      }

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
        addMessage(sessionId, 'user', toolResults);
      }

      // Continue the loop to get next LLM response
      continue;
    }

    // 5. No tool use: wait for next user input
    if (opts.oneShot) return;

    const userInput = await renderer.userPrompt();
    if (!userInput.trim()) {
      // Empty input in interactive mode - exit gracefully
      renderer.info('Goodbye!');
      return;
    }

    messages.push({ role: 'user', content: [{ type: 'text', text: userInput }] });
    addMessage(sessionId, 'user', [{ type: 'text', text: userInput }]);
  }
}
