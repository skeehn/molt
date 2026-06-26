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
    // codex 0.135.0 - use exec mode
    // Note: codex exec can be slow (10-30s typical)
    const proc = spawn('codex', ['exec', '--dangerously-bypass-approvals-and-sandbox', prompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000, // 2 minute timeout
    });

    let output = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      // Parse codex output - look for the actual response after session info
      // Codex format: "session id: ...\n--------\nuser\n[prompt]\ncodex\n[response]\ntokens used\n..."
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      // Extract just the codex response from output
      const lines = output.split('\n');
      const codexIndex = lines.findIndex(l => l.trim() === 'codex');
      const tokensIndex = lines.findIndex(l => l.startsWith('tokens used'));
      
      let response = '';
      if (codexIndex !== -1 && tokensIndex !== -1) {
        response = lines.slice(codexIndex + 1, tokensIndex).join('\n').trim();
      } else {
        response = output; // Fallback to full output
      }
      
      resolve({ output: response || output || stderr, exitCode: code || 0 });
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn codex: ${err.message}`));
    });
  });
}
