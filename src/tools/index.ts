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
import { multiEditTool, executeMultiEdit } from './multi-edit.js';
import { gitTool, executeGit } from './git.js';
import { testRunnerTool, executeTestRunner } from './test-runner.js';
import { repoMapTool, executeRepoMap } from './repo-map.js';

export const TOOLS: Tool[] = [
  // Core (10) — essential for any coding task
  bashTool,        // Run shell commands
  readTool,        // Read files
  writeTool,       // Write files (with syntax check)
  patchTool,       // Targeted edits
  grepTool,        // Search content
  workspaceScanTool, // List files/structure
  gitTool,         // Git operations
  testRunnerTool,  // Run tests
  finishTool,      // Signal completion
  repoMapTool,     // Understand codebase structure

  // Power (5) — for complex tasks
  multiEditTool,   // Batch edits across files
  engramTool,      // Persistent memory
  delegateTool,    // Spawn sub-agents
];

const executors: Record<string, (input: any) => Promise<ToolResult>> = {
  bash: executeBash,
  read: executeRead,
  write: executeWrite,
  patch: executePatch,
  grep: executeGrep,
  workspace_scan: executeWorkspaceScan,
  git: executeGit,
  run_tests: executeTestRunner,
  repo_map: executeRepoMap,
  multi_edit: executeMultiEdit,
  engram: executeEngram,
  delegate: executeDelegate,
  finish: executeFinish,
};

export async function executeTool(name: string, input: any): Promise<ToolResult> {
  const executor = executors[name];
  if (!executor) {
    return { content: `Unknown tool: ${name}`, is_error: true };
  }
  return executor(input);
}
