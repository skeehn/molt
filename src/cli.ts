#!/usr/bin/env node
import { orchestrate } from './agent/orchestrator.js';
import {
  loadConfig, saveConfig, getConfigDir, validateConfig,
  loadGrainEnv, saveKeyToEnv, listEnvKeys, GRAIN_VERSION, VALID_PROVIDERS,
} from './config.js';
import * as renderer from './tui/renderer.js';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import * as readline from 'readline';
import { spawn, execSync } from 'child_process';

// ─── Load ~/.grain/.env before anything else ──────────────────────────────────
loadGrainEnv();

// ─── ANSI helpers (no chalk import needed in cli.ts) ─────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  white:  '\x1b[37m',
};
const ok   = `${c.green}✓${c.reset}`;
const warn = `${c.yellow}!${c.reset}`;
const err  = `${c.red}✗${c.reset}`;
const dim  = (s: string) => `${c.dim}${s}${c.reset}`;
const bold = (s: string) => `${c.bold}${s}${c.reset}`;

// ─── Arg parser ───────────────────────────────────────────────────────────────

interface ParsedArgs {
  command?: 'init' | 'update' | 'config' | 'status' | 'serve' | 'help' | 'version';
  configSubcmd?: 'set' | 'reset' | 'show';
  configKey?: string;
  configValue?: string;
  prompt?: string;
  autoApprove: boolean;
  concise: boolean;
  model?: string;
  provider?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = { autoApprove: false, concise: false };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === 'init')                                   { result.command = 'init'; break; }
    if (arg === 'update')                                 { result.command = 'update'; break; }
    if (arg === 'status')                                 { result.command = 'status'; break; }
    if (arg === 'serve')                                  { result.command = 'serve'; break; }
    if (arg === '--help' || arg === '-h' || arg === 'help') { result.command = 'help'; break; }
    if (arg === '--version' || arg === '-v' || arg === 'version') { result.command = 'version'; break; }

    if (arg === 'config') {
      result.command = 'config';
      const sub = args[i + 1];
      if (sub === 'set') {
        result.configSubcmd = 'set';
        result.configKey    = args[i + 2];
        result.configValue  = args[i + 3];
      } else if (sub === 'reset') {
        result.configSubcmd = 'reset';
      } else {
        result.configSubcmd = 'show';
      }
      break;
    }

    if (arg === '-p' || arg === '--prompt')         { result.prompt = args[++i]; }
    else if (arg === '-y' || arg === '--yes')        { result.autoApprove = true; }
    else if (arg === '--concise' || arg === '-c')    { result.concise = true; }
    else if (arg === '--model')                      { result.model = args[++i]; }
    else if (arg === '--provider')                   { result.provider = args[++i]; }
    else if (!arg.startsWith('-') && !result.prompt) {
      result.prompt = args.slice(i).join(' ');
      break;
    }
    i++;
  }
  return result;
}

// ─── Interactive prompt helper ────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ─── Engram: silent background auto-start ────────────────────────────────────
// Checks :7474 with a 200ms timeout. If dead and engram binary exists,
// spawns it detached. grain never waits — continues immediately.

