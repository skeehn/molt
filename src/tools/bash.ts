import { spawn } from 'child_process';
import type { ToolResult } from '../providers/types.js';

const MAX_OUTPUT = 50 * 1024; // 50KB

export const bashTool = {
  name: 'bash',
  description: 'Execute a shell command and return its output. Use for running programs, installing packages, git operations, etc.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in seconds (default: 120)' },
    },
    required: ['command'],
  },
};

export async function executeBash(input: { command: string; timeout?: number }): Promise<ToolResult> {
  const timeout = (input.timeout || 120) * 1000;

  return new Promise((resolve) => {
    const proc = spawn('bash', ['-c', input.command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT) {
        stdout = stdout.slice(0, MAX_OUTPUT) + '\n... [output truncated at 50KB]';
        proc.kill();
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
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
