# grain - TypeScript Coding Agent

## Architecture

TypeScript + Bun runtime. Streaming agent loop with tool execution, engram HTTP memory, and JSON session storage.

Location: ~/grain/
Binary: ~/bin/grain (built with `bun run build && cp dist/cli.js ~/bin/grain`)
Config: ~/.grain/config.json
Sessions: ~/.grain/sessions/ (JSON files)
Skills: ~/.grain/skills/*.json

## Key Commands

```bash
# One-shot task
grain --yes "task description"

# Interactive REPL
grain

# With specific provider/model
grain --provider anthropic --model claude-opus-4-5

# Show help
grain --help
```

## Source Structure

src/
  cli.ts              Entry point, arg parsing
  config.ts           Config management
  system-prompt.ts    Quality standards + cwd/platform injection
  router/
    index.ts          Model routing (Haiku/Sonnet/Opus by complexity)
  agent/
    loop.ts           Core streaming agent loop
    context-tracker.ts  Session file tracking
  providers/
    bedrock.ts        AWS Bedrock (default)
    anthropic.ts      Direct Anthropic API
    openrouter.ts     OpenRouter
    ollama.ts         Local Ollama
    subprocess.ts     Sub-agent delegation
  tools/              13 tools (10 core + 3 power)
    bash.ts           Shell execution with streaming output
    read.ts           File reading with line numbers
    write.ts          File writing + syntax check
    patch.ts          Find/replace
    grep.ts           ripgrep search
    workspace.ts      List files/structure
    git.ts            Git operations
    test-runner.ts    Run tests
    repo-map.ts       Codebase structure map (regex-based, no native deps)
    multi-edit.ts     Batch edits across files
    engram.ts         HTTP-first knowledge base (localhost:7474, subprocess fallback)
    delegate.ts       Sub-agent spawning
    finish.ts         Task completion
  session/
    store.ts          JSON file session storage (no WASM, no native deps)
  skills/
    manager.ts        Skill loading and injection
    types.ts          Skill type definitions
  tui/
    renderer.ts       Streaming ANSI output

## Model Routing

- Trivial/Simple tasks  → Haiku 4.5 (fast, cheap)
- Moderate/Complex      → Sonnet 4.5 (capable)
- Critical              → Opus 4 (maximum quality)

Routing looks at: task keywords, number of files, question vs action, complexity signals.

## Providers

Default: bedrock (us.anthropic.claude-sonnet-4-5-20250929-v1:0)
Auth: AWS profile/env for Bedrock, ANTHROPIC_API_KEY for direct, etc.

## engram Integration

engram HTTP server (port 7474) eliminates subprocess overhead.
Start: `engram -d ~/.engram/knowledge serve --port 7474`

grain auto-detects if HTTP is up, falls back to subprocess if not.
Skills at ~/.grain/skills/ are loaded and injected per-task.

## Build + Test

```bash
cd ~/grain
bun run build          # ~50-100ms
cp dist/cli.js ~/bin/grain

# Test model routing
grain --yes "what is 2+2"                  # should use Haiku
grain --yes "analyze the full architecture of this repo"  # should use Sonnet

# Test repo map
cd ~/grain && grain --yes "use repo_map to show project structure"

# Test engram
grain --yes "use engram to search for grain architecture"
```

## Code Standards

- TypeScript, target node (for npm compat), bundled single file
- Bun for development/build, Node for runtime
- JSON files for sessions (no native deps)
- Streaming via process.stdout.write() not console.log()
- Error handling via try/catch, return {content, is_error}

## Known Pitfalls

1. LSP shows `process`/`Buffer` not found — pre-existing tsconfig issue, bun provides them at runtime, builds fine
2. engram subprocess spawns take 4-12s — always ensure HTTP server is running
3. Model routing uses regex heuristics — complex prompts may route to Haiku incorrectly
4. tool_use_delta events accumulate JSON — large file writes are expected, not a freeze
5. delegate tool runs in isolated context (no shared file state with parent)