export async function ensureEngramRunning(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 200);
    const res = await fetch('http://localhost:7474/health', { signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) return; // already running
  } catch { /* not running */ }

  const bin = join(homedir(), 'bin', 'engram');
  if (!existsSync(bin)) return; // not installed — silent skip

  const db = join(homedir(), '.engram', 'knowledge');
  const child = spawn(bin, ['-d', db, 'serve', '--port', '7474'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref(); // grain doesn't wait for it
}

// ─── grain update ─────────────────────────────────────────────────────────────

async function handleUpdate(): Promise<void> {
  console.log(`\n${bold('grain update')}\n`);
  console.log(`Current version: ${c.cyan}v${GRAIN_VERSION}${c.reset}`);
  process.stdout.write('Checking for updates... ');

  try {
    const res = await fetch('https://api.github.com/repos/skeehn/grain/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': `grain/${GRAIN_VERSION}` },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const release: any = await res.json();
    const latest = release.tag_name?.replace(/^v/, '') ?? '';

    if (!latest) throw new Error('Could not parse release version');

    if (latest === GRAIN_VERSION) {
      console.log(`${ok} Already up to date (v${GRAIN_VERSION})\n`);
      return;
    }

    console.log(`${ok} New version available: ${c.green}v${latest}${c.reset}\n`);

    // Find asset for this platform
    const plat = platform(); // darwin | linux | win32
    const arch = process.arch; // arm64 | x64
    const assetName = `grain-${plat}-${arch}`;
    const asset = release.assets?.find((a: any) => a.name === assetName || a.name === `${assetName}.js`);

    if (!asset) {
      // No binary asset — fall back to npm / manual
      console.log(`No pre-built binary for ${plat}-${arch}.`);
      console.log(`Install manually:\n`);
      console.log(`  ${c.cyan}curl -fsSL https://raw.githubusercontent.com/skeehn/grain/main/install.sh | sh${c.reset}\n`);
      return;
    }

    const confirm = await ask(`Update to v${latest}? [Y/n] `);
    if (confirm.toLowerCase() === 'n') { console.log('Cancelled.\n'); return; }

    process.stdout.write('Downloading... ');
    const binRes = await fetch(asset.browser_download_url);
    if (!binRes.ok) throw new Error(`Download failed: ${binRes.status}`);
    const buf = await binRes.arrayBuffer();

    // Replace current binary
    const currentBin = process.execPath === process.argv[1]
      ? process.argv[1]                         // running as binary
      : join(homedir(), 'bin', 'grain');        // symlinked install

    writeFileSync(currentBin, Buffer.from(buf), { mode: 0o755 });
    console.log(`${ok} Updated to v${latest}\n`);
    console.log(`Restart grain to use the new version.\n`);
  } catch (e: any) {
    console.log(`${err} Update check failed: ${e.message}`);
    console.log(`\nUpdate manually:\n  ${c.cyan}curl -fsSL https://raw.githubusercontent.com/skeehn/grain/main/install.sh | sh${c.reset}\n`);
  }
}

// ─── grain config ─────────────────────────────────────────────────────────────

function handleConfig(sub?: string, key?: string, value?: string): void {
  const config = loadConfig();
  const keys = listEnvKeys();

  if (!sub || sub === 'show') {
    // Pretty table
    const providerOk = VALID_PROVIDERS.includes(config.provider as any);
    console.log(`\n${bold('grain config')}\n`);
    console.log(`  Provider     ${providerOk ? c.green : c.yellow}${config.provider}${c.reset}`);
    console.log(`  Model        ${config.model ?? dim('auto (smart routing)')}`);
    console.log(`  engram DB    ${dim(config.engram_db)}`);
    console.log(`  Max tokens   ${dim(String(config.max_tokens))}`);
    console.log(`  Config dir   ${dim(getConfigDir())}`);

    const envKeyNames = ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'AWS_ACCESS_KEY_ID'];
    const savedKeys = envKeyNames.filter(k => keys[k]);
    if (savedKeys.length > 0) {
      console.log();
      for (const k of savedKeys) {
        const v = keys[k];
        const masked = v.slice(0, 8) + '...' + v.slice(-4);
        console.log(`  ${k}  ${dim(masked)}`);
      }
    }

    console.log();
    console.log(`${dim('Commands:')}`);
    console.log(`  grain config set provider <name>          ${dim('bedrock | anthropic | openrouter | ollama')}`);
    console.log(`  grain config set model <id>               ${dim('override smart routing (optional)')}`);
    console.log(`  grain config set key <KEY_NAME> <value>   ${dim('save API key to ~/.grain/.env')}`);
    console.log(`  grain config reset                        ${dim('restore defaults')}`);
    console.log();
    return;
  }

  if (sub === 'reset') {
    saveConfig({
      provider:   'bedrock',
      model:      null,
      engram_db:  '~/.engram/knowledge',
      max_tokens: 180000,
    });
    console.log(`${ok} Config reset to defaults.\n`);
    return;
  }

  if (sub === 'set') {
    if (!key) {
      console.error(`Usage: grain config set <key> <value>\n`);
      console.error(`Keys: provider  model  key  engram_db  max_tokens\n`);
      process.exit(1);
    }

    // Special: grain config set key ANTHROPIC_API_KEY sk-...
    if (key === 'key') {
      const envKeyName  = value;
      const envKeyValue = process.argv[process.argv.length - 1]; // last arg
      if (!envKeyName || !envKeyValue || envKeyName === envKeyValue) {
        console.error(`Usage: grain config set key <KEY_NAME> <value>`);
        console.error(`  e.g. grain config set key ANTHROPIC_API_KEY sk-ant-...`);
        process.exit(1);
      }
      saveKeyToEnv(envKeyName, envKeyValue);
      const masked = envKeyValue.slice(0, 8) + '...' + envKeyValue.slice(-4);
      console.log(`${ok} Saved ${c.cyan}${envKeyName}${c.reset} = ${dim(masked)} to ~/.grain/.env\n`);
      return;
    }

    if (key === 'provider') {
      if (!value || !VALID_PROVIDERS.includes(value as any)) {
        console.error(`Invalid provider "${value}". Valid: ${VALID_PROVIDERS.join(', ')}`);
        process.exit(1);
      }
      saveConfig({ provider: value });
      console.log(`${ok} provider = ${c.cyan}${value}${c.reset}\n`);
      return;
    }

    if (key === 'model') {
      saveConfig({ model: value ?? null });
      console.log(`${ok} model = ${c.cyan}${value ?? 'auto'}${c.reset}\n`);
      return;
    }

    if (key === 'engram_db') {
      if (!value) { console.error('Usage: grain config set engram_db <path>'); process.exit(1); }
      saveConfig({ engram_db: value });
      console.log(`${ok} engram_db = ${c.cyan}${value}${c.reset}\n`);
      return;
    }

    if (key === 'max_tokens') {
      const n = parseInt(value ?? '', 10);
      if (isNaN(n)) { console.error('max_tokens must be a number'); process.exit(1); }
      saveConfig({ max_tokens: n });
      console.log(`${ok} max_tokens = ${c.cyan}${n}${c.reset}\n`);
      return;
    }

    console.error(`Unknown key "${key}". Valid: provider  model  key  engram_db  max_tokens`);
    process.exit(1);
  }
}

