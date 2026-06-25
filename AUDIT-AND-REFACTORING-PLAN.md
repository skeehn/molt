# molt Codebase Audit & Refactoring Plan

**Date:** June 25, 2026  
**Audit By:** molt (self-analysis)  
**Status:** Phase 1 Complete ✅

---

## Codebase Stats

### Actual Size (excluding node_modules)
- **Total LOC:** 5,631
- **Files:** 42 TypeScript files
- **Reality Check:** The 1.3M LOC was node_modules! 😅

### Largest Files (Refactoring Targets)
1. **project-explainer.ts** - 691 LOC
2. **context-tracker.ts** - 461 LOC  
3. **loop.ts** - 420 LOC → **381 LOC** ✅ (refactored)
4. **dataflow-analyzer.ts** - 406 LOC

---

## Refactoring Completed

### ✅ **loop.ts** - Extracted Plan Parser (31 LOC)

**What We Did:**
- Created `src/agent/loop/` module directory
- Extracted `parsePlanFromText` function
- Moved `PlanStep` interface
- Updated imports
- **Result:** 420 → 381 LOC (9% reduction)

**Commit:** molt self-refactor: Extract plan parser to separate module

---

## Refactoring Plan (Prioritized)

### 🔴 **HIGH PRIORITY** - Do Next

#### 1. **project-explainer.ts** (691 → ~450 LOC target)

**Split into 4 modules:**

```
src/tools/project-explainer/
├── index.ts (main coordinator, ~120 LOC)
├── detectors.ts (type detection, ~150 LOC)
│   ├── detectProjectType()
│   ├── detectLanguages()
│   ├── detectFrameworks()
│   └── detectBuildSystem()
├── analyzers.ts (language analyzers, ~200 LOC)
│   ├── analyzeRustWorkspace()
│   ├── analyzeTypeScriptProject()
│   ├── findTests()
│   └── analyzeBuildSystem()
└── file-utils.ts (utilities, ~150 LOC)
    ├── findEntryPoints()
    ├── findDocumentation()
    ├── countLinesInDir()
    └── traverseDirectory()
```

**Specific Extractions:**
- Lines 78-161 → `detectors.ts`
- Lines 240-306, 330-377, 416-462 → `analyzers.ts`
- Lines 164-221, 224-237, 309-327 → `file-utils.ts`

**Duplicate Logic Found:**
- Directory traversal repeated 3x (lines 309-327, 483)
- File detection patterns (lines 78-161)
- Entry point finding per-language (lines 164-221)

#### 2. **loop.ts** (381 → ~250 LOC target)

**Further Splits:**

```
src/agent/loop/
├── index.ts (main loop, ~100 LOC)
├── plan-parser.ts ✅ (done, 39 LOC)
├── phases.ts (phase execution, ~150 LOC)
│   ├── executeUnderstand()
│   ├── executePlan()
│   ├── executeToolCall()
│   └── executeVerify()
├── approval.ts (plan approval, ~50 LOC)
└── interactive.ts (user prompts, ~50 LOC)
```

**Specific Extractions:**
- Lines 92-113 → `phases.ts::executeUnderstand()`
- Lines 122-240 → `phases.ts::executePlan()`
- Lines 245-296 → `phases.ts::executeToolCall()`
- Lines 311-341 → `phases.ts::executeVerify()`
- Lines 224-239 → `approval.ts::requestPlanApproval()`

**Complexity Issues:**
- Main while loop is 298 lines (lines 90-388)
- Stream handling too complex (lines 148-211)
- User prompt logic repeated 3x

### 🟡 **MEDIUM PRIORITY** - After High Priority

#### 3. **context-tracker.ts** (461 → ~350 LOC target)

**Split into 4 modules:**

```
src/agent/context-tracker/
├── index.ts (main class, ~100 LOC)
├── session.ts (session management, ~150 LOC)
├── cache.ts (project caching, ~120 LOC)
└── engram-bridge.ts (engram integration, ~50 LOC)
```

**Duplicate Logic:**
- Lines 100-116: Three similar `track*` methods → consolidate
- Lines 289-325: Git commit checking duplicated

#### 4. **dataflow-analyzer.ts** (406 → ~350 LOC target)

**Split into 3 modules:**

```
src/tools/dataflow-analyzer/
├── index.ts (main, ~100 LOC)
├── extractors.ts (language-specific, ~200 LOC)
└── renderers.ts (ASCII/Mermaid output, ~120 LOC)
```

---

## Shared Utilities Needed

**Create these common modules:**

### `src/utils/file-traversal.ts`
- `countLinesInDir()` - used in project-explainer, workspace
- `findFiles()` - used in project-explainer, dataflow-analyzer
- `traverseDirectory()` - used everywhere

### `src/utils/git.ts`
- `getGitCommit()` - used in context-tracker
- `getGitStatus()` - used in git.ts tool
- `getGitDiff()` - future use

### `src/utils/parsers.ts`
- `parseCargoToml()` - used in project-explainer
- `parsePackageJson()` - used everywhere
- `parseMakefile()` - used in project-explainer

---

## Refactoring Strategy

### Phase 1: Quick Wins ✅ (DONE)
- ✅ Extract plan parser from loop.ts (31 LOC saved)

### Phase 2: Major Splits (Next 2-3 hours)
1. **Split project-explainer.ts** (45 min)
   - Biggest file, clear module boundaries
   - High duplication
   
2. **Split loop.ts phases** (60 min)
   - Core complexity reduction
   - Makes agent loop maintainable

3. **Create shared utilities** (30 min)
   - Prevents future duplication
   - file-traversal.ts, git.ts, parsers.ts

### Phase 3: Polish (Later)
4. Split context-tracker.ts (45 min)
5. Split dataflow-analyzer.ts (30 min)

---

## Expected Impact

### Before Refactoring:
- Largest file: 691 LOC
- Average file: 134 LOC
- Duplicate code: ~15%

### After Phase 2:
- Largest file: ~250 LOC
- Average file: 95 LOC
- Duplicate code: ~5%
- **Maintainability: 3x better**

---

## Testing Strategy

**After each refactor:**
1. `bun run build` - must pass
2. Test basic operations:
   ```bash
   molt "create test.txt"
   molt "read that file"
   molt "explain this project"
   ```
3. Git commit with descriptive message

---

## Automation Opportunity

**molt can refactor molt!**

```bash
# Let molt do the refactoring
molt "split project-explainer.ts into 4 modules as described in the audit plan"

# molt will:
# 1. Read the audit plan
# 2. Create module directories
# 3. Extract functions
# 4. Update imports
# 5. Test build
# 6. Verify functionality
```

**This is the future:** AI agents maintaining their own code.

---

## Progress Tracking

- [x] Audit complete (self-analysis by molt)
- [x] Phase 1: Extract plan parser ✅
- [ ] Phase 2.1: Split project-explainer.ts
- [ ] Phase 2.2: Split loop.ts phases
- [ ] Phase 2.3: Create shared utilities
- [ ] Phase 3.1: Split context-tracker.ts
- [ ] Phase 3.2: Split dataflow-analyzer.ts

---

**Next Command:**
```bash
molt --yes --concise -p "split project-explainer.ts into modules: detectors.ts, analyzers.ts, file-utils.ts as described in AUDIT plan"
```

Let molt refactor molt! 🚀
