import { spawn } from 'child_process';
import type { ToolResult } from '../providers/types.js';

export const grepTool = {
  name: 'grep',
  description: 'Search file contents using ripgrep. Returns matches with file:line:content format.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      path: { type: 'string', description: 'Directory or file to search in (default: current directory)' },
      file_glob: { type: 'string', description: 'Filter files by glob pattern (e.g., "*.ts")' },
    },
    required: ['pattern'],
  },
};

export async function executeGrep(input: { pattern: string; path?: string; file_glob?: string }): Promise<ToolResult> {
  const args: string[] = ['--line-number', '--no-heading', '--color=never', '-e', input.pattern];

  if (input.file_glob) {
    args.push('--glob', input.file_glob);
  }

  args.push(input.path || '.');

  return new Promise((resolve) => {
    const proc = spawn('rg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      if (stdout.length > 50000) {
        stdout = stdout.slice(0, 50000) + '\n... [truncated]';
        proc.kill();
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 1 && !stderr) {
        resolve({ content: 'No matches found.' });
      } else if (stderr) {
        resolve({ content: stderr, is_error: true });
      } else {
        resolve({ content: stdout || 'No matches found.' });
      }
    });

    proc.on('error', (err) => {
      resolve({ content: `Error running ripgrep: ${err.message}`, is_error: true });
    });
  });
}
