# molt

TypeScript coding agent with streaming TUI, multi-provider LLM support, and engram knowledge integration.

## Features

- Multi-provider LLM support (Bedrock, Anthropic, OpenRouter, Ollama)
- Raw streaming TUI (Claude Code style)
- engram knowledge base integration
- Sub-agent delegation
- Session persistence (SQLite)
- Full tool suite: bash, read, write, patch, grep, engram
- Bun runtime for speed

## Quick Start

```bash
# Install dependencies
bun install

# Run
molt -p "Create a TypeScript function"

# Or interactive mode
molt
```

## Architecture

Built in TypeScript with Bun runtime. Streaming agent loop with tool execution, engram context injection, and session persistence.

Location: ~/molt
Binary: ~/bin/molt

## License

MIT
