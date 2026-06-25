#!/usr/bin/env node
import { orchestrate } from './agent/orchestrator.js';
import { loadConfig, saveConfig } from './config.js';
import * as renderer from './tui/renderer.js';

interface ParsedArgs {
  prompt?: string;
  autoApprove: boolean;
  concise: boolean;
  model?: string;
  provider?: string;
  command?: string;
  configArgs?: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip bun/node and script path
  const result: ParsedArgs = { autoApprove: false, concise: false };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-p' || arg === '--prompt') {
      result.prompt = args[++i];
    } else if (arg === '-y' || arg === '--yes' || arg === '--auto-approve') {
      result.autoApprove = true;
    } else if (arg === '--concise' || arg === '-c') {
      result.concise = true;
    } else if (arg === '--model') {
      result.model = args[++i];
    } else if (arg === '--provider') {
      result.provider = args[++i];
    } else if (arg === 'config') {
      result.command = 'config';
      result.configArgs = args.slice(i + 1);
      break;
    } else if (!arg.startsWith('-') && !result.prompt) {
      // Treat as inline prompt if no flag
      result.prompt = args.slice(i).join(' ');
      break;
    }
    i++;
  }

  return result;
}

function handleConfig(configArgs: string[]): void {
  const config = loadConfig();

  if (configArgs.length === 0) {
    // Show current config
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (configArgs.length === 2) {
    const [key, value] = configArgs;
    if (key === 'provider' || key === 'model' || key === 'engram_db') {
      saveConfig({ [key]: value } as any);
      console.log(`Set ${key} = ${value}`);
    } else if (key === 'max_tokens') {
      saveConfig({ max_tokens: parseInt(value, 10) });
      console.log(`Set max_tokens = ${value}`);
    } else {
      renderer.error(`Unknown config key: ${key}`);
    }
  } else {
    renderer.error('Usage: molt config [key value]');
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  if (parsed.command === 'config') {
    handleConfig(parsed.configArgs || []);
    return;
  }

  try {
    await orchestrate({
      prompt: parsed.prompt,
      autoApprove: parsed.autoApprove,
      concise: parsed.concise,
      model: parsed.model,
      provider: parsed.provider,
    });
  } catch (err: any) {
    if (err.message === 'SIGINT') {
      renderer.newLine();
      renderer.info('Goodbye.');
    } else {
      renderer.error(err.message);
      process.exit(1);
    }
  }
}

main();
