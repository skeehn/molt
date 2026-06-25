# Manual Testing Guide for grain

**Goal:** Test grain yourself to find any issues before launch

**Time:** 30-45 minutes  
**Prerequisites:** grain installed (npm or local)

---

## SETUP

```bash
# Make sure you have a clean environment
cd ~
rm -rf ~/.grain  # Fresh start
grain init  # Set up configuration
```

---

## TEST 1: Basic Functionality (5 min)

### 1.1 Simple Prompt
```bash
grain "what is 7 + 8?"
```
**Expected:** Should answer "15" quickly (~3s)  
**Check:** ✓ Answer correct? ✓ Fast response?

### 1.2 Help Command
```bash
grain --help
```
**Expected:** Shows usage, options, examples  
**Check:** ✓ Clear instructions? ✓ All options listed?

### 1.3 Config Command
```bash
grain config
```
**Expected:** Shows current configuration  
**Check:** ✓ Config displayed? ✓ Provider shown correctly?

---

## TEST 2: Project Analysis (10 min)

### 2.1 Analyze grain Itself
```bash
cd ~/grain
grain "analyze this project and explain the architecture"
```
**Expected:** Should detect TypeScript, explain structure (~45s)  
**Check:**
- ✓ Detects language correctly?
- ✓ Finds entry point (src/cli.ts)?
- ✓ Explains tools, providers, agent loop?
- ✓ Response makes sense?

### 2.2 Knowledge Graph Extraction
```bash
cd ~/grain
grain "extract knowledge graph"
```
**Expected:** Should find entities, relationships  
**Check:**
- ✓ Finds functions, classes, modules?
- ✓ Counts look reasonable?
- ✓ No errors or crashes?

### 2.3 Empty Directory
```bash
mkdir /tmp/empty-test
cd /tmp/empty-test
grain "what's in this directory?"
```
**Expected:** Should handle gracefully, not crash  
**Check:**
- ✓ Doesn't crash?
- ✓ Explains directory is empty?

---

## TEST 3: Multi-Turn Conversation (5 min)

### 3.1 Context Tracking
```bash
cd ~/grain
grain
```
Then at the prompt:
```
> "what files are in src/tools?"
> "which one handles knowledge graphs?"
> "show me the first 20 lines of that file"
```

**Expected:** Should remember context from previous messages  
**Check:**
- ✓ Remembers previous questions?
- ✓ File references work?
- ✓ Can chain questions logically?

**Exit:** Press Ctrl+C

---

## TEST 4: Different Project Types (10 min)

### 4.1 Rust Project (if you have engram)
```bash
cd ~/engram
grain "how many Rust crates are in this workspace?"
```
**Expected:** Should analyze Rust correctly  
**Check:**
- ✓ Detects Rust/Cargo?
- ✓ Finds crates?
- ✓ No errors?

### 4.2 Go Project (if you have ironrun)
```bash
cd ~/ironrun
grain "what does this CLI tool do?"
```
**Expected:** Should understand Go project  
**Check:**
- ✓ Reads main.go or relevant files?
- ✓ Explains purpose?

### 4.3 Web Project (if you have one)
```bash
cd ~/current-landing-page  # or any Next.js/React project
grain "what framework is this using?"
```
**Expected:** Should detect Next.js/React/etc  
**Check:**
- ✓ Identifies framework?
- ✓ Finds package.json?

---

## TEST 5: Error Handling (5 min)

### 5.1 Invalid Path
```bash
grain "analyze /nonexistent/directory"
```
**Expected:** Graceful error, not crash  
**Check:**
- ✓ Clear error message?
- ✓ Doesn't crash grain?

### 5.2 Malformed Prompt
```bash
grain "!@#$%^&*()"
```
**Expected:** Either interprets or asks for clarification  
**Check:**
- ✓ Doesn't crash?
- ✓ Reasonable response?

### 5.3 Very Long Prompt
```bash
grain "$(python3 -c 'print("analyze this project " * 1000)')"
```
**Expected:** Should handle or truncate  
**Check:**
- ✓ Doesn't hang?
- ✓ Responds or errors gracefully?

---

## TEST 6: Concise Mode (3 min)

### 6.1 Regular vs Concise
```bash
# Regular
grain "what is React?"

# Concise
grain --concise "what is React?"
```
**Expected:** Concise mode should be terser  
**Check:**
- ✓ Concise mode shorter?
- ✓ Still accurate?

---

## TEST 7: Special Characters & Edge Cases (5 min)

### 7.1 Quotes in Prompt
```bash
grain "explain the difference between 'single' and \"double\" quotes"
```
**Expected:** Should handle quotes correctly  
**Check:** ✓ No parsing errors?

