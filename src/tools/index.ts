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
import { multiEditTool, executeMultiEdit } from './multi-edit.js';
import { gitCheckpointTool, gitRollbackTool, gitStatusTool, executeGitCheckpoint, executeGitRollback, executeGitStatus } from './git.js';
import { testRunnerTool, executeTestRunner } from './test-runner.js';
import { costTrackingTool, executeCostSummary } from './cost-tracking.js';
import { projectExplainerTool, executeExplainProject } from './project-explainer.js';
import { dataFlowTool, executeAnalyzeDataFlow } from './dataflow-analyzer.js';

export const TOOLS: Tool[] = [
  bashTool,
  readTool,
  writeTool,
  patchTool,
  grepTool,
  engramTool,
  workspaceScanTool,
  semanticSearchTool,
  multiEditTool,
  gitCheckpointTool,
  gitRollbackTool,
  gitStatusTool,
  testRunnerTool,
  costTrackingTool,
  projectExplainerTool,
  dataFlowTool,
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
  semantic_search: executeSemanticSearch,
  multi_edit: executeMultiEdit,
  git_checkpoint: executeGitCheckpoint,
  git_rollback: executeGitRollback,
  git_status: executeGitStatus,
  run_tests: executeTestRunner,
  cost_summary: executeCostSummary,
  explain_project: executeExplainProject,
  analyze_dataflow: executeAnalyzeDataFlow,
  delegate: executeDelegate,
  finish: executeFinish,
};

export async function executeTool(name: string, input: any): Promise<ToolResult> {
  const executor = executors[name];
  if (!executor) {
    return {
      content: `Unknown tool: ${name}`,
      is_error: true,
    };
  }
  return executor(input);
}
