// Enhanced agent loop with multi-phase execution
import type { Message, ContentBlock } from '../providers/types.js';
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
  autoApprove?: boolean; // NEW: skip plan approval
}

interface PlanStep {
  id: number;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  tool?: string;
  error?: string;
}

export async function agentLoop(opts: AgentOpts): Promise<void> {
  const config = loadConfig();
  const providerName = opts.provider || config.provider;
  const modelName = opts.model || config.model || undefined;
  const provider = getProvider(providerName, modelName);

  renderer.info(`Using ${provider.name} / ${provider.model}`);

  // Session management
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

  // Initial prompt
  if (opts.prompt) {
    messages.push({ role: 'user', content: [{ type: 'text', text: opts.prompt }] });
    addMessage(sessionId, 'user', [{ type: 'text', text: opts.prompt }]);
  } else if (messages.length === 0) {
    const input = await renderer.userPrompt();
    if (!input.trim()) {
      // Empty input in initial prompt - just wait, don't exit
      renderer.info('Type a command to get started, or Ctrl+C to exit.');
      return agentLoop(opts); // Re-prompt
    }
    messages.push({ role: 'user', content: [{ type: 'text', text: input }] });
    addMessage(sessionId, 'user', [{ type: 'text', text: input }]);
  }

  // Main execution loop
  while (true) {
    // === PHASE 1: UNDERSTAND ===
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

    // === PHASE 2: PLAN ===
    const spin = renderer.spinner('Planning...');
    let plan: PlanStep[] | null = null;
    
    // Ask LLM to create a plan first
    const planningSystem = system + `\n\nBefore executing, create a brief step-by-step plan.
Start your response with:
PLAN:
1. [step]
2. [step]
...

Then proceed with execution.`;

    const assistantBlocks: ContentBlock[] = [];
    let currentToolId = '';
    let currentToolName = '';
    let currentToolInput = '';
    let hasToolUse = false;
    let textBuffer = '';
    let spinnerStopped = false;
    let planText = '';

    try {
      for await (const event of provider.stream(messages, planningSystem, TOOLS)) {
        if (event.type === 'text_delta') {
          if (!spinnerStopped) {
            spin.stop();
            renderer.clearLine();
            spinnerStopped = true;
          }
          textBuffer += event.text;
          renderer.stream(event.text);
          
          // Extract plan if present
          if (textBuffer.includes('PLAN:') && !plan) {
            planText += event.text;
          }
        } else if (event.type === 'tool_use_start') {
          hasToolUse = true;
          currentToolId = event.id;
          currentToolName = event.name;
          currentToolInput = '';
          
          const block: ContentBlock = {
            type: 'tool_use',
            id: event.id,
            name: event.name,
            input: {},
          };
          assistantBlocks.push(block);
          
          if (!spinnerStopped) {
            spin.stop();
            renderer.clearLine();
            spinnerStopped = true;
          }
          renderer.tool(event.name, {});
        } else if (event.type === 'tool_use_delta') {
          const block = assistantBlocks.find(b => b.type === 'tool_use' && b.id === event.id) as any;
          if (block) {
            block.input = { ...(block.input || {}), ...event.input };
          }
        }
      }

      if (!spinnerStopped) {
        spin.stop();
      }
      renderer.newLine();

      // Parse plan from text if found
      if (planText) {
        plan = parsePlanFromText(planText);
        if (plan && plan.length > 0) {
          renderer.newLine();
          renderer.info('📋 Execution Plan:');
          plan.forEach((step, i) => {
            renderer.info(`  ${i + 1}. ${step.description}`);
          });
          renderer.newLine();
          
          // === PHASE 3: APPROVAL ===
          if (!opts.autoApprove && !opts.oneShot) {
            const approval = await renderer.userPrompt('Proceed with this plan? [Y/n] ');
            if (approval.toLowerCase() === 'n') {
              renderer.info('Plan rejected. What would you like to do instead?');
              const newInput = await renderer.userPrompt();
              if (newInput.trim()) {
                messages.push({ role: 'user', content: [{ type: 'text', text: newInput }] });
                addMessage(sessionId, 'user', [{ type: 'text', text: newInput }]);
                continue; // Start over with new request
              } else {
                break; // Exit
              }
            }
          }
        }
      }

      // === PHASE 4: EXECUTE ===
      // Tools were already called during streaming, now execute them
      const toolResults: ContentBlock[] = [];
      for (const block of assistantBlocks) {
        if (block.type === 'tool_use') {
          if (block.name === 'finish') {
            const finishMsg = block.input.message || 'Task complete.';
            renderer.success(`✓ ${finishMsg}`);
            
            // Store success pattern in engram
            await engramStore(`Completed: ${lastUserMsg?.content[0]?.type === 'text' ? lastUserMsg.content[0].text : 'task'}`, ['success']);
            
            addMessage(sessionId, 'assistant', assistantBlocks);
            
            // Done with this request
            if (opts.oneShot) {
              return;
            }
            
            // Continue interactive mode
            renderer.newLine();
            const nextInput = await renderer.userPrompt();
            if (!nextInput.trim()) {
              // Empty input - keep prompting (continuous REPL)
              continue;
            }
            messages = []; // Fresh context
            messages.push({ role: 'user', content: [{ type: 'text', text: nextInput }] });
            addMessage(sessionId, 'user', [{ type: 'text', text: nextInput }]);
            continue;
          }

          const result = await executeTool(block.name, block.input);
          renderer.result(result);
          
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({
        role: 'assistant',
        content: assistantBlocks,
      });

      if (toolResults.length > 0) {
        messages.push({
          role: 'user',
          content: toolResults,
        });
        addMessage(sessionId, 'assistant', assistantBlocks);
        addMessage(sessionId, 'user', toolResults);
      } else {
        addMessage(sessionId, 'assistant', assistantBlocks);
        
        if (opts.oneShot) {
          return;
        }
        
        // No tools used, agent gave a text response - continue conversation
        renderer.newLine();
        const nextInput = await renderer.userPrompt();
        if (!nextInput.trim()) {
          continue; // Empty - keep prompting
        }
        messages.push({ role: 'user', content: [{ type: 'text', text: nextInput }] });
        addMessage(sessionId, 'user', [{ type: 'text', text: nextInput }]);
      }

      // === PHASE 5: VERIFY ===
      // Simple verification: if tools succeeded and no errors, we're good
      // More sophisticated verification can be added later

    } catch (err: any) {
      if (!spinnerStopped) {
        spin.stop();
      }
      renderer.error(err.message);
      
      // Store error pattern
      await engramStore(`Error: ${err.message}`, ['error', 'failure']);
      
      if (opts.oneShot) {
        throw err;
      }
      
      // Continue in interactive mode
      renderer.newLine();
      const retry = await renderer.userPrompt('Try again? ');
      if (!retry.trim() || retry.toLowerCase() === 'n') {
        break;
      }
    }
  }

  renderer.info('Goodbye!');
}

function parsePlanFromText(text: string): PlanStep[] {
  const lines = text.split('\n');
  const steps: PlanStep[] = [];
  let inPlan = false;
  let stepId = 0;

  for (const line of lines) {
    if (line.toUpperCase().includes('PLAN:')) {
      inPlan = true;
      continue;
    }

    if (!inPlan) continue;

    // Match numbered steps
    const match = line.match(/^\s*(\d+)[\.\)]\s*(.+)$/);
    if (match) {
      const description = match[2].trim();
      steps.push({
        id: ++stepId,
        description,
        status: 'pending',
      });
    } else if (line.trim() && !line.match(/^\s*\d/)) {
      // End of plan
      break;
    }
  }

  return steps;
}