// ─── grain status ─────────────────────────────────────────────────────────────

async function handleStatus(): Promise<void> {
  console.log(`\n${bold('grain status')}\n`);

  // Config
  const config = loadConfig();
  console.log(`  ${bold('Config')}    ${c.cyan}${config.provider}${c.reset} / ${config.model ?? 'auto'}`);

  // Engram
  const engramBin = join(homedir(), 'bin', 'engram');
  process.stdout.write(`  ${bold('Engram')}    `);
  if (!existsSync(engramBin)) {
    console.log(`${warn} binary not found at ~/bin/engram`);
  } else {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 400);
      const res = await fetch('http://localhost:7474/health', { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        const stats: any = await (await fetch('http://localhost:7474/stats')).json();
        console.log(`${ok} running  ${dim(`(${stats.nodes} nodes · ${stats.fts_docs} indexed)`)}`);
      } else {
        console.log(`${warn} server not responding`);
      }
    } catch {
      console.log(`${warn} not running  ${dim('(auto-starts on next grain launch)')}`);
    }
  }

  // Provider check
  process.stdout.write(`  ${bold('Provider')}  `);
  if (config.provider === 'bedrock') {
    const hasAWS = !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_REGION);
    if (hasAWS) {
      console.log(`${ok} bedrock  ${dim(`(${process.env.AWS_PROFILE || process.env.AWS_REGION || 'env detected'})`)}`);
    } else {
      console.log(`${warn} bedrock — no AWS credentials in env`);
    }
  } else if (config.provider === 'anthropic') {
    console.log(process.env.ANTHROPIC_API_KEY
      ? `${ok} anthropic  ${dim('(ANTHROPIC_API_KEY set)')}`
      : `${err} anthropic — ANTHROPIC_API_KEY not set\n       Run: grain config set key ANTHROPIC_API_KEY sk-...`);
  } else if (config.provider === 'openrouter') {
    console.log(process.env.OPENROUTER_API_KEY
      ? `${ok} openrouter`
      : `${err} openrouter — OPENROUTER_API_KEY not set\n       Run: grain config set key OPENROUTER_API_KEY ...`);
  } else if (config.provider === 'ollama') {
    try {
      await fetch('http://localhost:11434/api/tags');
      console.log(`${ok} ollama  ${dim('(localhost:11434 responding)')}`);
    } catch {
      console.log(`${warn} ollama  ${dim('(localhost:11434 not responding — is Ollama running?)')}`);
    }
  }

  // Version + update hint
  console.log();
  console.log(`  ${bold('Version')}   ${c.cyan}v${GRAIN_VERSION}${c.reset}  ${dim('  run "grain update" to check for updates')}`);
  console.log();
}

