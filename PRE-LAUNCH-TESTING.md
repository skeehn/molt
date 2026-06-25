# grain: Pre-Launch Deep Testing Plan

**Goal:** Make grain 10x more reliable before launch. Find and fix ALL major bugs.

---

## 1. INSTALLATION TESTING

### Test 1.1: Fresh Install (npm)
**Scenario:** New user installs via npm
```bash
# Simulate fresh machine
mkdir /tmp/grain-test-npm
cd /tmp/grain-test-npm
npm install -g ~/grain
grain --version
grain init
grain "hello world"
```
**Expected:** Works flawlessly, no errors
**Actual:** [TO TEST]

### Test 1.2: Fresh Install (bun)
```bash
mkdir /tmp/grain-test-bun
cd /tmp/grain-test-bun
bun install -g ~/grain
grain --version
grain init
```
**Expected:** Works flawlessly
**Actual:** [TO TEST]

### Test 1.3: Developer Install (clone + build)
```bash
git clone https://github.com/skeehn/grain.git /tmp/grain-dev
cd /tmp/grain-dev
bun install
bun run build
./dist/cli.js --version
```
**Expected:** Build succeeds, binary works
**Actual:** [TO TEST]

---

## 2. CORE FUNCTIONALITY TESTING

### Test 2.1: Basic Commands
- [ ] `grain --help` - Shows help
- [ ] `grain --version` - Shows version
- [ ] `grain init` - Interactive setup works
- [ ] `grain config` - Shows config
- [ ] `grain config set provider anthropic` - Updates config

### Test 2.2: Provider Testing
**For EACH provider (bedrock, anthropic, openrouter, ollama):**
- [ ] Configure provider
- [ ] Run simple prompt: `grain "what is 2+2"`
- [ ] Check response is correct
- [ ] No crashes, no errors

### Test 2.3: Skills System
- [ ] Create a test skill manually at ~/.grain/skills/test-skill.json
- [ ] Run prompt that matches skill (e.g., "fix typescript detection")
- [ ] Verify skill is suggested (💡 icon)
- [ ] Verify skill is loaded and used
- [ ] Check success rate tracking

### Test 2.4: Knowledge Graph
- [ ] Run on TypeScript project: `grain "extract knowledge graph"`
- [ ] Verify entities extracted
- [ ] Verify relationships detected
- [ ] Check Mermaid diagram generation
- [ ] Run on Rust project
- [ ] Run on Go project

### Test 2.5: Context Tracking
- [ ] Run: `grain "create file test.txt with hello"`
- [ ] Run: `grain "read that file"`
- [ ] Verify context remembers "that file" = test.txt

### Test 2.6: Concise Mode
- [ ] Run: `grain --concise "analyze this project"`
- [ ] Verify output is terse
- [ ] Compare with regular mode

---

## 3. ERROR HANDLING TESTING

### Test 3.1: Missing API Keys
- [ ] Unset ANTHROPIC_API_KEY
- [ ] Try to run grain with anthropic provider
- [ ] Verify helpful error message
- [ ] Verify suggests running `grain init`

### Test 3.2: Invalid Provider
- [ ] Set config provider to "invalid"
- [ ] Run grain
- [ ] Verify clear error message

### Test 3.3: Network Failures
- [ ] Disconnect network
- [ ] Run grain with bedrock/anthropic
- [ ] Verify graceful error (not crash)

### Test 3.4: Missing engram
- [ ] Rename ~/bin/engram to ~/bin/engram.bak
- [ ] Run grain
- [ ] Verify warning shown (not crash)
- [ ] Verify grain continues working

### Test 3.5: Malformed Config
- [ ] Edit ~/.grain/config.json with invalid JSON
- [ ] Run grain
- [ ] Verify falls back to defaults (not crash)

