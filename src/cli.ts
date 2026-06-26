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

async function testBedrockConnection(): Promise<{ ok: boolean; model: string; error?: string }> {
  // Make a real minimal API call to verify credentials work
  const model = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
  try {
    const region = process.env.AWS_REGION || 'us-east-1';
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const client = new BedrockRuntimeClient({ region });
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ping' }],
    });
    await client.send(new InvokeModelCommand({ modelId: model, body, contentType: 'application/json', accept: 'application/json' }));
    return { ok: true, model };
  } catch (err: any) {
    return { ok: false, model, error: err.message?.split('\n')[0] };
  }
}

function checkEngramInstalled(): { installed: boolean; path: string } {
  const engramPath = join(homedir(), 'bin', 'engram');
  return { installed: existsSync(engramPath), path: engramPath };
}

async function handleInit(): Promise<void> {
  const c = {
    reset: '\x1b[0m',
    bold:  '\x1b[1m',
    cyan:  '\x1b[36m',
    green: '\x1b[32m',
    red:   '\x1b[31m',
    yellow:'\x1b[33m',
    dim:   '\x1b[2m',
  };

  console.log(`\n${c.bold}grain init${c.reset}\n`);

  // ── Check existing config ────────────────────────────────────────────────
  const configPath = join(getConfigDir(), 'config.json');
  if (existsSync(configPath)) {
    const current = loadConfig();
    console.log(`Config found at ~/.grain/config.json`);
    console.log(`  provider:   ${current.provider}`);
    console.log(`  model:      ${current.model ?? 'auto'}`);
    console.log(`  engram_db:  ${current.engram_db}\n`);
    const reconfigure = await ask('Reconfigure? [y/N] ');
    if (reconfigure.toLowerCase() !== 'y') {
      console.log('Keeping existing config.');
      process.exit(0);
    }
    console.log();
  }

  // ── Detect providers ─────────────────────────────────────────────────────
  console.log('Detecting providers...\n');
  const available: Array<{ name: string; label: string }> = [];

  const hasAWSRegion  = !!process.env.AWS_REGION;
  const hasAWSProfile = !!process.env.AWS_PROFILE;
  const hasAWSKey     = !!process.env.AWS_ACCESS_KEY_ID;
  if (hasAWSRegion || hasAWSProfile || hasAWSKey) {
    const hint = hasAWSProfile ? `profile=${process.env.AWS_PROFILE}` : hasAWSKey ? 'key detected' : `region=${process.env.AWS_REGION}`;
    available.push({ name: 'bedrock', label: `bedrock   (${hint})` });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    available.push({ name: 'anthropic', label: 'anthropic (ANTHROPIC_API_KEY set)' });
  }
  if (process.env.OPENROUTER_API_KEY) {
    available.push({ name: 'openrouter', label: 'openrouter (OPENROUTER_API_KEY set)' });
  }
  available.push({ name: 'ollama', label: 'ollama    (local, no key needed)' });

  available.forEach((p, i) => console.log(`  ${i + 1}. ${p.label}`));
  console.log();

  // ── Pick provider ────────────────────────────────────────────────────────
  const defaultIdx = 0;
  const choice = await ask(`Provider [1-${available.length}, default=${available[defaultIdx].name}]: `);
  let provider = available[defaultIdx].name;
  const choiceNum = parseInt(choice, 10);
  if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= available.length) {
    provider = available[choiceNum - 1].name;
  } else if (choice.trim()) {
    const match = available.find(p => p.name.startsWith(choice.toLowerCase()));
    if (match) provider = match.name;
  }

  console.log(`\nProvider: ${c.bold}${provider}${c.reset}\n`);

  // ── Test connection ───────────────────────────────────────────────────────
  if (provider === 'bedrock') {
    process.stdout.write('Testing Bedrock connection... ');
    const result = await testBedrockConnection();
    if (result.ok) {
      console.log(`${c.green}ok${c.reset} (${result.model})`);
    } else {
      console.log(`${c.red}failed${c.reset}`);
      console.log(`  ${c.dim}${result.error}${c.reset}`);
      console.log('\nCheck your AWS credentials (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
      console.log('or run: aws configure\n');
      const proceed = await ask('Continue anyway? [y/N] ');
      if (proceed.toLowerCase() !== 'y') process.exit(1);
    }
  } else if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    const key = await ask('ANTHROPIC_API_KEY: ');
    if (!key.trim()) { console.log('No key provided. Exiting.'); process.exit(1); }
    console.log(`\nAdd to your shell profile:\n  export ANTHROPIC_API_KEY=${key}\n`);
  }

  // ── Save config ──────────────────────────────────────────────────────────
  const config = { provider, model: null, engram_db: '~/.engram/knowledge', max_tokens: 180000 };
  saveConfig(config);
  console.log(`\nConfig saved to ~/.grain/config.json`);

  // ── Set up skills dir ─────────────────────────────────────────────────────
  const skillsDir = join(homedir(), '.grain', 'skills');
  if (!existsSync(skillsDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(skillsDir, { recursive: true });
    console.log('Created ~/.grain/skills/');
  }

  // ── Check engram ──────────────────────────────────────────────────────────
  const engram = checkEngramInstalled();
  console.log();
  if (engram.installed) {
    console.log(`engram: ${c.green}installed${c.reset} (${engram.path})`);
    // Start the HTTP server in the background if not already running
    const { execSync } = await import('child_process');
    try {
      execSync('curl -sf http://localhost:7474/health > /dev/null 2>&1');
      console.log(`engram server: ${c.green}already running${c.reset} (http://localhost:7474)`);
    } catch {
      try {
        execSync(`nohup ${engram.path} -d ~/.engram/knowledge serve > /tmp/engram.log 2>&1 &`);
        await new Promise(r => setTimeout(r, 800));
        try {
          execSync('curl -sf http://localhost:7474/health > /dev/null 2>&1');
          console.log(`engram server: ${c.green}started${c.reset} (http://localhost:7474)`);
        } catch {
          console.log(`engram server: ${c.yellow}starting${c.reset} (check /tmp/engram.log if issues)`);
        }
      } catch {
        console.log(`engram server: ${c.yellow}could not start${c.reset} — run manually: engram serve`);
      }
    }
  } else {
    console.log(`engram: ${c.yellow}not found${c.reset} at ~/bin/engram`);
    console.log(`  Build it: cd ~/engram && cargo build --release && cp target/release/engram ~/bin/`);
    console.log(`  grain works without it but won't have persistent memory across sessions.`);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}Ready.${c.reset}\n`);
  console.log('Quick start:');
  console.log(`  ${c.cyan}grain "explain this codebase"${c.reset}`);
  console.log(`  ${c.cyan}grain --yes "add tests for src/auth.ts"${c.reset}`);
  console.log(`  ${c.cyan}grain "build a dark site for my SaaS"${c.reset}`);
  console.log();
  console.log(`Config:  ~/.grain/config.json`);
  console.log(`Skills:  ~/.grain/skills/`);
  console.log(`Logs:    ~/.grain/sessions/`);
  console.log();
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
