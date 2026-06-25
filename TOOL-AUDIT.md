# grain Tool Audit & Optimization

**Goal:** Reduce from 19 tools to 10-15 core tools for efficiency

---

## CURRENT TOOLS (19 total)

### Core Tools (Essential - 10)
1. **bash** - Execute shell commands ✅ KEEP
2. **read** - Read files ✅ KEEP
3. **write** - Write files ✅ KEEP
4. **patch** - Edit files (find/replace) ✅ KEEP
5. **grep** - Search in files ✅ KEEP
6. **workspace_scan** - Understand project structure ✅ KEEP
7. **git_status** - Git operations ✅ KEEP (merge 3 git tools)
8. **run_tests** - Execute tests ✅ KEEP
9. **delegate** - Spawn subagents ✅ KEEP
10. **finish** - Mark task complete ✅ KEEP

### Advanced Tools (Nice-to-Have - 6)
11. **engram** - Knowledge storage ⚠️ OPTIONAL (external dep)
12. **semantic_search** - Semantic file search ⚠️ OPTIONAL (can use grep)
13. **multi_edit** - Multi-file edits ⚠️ OPTIONAL (can use patch multiple times)
14. **project_explainer** - Explain codebase ⚠️ OPTIONAL (can derive from workspace_scan)
15. **analyze_dataflow** - Data flow analysis ⚠️ OPTIONAL (specialized)
16. **extract_knowledge_graph** - KG extraction ⚠️ OPTIONAL (specialized)

### Utility Tools (Low Priority - 3)
17. **git_checkpoint** - Git commit 🔴 MERGE with git_status
18. **git_rollback** - Git rollback 🔴 MERGE with git_status
19. **cost_summary** - Cost tracking 🔴 REMOVE (can log internally)

---

## RECOMMENDATIONS

### Option A: Minimal Core (10 tools)
**Keep:** bash, read, write, patch, grep, workspace_scan, git (merged), run_tests, delegate, finish

**Remove:** engram, semantic_search, multi_edit, project_explainer, analyze_dataflow, extract_knowledge_graph, cost_summary

**Impact:**
- ✅ Fewest tokens
- ✅ Fastest execution
- ❌ Loses unique features (KG, engram)

### Option B: Competitive (15 tools)
**Keep:** All core 10 + engram, semantic_search, multi_edit, project_explainer, extract_knowledge_graph

**Remove:** analyze_dataflow, cost_summary, split git tools

**Impact:**
- ✅ Keeps competitive advantages
- ✅ Still reasonable token count
- ✅ Maintains grain's USPs

### Option C: Current (19 tools)
**Keep:** Everything

**Impact:**
- ❌ High token usage
- ❌ Slower model decisions
- ✅ Maximum capability

---

## RECOMMENDED: Option B (15 tools)

### Merge Git Tools Into One
```typescript
// OLD:
git_checkpoint, git_rollback, git_status

// NEW:
git: {
  actions: ['status', 'commit', 'rollback']
}
```

### Remove
1. **cost_summary** - Track internally, don't expose as tool
2. **analyze_dataflow** - Too specialized, rarely used

### Keep Unique Features
- **engram** - Unique to grain
- **extract_knowledge_graph** - Unique to grain
- **semantic_search** - Better than grep for large codebases
- **multi_edit** - Efficiency for bulk changes
- **project_explainer** - Quick codebase understanding

---

## TOKEN IMPACT

### Before (19 tools)
Estimated tool schema tokens: ~3,000 tokens per request

### After (15 tools)
Estimated tool schema tokens: ~2,400 tokens per request

**Savings:** 600 tokens per request (20% reduction)

---

## IMPLEMENTATION

### Step 1: Merge Git Tools
```typescript
// src/tools/git.ts
export const gitTool: Tool = {
  name: 'git',
  description: 'Git operations: status, commit, rollback',
  parameters: {
    action: 'status' | 'commit' | 'rollback',
    message: string, // for commit
    ref: string, // for rollback
  }
};
```

### Step 2: Remove cost_summary
```typescript
// src/tools/index.ts
// Remove: costTrackingTool
// Track costs internally in agent loop instead
```

### Step 3: Remove analyze_dataflow
```typescript
// src/tools/index.ts
// Remove: dataFlowTool
// Keep logic for future use, but don't expose as tool
```

### Step 4: Update TOOLS array
```typescript
export const TOOLS: Tool[] = [
  // Core (10)
  bashTool,
  readTool,
  writeTool,
  patchTool,
  grepTool,
  workspaceScanTool,
  gitTool, // Merged
  runTestsTool,
  delegateTool,
  finishTool,
  
  // Advanced (5)
  engramTool,
  semanticSearchTool,
  multiEditTool,
  projectExplainerTool,
  knowledgeGraphTool,
];
// Total: 15 tools
```

---

## MCP SUPPORT

### Current Status: ❌ NOT IMPLEMENTED

### What's Needed:
1. MCP server configuration in ~/.grain/config.json
2. Dynamic tool loading from MCP servers
3. Tool schema translation (MCP → grain format)

### Implementation:
```typescript
// src/mcp/client.ts
export class MCPClient {
  async loadServers(): Promise<void> {
    // Read ~/.grain/mcp.json
    // Connect to each MCP server
    // Load tool schemas
    // Register as grain tools
  }
}

// src/tools/index.ts
import { loadMCPTools } from '../mcp/client.js';

export async function getTools(): Promise<Tool[]> {
  const builtinTools = [...TOOLS];
  const mcpTools = await loadMCPTools();
  return [...builtinTools, ...mcpTools];
}
```

---

## NEXT STEPS

1. ✅ Merge git tools (15 min)
2. ✅ Remove cost_summary tool (5 min)
3. ✅ Remove analyze_dataflow tool (5 min)
4. ✅ Test with 15 tools (10 min)
5. ⏸️ Add MCP support (1 hour) - Can be post-launch

**Total time:** 35 minutes

**Result:** 15 tools, 20% token savings, keeps unique features
