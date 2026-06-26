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
  const KEEP_RECENT = 20;
  if (messages.length <= KEEP_RECENT) return messages;

  const toSummarize = messages.slice(0, -KEEP_RECENT);
  const toKeep = messages.slice(-KEEP_RECENT);

  // Extract structured facts from summarized messages
  const filesWritten: string[] = [];
  const commandsRun: string[] = [];
  const errors: string[] = [];
  const keyDecisions: string[] = [];

  for (const msg of toSummarize) {
    for (const block of msg.content) {
      if (block.type === 'tool_use') {
        if (block.name === 'write' || block.name === 'multi_edit') {
          const p = block.input?.path || (block.input?.edits || []).map((e: any) => e.path).join(', ');
          if (p) filesWritten.push(p);
        } else if (block.name === 'bash') {
          const cmd = (block.input?.command || '').slice(0, 80);
          if (cmd) commandsRun.push(cmd);
        } else if (block.name === 'finish') {
          const m = block.input?.message || '';
          if (m) keyDecisions.push(`COMPLETED: ${m}`);
        }
      } else if (block.type === 'tool_result' && (block as any).is_error) {
        const err = (typeof block.content === 'string' ? block.content : '').slice(0, 120);
        if (err) errors.push(err);
      } else if (block.type === 'text' && msg.role === 'assistant') {
        const text = (block as any).text?.trim() || '';
        if (text.length > 100 && text.length < 400) keyDecisions.push(text.slice(0, 200));
      }
    }
  }

  const parts: string[] = [
    `[CONTEXT SUMMARY — ${toSummarize.length} earlier messages compacted]`,
  ];
  if (filesWritten.length) parts.push(`Files written: ${[...new Set(filesWritten)].join(', ')}`);
  if (commandsRun.length) parts.push(`Commands run: ${[...new Set(commandsRun)].slice(0, 10).join(' | ')}`);
  if (errors.length) parts.push(`Errors: ${[...new Set(errors)].slice(0, 5).join(' | ')}`);
  if (keyDecisions.length) parts.push(`Key outcomes:\n${keyDecisions.slice(0, 5).map(d => `  • ${d}`).join('\n')}`);
  parts.push('[Continue from the recent messages below]');

  const summaryMessage: Message = {
    role: 'user',
    content: [{ type: 'text', text: parts.join('\n') }],
  };

  return [summaryMessage, ...toKeep];
}

const ENGRAM_HTTP = 'http://localhost:7474';

export async function engramRetrieve(query: string): Promise<string> {
  // Try HTTP first (faster, no subprocess overhead)
  try {
    const url = `${ENGRAM_HTTP}/search?q=${encodeURIComponent(query)}&limit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const results = await res.json() as Array<{ body: string; score: number; tags: string[] }>;
      if (results.length === 0) return '';
      return results
        .filter(r => r.score > 0.01)
        .slice(0, 5)
        .map(r => `• ${r.body}`)
        .join('\n');
    }
  } catch { /* fall through to CLI */ }

  // Fallback: CLI subprocess
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
  // Try HTTP first
  try {
    await fetch(`${ENGRAM_HTTP}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: fact, tags, node_type: 'fact' }),
      signal: AbortSignal.timeout(4000),
    });
    return;
  } catch { /* fall through to CLI */ }

  // Fallback: CLI subprocess
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
