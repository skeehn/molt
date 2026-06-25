#!/usr/bin/env node
import { orchestrate } from './agent/orchestrator.js';
import { loadConfig, saveConfig, getConfigDir, validateConfig } from './config.js';
import * as renderer from './tui/renderer.js';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as readline from 'readline';

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
    } else if (arg === 'init') {
      result.command = 'init';
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
      const newConfig = loadConfig();
      (newConfig as any)[key] = value;
      saveConfig(newConfig);
      console.log(`Set ${key} = ${value}`);
    } else if (key === 'max_tokens') {
      const newConfig = loadConfig();
      newConfig.max_tokens = parseInt(value, 10);
      saveConfig(newConfig);
      console.log(`Set max_tokens = ${value}`);
    } else {
      renderer.error(`Unknown config key: ${key}`);
    }
  } else {
    renderer.error('Usage: grain config [key value]');
  }
}

function checkEnvVar(varName: string): boolean {
  return !!process.env[varName];
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function handleInit(): Promise<void> {
  console.log('🌾 Welcome to grain!\n');
  console.log('Let\'s set up your configuration.\n');

  // Check for existing config
  const configPath = join(getConfigDir(), 'config.json');
  if (existsSync(configPath)) {
    console.log('✅ Config already exists at ~/.grain/config.json\n');
    const current = loadConfig();
    console.log('Current config:');
    console.log(JSON.stringify(current, null, 2));
    console.log();
    const reconfigure = await ask('Reconfigure? (y/n): ');
    if (reconfigure.toLowerCase() !== 'y') {
      console.log('\nKeeping existing config.');
      return;
    }
    console.log();
  }

  // Detect available providers
  console.log('Detecting available providers...\n');
  const available: Array<{name: string, display: string}> = [];
  
  if (checkEnvVar('AWS_REGION')) {
    available.push({name: 'bedrock', display: 'bedrock (AWS_REGION detected)'});
  }
  if (checkEnvVar('ANTHROPIC_API_KEY')) {
    available.push({name: 'anthropic', display: 'anthropic (ANTHROPIC_API_KEY detected)'});
  }
  if (checkEnvVar('OPENROUTER_API_KEY')) {
    available.push({name: 'openrouter', display: 'openrouter (OPENROUTER_API_KEY detected)'});
  }
  available.push({name: 'ollama', display: 'ollama (local, no API key needed)'});

  console.log('Available providers:');
  available.forEach((p, i) => console.log(`  ${i + 1}. ${p.display}`));
  console.log();

  const choice = await ask('Select provider (1-4, or name): ');
  
  let provider = '';
  const choiceNum = parseInt(choice, 10);
  if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= available.length) {
    provider = available[choiceNum - 1].name;
  } else if (choice.toLowerCase().startsWith('bed')) {
    provider = 'bedrock';
  } else if (choice.toLowerCase().startsWith('ant')) {
    provider = 'anthropic';
  } else if (choice.toLowerCase().startsWith('open')) {
    provider = 'openrouter';
  } else if (choice.toLowerCase().startsWith('olla')) {
    provider = 'ollama';
  } else {
    console.log(`\nUnknown provider: ${choice}`);
    console.log(`Using default: ${available[0].name}\n`);
    provider = available[0].name;
  }

  // Create config
  const config = {
    provider,
    model: null,
    engram_db: '~/.engram/knowledge',
    max_tokens: 180000,
  };

  // Validate
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.log(`\n❌ Validation failed:`);
    console.log(validation.error);
    console.log('\nPlease set the required environment variables and run "grain init" again.');
    process.exit(1);
  }

  // Save config
  saveConfig(config);
  console.log('\n✅ Config saved to ~/.grain/config.json');
  console.log(JSON.stringify(config, null, 2));
  
  // Test connection (simple check)
  console.log('\n🧪 Testing connection...');
  try {
    const testConfig = loadConfig();
    console.log(`✅ Provider "${testConfig.provider}" configured successfully!`);
  } catch (err: any) {
    console.log(`❌ Test failed: ${err.message}`);
  }

  console.log('\n🎉 Setup complete!\n');
  console.log('Try these commands:');
  console.log('  grain "analyze this project"');
  console.log('  grain "explain architecture"');
  console.log('  grain --help');
  console.log('\nTips:');
  console.log('  - grain learns from every project');
  console.log('  - Use --concise for terse output');
  console.log('  - Skills auto-suggest with 💡');
  console.log('\nConfig: ~/.grain/config.json');
  console.log('Skills: ~/.grain/skills/\n');
}

function showWelcomeMessage(): void {
  const firstRunPath = join(getConfigDir(), '.first-run');
  
  if (existsSync(firstRunPath)) {
    return; // Already shown welcome
  }

  console.log('🌾 Welcome to grain!\n');
  console.log('grain is a self-improving AI coding agent.\n');
  console.log('Try:');
  console.log('  grain "analyze this project"');
  console.log('  grain "explain architecture"');
  console.log('  grain --help');
  console.log('\nTips:');
  console.log('  - grain learns from every project');
  console.log('  - Use --concise for terse output');
  console.log('  - Skills auto-suggest with 💡');
  console.log('\nConfig: ~/.grain/config.json');
  console.log('Skills: ~/.grain/skills/');
  console.log('\nRun "grain init" to configure providers.\n');

  // Mark as shown
  try {
    writeFileSync(firstRunPath, new Date().toISOString());
  } catch {
    // Ignore errors
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  if (parsed.command === 'config') {
    handleConfig(parsed.configArgs || []);
    return;
  }

  if (parsed.command === 'init') {
    await handleInit();
    return;
  }

  // Show welcome message on first run
  if (!parsed.prompt && !parsed.command) {
    showWelcomeMessage();
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

main().catch((err) => {
  renderer.error(err.message);
  process.exit(1);
});
