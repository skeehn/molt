# grain

Self-improving AI coding agent with persistent memory.

```sh
curl -fsSL https://raw.githubusercontent.com/skeehn/grain/main/install.sh | sh
```

---

## What it is

grain is a CLI agent that reads your codebase, writes code, runs commands, and remembers what it learns — across sessions, across projects. It routes tasks to the right model automatically (Haiku for simple, Sonnet for moderate, Opus for complex) to keep costs low.

It uses [engram](https://github.com/skeehn/engram) as a local knowledge graph — every project grain works on gets indexed. The more you use it, the smarter it gets on your specific stack.

---

## Install

**One-liner (recommended):**
```sh
curl -fsSL https://raw.githubusercontent.com/skeehn/grain/main/install.sh | sh
```

Installs `grain` and `engram` to `~/bin/`. Requires Node.js >= 18.

**Then set up your provider:**
```sh
grain init
```

---

## Quick start

```sh
# Explain a codebase
grain "explain the architecture of this project"

# Write code, fully automated
grain --yes "add input validation to src/api/users.ts"

# Debug something
grain "why is the auth middleware returning 401 on valid tokens"

# Build something new
grain "build a dark-themed landing page for this project"
```

---

## Commands

```
grain [task]                  run a task interactively
grain "do something"          one-shot inline task
grain --yes "task"            fully automated, no prompts

grain init                    interactive setup wizard
grain status                  check provider, engram, config
grain update                  update to latest version

grain config                  show current config
grain config set provider <name>
grain config set model <id>
grain config set key <KEY_NAME> <value>    saves to ~/.grain/.env
grain config set engram_db <path>
grain config reset

grain --help                  full help
grain --version               show version
```

---

## Providers

| Provider    | Setup |
|-------------|-------|
| `bedrock`   | `aws configure` or set `AWS_REGION` + `AWS_ACCESS_KEY_ID` |
| `anthropic` | `grain config set key ANTHROPIC_API_KEY sk-ant-...` |
| `openrouter`| `grain config set key OPENROUTER_API_KEY ...` |
| `ollama`    | Install [Ollama](https://ollama.ai), no key needed |

API keys are saved to `~/.grain/.env` — never to your shell profile. grain loads them automatically on startup.

---

## Config

Everything lives in `~/.grain/`:

```
~/.grain/
  config.json       provider, model, settings
  .env              API keys (chmod 600, auto-loaded)
  skills/           project-specific agent skills
  sessions/         conversation logs
```

---

## Memory (engram)

grain uses [engram](https://github.com/skeehn/engram) — a local Rust knowledge graph — for persistent memory. Install script downloads it automatically.

engram starts automatically in the background when you run grain. It runs at `localhost:7474`.

Without engram, grain still works — just without cross-session memory.

---

## Flags

```
-y, --yes          auto-approve all tool calls
-c, --concise      shorter output
--provider <name>  override provider for this run
--model <id>       override model for this run
-h, --help
-v, --version
```

---

## Requirements

- Node.js >= 18
- One of: AWS credentials, Anthropic API key, OpenRouter API key, or Ollama

---

## License

MIT
