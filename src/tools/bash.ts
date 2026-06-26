import { spawn } from 'child_process';
import type { ToolResult } from '../providers/types.js';
import * as renderer from '../tui/renderer.js';

const MAX_OUTPUT = 50 * 1024; // 50KB

export const bashTool = {
  name: 'bash',
  description: 'Execute a shell command and return its output. For long-running servers (vite, npm run dev, cargo run), use timeout to limit runtime: e.g. `timeout 8 npm run dev` — this starts the server, captures startup output, then returns. Do NOT run servers without timeout.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute. For dev servers use: timeout 8 npm run dev' },
      timeout: { type: 'number', description: 'Timeout in seconds (default: 60, max: 300)' },
      workdir: { type: 'string', description: 'Working directory (default: cwd)' },
    },
    required: ['command'],
  },
};

export async function executeBash(input: { command: string; timeout?: number; workdir?: string }): Promise<ToolResult> {
  const timeout = Math.min((input.timeout || 60) * 1000, 300_000); // max 300s
  const cwd = input.workdir || process.cwd();

  return new Promise((resolve) => {
    const proc = spawn('bash', ['-c', input.command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';
    let lastStreamTime = 0;
    let truncated = false;

    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;

      // Stream output to user in real-time (throttled to avoid spam)
      const now = Date.now();
      if (now - lastStreamTime > 200) { // 200ms throttle
        const line = chunk.trim().split('\n').pop() || '';
        if (line) renderer.dim(`  │ ${line.slice(0, 120)}`);
        lastStreamTime = now;
      }

      if (stdout.length > MAX_OUTPUT) {
        stdout = stdout.slice(0, MAX_OUTPUT) + '\n... [output truncated at 50KB]';
        truncated = true;
        proc.kill();
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;

      // Stream important stderr (errors, warnings)
      if (/error|Error|ERR|warn|WARN/i.test(chunk)) {
        const line = chunk.trim().split('\n').pop() || '';
        if (line) renderer.dim(`  │ ⚠ ${line.slice(0, 120)}`);
      }

      if (stderr.length > MAX_OUTPUT) {
        stderr = stderr.slice(0, MAX_OUTPUT) + '\n... [stderr truncated at 50KB]';
      }
    });

    proc.on('close', (code) => {
      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += (output ? '\n' : '') + stderr;
      if (!output) output = `Process exited with code ${code}`;

      resolve({
        content: output,
        is_error: code !== 0,
      });
    });

    proc.on('error', (err) => {
      resolve({
        content: `Error executing command: ${err.message}`,
        is_error: true,
      });
    });
  });
}
