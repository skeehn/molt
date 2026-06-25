# grain: The Universal AI Agent Interface

**Use grain as your ONE tool to orchestrate ALL AI coding agents**

---

## Why grain?

Instead of learning and switching between:
- `codex` for OpenAI workflows
- `claude` for Anthropic workflows  
- `aider` for git-focused work
- `cursor` for IDE work

**Use grain to orchestrate them all** 🎯

---

## How It Works

grain has a `delegate` tool that can spawn:
1. **grain subagents** - Smart-routed multi-provider agents
2. **codex** - OpenAI Codex CLI (full-auto mode)
3. **claude-code** - Anthropic Claude Code CLI

This means you can:
```bash
# Use grain directly (multi-provider, smart routing)
grain "analyze this codebase"

# Or delegate to codex when you want OpenAI specifically
grain "use codex to implement this feature"

# Or delegate to claude-code when you want Claude specifically  
grain "use claude-code to review this PR"

# grain picks the best tool for the job!
```

---

## The One Command Workflow

### OLD WAY (context switching hell):
```bash
# Terminal 1: codex for OpenAI
codex "task 1"

# Terminal 2: claude for Anthropic
claude "task 2"

# Terminal 3: aider for git
aider "task 3"

# You have to remember which tool for what
# You have to manage 3 different contexts
# You have to learn 3 different UIs
```

### NEW WAY (grain orchestrates):
```bash
# One terminal, one command
grain "task 1"  # grain picks best provider

grain "use codex for task 2"  # grain delegates to codex

grain "use claude-code for task 3"  # grain delegates to claude

# grain is your universal interface
# grain tracks ALL context across sessions
# grain learns from ALL your work (skills)
```

---

## Delegation Examples

### Example 1: Delegate to Codex
```bash
grain "delegate to codex: implement a binary search tree in Python with tests"
```

grain will:
1. Recognize the `delegate` request
2. Spawn `codex --approval-mode full-auto`
3. Pass the task
4. Return the result
5. Store in session history

### Example 2: Delegate to Claude Code
```bash
grain "use claude-code to refactor this file for better type safety"
```

grain will:
1. Detect `claude-code` mention
2. Spawn `claude -p "..."`
3. Stream the output
4. Integrate result
5. Learn from the pattern (skills)

### Example 3: Smart Routing
```bash
grain "implement quicksort"
```

grain will:
1. Analyze task complexity
2. Check cost vs quality
3. Pick best provider (maybe codex, maybe claude, maybe bedrock)
4. Execute
5. Learn what worked

---

## Configuration

### ~/.grain/config.json
```json
{
  "provider": "bedrock",
  "model": "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
}
```

### Delegation Settings (Auto-detected)
- **codex**: Requires `codex` in PATH → `/opt/homebrew/bin/codex` ✅
- **claude-code**: Requires `claude` in PATH → `~/.local/bin/claude` ✅
- **bedrock**: Requires `AWS_REGION` env var ✅
- **anthropic**: Requires `ANTHROPIC_API_KEY` env var
- **openrouter**: Requires `OPENROUTER_API_KEY` env var
- **ollama**: Requires ollama running locally

grain auto-detects what's available and routes intelligently.

---

## Benefits of Using grain as Your Interface

### 1. **Context Continuity** 📊
ALL conversations stored in one place:
```bash
~/.grain/sessions.db  # 70 sessions, 705 messages
```

### 2. **Cost Tracking** 💰
grain tracks tokens and costs across ALL providers:
```
Simple task → bedrock (cheap, fast)
Complex task → claude-code (expensive, smart)
```

### 3. **Skills Compound** 🧠
grain learns from codex, claude-code, and its own work:
```bash
~/.grain/skills/  # 8 skills, grows over time
```

### 4. **Knowledge Graphs** 🕸️
grain builds knowledge graphs from ALL your projects:
```bash
grain "extract knowledge graph"
# Works across codex output, claude output, your own code
```

### 5. **Session Persistence** 💾
Resume ANY conversation from ANY agent:
```bash
grain --resume  # Picks up where you left off
```

### 6. **Multi-Turn Workflows** 🔄
```bash
grain "analyze codebase"         # grain does it
grain "now use codex to fix bugs"  # delegates to codex  
grain "now use claude to review"   # delegates to claude
# All in one conversation, tracked, learned
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│              grain CLI                  │
│    (Your universal interface)           │
└─────────────┬───────────────────────────┘
              │
              ├─► Smart Router
              │   ├─► bedrock (AWS)
              │   ├─► anthropic (Direct)
              │   ├─► openrouter (Multi-model)
              │   └─► ollama (Local)
              │
              ├─► Subprocess Delegation
              │   ├─► codex (OpenAI CLI)
              │   └─► claude-code (Anthropic CLI)
              │
              ├─► Skills System
              │   └─► Learns from ALL agents
              │
              ├─► Knowledge Graphs
              │   └─► Understands ALL codebases
              │
              └─► Session DB
                  └─► Tracks ALL conversations
```

---

## Testing Delegation

### Test 1: Verify codex works
```bash
grain "delegate to codex: what is 2+2?"
```

Expected output:
```
🧠 Delegating to codex...
[codex output]
✓ Task complete.
```

### Test 2: Verify claude-code works
```bash
grain "use claude-code to explain this file"
```

Expected output:
```
🧠 Delegating to claude-code...
[claude output]
✓ Task complete.
```

### Test 3: Verify smart routing works
```bash
grain "simple task: hello world"
```

Expected:
```
🧠 Simple task → using fast, cheap model (bedrock)
```

---

## Comparison

| Feature | grain Orchestrator | codex alone | claude alone |
|---------|-------------------|-------------|--------------|
| **One interface** | ✅ | ❌ | ❌ |
| **Multi-provider** | ✅ 4+ | ❌ OpenAI only | ❌ Anthropic only |
| **Can use codex** | ✅ Delegate | ✅ Native | ❌ |
| **Can use claude** | ✅ Delegate | ❌ | ✅ Native |
| **Cost tracking** | ✅ All providers | ❌ | ❌ |
| **Skills learning** | ✅ Compounds | ❌ | ❌ |
| **Session DB** | ✅ SQLite | ❌ | ❌ |
| **Context graphs** | ✅ engram | ❌ | ❌ |
| **Smart routing** | ✅ Task-based | ❌ | ❌ |

---

## The Vision

**grain is not replacing codex or claude-code.**

**grain is the conductor of the orchestra.** 🎼

- codex is your OpenAI specialist
- claude-code is your Anthropic specialist
- grain is the interface that knows when to use each

You think in terms of tasks, not tools.
grain figures out the best tool for the job.

---

## Next Steps

1. **Test delegation** (5 min) - Verify codex + claude-code work
2. **Document workflow** (5 min) - Write your personal playbook
3. **Use it daily** (ongoing) - Make grain your default

**Result:** ONE command, ALL capabilities, FULL context. 🚀

---

**grain: Your universal AI coding interface** 🌾
