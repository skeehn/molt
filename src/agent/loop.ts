// Agent loop - fluid execution with streaming, error recovery, and quality control
import type { Message, ContentBlock } from '../providers/types.js';
import { getProvider } from '../providers/index.js';
import { TOOLS, executeTool, setToolCwd, destroyShell } from '../tools/index.js';
import { classifyTaskComplexity, routeModel, explainRouting, resolveModelAlias, MODEL_CONFIGS } from '../router/index.js';
import { trackToolCall, getContextSummary } from './context-tracker.js';
import { getSystemPrompt } from '../system-prompt.js';
import { loadConfig } from '../config.js';
import { createSession, addMessage, getMessages, getLastSession } from '../session/store.js';
import { needsCompaction, compact, engramRetrieve, engramStore } from './context.js';
import * as renderer from '../tui/renderer.js';
import { getSkillManager } from '../skills/manager.js';
import type { SkillMatch } from '../skills/types.js';

export interface AgentOpts {
  prompt?: string;
  resume?: boolean;
  model?: string;
  provider?: string;
  oneShot?: boolean;
  autoApprove?: boolean;
  concise?: boolean;
  maxTurns?: number;  // override default MAX_TURNS (useful for benchmarking)
}

const MAX_TURNS = 30; // Safety limit to prevent infinite loops