### Test 3.6: Tool Failures
- [ ] Run `grain "read file that doesn't exist"`
- [ ] Verify error is handled gracefully
- [ ] Agent continues (doesn't exit)

---

## 4. EDGE CASES & STRESS TESTING

### Test 4.1: Large Projects
- [ ] Run on cilow-next (500K+ LOC)
- [ ] Check doesn't hang or OOM
- [ ] Knowledge graph completes (or times out gracefully)

### Test 4.2: Empty Project
- [ ] Run in empty directory
- [ ] Verify no crash

### Test 4.3: Binary Files
- [ ] Try to analyze directory with images, PDFs
- [ ] Verify no crashes on binary files

### Test 4.4: Long Prompts
- [ ] 10,000 character prompt
- [ ] Verify doesn't crash

### Test 4.5: Special Characters
- [ ] Prompt with emojis, unicode, newlines
- [ ] Verify handles correctly

### Test 4.6: Rapid Fire
- [ ] Run 10 commands in quick succession
- [ ] Verify no race conditions

---

## 5. PLATFORM TESTING

### Test 5.1: macOS (your machine)
- [ ] All tests pass

### Test 5.2: Linux (via Docker)
```bash
docker run -it ubuntu:22.04
apt update && apt install -y nodejs npm
npm install -g /path/to/grain
grain --version
```
- [ ] Installation works
- [ ] Basic commands work

### Test 5.3: Different Node/Bun Versions
- [ ] Node 18
- [ ] Node 20
- [ ] Node 22
- [ ] Bun 1.0
- [ ] Bun 1.1

---

## 6. REAL-WORLD USAGE TESTING

### Test 6.1: Analyze Real Projects
- [ ] ~/grain (analyze itself - dogfooding!)
- [ ] ~/engram (Rust workspace)
- [ ] ~/ironrun (Go CLI)
- [ ] ~/cilow-next (large TypeScript project)

**For each, verify:**
- Knowledge graph extraction works
- Architecture explanation is accurate
- No crashes
- Reasonable time (<2 min)

### Test 6.2: Typical User Workflows
**Workflow: New user tries grain**
1. Install via npm
2. Run `grain init`
3. Configure bedrock
4. Run `grain "analyze this project"`
5. Ask follow-up: `grain "show me the main entry point"`

**Expected:** Smooth, no confusion, works
**Actual:** [TO TEST]

**Workflow: Fix a bug**
1. `grain "find all TODO comments"`
2. `grain "implement the first TODO"`
3. `grain "run tests"`

**Expected:** Works end-to-end
**Actual:** [TO TEST]

**Workflow: Knowledge graph exploration**
1. `grain "extract knowledge graph"`
2. `grain "show me the call graph for function X"`
3. `grain "what calls function Y?"`

**Expected:** Accurate results
**Actual:** [TO TEST]

---

## 7. COMPETITOR RESEARCH

### Test 7.1: Install Cursor
- [ ] Download and install Cursor
- [ ] Try same prompts as grain
- [ ] Compare speed, accuracy, UX
- [ ] Note what they do better
- [ ] Note what we do better

### Test 7.2: Install Aider
```bash
pip install aider-chat
aider --help
```
- [ ] Try on same test project
- [ ] Compare knowledge graph capabilities
- [ ] Note features they have that we don't

### Test 7.3: Install Continue.dev
- [ ] Install VS Code extension
- [ ] Try on test project
- [ ] Compare features

### Test 7.4: Claude Code CLI
```bash
# If accessible
claude-code --help
```
- [ ] Test on same prompts
- [ ] Compare self-improvement capabilities (they don't have this!)

---

## 8. DOCUMENTATION VALIDATION

### Test 8.1: README Accuracy
- [ ] Follow README install instructions exactly
- [ ] Verify every command works
- [ ] Check for broken links
- [ ] Verify examples are accurate

### Test 8.2: ARCHITECTURE.md
- [ ] Verify architecture matches actual code
- [ ] Check LOC counts are current
- [ ] Verify examples compile/run

### Test 8.3: EXAMPLES.md
- [ ] Run each example command
- [ ] Verify output matches documentation

---

## 9. SECURITY & PRIVACY

### Test 9.1: No Secret Leakage
- [ ] Check no API keys in code
- [ ] Check no hardcoded paths with usernames
- [ ] Check skills don't contain sensitive data

### Test 9.2: File System Safety
- [ ] Verify can't write outside project directory (without confirmation)
- [ ] No rm -rf possibilities

---

## 10. PERFORMANCE & METRICS

### Test 10.1: Speed Benchmarks
- [ ] Time: Hello world prompt (target: <5s)
- [ ] Time: Knowledge graph extraction (target: <60s for 10K LOC)
- [ ] Time: Skill matching (target: <1s)

### Test 10.2: Resource Usage
- [ ] Memory usage during analysis (target: <500MB)
- [ ] No memory leaks (run 10 commands, check stable memory)

---

## BUG TRACKING

### Critical Bugs (Launch Blockers)
- [ ] [Empty - we'll find them!]

### Major Bugs (Should Fix)
- [ ] [Empty - we'll find them!]

### Minor Bugs (Can Ship With)
- [ ] [Empty - we'll find them!]

---

## EXECUTION ORDER

**Today (4-5 hours):**

1. **Installation Testing** (30 min)
   - Test npm install
   - Test bun install  
   - Test developer setup

2. **Core Functionality** (1 hour)
   - Test all basic commands
   - Test each provider
   - Test skills system
   - Test knowledge graphs

3. **Error Handling** (45 min)
   - Test all error scenarios
   - Verify graceful failures
   - Check error messages

4. **Real-World Usage** (1 hour)
   - Analyze grain itself
   - Analyze engram
   - Analyze ironrun
   - Test typical workflows

5. **Competitor Research** (1 hour)
   - Install Cursor
   - Install Aider
   - Compare features
   - Find gaps

6. **Fix Critical Bugs** (1 hour buffer)
   - Fix anything found
   - Re-test

**Tomorrow:**
- Launch content (only if everything passes!)

---

**Let's start with Installation Testing!**

Which test should we run first?

A) Test npm install (fresh machine simulation)
B) Test all core commands systematically
C) Test on 3 real projects (grain, engram, ironrun)
D) Install competitors first to see what we're up against
