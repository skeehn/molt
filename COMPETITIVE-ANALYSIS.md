# Competitive Analysis: grain vs. Leading AI Agent Harnesses

**Date:** June 25, 2026  
**Goal:** Compare grain to industry leaders, identify gaps, become THE BEST

---

## COMPETITORS

### 1. **Aider** (github.com/paul-gauthier/aider)
- **Focus:** AI pair programming
- **Languages:** Python, JavaScript, Java, C++, etc.
- **Model Support:** Claude, GPT-4, local models
- **Key Features:**
  - Git integration (commits, branches)
  - Whole repo context (map files)
  - Edit format (SEARCH/REPLACE blocks)
  - Voice coding support
  - Multi-file edits

### 2. **Codex CLI** (OpenAI)
- **Focus:** Command-line coding assistant
- **Languages:** All major languages
- **Model Support:** GPT-4, o1
- **Key Features:**
  - Natural language → code
  - Context from repository
  - Streaming responses
  - Interactive mode

### 3. **Claude Code CLI** (Anthropic)
- **Focus:** Code generation and modification
- **Languages:** All major languages
- **Model Support:** Claude 3.5 Sonnet, Opus
- **Key Features:**
  - Long context (200K tokens)
  - Artifact generation
  - Computer use (beta)
  - Tool use optimization

### 4. **OpenCode** (DeepSeek)
- **Focus:** Open-source coding agent
- **Languages:** Python-first, multi-language
- **Model Support:** DeepSeek-V3, local models
- **Key Features:**
  - Open source
  - Local-first
  - Repository understanding
  - Test generation

### 5. **Pi / Continue.dev**
- **Focus:** IDE integration
- **Languages:** All via IDE
- **Model Support:** Multiple (OpenAI, Anthropic, local)
- **Key Features:**
  - VS Code / JetBrains integration
  - Tab completion
  - Inline editing
  - Slash commands

### 6. **Cursor** (Commercial)
- **Focus:** AI-first IDE
- **Languages:** All via IDE
- **Model Support:** GPT-4, Claude
- **Key Features:**
  - Native IDE
  - Composer (multi-file edit)
  - Context retrieval
  - Chat + edit modes

---

## COMPARATIVE ANALYSIS

### Feature Matrix

| Feature | grain | Aider | Codex | Claude Code | OpenCode | Continue | Cursor |
|---------|-------|-------|-------|-------------|----------|----------|--------|
| **Multi-language** | ✅ | ✅ | ✅ | ✅ | ⚠️ Python | ✅ | ✅ |
| **Multi-provider** | ✅ 4 | ⚠️ 3 | ❌ 1 | ❌ 1 | ⚠️ 2 | ✅ Many | ⚠️ 2 |
| **Knowledge graphs** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Self-improving** | ✅ Skills | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Smart routing** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Session history** | ✅ DB | ⚠️ File | ❌ | ❌ | ❌ | ⚠️ File | ✅ |
| **Context tracking** | ✅ | ✅ Map | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ |
| **Git integration** | ⚠️ Basic | ✅ Auto | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ |
| **Voice input** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **IDE integration** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ Native |
| **Streaming** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tool count** | 20+ | ~10 | ~15 | ~20 | ~12 | ~15 | ~25 |
| **Open source** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Local-first** | ⚠️ | ⚠️ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **MCP support** | ❓ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Cost tracking** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Context compaction** | ✅ engram | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## COMPETITIVE ADVANTAGES (grain)

### What grain WINS on:
1. ✅ **Self-improving** - Skills system learns patterns
2. ✅ **Knowledge graphs** - Deep codebase understanding
3. ✅ **Multi-provider** - 4 providers (bedrock, anthropic, openrouter, ollama)
4. ✅ **Smart routing** - Cost-optimized model selection
5. ✅ **Cost tracking** - Built-in token/cost monitoring
6. ✅ **Context compaction** - engram integration
7. ✅ **Open source** - MIT license
8. ✅ **Session DB** - Persistent conversation history

### What grain LOSES on:
1. ❌ **IDE integration** - Continue/Cursor have native IDE support
2. ❌ **Voice input** - Aider has voice coding
3. ❌ **Git auto-commit** - Aider commits automatically
4. ❌ **Multi-file edits** - Cursor Composer is superior
5. ❌ **Map files** - Aider's repo map is smart
6. ❓ **MCP support** - Need to verify/add
7. ❌ **Tool minimalism** - We have 20+ tools, others 10-15

---

## CRITICAL GAPS TO FIX

### 1. MCP Server Support ❓
**Status:** Need to check if implemented  
**Impact:** HIGH - Modern standard for tool integration  
**Priority:** CRITICAL

### 2. Tool Count (20+ tools)
**Status:** Too many tools = more tokens, slower  
**Impact:** HIGH - Affects context window, cost  
**Priority:** HIGH

### 3. Real Work Verification
**Status:** Need to verify grain actually executes, not just plans  
**Impact:** CRITICAL - Must DO work, not just talk about it  
**Priority:** CRITICAL

### 4. Git Integration
**Status:** Basic git_status tool, no auto-commit  
**Impact:** MEDIUM - Nice to have  
**Priority:** MEDIUM

### 5. Context Management
**Status:** Has compaction, but needs testing  
**Impact:** HIGH - Long conversations must work  
**Priority:** HIGH

---

## TESTS TO RUN

### Test 1: Real Work vs. Planning
**Goal:** Verify grain DOES work, not just plans  
**Method:** Give task, verify files changed

### Test 2: Token Efficiency
**Goal:** Compare token usage vs. competitors  
**Method:** Same task, measure tokens used

### Test 3: Tool Minimalism
**Goal:** Audit if all 20+ tools are necessary  
**Method:** Check tool usage frequency

### Test 4: Context Window Management
**Goal:** Test 50+ turn conversation  
**Method:** Long conversation, verify no loss

### Test 5: Multi-File Editing
**Goal:** Can grain edit multiple files?  
**Method:** Task requiring 3+ file changes

### Test 6: Model Routing
**Goal:** Verify smart routing works  
**Method:** Various tasks, check model selection

### Test 7: Skills Learning
**Goal:** Verify skills system compounds  
**Method:** Repeat similar tasks, check improvement

### Test 8: Knowledge Graph Accuracy
**Goal:** Verify KG is accurate and useful  
**Method:** Compare to manual analysis

### Test 9: Session Continuity
**Goal:** Resume old conversation  
**Method:** Exit, restart, verify context

### Test 10: MCP Integration
**Goal:** Verify MCP servers work  
**Method:** Add MCP server, use tools

---

## IMPROVEMENT PLAN

### Phase 1: Critical Fixes (1 hour)
1. Verify MCP support (or add if missing)
2. Test real work execution
3. Audit tool count, remove unnecessary
4. Fix any planning-only behavior

### Phase 2: Token Optimization (30 min)
1. Minimize tool schemas
2. Optimize system prompt
3. Test context compaction
4. Add streaming for large responses

### Phase 3: Competitive Testing (1 hour)
1. Run same task on grain vs. competitors
2. Measure tokens, time, quality
3. Identify remaining gaps
4. Make final improvements

---

## SUCCESS CRITERIA

grain is THE BEST when:
- ✅ Does real work (not just planning)
- ✅ Uses fewer tokens than competitors
- ✅ Supports MCP servers
- ✅ Minimal tool count (10-15 core tools)
- ✅ Smart model routing works
- ✅ Context managed efficiently
- ✅ Skills compound over time
- ✅ Knowledge graphs add value
- ✅ Session continuity works
- ✅ Open source + self-hostable

---

**Next: Run the 10 tests and fix issues found!**
