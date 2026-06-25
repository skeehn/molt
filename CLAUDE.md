# grain - TypeScript Coding Agent

## Architecture

TypeScript + Bun runtime. Streaming agent loop with tool execution, engram context injection, and SQLite session persistence.

Location: ~/grain/
Binary: ~/bin/grain (wrapper: bun run ~/grain/src/cli.ts)
Config: ~/.grain/config.json
Sessions: ~/.grain/sessions.db (bun:sqlite)

## Key Commands

```bash
# One-shot task
grain -p "task description"

# Interactive REPL
grain

# Resume last session
grain --resume

# Override provider
grain --provider ollama --model qwen3:32b

# Show config
grain config
```

## Source Structure

src/
  cli.ts              Entry point, arg parsing
  config.ts           Config management
  system-prompt.ts    System prompt with cwd/platform
  agent/
    loop.ts           Core agent loop
    context.ts        Token counting, engram injection
  providers/
    bedrock.ts        AWS Bedrock (default)
    anthropic.ts      Direct Anthropic API
    openrouter.ts     OpenRouter
    ollama.ts         Local Ollama
    subprocess.ts     Sub-agent delegation
  tools/
    bash.ts           Shell execution (50KB cap)
    read.ts           File reading with line numbers
    write.ts          File writing
    patch.ts          Find/replace (3 fuzzy strategies)
    grep.ts           ripgrep search
    engram.ts         Knowledge base queries
    delegate.ts       Sub-agent spawning
    finish.ts         Task completion
  session/
    store.ts          SQLite session storage
  tui/
    renderer.ts       Streaming ANSI output

## Providers

Default: bedrock (us.anthropic.claude-sonnet-4-5-20250929-v1:0)
Auth: AWS profile/env for Bedrock, ANTHROPIC_API_KEY for direct, etc.

## engram Integration

Config in ~/.grain/config.json:
```json
{
  "provider": "bedrock",
  "model": null,
  "engram_db": "~/engram/.engram",
  "max_tokens": 180000
}
```

Before each LLM call:
1. Search engram with last user message
2. Inject top results into system prompt
3. LLM can also call engram tool explicitly

## Tools Available

- bash: Shell commands (50KB stdout truncation)
- read: File reading with line numbers and pagination
- write: File writing (creates parent dirs)
- patch: Find/replace with fuzzy matching
- grep: ripgrep file search
- engram: Knowledge base search/add/get
- delegate: Sub-agent spawning (isolated context)
- finish: Task completion with optional learnings

## Code Standards

- TypeScript strict mode
- Bun runtime (NOT Node)
- Use bun:sqlite not better-sqlite3
- Streaming via process.stdout.write() not console.log()
- Error handling via try/catch, return {content, is_error}

## Known Pitfalls

1. bun:sqlite is builtin - don't npm install it
2. engram CLI needs -d flag BEFORE subcommand
3. Use --target bun for builds, not node
4. delegate tool runs in isolated context (no file persistence)
5. Provider streaming formats differ (Bedrock SSE vs Ollama JSON lines)

## Testing Pattern

Create test files in ~/grain-test/ and run:
```bash
cd ~/grain-test
grain -p "test task description"
```
