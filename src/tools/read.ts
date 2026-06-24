import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { ToolResult } from '../providers/types.js';

export const readTool = {
  name: 'read',
  description: 'Read a file with line numbers. Returns content in "LINE_NUM|CONTENT" format.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
      offset: { type: 'number', description: 'Line number to start from (1-indexed, default: 1)' },
      limit: { type: 'number', description: 'Maximum lines to read (default: 500)' },
    },
    required: ['path'],
  },
};

export async function executeRead(input: { path: string; offset?: number; limit?: number }): Promise<ToolResult> {
  const filePath = resolve(input.path);
  const offset = Math.max(1, input.offset || 1);
  const limit = input.limit || 500;

  if (!existsSync(filePath)) {
    return { content: `File not found: ${filePath}`, is_error: true };
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const startIdx = offset - 1;
    const endIdx = Math.min(startIdx + limit, lines.length);
    const selected = lines.slice(startIdx, endIdx);

    const numbered = selected.map((line, i) => `${startIdx + i + 1}|${line}`).join('\n');

    let result = numbered;
    if (endIdx < lines.length) {
      result += `\n... (${lines.length - endIdx} more lines)`;
    }

    return { content: result };
  } catch (err: any) {
    return { content: `Error reading file: ${err.message}`, is_error: true };
  }
}
