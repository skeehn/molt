// Simplified orchestrator - start with working version, then enhance
import { agentLoop } from './loop.js';

export interface OrchestratorOpts {
  prompt?: string;
  autoApprove?: boolean;
  model?: string;
  provider?: string;
}

export async function orchestrate(opts: OrchestratorOpts): Promise<void> {
  // For now, just use the old loop but plan to migrate to Ink later
  // This keeps molt working while we build out the new features
  
  await agentLoop({
    prompt: opts.prompt,
    resume: false,
    model: opts.model,
    provider: opts.provider,
    oneShot: !!opts.prompt,
  });
}
