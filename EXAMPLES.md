# EXAMPLES

Real-world grain usage demonstrations showing knowledge graphs, skills, and self-improvement.

---

## Example 1: Analyze a Rust Workspace

**Command:**
```bash
grain "analyze ~/engram and extract knowledge graph"
```

**Output:**
```
🧠 Using Claude Sonnet 4
💡 Found 0 relevant skills

📋 Plan:
  1. Extract knowledge graph from ~/engram
  2. Analyze architecture and explain structure

⚡ Extracting knowledge graph...

✅ Found: 196 entities, 10 modules

# Knowledge Graph

## Summary
- **Entities:** 196
- **Relationships:** 0 (runtime data)
- **Modules:** 10 crates
- **Entry Points:** engram-cli/src/main.rs

## Modules
- engram-core (types, IDs)
- engram-store (sled KV)
- engram-embed (Jina v3 API)
- engram-fts (Tantivy)
- engram-vector (HNSW)
- engram-graph (BFS traversal)
- engram-temporal (time-travel)
- engram-query (RRF fusion)
- engram-extract (pipeline)
- engram-cli (binary)

## Architecture

```
┌─────────────────────────────────────────────┐
│              engram-cli                     │  ← CLI
├─────────────────────────────────────────────┤
│         engram-extract (Pipeline)           │  ← Ingestion
├──────────────┬──────────────────────────────┤
│  engram-query (QueryEngine)                 │  ← Search
├──────────────┴──────────────┬───────────────┤
│  engram-graph    engram-temporal            │  ← Analysis
├──────────────┬──────────────┴───────────────┤
│  engram-fts  │  engram-vector │ engram-embed│  ← Indexes
├──────────────┴────────────────┴─────────────┤
│           engram-store (Sled KV)            │  ← Storage
├─────────────────────────────────────────────┤
│           engram-core (Types/IDs)           │  ← Foundation
└─────────────────────────────────────────────┘
```

**Key Innovations:**
- Temporal Datomic-style: Delta log enables time-travel
- 3-Lane Pipeline: Write immediately, embed async
- Hybrid Search: RRF fuses vector/keyword/graph modes
```

**Time:** 45 seconds  
**Entities Extracted:** 196  
**Modules Mapped:** 10  

---

## Example 2: Debug TypeScript Detection

**Problem:** Knowledge graph tool not detecting TypeScript files in single-file projects.

**First Attempt:**
```bash
grain "extract knowledge graph from ~/test-project"
```

**Result:**
```
Found: 2 entities (Project, main.ts as modules)
Expected: 5 entities (1 interface + 4 functions)
```

**Fix:**
```bash
grain "debug why TypeScript files aren't being detected in knowledge graph extraction"
```

**grain's Self-Improvement:**
1. Analyzed knowledge-graph.ts
2. Found project type detection logic
3. Discovered missing `.ts` file check
4. Added: `files.some(f => f.endsWith('.ts'))`
5. Tested fix
6. Removed debug logs
7. Committed working code

**Second Attempt:**
```bash
grain "extract knowledge graph from ~/test-project"
```

**Result:**
```
✅ Found: 5 entities, 8 relationships
- User interface
- createUser function
- getUser function  
- updateUser function
- deleteUser function
- 8 relationships (function calls, type usage)
```

**Outcome:** grain fixed its own bug and extracted correctly! 🎉

---

## Example 3: Skills System in Action

**Query:**
```bash
grain "how do I fix TypeScript detection in a project analyzer?"
```

**grain's Response:**
```
💡 Found 2 relevant skills:
   - Fix TypeScript Detection Bug (75% match)
   - Fix TypeScript Project Detection Bug (74% match)

Using skill: Fix TypeScript Detection Bug

## Approach

1. Check project type detection logic
2. Look for file extension checks (.ts, .tsx)
3. Ensure detection includes: package.json OR tsconfig.json OR .ts files
4. Add files.some(f => f.endsWith('.ts')) check
5. Test on single-file TypeScript projects

## Code Pattern

```typescript
// Fix pattern:
if (files.includes('package.json') || 
    files.includes('tsconfig.json') || 
    files.some((f: string) => f.endsWith('.ts'))) {
  projectType = 'typescript';
}
```

## Example

**Problem:** Knowledge graph detected project as 'unknown' instead of 'typescript'  
**Execution:** Added .ts file check to detection  
**Outcome:** Fixed! 2 → 5 entities extracted ✅

## Why This Works

The root cause is incomplete project type detection. Adding the .ts file check ensures
standalone TypeScript files are recognized even without package.json/tsconfig.json.
```

