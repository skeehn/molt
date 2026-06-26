import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { ToolResult } from '../providers/types.js';
import * as renderer from '../tui/renderer.js';

const MAX_OUTPUT = 50 * 1024; // 50KB

// ── Persistent shell session ──────────────────────────────────────────────────
// One bash process per agent task. Environment (cwd, exports, aliases) persists
// across all tool calls just like a real terminal session.

interface ShellSession {
  proc: ChildProcessWithoutNullStreams;
  cwd: string;
}

let _session: ShellSession | null = null;

export function getOrCreateShell(initialCwd: string): ShellSession {
  if (_session) return _session;

  const proc = spawn('bash', ['--norc', '--noprofile'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: initialCwd,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', PS1: '' },
  });

  proc.on('exit', () => { _session = null; });
  proc.on('error', () => { _session = null; });

  _session = { proc, cwd: initialCwd };
  return _session;
}

export function destroyShell(): void {
  if (_session) {
    try { _session.proc.kill(); } catch {}
    _session = null;
  }
}

// Run a command in the persistent shell. Uses a unique sentinel to detect end.
function runInShell(
  session: ShellSession,
  command: string,
  timeoutMs: number,
  onLine: (line: string) => void,
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const sentinel = `__GRAIN_DONE_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
    let output = '';
    let exitCodeStr = '0';
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        // Send Ctrl+C to interrupt any running process, then resolve
        try { session.proc.stdin.write('\x03'); } catch {}
        resolve({ output: output + '\n[timeout]', exitCode: 124 });
      }
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith(sentinel)) {
          // sentinel line: "__GRAIN_DONE_...__:EXIT_CODE"
          const parts = line.split(':');
          exitCodeStr = parts[1]?.trim() ?? '0';
          clearTimeout(timer);
          if (!done) {
            done = true;
            session.proc.stdout.off('data', onData);
            session.proc.stderr.off('data', onErrData);
            resolve({ output: output.trim(), exitCode: parseInt(exitCodeStr, 10) || 0 });
          }
          return;
        }
        // Skip empty PS1 artifacts
        if (line.trim() === '') continue;
        output += line + '\n';
        if (output.length < MAX_OUTPUT) onLine(line);
      }

      if (output.length > MAX_OUTPUT && !output.includes('[truncated]')) {
        output = output.slice(0, MAX_OUTPUT) + '\n... [output truncated at 50KB]';
      }
    };

    const onErrData = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      if (/error|Error|ERR|warn|WARN/i.test(text)) {
        const line = text.trim().split('\n').pop() || '';
        if (line) onLine(`⚠ ${line.slice(0, 120)}`);
      }
    };

    session.proc.stdout.on('data', onData);
    session.proc.stderr.on('data', onErrData);

    // Write: command, capture exit code, emit sentinel
    const wrapped = `${command}\n__exit_code=$?\necho "${sentinel}:$__exit_code"\n`;
    session.proc.stdin.write(wrapped);
  });
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const bashTool = {
  name: 'bash',
  description: [
    'Execute a shell command. The shell is PERSISTENT — cd, exports, and env vars carry over between calls.',
    'For long-running servers use timeout: `timeout 8 npm run dev`.',
    'Default timeout 60s, max 300s.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to run. cd works persistently. For servers: timeout 8 npm run dev',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default: 60, max: 300)',
      },
    },
    required: ['command'],
  },
};

export async function executeBash(
  input: { command: string; timeout?: number },
  initialCwd?: string,
): Promise<ToolResult> {
  const timeoutMs = Math.min((input.timeout ?? 60) * 1000, 300_000);
  const cwd = initialCwd || process.cwd();

  const session = getOrCreateShell(cwd);

  let lastStreamTime = 0;
  const { output, exitCode } = await runInShell(session, input.command, timeoutMs, (line) => {
    const now = Date.now();
    if (now - lastStreamTime > 150) {
      renderer.dim(`  │ ${line.slice(0, 120)}`);
      lastStreamTime = now;
    }
  });

  const content = output || `Process exited with code ${exitCode}`;
  return { content, is_error: exitCode !== 0 };
}
