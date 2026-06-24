import { spawn } from 'child_process';
import type { StreamEvent } from './types.js';

export interface SubprocessResult {
  output: string;
  exitCode: number;
}

export async function delegateToClaudeCode(prompt: string): Promise<SubprocessResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', prompt, '--output-format', 'stream-json'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      // Parse stream-json format - each line is a JSON object
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'assistant' && parsed.message?.content) {
            for (const block of parsed.message.content) {
              if (block.type === 'text') {
                output += block.text;
              }
            }
          } else if (parsed.type === 'result') {
            output += parsed.result || '';
          }
        } catch {
          output += line;
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ output: output || stderr, exitCode: code || 0 });
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

export async function delegateToCodex(prompt: string): Promise<SubprocessResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('codex', ['--approval-mode', 'full-auto', '-q', prompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ output: output || stderr, exitCode: code || 0 });
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn codex: ${err.message}`));
    });
  });
}
