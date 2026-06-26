# grain Quick Reference Card

## Installation
```bash
cd ~/grain
npm install -g grain-0.1.0.tgz
grain init
```

## Basic Usage
```bash
# Simple prompt
grain "your question here"

# Interactive mode
grain
> question 1
> question 2
> Ctrl+C to exit

# Concise mode
grain --concise "question"

# Auto-approve (no confirmation)
grain --yes "task"

# Combined
grain --yes --concise "task"
```

## File Operations
```bash
# Create file
grain "create file.txt with content 'hello'"

# Read file
grain "what's in file.txt?"

# Modify file
grain "change 'hello' to 'hi' in file.txt"

# Multiple files
grain "create 3 files: a.txt, b.txt, c.txt each with different content"
```

## Project Analysis
```bash
# Analyze codebase
grain "analyze this project"

# Count files
grain "how many TypeScript files in src/?"

# Explain architecture
grain "explain the architecture of this codebase"

# Extract knowledge graph
grain "extract knowledge graph"
```

## Iterative Development
```bash
# Step 1: Plan
grain "plan a simple TODO app in one HTML file"

# Step 2: Create
grain "create todo.html based on that plan"

# Step 3: Enhance
grain "add CSS styling to todo.html - dark theme"

# Step 4: Test
grain "add test cases for todo.html functionality"

# Step 5: Review
grain "review todo.html and suggest improvements"
```

## Advanced
```bash
# Delegate to codex (OpenAI)
grain "delegate to codex: implement feature X"

# Delegate to claude-code (Anthropic)
grain "use claude-code to review this file"

# Multi-step task
grain "1. analyze code 2. write tests 3. run tests 4. report results"

# Resume last session
grain --resume
```

## Debugging
```bash
# Check config
cat ~/.grain/config.json

# Check sessions
sqlite3 ~/.grain/sessions.db "SELECT * FROM sessions LIMIT 5;"

# Check skills
ls ~/.grain/skills/

# Check logs (if grain crashes)
# grain doesn't write logs yet, check terminal output
```

## Providers
- **bedrock** (AWS) - Default, needs AWS_REGION
- **anthropic** (Direct) - Needs ANTHROPIC_API_KEY
- **openrouter** - Needs OPENROUTER_API_KEY  
- **ollama** (Local) - Needs ollama running

## Quick Tips
1. **Be specific** - "Create X with Y features" works better than "make something cool"
2. **Iterate** - Build in steps, don't ask for everything at once
3. **Verify** - Check grain's work, it's not perfect
4. **Context matters** - Run grain in the right directory
5. **Multi-turn** - Use interactive mode for related questions

## Common Patterns

### Pattern 1: Scaffold Project
```bash
grain "Create project structure:
- index.html (main page)
- styles.css (dark theme)
- script.js (interactivity)
- README.md (documentation)"
```

### Pattern 2: Fix Bugs
```bash
grain "This code has a bug: [paste code]
Find and fix the issue"
```

### Pattern 3: Refactor
```bash
grain "Refactor this code for better readability:
[paste code]"
```

### Pattern 4: Document
```bash
grain "Add JSDoc comments to all functions in script.js"
```

### Pattern 5: Test
```bash
grain "Create test cases for this function:
[paste function]"
```

## ASCII Website Project (Your Test)
```bash
mkdir ~/ascii-editorial-site && cd ~/ascii-editorial-site

# Round 1
grain "Create index.html: editorial ASCII art website, dark theme"

# Round 2  
grain "Add 3 articles with ASCII borders"

# Round 3
grain "Add interactive hover effects"

# Round 4
grain "Create ascii-art-generator.html tool"

# Round 5
grain "Review and polish everything"
```

## Expected Response Times
- Simple Q&A: 3-5s
- File operations: 5-10s
- Project analysis: 30-60s
- Complex tasks: 1-2 min
- Codex delegation: 30-60s

## Exit Codes
- 0 = Success
- 1 = Error (check output)
- 124 = Timeout

## Getting Help
```bash
grain --help
```

## Evaluation Checklist (During Testing)
- [ ] Installs cleanly
- [ ] Config works
- [ ] Simple prompts fast
- [ ] File ops work
- [ ] Multi-turn context tracked
- [ ] Real project completable
- [ ] Agent loop visible (plan → execute → verify)
- [ ] Error handling graceful
- [ ] No crashes

**Score >85/100 = LAUNCH** 🚀

---

**You've got this! Build something cool!** 🌾
