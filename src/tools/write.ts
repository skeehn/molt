import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import type { Tool, ToolResult } from '../providers/types.js';
import { getContextTracker } from '../agent/context-tracker.js';

export const writeTool = {
  name: 'write',
  description: 'Write content to a file, creating parent directories if needed. Overwrites existing content.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
};

export async function executeWrite(input: { path: string; content: string }): Promise<ToolResult> {
  const filePath = resolve(input.path);

  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, input.content);
    const bytes = Buffer.byteLength(input.content);
    return { content: `Wrote ${bytes} bytes to ${filePath}` };
  } catch (err: any) {
    return { content: `Error writing file: ${err.message}`, is_error: true };
  }
}
