import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import type { Message, ContentBlock } from '../providers/types.js';
import { loadConfig } from '../config.js';

export const MAX_TOKENS = 180000;

export function countTokens(messages: Message[]): number {
  let chars = 0;
  for (const msg of messages) {
    for (const block of msg.content) {
      if (block.type === 'text') chars += block.text.length;
      else if (block.type === 'tool_result') chars += block.content.length;
      else if (block.type === 'tool_use') chars += JSON.stringify(block.input).length + block.name.length;
    }
  }
  return Math.ceil(chars / 4);
}

export function needsCompaction(messages: Message[]): boolean {
  return countTokens(messages) > MAX_TOKENS * 0.8;
}

export function compact(messages: Message[]): Message[] {
  if (messages.length <= 4) return messages;

  const toSummarize = messages.slice(0, -4);
  const toKeep = messages.slice(-4);

  const summaryParts: string[] = [];
  for (const msg of toSummarize) {
    for (const block of msg.content) {
      if (block.type === 'text') {
        summaryParts.push(`[${msg.role}]: ${block.text.slice(0, 200)}`);
      } else if (block.type === 'tool_use') {
        summaryParts.push(`[tool_use]: ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`);
      } else if (block.type === 'tool_result') {
        summaryParts.push(`[tool_result]: ${block.content.slice(0, 100)}`);
      }
    }
  }

  const summaryText = `[Context summary - ${toSummarize.length} messages compacted]\n${summaryParts.join('\n')}`;

  const summaryMessage: Message = {
    role: 'user',
    content: [{ type: 'text', text: summaryText }],
  };

  return [summaryMessage, ...toKeep];
}

export async function engramRetrieve(query: string): Promise<string> {
  const engramBin = join(homedir(), 'bin', 'engram');
  const config = loadConfig();
  const dbPath = config.engram_db.replace('~', homedir());

  return new Promise((resolve) => {
    const proc = spawn(engramBin, ['-d', dbPath, 'search', query], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });

    let output = '';
    proc.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    proc.on('close', () => resolve(output));
    proc.on('error', () => resolve(''));
  });
}

export async function engramStore(fact: string, tags: string[] = ['grain-auto']): Promise<void> {
  const engramBin = join(homedir(), 'bin', 'engram');
  const config = loadConfig();
  const dbPath = config.engram_db.replace('~', homedir());

  const tagArgs = tags.flatMap(t => ['--tags', t]);

  return new Promise((resolve) => {
    const proc = spawn(engramBin, ['-d', dbPath, 'add', fact, ...tagArgs], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
  });
}
