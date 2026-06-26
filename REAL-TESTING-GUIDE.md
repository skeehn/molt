# grain: Fresh Install & Real Project Testing Guide

**FOR: Manual user testing by YOU**  
**PROJECT: Design an editorial ASCII website**  
**TIME: 1-2 hours hands-on**

---

## Step 1: Fresh Install (5 min)

### 1.1 Clean Slate
```bash
# Remove old grain installations
rm -rf ~/.grain
rm ~/bin/grain 2>/dev/null

# Verify clean
ls ~/.grain 2>/dev/null && echo "ERROR: ~/.grain still exists" || echo "✓ Clean"
```

### 1.2 Install from Local Package
```bash
# Install from the package we just built
cd ~/grain
npm install -g grain-0.1.0.tgz

# Verify installation
which grain
grain --help
```

### 1.3 Initialize Configuration
```bash
# Run init to set up config
grain init

# Select your provider (probably #1 - ollama or #2 - bedrock)
# This creates ~/.grain/config.json

# Verify config
cat ~/.grain/config.json
```

---

## Step 2: Quick Smoke Tests (10 min)

### 2.1 Test: Basic Functionality
```bash
grain "what is 15 + 27?"
# Expected: "42" (should be fast, ~3s)
```

### 2.2 Test: File Operations
```bash
cd /tmp
mkdir grain-test && cd grain-test
grain "create a file called test.md with a haiku about coding"
cat test.md
# Expected: File exists with a haiku
```

### 2.3 Test: Project Analysis
```bash
cd ~/grain
grain "how many TypeScript files are in src/tools/?"
# Expected: Should count and list them
```

### 2.4 Test: Multi-Turn Conversation
```bash
grain
# Interactive mode
> "what files are in this directory?"
> "which one is the entry point?"
> "read the first 20 lines of it"
# Press Ctrl+C to exit
# Expected: Context tracked across questions
```

---

## Step 3: Real Project - Editorial ASCII Website (1 hour)

### 3.1 Project Setup
```bash
# Create project directory
mkdir -p ~/ascii-editorial-site
cd ~/ascii-editorial-site

# Initialize git
git init

# Ask grain to help plan
grain "I want to build an editorial-style ASCII art website. 
Single HTML file, dark theme, ASCII art headers, monospace fonts.
Create a project plan with file structure."
```

### 3.2 Use grain Iteratively

**Round 1: Design**
```bash
grain "Create index.html:
- Dark background (#0a0a0a)
- ASCII art masthead for 'THE TERMINAL POST'  
- Monospace font (Courier or similar)
- 3 article sections with ASCII dividers
- Vintage computer terminal aesthetic
- All inline CSS"
```

**Round 2: Content**
```bash
grain "Add 3 sample articles:
1. 'The Art of Command Line' - about CLI tools
2. 'Digital Minimalism' - about simple tech
3. 'ASCII Renaissance' - about text-based art

Use ASCII borders around each article."
```

**Round 3: Enhancement**
```bash
grain "Add interactive elements:
- Blinking cursor effect in header
- Hover effects on articles (border color change)
- Footer with ASCII signature"
```

**Round 4: Polish**
```bash
grain "Review the HTML and:
1. Fix any layout issues
2. Improve responsive design
3. Add meta tags for SEO
4. Optimize for readability"
```

### 3.3 Test the Site
```bash
# Open in browser
open index.html

# Or use a local server
python3 -m http.server 8000
# Visit http://localhost:8000
```

---

## Step 4: Test Advanced Features (30 min)

### 4.1 Test: Knowledge Graph
```bash
cd ~/ascii-editorial-site
grain "extract knowledge graph from this project"
# Expected: Entities (HTML, sections, styles), relationships
```

### 4.2 Test: Skills Learning
```bash
# Check if grain learned from your work
ls ~/.grain/skills/
cat ~/.grain/skills/*.json | grep -A 5 "pattern"
# Expected: Skills saved from successful tasks
```

### 4.3 Test: Session Persistence
```bash
# Check database
sqlite3 ~/.grain/sessions.db "SELECT COUNT(*) FROM sessions;"
sqlite3 ~/.grain/sessions.db "SELECT id, title, created_at FROM sessions ORDER BY created_at DESC LIMIT 5;"
# Expected: All your sessions recorded
```

### 4.4 Test: Cost Tracking (if using bedrock/anthropic)
```bash
# Check if costs are tracked
grain "show me cost summary for today"
# Expected: Token usage and estimated costs
```

### 4.5 Test: Delegation (Optional)
```bash
# Only if you want to test codex integration
grain "delegate to codex: write a Python script that generates ASCII art from text"
# Expected: Codex spawns, returns result (may be slow 30-60s)
```

---

## Step 5: Build a Mini Tool (30 min)