// ─── grain init ───────────────────────────────────────────────────────────────

async function handleInit(): Promise<void> {
  console.log(`\n${bold('grain init')}\n`);

  // Show existing config if present
  const configPath = join(getConfigDir(), 'config.json');
  if (existsSync(configPath)) {
    const cur = loadConfig();
    console.log(`Existing config found:`);
    console.log(`  provider:  ${c.cyan}${cur.provider}${c.reset}`);
    console.log(`  model:     ${cur.model ?? dim('auto')}`);
    console.log(`  engram_db: ${dim(cur.engram_db)}\n`);
    const redo = await ask('Reconfigure? [y/N] ');
    if (redo.toLowerCase() !== 'y') {
      console.log('Keeping existing config. Run "grain status" to check everything is working.\n');
      process.exit(0);
    }
    console.log();
  }

  // ── Detect available providers ───────────────────────────────────────────
  console.log('Detecting providers...\n');
  const available: Array<{ name: string; label: string; hint?: string }> = [];

  const awsOk = !!(process.env.AWS_REGION || process.env.AWS_PROFILE || process.env.AWS_ACCESS_KEY_ID);
  if (awsOk) {
    const hint = process.env.AWS_PROFILE ? `profile=${process.env.AWS_PROFILE}` : `region=${process.env.AWS_REGION || 'us-east-1'}`;
    available.push({ name: 'bedrock', label: `AWS Bedrock`, hint });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    available.push({ name: 'anthropic', label: 'Anthropic', hint: 'ANTHROPIC_API_KEY set' });
  }
  if (process.env.OPENROUTER_API_KEY) {
    available.push({ name: 'openrouter', label: 'OpenRouter', hint: 'OPENROUTER_API_KEY set' });
  }
  available.push({ name: 'ollama', label: 'Ollama', hint: 'local, no key needed' });

  available.forEach((p, i) => {
    const hintStr = p.hint ? dim(` (${p.hint})`) : '';
    console.log(`  ${c.bold}${i + 1}.${c.reset} ${p.label}${hintStr}`);
  });

  // If nothing detected except ollama, offer key entry
  if (available.length === 1) {
    console.log(`\n${warn} No cloud provider credentials detected.`);
    console.log(`  To use Anthropic: grain config set key ANTHROPIC_API_KEY sk-ant-...`);
    console.log(`  To use Bedrock:   aws configure  (then re-run grain init)`);
    console.log();
  }

  // ── Choose provider ───────────────────────────────────────────────────────
  console.log();
  const choice = await ask(`Provider [1-${available.length}] (default: ${available[0].name}): `);
  let provider = available[0].name;
  const num = parseInt(choice, 10);
  if (!isNaN(num) && num >= 1 && num <= available.length) {
    provider = available[num - 1].name;
  } else if (choice.trim()) {
    const match = available.find(p => p.name.startsWith(choice.toLowerCase()));
    if (match) provider = match.name;
  }
  console.log(`\nUsing: ${bold(provider)}\n`);

  // ── API key entry for new providers ──────────────────────────────────────
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    const key = await ask('ANTHROPIC_API_KEY (paste, hidden after save): ');
    if (!key.trim()) { console.log('No key entered. Exiting.'); process.exit(1); }
    saveKeyToEnv('ANTHROPIC_API_KEY', key.trim());
    process.env.ANTHROPIC_API_KEY = key.trim();
    console.log(`${ok} Saved to ~/.grain/.env\n`);
  }

  if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
    const key = await ask('OPENROUTER_API_KEY: ');
    if (!key.trim()) { console.log('No key entered. Exiting.'); process.exit(1); }
    saveKeyToEnv('OPENROUTER_API_KEY', key.trim());
    process.env.OPENROUTER_API_KEY = key.trim();
    console.log(`${ok} Saved to ~/.grain/.env\n`);
  }

  // ── Test connection ───────────────────────────────────────────────────────
  if (provider === 'bedrock') {
    process.stdout.write('Testing Bedrock connection... ');
    const result = await testBedrockConnection();
    if (result.ok) {
      console.log(`${ok} connected\n`);
    } else {
      console.log(`${err} failed\n  ${dim(result.error ?? 'Unknown error')}\n`);
      console.log('Check credentials: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
      console.log('or run: aws configure\n');
      const go = await ask('Continue anyway? [y/N] ');
      if (go.toLowerCase() !== 'y') process.exit(1);
    }
  }

  // ── Save config ───────────────────────────────────────────────────────────
  saveConfig({ provider, model: null, engram_db: '~/.engram/knowledge', max_tokens: 180000 });
  console.log(`${ok} Config saved to ~/.grain/config.json\n`);

  // ── Skills dir ────────────────────────────────────────────────────────────
  const { mkdirSync } = await import('fs');
  mkdirSync(join(homedir(), '.grain', 'skills'), { recursive: true });

  // ── Engram ────────────────────────────────────────────────────────────────
  const engramBin = join(homedir(), 'bin', 'engram');
  console.log('─────────────────────────────────');
  if (existsSync(engramBin)) {
    console.log(`${ok} engram binary found`);
    process.stdout.write('   Starting memory server... ');
    try {
      execSync('curl -sf http://localhost:7474/health > /dev/null 2>&1');
      console.log(`${ok} already running`);
    } catch {
      try {
        const db = join(homedir(), '.engram', 'knowledge');
        const child = spawn(engramBin, ['-d', db, 'serve', '--port', '7474'], {
          detached: true, stdio: 'ignore',
        });
        child.unref();
        await new Promise(r => setTimeout(r, 900));
        execSync('curl -sf http://localhost:7474/health > /dev/null 2>&1');
        console.log(`${ok} started at http://localhost:7474`);
      } catch {
        console.log(`${warn} could not start — run manually: engram -d ~/.engram/knowledge serve`);
      }
    }
  } else {
    console.log(`${warn} engram not found at ~/bin/engram`);
    console.log(`   grain works without it but won't have persistent memory.`);
    console.log(`   Build: cd ~/engram && cargo build --release && cp target/release/engram ~/bin/`);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('─────────────────────────────────\n');
  console.log(`${bold('Ready.')}\n`);
  console.log(`  ${c.cyan}grain "explain this codebase"${c.reset}`);
  console.log(`  ${c.cyan}grain --yes "add tests for src/auth.ts"${c.reset}`);
  console.log(`  ${c.cyan}grain status${c.reset}              ${dim('check everything is running')}`);
  console.log(`  ${c.cyan}grain update${c.reset}              ${dim('check for new version')}`);
  console.log();
}

// ─── grain --help ─────────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
${bold(`grain v${GRAIN_VERSION}`)} — self-improving AI coding agent

${bold('USAGE')}
  grain [task]                 run a task interactively
  grain "do something"         one-shot inline task
  grain -p "task" --yes        fully automated (no prompts)

${bold('FLAGS')}
  -y, --yes                    auto-approve all actions
  -c, --concise                shorter output, fewer tokens
  --provider <name>            override provider for this run
  --model <id>                 override model for this run
  -h, --help                   show this help
  -v, --version                show version

${bold('COMMANDS')}
  grain init                   interactive setup wizard
  grain status                 check provider, engram, config
  grain update                 update grain to latest version
  grain config                 show current config
  grain config set provider <name>         set provider
  grain config set model <id>              set model override
  grain config set key <KEY> <value>       save API key to ~/.grain/.env
  grain config set engram_db <path>        set engram database path
  grain config reset                       restore defaults

${bold('PROVIDERS')}
  bedrock     AWS Bedrock (Haiku/Sonnet/Opus — smart routing)
  anthropic   Direct Anthropic API  ANTHROPIC_API_KEY
  openrouter  OpenRouter            OPENROUTER_API_KEY
  ollama      Local Ollama          no key needed

${bold('EXAMPLES')}
  grain "explain the architecture of this project"
  grain --yes "add unit tests for src/parser.ts"
  grain --provider anthropic "refactor this to use async/await"
  grain config set key ANTHROPIC_API_KEY sk-ant-abc123
  grain config set provider anthropic

${bold('CONFIG')}    ~/.grain/config.json
${bold('KEYS')}      ~/.grain/.env       ${dim('(auto-loaded, never exported to shell)')}
${bold('SKILLS')}    ~/.grain/skills/
${bold('LOGS')}      ~/.grain/sessions/
`);
}

// ─── Bedrock connection test ──────────────────────────────────────────────────

async function testBedrockConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const region = process.env.AWS_REGION || 'us-east-1';
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const client = new BedrockRuntimeClient({ region });
    await client.send(new InvokeModelCommand({
      modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      contentType: 'application/json',
      accept: 'application/json',
    }));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message?.split('\n')[0] };
  }
}

// ─── First-run welcome ────────────────────────────────────────────────────────

function showWelcomeIfNeeded(): void {
  const flag = join(getConfigDir(), '.welcomed');
  if (existsSync(flag)) return;
  try { writeFileSync(flag, new Date().toISOString()); } catch { /* ignore */ }

  console.log(`
${bold('Welcome to grain.')} v${GRAIN_VERSION}

Self-improving AI coding agent with persistent memory.

Run ${c.cyan}grain init${c.reset} to set up your provider and API keys.
Run ${c.cyan}grain --help${c.reset} for all commands.
`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  // Commands that don't need engram or the agent
  if (parsed.command === 'help')    { showHelp(); return; }
  if (parsed.command === 'version') { console.log(`grain v${GRAIN_VERSION}`); return; }
  if (parsed.command === 'update')  { await handleUpdate(); return; }
  if (parsed.command === 'init')    { await handleInit(); return; }
  if (parsed.command === 'status')  { await handleStatus(); return; }

  if (parsed.command === 'config') {
    handleConfig(parsed.configSubcmd, parsed.configKey, parsed.configValue);
    return;
  }

  // Startup: show welcome on first ever run
  if (!parsed.prompt) showWelcomeIfNeeded();

  // Silently ensure engram is running (non-blocking)
  ensureEngramRunning().catch(() => { /* never fails grain */ });

  // Run the agent
  try {
    await orchestrate({
      prompt:      parsed.prompt,
      autoApprove: parsed.autoApprove,
      concise:     parsed.concise,
      model:       parsed.model,
      provider:    parsed.provider,
    });
  } catch (e: any) {
    if (e.message === 'SIGINT') {
      renderer.newLine();
      renderer.info('Goodbye.');
    } else {
      renderer.error(e.message);
      process.exit(1);
    }
  }
}

main().catch(e => { renderer.error(e.message); process.exit(1); });
