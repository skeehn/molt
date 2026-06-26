import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { ToolResult } from '../providers/types.js';
import * as renderer from '../tui/renderer.js';

const MAX_OUTPUT = 50_000;
const DEFAULT_TIMEOUT = 60_000;

// ── Persistent shell session ───────────────────────────────────────────────────

interface ShellSession {
  proc: ChildProcessWithoutNullStreams;
  cwd: string;
}

let _session: ShellSession | null = null;

function getOrCreateShell(cwd: string): ShellSession {
  if (_session && !_session.proc.killed) return _session;
  const proc = spawn('bash', ['--norc', '--noprofile'], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PS1: '', TERM: 'dumb' },
  });
  proc.on('exit', () => { _session = null; });
  _session = { proc, cwd };
  return _session;
}

export function destroyShell(): void {
  if (_session) {
    try { _session.proc.stdin.end(); } catch {}
    try { _session.proc.kill(); } catch {}
    _session = null;
  }
}

// ── Command execution inside persistent shell ──────────────────────────────────

function runInShell(
  session: ShellSession,
  command: string,
  timeoutMs: number,
  onLine: (line: string) => void,
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const sentinel = `__GRAIN_DONE_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
    let output = '';
    let done = false;
    let lineBuffer = '';  // accumulates partial lines across chunks

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        cleanup();
        try { session.proc.stdin.write('\x03\n'); } catch {}
        resolve({ output: output + '\n[timeout]', exitCode: 124 });
      }
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      session.proc.stdout.off('data', onData);
      session.proc.stderr.off('data', onErrData);
    }

    function processLine(line: string) {
      if (done) return;
      // Check sentinel — must be exact match on the line
      if (line.startsWith(sentinel + ':') || line === sentinel) {
        const exitCodeStr = line.includes(':') ? line.split(':').pop()?.trim() ?? '0' : '0';
        done = true;
        cleanup();
        resolve({ output: output.trim(), exitCode: parseInt(exitCodeStr, 10) || 0 });
        return;
      }
      if (line === '') return; // skip blank lines
      output += line + '\n';
      if (output.length > MAX_OUTPUT && !output.includes('[truncated]')) {
        output = output.slice(0, MAX_OUTPUT) + '\n... [output truncated at 50KB]';
      }
      if (output.length < MAX_OUTPUT) onLine(line);
    }

    const onData = (chunk: Buffer) => {
      // Accumulate into lineBuffer, process complete lines only
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      // Last element may be incomplete — keep it in the buffer
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        processLine(line);
        if (done) return;
      }
    };

    const onErrData = (chunk: Buffer) => {
      if (done) return;
      const text = chunk.toString();
      output += text;
      if (/error|Error|ERR|warn|WARN/i.test(text)) {
        const line = text.trim().split('\n').pop() || '';
        if (line) onLine(`⚠ ${line.slice(0, 120)}`);
      }
    };

    session.proc.stdout.on('data', onData);
    session.proc.stderr.on('data', onErrData);

    // Wrap: run command, capture exit, emit sentinel on its own line
    const wrapped = `${command}\n__gc=$?; echo "${sentinel}:$__gc"\n`;
    session.proc.stdin.write(wrapped);
  });
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const bashTool = {
  name: 'bash',
  description: [
    'Execute a shell command. The shell is PERSISTENT — cd, exports, and env vars carry over between calls.',
    'For long-running servers use timeout: `timeout 8 npm run dev`.',
    'Avoid interactive commands (vim, less) — pipe to cat or use flags.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to run' },
      timeout: { type: 'number', description: 'Timeout in seconds (default: 60)' },
    },
    required: ['command'],
  },
};

export async function executeBash(
  input: { command: string; timeout?: number },
  cwd?: string,
): Promise<ToolResult> {
  const timeoutMs = (input.timeout ?? 60) * 1000;
  const workdir = cwd || process.cwd();
  const session = getOrCreateShell(workdir);

  renderer.toolStart('bash', input.command.slice(0, 120));

  const { output, exitCode } = await runInShell(
    session,
    input.command,
    timeoutMs,
    (_line) => {}, // streaming lines suppressed — show result once at end
  );

  if (output) renderer.dim(`  ${output.split('\n').slice(0, 6).join('\n  ')}`);

  if (exitCode !== 0 && exitCode !== 124) {
    return {
      content: output || `Command failed with exit code ${exitCode}`,
      is_error: false, // Don't mark as error — let the LLM decide how to handle it
    };
  }

  return { content: output || '(no output)' };
}