**Time:** 8 seconds  
**Skill Match:** 75% confidence  
**Saved Time:** ~15 minutes (grain already knew the solution)

---

## Example 4: Inheritance Detection

**Test Project:**
```typescript
// test-inheritance.ts
export interface Flyable {
  fly(): void;
}

export interface Swimmable {
  swim(): void;
}

export class Animal {
  name: string;
}

export class Dog extends Animal {}

export class Bird extends Animal implements Flyable {
  fly() { console.log('Flying!'); }
}

export class Duck extends Animal implements Flyable, Swimmable {
  fly() { console.log('Flying!'); }
  swim() { console.log('Swimming!'); }
}
```

**Command:**
```bash
grain "extract knowledge graph with inheritance relationships"
```

**Output:**
```
Found: 6 entities, 6 relationships

## Entities
- Flyable (interface)
- Swimmable (interface)
- Animal (class)
- Dog (class)
- Bird (class)
- Duck (class)

## Relationships
- Dog → Animal (extends)
- Bird → Animal (extends)
- Bird → Flyable (implements)
- Duck → Animal (extends)
- Duck → Flyable (implements)
- Duck → Swimmable (implements)

## Mermaid Diagram

```mermaid
flowchart TD
  Animal:::classStyle
  Flyable:::typeStyle
  Swimmable:::typeStyle
  Dog:::classStyle
  Bird:::classStyle
  Duck:::classStyle
  
  Dog -->|extends| Animal
  Bird -->|extends| Animal
  Bird -.->|implements| Flyable
  Duck -->|extends| Animal
  Duck -.->|implements| Flyable
  Duck -.->|implements| Swimmable
  
  classDef classStyle fill:#4CAF50,stroke:#333,color:#fff
  classDef typeStyle fill:#FFC107,stroke:#333,color:#000
```
```

**Perfect hierarchy extraction!** ✅

---

## Example 5: Multi-Crate Rust Analysis

**Command:**
```bash
grain "explain the architecture of ~/engram"
```

**Output Highlights:**
- **196 entities** across 10 crates
- **Full dependency graph** (crate → crate relationships)
- **Data flow diagram** (write path + read path)
- **Key innovations identified:**
  - Temporal Datomic-style delta log
  - 3-lane async pipeline
  - RRF fusion for hybrid search
  - Content-addressed storage (SHA-256)
  - JTMS justification tracking

**Time:** 60 seconds  
**Analysis Depth:** Production-grade architectural understanding

---

## Example 6: Self-Improvement #4 (Inheritance)

**grain enhanced itself:**

```bash
grain "add class inheritance and interface implementation detection to knowledge-graph.ts"
```

**What grain did:**
1. Read knowledge-graph.ts (501 lines)
2. Analyzed existing relationship detection
3. Added third-pass for inheritance:
   - `class X extends Y` (TypeScript)
   - `class X implements I, J` (TypeScript)
   - `impl TraitName for StructName` (Rust)
4. Created test file with inheritance examples
5. Tested extraction (0 → 6 relationships)
6. Committed working code

**Result:** grain now detects extends + implements! 🚀

**This is self-improvement #4 proven today.**

---

## Key Takeaways

1. **Knowledge Graphs Work**
   - 196 entities from real Rust workspace
   - Inheritance hierarchies fully mapped
   - Multi-language support proven

2. **Skills Save Time**
   - 75% match confidence
   - Instant answers from learned patterns
   - ~15 minutes saved per matched skill

3. **Self-Improvement is Real**
   - 4x improvements in one day
   - grain fixes its own bugs
   - grain adds its own features
   - Each improvement compounds

4. **Production-Ready Analysis**
   - Handles complex multi-crate projects
   - Extracts architectural insights
   - Generates visual diagrams

---

**grain learns from every project and gets smarter over time.** 🌾