### 7.2 Newlines
```bash
grain "list:
1. item one
2. item two
3. item three"
```
**Expected:** Should handle multiline input  
**Check:** ✓ Reads full input?

### 7.3 Unicode/Emoji
```bash
grain "what does this emoji mean: 🌾"
```
**Expected:** Should handle Unicode  
**Check:** ✓ No encoding errors?

---

## TEST 8: Session Persistence (5 min)

### 8.1 Create Session
```bash
grain "remember: my favorite color is blue"
```
**Check:** ✓ Acknowledges?

### 8.2 New Session (should NOT remember)
```bash
grain "what's my favorite color?"
```
**Expected:** Should NOT know (new session)  
**Check:** ✓ Doesn't incorrectly remember?

### 8.3 Check Sessions Directory
```bash
ls -lh ~/.grain/
cat ~/.grain/config.json
```
**Expected:** Should see sessions.db, config.json  
**Check:**
- ✓ Files exist?
- ✓ Reasonable sizes?

---

## TEST 9: Performance & Resource Usage (5 min)

### 9.1 Monitor Memory
```bash
# Terminal 1: Run grain
grain "analyze ~/grain"

# Terminal 2: Watch memory
watch -n 1 'ps aux | grep grain | grep -v grep'
```
**Expected:** Memory should be stable  
**Check:**
- ✓ Memory doesn't grow unbounded?
- ✓ CPU reasonable during thinking?

### 9.2 Response Times
Test a few prompts and note times:
- Simple math: _____ seconds
- Project analysis: _____ seconds
- Knowledge graph: _____ seconds

**Expected:**
- Simple: < 5s
- Analysis: < 60s
- KG: < 90s

**Check:** ✓ Within acceptable range?

---

## TEST 10: Stress Test (Optional, 5 min)

### 10.1 Rapid Fire
```bash
for i in {1..10}; do
  echo "Test $i"
  grain --yes --concise "what is $i times 2?"
done
```
**Expected:** Should handle 10 consecutive runs  
**Check:**
- ✓ All complete successfully?
- ✓ No crashes or hangs?
- ✓ Answers all correct?

---

## RESULTS CHECKLIST

Mark each test:
- ✅ = Works perfectly
- ⚠️ = Works but has issues
- ❌ = Failed or crashed

```
[ ] TEST 1: Basic Functionality
  [ ] 1.1 Simple prompt
  [ ] 1.2 Help command
  [ ] 1.3 Config command

[ ] TEST 2: Project Analysis
  [ ] 2.1 Analyze grain
  [ ] 2.2 Knowledge graph
  [ ] 2.3 Empty directory

[ ] TEST 3: Multi-Turn Conversation
  [ ] 3.1 Context tracking

[ ] TEST 4: Different Project Types
  [ ] 4.1 Rust project
  [ ] 4.2 Go project
  [ ] 4.3 Web project

[ ] TEST 5: Error Handling
  [ ] 5.1 Invalid path
  [ ] 5.2 Malformed prompt
  [ ] 5.3 Very long prompt

[ ] TEST 6: Concise Mode
  [ ] 6.1 Regular vs concise

[ ] TEST 7: Special Characters
  [ ] 7.1 Quotes
  [ ] 7.2 Newlines
  [ ] 7.3 Unicode/emoji

[ ] TEST 8: Session Persistence
  [ ] 8.1 Create session
  [ ] 8.2 New session
  [ ] 8.3 Check files

[ ] TEST 9: Performance
  [ ] 9.1 Memory usage
  [ ] 9.2 Response times

[ ] TEST 10: Stress Test
  [ ] 10.1 Rapid fire
```

---

## WHAT TO LOOK FOR

### 🚨 Critical Issues (Must Fix):
- Crashes or hangs
- Data loss
- Incorrect answers
- Security issues

### ⚠️ Major Issues (Should Fix):
- Slow performance (>2x expected)
- Confusing errors
- UX problems
- Memory leaks

### 💡 Minor Issues (Nice to Fix):
- Typos in output
- Minor formatting issues
- Small performance improvements

---

## REPORT ISSUES

For each issue found, note:
1. **Test number** (e.g., TEST 2.1)
2. **What happened** (actual behavior)
3. **What you expected** (expected behavior)
4. **How to reproduce** (exact commands)
5. **Severity** (🚨 ⚠️ or 💡)

---

## WHEN DONE

After completing all tests:

1. Count results:
   - ✅ Passed: _____
   - ⚠️ Issues: _____
   - ❌ Failed: _____

2. Calculate confidence:
   - 90%+ passed → High confidence, ready to launch
   - 75-90% passed → Medium confidence, fix major issues
   - <75% passed → Low confidence, need more work

3. Share findings!

---

**Good luck testing! Find those bugs!** 🐛🔍
