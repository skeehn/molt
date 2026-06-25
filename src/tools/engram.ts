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

let engramWarningShown = false;

function checkEngramAvailable(): boolean {
  return existsSync(ENGRAM_BIN);
}

function showEngramWarning(): string {
  if (!engramWarningShown) {
    engramWarningShown = true;
    return '⚠️  engram not found, knowledge persistence disabled. Install: https://github.com/skeehn/engram\n\n';
  }
  return '';
}

export async function executeEngram(input: { action: string; query?: string; body?: string; tags?: string[] }): Promise<ToolResult> {
  // Check if engram is available
  if (!checkEngramAvailable()) {
    const warning = showEngramWarning();
    // Return empty results instead of failing
    switch (input.action) {
      case 'search':
        return { content: warning + 'No results (engram not installed)' };
      case 'add':
        return { content: warning + 'Knowledge not persisted (engram not installed)' };
      case 'get':
        return { content: warning + 'Entry not found (engram not installed)' };
      default:
        return { content: warning + 'engram not available' };
    }
  }

  let args: string[] = [];

  // -d must come BEFORE the subcommand
  const dbArgs = ['-d', ENGRAM_DB];

  switch (input.action) {
    case 'search':
      if (!input.query) return { content: 'query is required for search action', is_error: true };
      args = [...dbArgs, 'search', input.query];
      break;
    case 'add':
      if (!input.body) return { content: 'body is required for add action', is_error: true };
      args = [...dbArgs, 'add', input.body];
      if (input.tags && input.tags.length > 0) {
        args.push('--tags', input.tags.join(','));
      }
      break;
    case 'get':
      if (!input.query) return { content: 'query (id) is required for get action', is_error: true };
      args = [...dbArgs, 'get', input.query];
      break;
    default:
      return { content: `Unknown action: ${input.action}`, is_error: true };
  }

  return new Promise((resolve) => {
    const proc = spawn(ENGRAM_BIN, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
      env: { ...process.env, JINA_API_KEY: process.env.JINA_API_KEY || '' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ content: stderr || `engram exited with code ${code}`, is_error: true });
      } else {
        resolve({ content: stdout || 'OK' });
      }
    });

    proc.on('error', (err) => {
      resolve({ content: `engram not available: ${err.message}`, is_error: true });
    });
  });
}
