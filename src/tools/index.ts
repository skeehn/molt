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
import { gitTool, executeGit } from './git.js';
import { testRunnerTool, executeTestRunner } from './test-runner.js';
import { projectExplainerTool, executeExplainProject } from './project-explainer.js';
import { knowledgeGraphTool, executeExtractKnowledgeGraph } from './knowledge-graph.js';

export const TOOLS: Tool[] = [
  // Core tools (10)
  bashTool,
  readTool,
  writeTool,
  patchTool,
  grepTool,
  workspaceScanTool,
  gitTool,
  testRunnerTool,
  delegateTool,
  finishTool,
  
  // Advanced tools (5)
  engramTool,
  semanticSearchTool,
  multiEditTool,
  projectExplainerTool,
  knowledgeGraphTool,
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
  git: executeGit,
  run_tests: executeTestRunner,
  explain_project: executeExplainProject,
  extract_knowledge_graph: executeExtractKnowledgeGraph,
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
