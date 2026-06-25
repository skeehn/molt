# Contributing to grain

Thank you for your interest in contributing to grain! 🌾

grain is a self-improving AI coding agent that learns from every project. Your contributions help make it smarter for everyone.

## How to Contribute

### 1. Report Bugs

Found a bug? [Open an issue](https://github.com/skeehn/grain/issues) with:
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Node/Bun version, grain version)
- Relevant logs or screenshots

### 2. Suggest Features

Have an idea? [Open a feature request](https://github.com/skeehn/grain/issues) with:
- Problem statement (what pain point does this solve?)
- Proposed solution
- Example usage
- Why this makes grain 10x better

### 3. Submit Pull Requests

**Before starting:**
- Check existing issues and PRs to avoid duplication
- For large changes, open an issue first to discuss

**PR Guidelines:**
- Fork the repo and create a branch from `main`
- Follow the existing code style
- Add tests if applicable
- Update documentation (README, ARCHITECTURE, etc.)
- Write clear commit messages
- Ensure `bun run build` passes

**Commit message format:**
```
<emoji> <type>: <description>

Examples:
✨ feat: Add watch mode for file changes
🐛 fix: Handle missing engram binary gracefully
📚 docs: Update installation instructions
🧹 chore: Remove temporary test files
```

### 4. Contribute Skills

grain learns via skills! Share your patterns:
- Create a skill JSON in `~/.grain/skills/`
- Test it on 2-3 real projects
- Submit via PR to `skills/community/`
- Include: pattern, approach, code, examples

**Skill quality bar:**
- Solves a real, recurring problem
- Works across 3+ projects
- Clear pattern matching (keywords, regex)
- Concrete code examples
- Success rate > 70%

## Development Setup

```bash
# Clone repo
git clone https://github.com/skeehn/grain.git
cd grain

# Install dependencies
bun install

# Build
bun run build

# Run locally
bun run src/cli.ts "your prompt"

# Test
bun test
```

## Project Structure

```
grain/
├── src/
│   ├── agent/          # Agent loop, context tracking
│   ├── tools/          # Tools (read, write, KG, etc.)
│   ├── skills/         # Skills system
│   ├── providers/      # LLM providers (Bedrock, Anthropic, etc.)
│   ├── router/         # Smart model routing
│   └── cli.ts          # CLI entry point
├── dist/               # Built output
├── README.md           # User-facing docs
├── ARCHITECTURE.md     # Technical deep-dive
├── EXAMPLES.md         # Real-world demos
└── LAUNCH-STRATEGY.md  # Go-to-market plan
```

## Code Style

- **TypeScript**: Strict mode, explicit types
- **Formatting**: Use existing patterns (we'll add Prettier soon)
- **Naming**: 
  - Functions: `camelCase` (e.g., `extractKnowledgeGraph`)
  - Files: `kebab-case` (e.g., `knowledge-graph.ts`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `VALID_PROVIDERS`)

## Testing

- Unit tests: `bun test`
- Integration tests: Test on real projects
- Manual QA: Run on 3 different project types (Rust, TS, Go)

## Documentation

Update docs when you:
- Add a new tool
- Add a new feature
- Change CLI commands
- Change configuration format

Files to update:
- `README.md` (user-facing)
- `ARCHITECTURE.md` (technical)
- `EXAMPLES.md` (usage demos)

## Community

- **Discord**: [grain.ai/discord](https://grain.ai/discord)
- **Twitter**: [@grain_ai](https://twitter.com/grain_ai)
- **Issues**: [GitHub Issues](https://github.com/skeehn/grain/issues)

## Code of Conduct

- Be respectful and constructive
- Help newcomers
- No harassment, discrimination, or spam
- Focus on improving grain for everyone

## Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md` (coming soon)
- Release notes
- Project README

Top contributors get:
- Maintainer status
- Early access to features
- Free Pro tier (when launched)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for making grain better!** 🌾🚀

Every contribution—bug report, feature idea, PR, or skill—makes grain smarter for everyone.

Let's build the future of self-improving AI agents together.