export async function agentLoop(opts: AgentOpts): Promise<void> {
  const config = loadConfig();
  const skillManager = getSkillManager();
  await skillManager.initialize();

  // Model routing
  let providerName = opts.provider || config.provider;
  let modelName = opts.model || config.model || undefined;

  // Resolve alias (e.g. 'sonnet' → 'us.anthropic.claude-sonnet-4-6')
  if (modelName) {
    const aliasKey = resolveModelAlias(modelName);
    if (aliasKey && MODEL_CONFIGS[aliasKey]) {
      const mc = MODEL_CONFIGS[aliasKey];
      providerName = mc.provider;
      modelName = mc.model;
      renderer.info(`🧠 Forced model → ${mc.label}`);
    }
  }

  if (!opts.model && !opts.provider && opts.prompt) {
    const complexity = classifyTaskComplexity(opts.prompt);
    const modelConfig = routeModel(complexity);
    providerName = modelConfig.provider;
    modelName = modelConfig.model;
    renderer.info(`🧠 ${explainRouting(complexity, modelConfig)}`);
  }

  const provider = getProvider(providerName, modelName);
  renderer.info(`Using ${provider.name} / ${provider.model}`);

  // Session management
  let sessionId: string;
  let messages: Message[] = [];

  // Init persistent shell cwd to wherever grain was invoked
  setToolCwd(process.cwd());

  if (opts.resume) {
    const last = await getLastSession();
    if (last) {
      sessionId = last;
      messages = await getMessages(sessionId);
      renderer.info('Resumed session');
    } else {
      sessionId = await createSession();
    }
  } else {
    sessionId = await createSession();
  }

  // Get initial prompt
  if (opts.prompt) {
    messages.push({ role: 'user', content: [{ type: 'text', text: opts.prompt }] });
    await addMessage(sessionId, 'user', [{ type: 'text', text: opts.prompt }]);
  } else if (messages.length === 0) {
    const input = await renderer.userPrompt();
    if (!input.trim()) {
      renderer.info('Type a command to get started, or Ctrl+C to exit.');
      return agentLoop(opts);
    }
    messages.push({ role: 'user', content: [{ type: 'text', text: input }] });
    addMessage(sessionId, 'user', [{ type: 'text', text: input }]);
  }

  // Main agent loop - fluid execution
  let turnCount = 0;
  const turnLimit = opts.maxTurns ?? MAX_TURNS;

  while (turnCount < turnLimit) {
    turnCount++;

    // Build system prompt with context + skills
    let system = getSystemPrompt(opts.concise);

    const contextSummary = getContextSummary();
    if (contextSummary) {
      system += `\n\n## Session Context\n${contextSummary}`;
    }

    // ── Markdown skills: inject once at turn 1 as permanent context ──────────
    if (turnCount === 1) {
      const mdContext = await skillManager.getMarkdownContext();
      if (mdContext) {
        system += `\n\n${mdContext}`;
        const mdCount = (await skillManager.listMarkdownSkills()).length;
        renderer.info(`💡 Skills: ${mdCount} loaded`);
      }
    }

    // ── JSON skills: keyword-matched at turn 1 ────────────────────────────────
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user' && m.content.some(b => b.type === 'text'));
    let matchedSkills: SkillMatch[] = [];

    if (lastUserMsg) {
      const userText = lastUserMsg.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join(' ');

      if (userText && turnCount === 1) {
        matchedSkills = await skillManager.matchSkills(userText, 0.6);

        if (matchedSkills.length > 0) {
          system += `\n\n## Relevant Learned Patterns\n`;
          for (const match of matchedSkills.slice(0, 3)) {
            system += `### ${match.skill.name} (${(match.confidence * 100).toFixed(0)}% match)\n`;
            system += `${match.skill.description}\n\n`;
            system += `**Approach:**\n${match.skill.approach}\n\n`;
            if (match.skill.code && match.skill.code.length > 0) {
              system += `**Code patterns:**\n\`\`\`\n${match.skill.code.join('\n')}\n\`\`\`\n\n`;
            }
          }
        }

        // Engram context
        const engramContext = await engramRetrieve(userText);
        if (engramContext.trim()) {
          system += `\n\nRelevant context from memory:\n${engramContext}`;
        }
      }
    }

    // Context compaction
    if (needsCompaction(messages)) {
      messages = compact(messages);
      renderer.warn('Context compacted.');
    }

    // Stream LLM response
    const spin = renderer.spinner('Thinking...');
    const assistantBlocks: ContentBlock[] = [];
    let currentToolId = '';
    let currentToolInputJson = '';
    const toolInputJsonMap = new Map<string, string>();
    let hasToolUse = false;
    let textBuffer = '';
    let spinnerStopped = false;

    try {
      const STREAM_TIMEOUT = 90000; // 90s inactivity (large files take time)
      let lastEventTime = Date.now();
      let timedOut = false;

      const streamTimeout = setInterval(() => {
        if (Date.now() - lastEventTime > STREAM_TIMEOUT) {
          clearInterval(streamTimeout);
          timedOut = true;
        }
      }, 5000);

      for await (const event of provider.stream(messages, system, TOOLS)) {
        if (timedOut) break;
        lastEventTime = Date.now();
        if (event.type === 'text_delta') {
          if (!spinnerStopped) { spin.stop(); renderer.clearLine(); spinnerStopped = true; }
          textBuffer += event.text;
          renderer.stream(event.text);
        } else if (event.type === 'tool_use_start') {
          hasToolUse = true;
          currentToolId = event.id;
          currentToolInputJson = '';
          toolInputJsonMap.set(event.id, '');
          assistantBlocks.push({
            type: 'tool_use',
            id: event.id,
            name: event.name,
            input: {},
          });
          if (!spinnerStopped) { spin.stop(); renderer.clearLine(); spinnerStopped = true; }
          renderer.tool(event.name, { _streaming: true });
        } else if (event.type === 'tool_use_delta') {
          currentToolInputJson += event.input_json;
          toolInputJsonMap.set(currentToolId, currentToolInputJson);
          lastEventTime = Date.now(); // reset timer during large file writes
        } else if (event.type === 'tool_use_end') {
          const jsonStr = toolInputJsonMap.get(currentToolId) || currentToolInputJson;
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr);
              const block = assistantBlocks.find(b => b.type === 'tool_use' && b.id === currentToolId) as any;
              if (block) {
                block.input = parsed;
                // Overwrite the "⚡ write..." line with full details now that we have input
                const summary = block.name === 'write' && parsed.path
                  ? `${parsed.path} (${parsed.content ? Buffer.byteLength(parsed.content, 'utf8') : 0} bytes)`
                  : block.name === 'bash' ? (parsed.command?.slice(0, 80) || '')
                  : block.name === 'read' ? (parsed.path || '')
                  : block.name === 'patch' ? (parsed.path || '')
                  : '';
                if (summary) {
                  renderer.dim(`  → ${summary}`);
                }
              }
            } catch (err) {
              renderer.warn(`Failed to parse tool input: ${err}`);
            }
          }
        }
      }

      if (timedOut) {
        renderer.warn('LLM stream timed out (90s no activity). Model may be overloaded — try again.');
      }

      if (!spinnerStopped) spin.stop();
      clearInterval(streamTimeout);
      if (textBuffer) {
        assistantBlocks.unshift({ type: 'text', text: textBuffer });
      }
      renderer.newLine();

      // If no tool calls, this is a final text response
      if (!hasToolUse) {
        messages.push({ role: 'assistant', content: assistantBlocks });
        addMessage(sessionId, 'assistant', assistantBlocks);

        if (opts.oneShot) return;

        // Interactive: wait for next input
        renderer.newLine();
        const nextInput = await renderer.userPrompt();
        if (!nextInput.trim()) continue;
        messages.push({ role: 'user', content: [{ type: 'text', text: nextInput }] });
        addMessage(sessionId, 'user', [{ type: 'text', text: nextInput }]);
        turnCount = 0; // Reset turn counter for new user request
        continue;
      }

      // Execute tools
      const toolResults: ContentBlock[] = [];
      let finishCalled = false;

      for (const block of assistantBlocks) {
        if (block.type !== 'tool_use') continue;

        if (block.name === 'finish') {
          const msg = block.input?.message || 'Task complete.';
          renderer.success(`✓ ${msg}`);
          finishCalled = true;

          // Record skill success
          if (matchedSkills.length > 0) {
            const topSkill = matchedSkills[0];
            await skillManager.recordExecution(topSkill.skill.id, true, {
              problem: opts.prompt || 'task',
              execution: assistantBlocks.filter(b => b.type === 'tool_use').map((b: any) => b.name).join(' → '),
              outcome: msg,
            });
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: msg,
            is_error: false,
          });
          break;
        }

        // Execute the tool
        const result = await executeTool(block.name, block.input);
        trackToolCall(block.name, block.input, result);

        const resultContent = typeof result.content === 'string'
          ? result.content
          : JSON.stringify(result.content);

        // Show result (truncated for display)
        const displayContent = resultContent.length > 500
          ? resultContent.slice(0, 500) + `\n... (${resultContent.length} chars total)`
          : resultContent;
        renderer.result(displayContent, result.is_error);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: resultContent,
          is_error: result.is_error,
        });
      }

      // Push messages
      messages.push({ role: 'assistant', content: assistantBlocks });
      addMessage(sessionId, 'assistant', assistantBlocks);

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
        addMessage(sessionId, 'user', toolResults);
      }

      // If finish was called, handle exit or next input
      if (finishCalled) {
        destroyShell(); // clean up persistent bash session
        if (opts.oneShot) return;

        renderer.newLine();
        const nextInput = await renderer.userPrompt();
        if (!nextInput.trim()) continue;
        messages = []; // Fresh context for new task
        messages.push({ role: 'user', content: [{ type: 'text', text: nextInput }] });
        addMessage(sessionId, 'user', [{ type: 'text', text: nextInput }]);
        turnCount = 0;
        continue;
      }

      // Otherwise, loop back to LLM with tool results (fluid execution)
      // The LLM will decide: more tools? done? ask user?

    } catch (err: any) {
      if (!spinnerStopped) spin.stop();
      renderer.error(err.message);
      await engramStore(`Error: ${err.message}`, ['error']);
      destroyShell();

      if (opts.oneShot) {
        // Don't crash — log what happened and exit immediately
        const isQuota = /429|quota|rate.?limit|throttl/i.test(err.message);
        const isAuthz = /403|AccessDenied|not available|forbidden/i.test(err.message);
        if (isQuota) {
          renderer.warn('Rate limit hit. Partial work saved to session. Run again to continue.');
        } else if (isAuthz) {
          renderer.warn(`Provider error: ${err.message}`);
        } else {
          renderer.warn(`Task stopped due to error: ${err.message}`);
        }
        process.exit(1); // hard exit — persistent shell would hang otherwise
      }

      renderer.newLine();
      const retry = await renderer.userPrompt('Try again? ');
      if (!retry.trim() || retry.toLowerCase() === 'n') break;
      turnCount = 0;
    }
  }

  if (turnCount >= turnLimit) {
    renderer.warn(`Reached ${turnLimit} turn limit. Use a more specific prompt or break into smaller tasks.`);
  }

  renderer.info('Goodbye!');
  // Force exit — persistent shell and other async handles keep the process alive otherwise
  process.exit(0);
}