### 5.1 ASCII Art Generator
```bash
cd ~/ascii-editorial-site
grain "Create a standalone tool: ascii-art-generator.html
- Single HTML file with inline JavaScript
- Input: User types text
- Output: Converts to ASCII art (big letters)
- Use canvas or pre-formatted text
- Dark theme matching the editorial site"
```

### 5.2 Test the Tool
```bash
open ascii-art-generator.html
# Type some text, verify ASCII output
```

### 5.3 Iterate on the Tool
```bash
grain "Enhance ascii-art-generator.html:
- Add font size controls
- Add copy-to-clipboard button
- Add multiple ASCII art styles (banner, block, script)
- Add color picker for ASCII art"
```

---

## Step 6: Test Agent Loop Behavior (15 min)

### 6.1 Multi-Step Task
```bash
grain "Multi-step task:
1. Analyze index.html structure
2. Create a README.md documenting the design
3. Create a deployment.sh script for uploading to a server
4. Test that all files exist"
```

**Watch for:**
- Does grain plan before executing? ✓
- Does it execute each step? ✓
- Does it verify completion? ✓
- Does it learn from the pattern? ✓

### 6.2 Error Recovery
```bash
grain "Read a file called nonexistent.txt"
# Expected: Graceful error, doesn't crash
```

### 6.3 Complex Reasoning
```bash
grain "Compare index.html and ascii-art-generator.html.
What design patterns do they share?
What could be extracted into a shared CSS file?"
```

**Watch for:**
- Does grain read both files? ✓
- Does it synthesize insights? ✓
- Does it provide actionable suggestions? ✓

---

## Step 7: Evaluation Checklist

Mark each as ✅ (works), ⚠️ (issues), or ❌ (broken):

### Core Functionality
- [ ] Installation smooth
- [ ] `grain init` works
- [ ] Simple prompts fast (<5s)
- [ ] File operations work
- [ ] Multi-turn context tracked

### Project Work
- [ ] Created HTML file
- [ ] Iterative refinement worked
- [ ] Final output usable
- [ ] HTML renders correctly in browser

### Advanced Features
- [ ] Knowledge graph extraction
- [ ] Skills learned and saved
- [ ] Session persistence
- [ ] Cost tracking (if applicable)

### Agent Loop
- [ ] Plans before executing
- [ ] Executes tools correctly
- [ ] Verifies completion
- [ ] Handles errors gracefully
- [ ] Multi-step tasks complete

### Tool Quality
- [ ] ASCII generator works
- [ ] Iterative enhancements applied
- [ ] Final tool is polished

### Performance
- [ ] Response times acceptable
- [ ] No crashes or hangs
- [ ] Memory usage reasonable
- [ ] Token usage efficient

---

## Step 8: Issues to Note

**For each issue:**
1. **What happened:** Describe the problem
2. **Expected:** What should have happened
3. **Steps to reproduce:** Exact commands
4. **Severity:** 🚨 Critical / ⚠️ Major / 💡 Minor

**Example:**
```
Issue #1:
- What: grain created file but with wrong content
- Expected: Should match my description exactly
- Steps: grain "create test.txt with 'hello'"
- Severity: ⚠️ Major
```

---

## Step 9: Final Verdict

After completing all tests:

### Score (out of 100):
- Core functionality: __/25
- Project work quality: __/25
- Advanced features: __/20
- Agent loop behavior: __/20
- Performance: __/10

**Total: __/100**

### Overall Assessment:
- [ ] **95-100:** SHIP IT TODAY 🚀
- [ ] **85-94:** Ship with known issues documented
- [ ] **75-84:** Fix major issues first
- [ ] **<75:** Needs more work

---

## Expected Time Breakdown

- **Setup:** 5 min
- **Smoke tests:** 10 min
- **Real project:** 60 min
- **Advanced features:** 30 min
- **Mini tool:** 30 min
- **Agent loop:** 15 min

**Total: ~2.5 hours** (can be split across breaks)

---

## What We're Testing For

### Must Have (Blockers if broken):
1. ✅ Installs without errors
2. ✅ Basic prompts work
3. ✅ File operations work
4. ✅ Multi-turn conversations work
5. ✅ Can complete a real project

### Should Have (Ship with docs if broken):
1. Knowledge graphs work
2. Skills learning works
3. Session persistence works
4. Error handling graceful

### Nice to Have (Post-launch OK):
1. Delegation to codex/claude
2. Cost tracking detailed
3. MCP support

---

## Tips for Testing

1. **Take notes as you go** - Don't wait until the end
2. **Try to break it** - Edge cases reveal bugs
3. **Use it like YOU would** - Natural workflow
4. **Compare to codex/claude** - Is grain better?
5. **Be critical** - Launch quality matters

---

## After Testing

Share your findings:
- What worked well? 🎉
- What needs fixing? 🔧
- What surprised you? 🤔
- Would YOU use this daily? ❤️

**Then we'll fix critical issues and LAUNCH!** 🚀

---

**Ready? Let's test grain for real!** 🌾
