import type { Tool, ToolResult } from '../providers/types.js';
import { bashTool, executeBash } from './bash.js';
import { readTool, executeRead } from './read.js';
import { writeTool, executeWrite } from './write.js';
import { patchTool, executePatch } from './patch.js';
import { grepTool, executeGrep } from './grep.js';
import { engramTool, executeEngram } from './engram.js';
import { delegateTool, executeDelegate } from './delegate.js';
import { finishTool, executeFinish } from './finish.js';
import { workspaceScanTool, executeWorkspaceScan } from './workspace.js';
// import { syntaxCheckTool, executeSyntaxCheck } from './syntax.js'; // Disabled: needs tree-sitter native bindings
import { semanticSearchTool, executeSemanticSearch } from './semantic-search.js';

export const TOOLS: Tool[] = [
  bashTool,
  readTool,
  writeTool,
  patchTool,
  grepTool,
  engramTool,
  workspaceScanTool,
  // syntaxCheckTool, // Requires tree-sitter native bindings
  semanticSearchTool,
  delegateTool,
  finishTool,
];

const executors: Record<string, (input: any) => Promise<ToolResult>> = {
  bash: executeBash,
  read: executeRead,
  write: executeWrite,
  patch: executePatch,
  grep: executeGrep,
  engram: executeEngram,
  workspace_scan: executeWorkspaceScan,
  // syntax_check: executeSyntaxCheck, // Disabled
  semantic_search: executeSemanticSearch,
  delegate: executeDelegate,
  finish: executeFinish,
};

export async function executeTool(name: string, input: any): Promise<ToolResult> {
  const executor = executors[name];
  if (!executor) {
    return { content: `Unknown tool: ${name}`, is_error: true };
  }
  try {
    return await executor(input);
  } catch (err: any) {
    return { content: `Tool error (${name}): ${err.message}`, is_error: true };
  }
}
