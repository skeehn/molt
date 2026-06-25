# grain

**Self-improving AI coding agent that learns from your codebase**

grain is an AI agent that gets smarter with every project. It builds knowledge graphs, learns patterns, and saves skills—creating a feedback loop that makes it more effective over time.

## Key Features

- **Knowledge Graphs**: Extract deep codebase understanding (196 entities tested on real projects)
- **Self-Improvement**: Proven 4x improvement loop—learns from mistakes and saves skills
- **Skills System**: Captures and reuses successful patterns across sessions
- **Multi-Language**: Native support for Rust, TypeScript, Go, Python
- **Context Tracking**: Persistent session memory via engram + SQLite

## Quick Start

```bash
# Install
bun install

# Run your first command
grain -p "analyze this codebase"

# Interactive mode
grain
```

**Example output:**
```
📊 Extracted 63 entities, 89 relationships
🧠 Learned 3 new patterns
💾 Saved skill: optimize-rust-performance
```

## Capabilities

- **Analyze Projects**: Deep understanding of structure, dependencies, data flow
- **Extract Knowledge Graphs**: Entities, relationships, and architectural patterns
- **Learn Patterns**: Identifies successful approaches and saves them as reusable skills
- **Suggest Skills**: Recommends relevant skills based on current context
- **Multi-Provider LLM**: Bedrock, Anthropic, OpenRouter, Ollama support
- **Sub-Agent Delegation**: Parallelize complex tasks

## Real Project Results

**engram** (Rust): 196 entities, 10 crates, complete knowledge graph
**ironrun** (Rust): 63 entities, 89 relationships mapped
**grain** (TypeScript): Full self-analysis and improvement loop

## Architecture

Built in TypeScript with Bun runtime. Streaming agent loop with:
- Tool execution engine (bash, read, write, patch, grep)
- engram knowledge base integration
- Session persistence (SQLite)
- Raw streaming TUI (Claude Code style)

```
grain (agent loop)
  ↓
engram (knowledge base)
  ↓
skills (reusable patterns)
  ↓
improved performance
```

## What Makes grain Different

**The self-improvement loop actually works.**

Proven 4x on real projects: grain analyzes codebases, extracts knowledge, identifies patterns, saves skills, and applies them to new problems. Each session makes it smarter.

Not just code generation—**code understanding that compounds**.

---

**Location**: ~/grain  
**Binary**: ~/bin/grain  
**License**: MIT
