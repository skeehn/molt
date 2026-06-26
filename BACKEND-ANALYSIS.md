# grain Backend Architecture Analysis

## 1. DATABASE LAYER (sql.js)

### Current Implementation: src/session/store.ts

**Technology:** sql.js (pure JavaScript SQLite)  
**Storage:** ~/.grain/sessions.db  
**Tables:**
- `sessions` - Session metadata
- `messages` - Conversation history

### Concerns to Address:

#### 1.1 Database Initialization
```typescript
let db: SqlJsDatabase | null = null;

async function initDB(): Promise<SqlJsDatabase> {
  if (db) return db;
  const SQL = await initSqlJs();
  // Load from disk or create new
}
```

**Potential Issues:**
- ❓ Race condition if multiple calls to initDB() simultaneously?
- ❓ What happens if database file is corrupted?
- ❓ Is database properly closed on exit?
- ❓ File locking for concurrent access?

#### 1.2 Session Management
**Functions:**
- `createSession()` - Creates new session ID
- `getLastSession()` - Retrieves most recent session
- `getMessages(sessionId)` - Loads conversation history
- `addMessage(sessionId, role, content)` - Appends message

**Potential Issues:**
- ❓ Max session size (will large conversations crash?)
- ❓ Memory leaks from large message arrays?
- ❓ Database write failures handled?
- ❓ Transaction safety?

#### 1.3 Persistence
**Save mechanism:**
```typescript
const data = db.export();
writeFileSync(DB_PATH, Buffer.from(data));
```

**Potential Issues:**
- ❓ Sync writes block event loop?
- ❓ Partial writes if process killed?
- ❓ Disk full errors handled?
- ❓ Backup/recovery strategy?

---

## 2. CONTEXT TRACKING (src/agent/context-tracker.ts)

### Purpose:
Tracks files, tool calls, and project context across conversation

### State Storage:
```typescript
const contextStore = new Map<string, SessionContext>();
```

**Potential Issues:**
- ❓ In-memory only - lost on crash?
- ❓ Memory growth for long sessions?
- ❓ Context compaction works correctly?
- ❓ File reference resolution robust?

---

## 3. AGENT LOOP (src/agent/loop.ts)

### Core Flow:
```
User Input → Provider (LLM) → Tool Calls → Results → Loop
```

### Critical Paths:

#### 3.1 Context Compaction
**Trigger:** When approaching token limit  
**Action:** Compress old messages

**Potential Issues:**
- ❓ Compaction preserves important info?
- ❓ engram integration works or fails gracefully?
- ❓ Compaction doesn't lose tool results?

#### 3.2 Error Handling
**Current:** try/catch blocks around tool execution

**Potential Issues:**
- ❓ Provider API failures recovered?
- ❓ Tool crashes don't kill agent?
- ❓ Infinite loops prevented?
- ❓ Rate limits handled?

#### 3.3 Session Persistence
**Current:** Async addMessage() after each turn

**Potential Issues:**
- ❓ Write failures logged?
- ❓ Session recoverable after crash?
- ❓ await addMessage() errors handled?

---

## 4. PROVIDER LAYER (src/providers/)

### Supported:
- bedrock (AWS Bedrock)
- anthropic (Direct API)
- openrouter (Multi-model)
- ollama (Local)

### Architecture:
```typescript
interface Provider {
  chat(messages: Message[]): Promise<Response>;
  stream?(messages: Message[]): AsyncIterator<Chunk>;
}
```

**Potential Issues:**
- ❓ Network timeouts handled?
- ❓ API key validation before calls?
- ❓ Streaming errors recovered?
- ❓ Rate limiting implemented?

---

## 5. SKILLS SYSTEM (src/skills/)

### Storage: ~/.grain/skills/*.json

### Lifecycle:
```
Load all → Pattern match → Execute → Learn new
```

**Potential Issues:**
- ❓ Malformed skill JSON crashes?
- ❓ Skill loading errors logged?
- ❓ Pattern matching performance OK?
- ❓ Skill execution sandboxed?

---

## 6. KNOWLEDGE GRAPH (src/tools/knowledge-graph.ts)

### External Dependency: ~/bin/engram

**Potential Issues:**
- ❓ engram binary missing - handled gracefully? ✅ YES (warned once)
- ❓ Large codebases timeout?
- ❓ Invalid project paths handled?
- ❓ Parse errors don't crash?

---

## CRITICAL TESTS TO RUN

### Database Tests:
1. **Large session** - Add 1000+ messages, verify memory + performance
2. **Concurrent writes** - Multiple sessions simultaneously
3. **Corruption recovery** - Delete DB file mid-session
4. **Disk full** - Fill disk, verify graceful failure

### Context Tests:
1. **Long conversation** - 50+ turns, verify compaction works
2. **File references** - Track 100+ files, check memory
3. **Context retrieval** - Load old session, verify history

### Agent Loop Tests:
1. **Error cascade** - Tool fails → recovery?
2. **Infinite loop** - Prompt that might loop forever
3. **Provider timeout** - Network failure mid-call
4. **Crash recovery** - Kill process, resume session

### Provider Tests:
1. **Invalid API key** - Clear error message?
2. **Network failure** - Retry logic?
3. **Rate limiting** - Backoff implemented?
4. **Streaming interruption** - Handle mid-stream failures?

### Skills Tests:
1. **Malformed JSON** - Bad skill file doesn't crash?
2. **Pattern matching** - 1000+ skills, performance OK?
3. **Skill execution** - Failures logged, not fatal?

---

## STRESS TESTS

### 1. Memory Leak Test
```bash
# Run 100 consecutive prompts
for i in {1..100}; do
  grain "what is $i + $i?"
done
# Check memory doesn't grow unbounded
```

### 2. Large File Test
```bash
# Analyze huge codebase
cd ~/cilow-next  # 2.6GB project
grain "analyze this entire project"
# Should complete or timeout gracefully
```

### 3. Concurrent Sessions Test
```bash
# Run 10 grain instances simultaneously
for i in {1..10}; do
  grain "task $i" &
done
wait
# Check database integrity
```

### 4. Disk Full Test
```bash
# Fill disk to <100MB
grain "large task"
# Should fail gracefully with clear error
```

---

## MANUAL TESTING CHECKLIST FOR USER

See MANUAL-TESTING-GUIDE.md for step-by-step tests to run yourself.

---

## FIXES NEEDED

Based on this analysis, here are potential improvements:

### High Priority:
1. ❓ Add database write error handling
2. ❓ Implement session size limits
3. ❓ Add memory leak detection
4. ❓ Better error messages for common failures

### Medium Priority:
1. ❓ Add database backup on corruption
2. ❓ Implement provider retry logic
3. ❓ Add skill validation on load
4. ❓ Context compaction safety checks

### Nice-to-Have:
1. Database migration system
2. Session export/import
3. Skill debugging mode
4. Performance monitoring

---

## NEXT: RUN TESTS YOURSELF

I'll create a detailed manual testing guide for you to follow.
