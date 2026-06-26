import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import type { ToolResult } from '../providers/types.js';

export const engramTool = {
  name: 'engram',
  description: 'Interact with engram knowledge base. Search for relevant context, add new learnings, or get specific entries.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['search', 'add', 'get'], description: 'Action to perform' },
      query: { type: 'string', description: 'Search query (for search action)' },
      body: { type: 'string', description: 'Content to add (for add action)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the entry (for add action)' },
    },
    required: ['action'],
  },
};

const ENGRAM_BIN = join(homedir(), 'bin', 'engram');
const ENGRAM_DB = join(homedir(), '.engram', 'knowledge');
const ENGRAM_HTTP = 'http://localhost:7474';

let httpAvailable: boolean | null = null; // null = not yet checked
let engramWarningShown = false;

// Check HTTP server with a short timeout
async function checkHttp(): Promise<boolean> {
  if (httpAvailable !== null) return httpAvailable;
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 300);
    const res = await fetch(`${ENGRAM_HTTP}/health`, { signal: ctrl.signal });
    clearTimeout(tid);
    httpAvailable = res.ok;
  } catch {
    httpAvailable = false;
  }
  return httpAvailable;
}

// HTTP-based operations (fast, no subprocess)
async function searchHttp(query: string, topK = 10): Promise<ToolResult> {
  const url = `${ENGRAM_HTTP}/search?q=${encodeURIComponent(query)}&top_k=${topK}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const results: any[] = await res.json();
  if (results.length === 0) return { content: 'No results found.' };
  const lines = results.map((r, i) =>
    `[${i + 1}] ${r.score.toFixed(3)} | ${r.id}\n    ${r.body.slice(0, 120)}...`
  );
  return { content: lines.join('\n\n') };
}

async function addHttp(body: string, tags: string[] = []): Promise<ToolResult> {
  const res = await fetch(`${ENGRAM_HTTP}/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, tags }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { id } = await res.json();
  return { content: `Added: ${id}` };
}

// Subprocess fallback
function runSubprocess(args: string[]): Promise<ToolResult> {
  return new Promise((resolve) => {
    const proc = spawn(ENGRAM_BIN, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) resolve({ content: stderr || `engram exited ${code}`, is_error: true });
      else resolve({ content: stdout || 'OK' });
    });
    proc.on('error', (err) => resolve({ content: `engram error: ${err.message}`, is_error: true }));
  });
}

export async function executeEngram(input: {
  action: string;
  query?: string;
  body?: string;
  tags?: string[];
}): Promise<ToolResult> {
  const useHttp = await checkHttp();

  if (!useHttp && !existsSync(ENGRAM_BIN)) {
    if (!engramWarningShown) {
      engramWarningShown = true;
    }
    switch (input.action) {
      case 'search': return { content: 'No results (engram not available)' };
      case 'add':    return { content: 'Knowledge not persisted (engram not available)' };
      default:       return { content: 'engram not available' };
    }
  }

  switch (input.action) {
    case 'search': {
      if (!input.query) return { content: 'query required', is_error: true };
      if (useHttp) {
        try { return await searchHttp(input.query); }
        catch { httpAvailable = false; } // mark down, fall through to subprocess
      }
      return runSubprocess(['-d', ENGRAM_DB, 'search', input.query]);
    }
    case 'add': {
      if (!input.body) return { content: 'body required', is_error: true };
      if (useHttp) {
        try { return await addHttp(input.body, input.tags || []); }
        catch { httpAvailable = false; }
      }
      const args = ['-d', ENGRAM_DB, 'add', input.body];
      if (input.tags?.length) args.push('--tags', input.tags.join(','));
      return runSubprocess(args);
    }
    case 'get': {
      if (!input.query) return { content: 'query (id) required', is_error: true };
      return runSubprocess(['-d', ENGRAM_DB, 'get', input.query]);
    }
    default:
      return { content: `Unknown action: ${input.action}`, is_error: true };
  }
}
