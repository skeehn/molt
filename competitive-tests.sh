#!/bin/bash
# grain Competitive Testing Suite
# Tests grain against 10 critical criteria

set -e

echo "🧪 grain Competitive Testing Suite"
echo "==================================="
echo ""

# Setup
TEST_DIR="/tmp/grain-competitive-tests"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Test counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
pass() {
    echo "✅ PASS: $1"
    ((PASSED++))
}

fail() {
    echo "❌ FAIL: $1"
    ((FAILED++))
}

warn() {
    echo "⚠️  WARN: $1"
    ((WARNINGS++))
}

echo "TEST 1: Real Work Verification"
echo "------------------------------"
echo "Goal: Verify grain DOES work, not just plans"
echo ""

# Create test file
echo "function add(a, b) { return a + b; }" > test.js

# Ask grain to modify it
timeout 90 node ~/grain/dist/cli.js --yes --concise \
  "modify test.js: change function name from 'add' to 'sum'" 2>&1 | tee test1.log

# Check if file was actually modified
if grep -q "sum" test.js; then
    pass "grain modified the file (real work)"
else
    fail "grain didn't modify the file (planning only)"
    cat test.js
fi

echo ""
echo "TEST 2: Token Efficiency"
echo "------------------------------"
echo "Goal: Measure token usage for simple task"
echo ""

# Simple task
timeout 60 node ~/grain/dist/cli.js --yes --concise \
  "what is 10 + 20?" 2>&1 | tee test2.log

# Extract token info if available
if grep -q "tokens" test2.log; then
    grep "tokens" test2.log | head -1
    pass "Token usage tracked"
else
    warn "Token usage not visible in output"
fi

echo ""
echo "TEST 3: Tool Count Audit"
echo "------------------------------"
echo "Goal: Check how many tools are loaded"
echo ""

# Check tools
cd ~/grain
TOOL_COUNT=$(find src/tools -name "*.ts" -type f | wc -l | tr -d ' ')
echo "Tool files found: $TOOL_COUNT"

if [ "$TOOL_COUNT" -le 15 ]; then
    pass "Tool count reasonable ($TOOL_COUNT <= 15)"
elif [ "$TOOL_COUNT" -le 20 ]; then
    warn "Tool count high ($TOOL_COUNT, target: 10-15)"
else
    fail "Too many tools ($TOOL_COUNT > 20)"
fi

# List tools
echo "Tools:"
find src/tools -name "*.ts" -type f -exec basename {} \; | sort

echo ""
echo "TEST 4: MCP Support Check"
echo "------------------------------"
echo "Goal: Verify MCP server integration exists"
echo ""

if grep -r "MCP\|Model Context Protocol" src/ >/dev/null 2>&1; then
    pass "MCP references found in code"
else
    fail "No MCP support detected"
fi

# Check for MCP config
if [ -f ~/.grain/mcp.json ] || grep -q "mcp" ~/.grain/config.json 2>/dev/null; then
    pass "MCP configuration found"
else
    warn "No MCP configuration found"
fi

echo ""
echo "TEST 5: Context Management"
echo "------------------------------"
echo "Goal: Verify context tracking works"
echo ""

cd "$TEST_DIR"
echo "// Context test file" > context-test.ts

timeout 60 node ~/grain/dist/cli.js --yes --concise \
  "what files are in this directory?" 2>&1 | tee test5.log

if grep -q "context-test.ts" test5.log; then
    pass "Context tracking works (found file)"
else
    warn "Context tracking unclear"
fi

echo ""
echo "TEST 6: Model Routing"
echo "------------------------------"
echo "Goal: Verify smart routing selects models"
echo ""

timeout 60 node ~/grain/dist/cli.js --yes --concise \
  "complex algorithmic task: implement quicksort" 2>&1 | tee test6.log

if grep -q "routing\|model" test6.log; then
    pass "Model routing visible"
else
    warn "Model routing not visible in output"
fi

echo ""
echo "TEST 7: Skills System"
echo "------------------------------"
echo "Goal: Check skills exist and load"
echo ""

if [ -d ~/.grain/skills ]; then
    SKILL_COUNT=$(find ~/.grain/skills -name "*.json" | wc -l | tr -d ' ')
    echo "Skills found: $SKILL_COUNT"
    
    if [ "$SKILL_COUNT" -gt 0 ]; then
        pass "Skills system active ($SKILL_COUNT skills)"
    else
        warn "No skills found"
    fi
else
    fail "Skills directory doesn't exist"
fi

echo ""
echo "TEST 8: Knowledge Graph"
echo "------------------------------"
echo "Goal: Test KG extraction"
echo ""

cd ~/grain
timeout 90 node ~/grain/dist/cli.js --yes --concise \
  "extract knowledge graph, count entities" 2>&1 | tee test8.log

if grep -q "entities\|relationships" test8.log; then
    pass "Knowledge graph extraction works"
else
    fail "Knowledge graph extraction failed"
fi

echo ""
echo "TEST 9: Session Persistence"
echo "------------------------------"
echo "Goal: Verify sessions saved to DB"
echo ""

if [ -f ~/.grain/sessions.db ]; then
    SESSION_COUNT=$(sqlite3 ~/.grain/sessions.db "SELECT COUNT(*) FROM sessions;" 2>/dev/null || echo "0")
    echo "Sessions in DB: $SESSION_COUNT"
    
    if [ "$SESSION_COUNT" -gt 0 ]; then
        pass "Session persistence works ($SESSION_COUNT sessions)"
    else
        warn "No sessions in DB"
    fi
else
    fail "Session database doesn't exist"
fi

echo ""
echo "TEST 10: Execution vs Planning"
echo "------------------------------"
echo "Goal: Verify grain executes tools, not just plans"
echo ""

cd "$TEST_DIR"
timeout 90 node ~/grain/dist/cli.js --yes --concise \
  "create a file named 'execution-test.txt' with content 'grain works'" 2>&1 | tee test10.log

if [ -f execution-test.txt ]; then
    if grep -q "grain works" execution-test.txt; then
        pass "grain executes tools (file created)"
    else
        warn "File created but content wrong"
        cat execution-test.txt
    fi
else
    fail "grain didn't execute (file not created)"
fi

echo ""
echo "================================================"
echo "RESULTS SUMMARY"
echo "================================================"
echo "✅ Passed: $PASSED"
echo "⚠️  Warnings: $WARNINGS"
echo "❌ Failed: $FAILED"
echo ""

TOTAL=$((PASSED + FAILED))
if [ "$TOTAL" -gt 0 ]; then
    SCORE=$((PASSED * 100 / TOTAL))
    echo "Score: $SCORE%"
    
    if [ "$SCORE" -ge 90 ]; then
        echo "🎉 EXCELLENT - Ready for production!"
    elif [ "$SCORE" -ge 75 ]; then
        echo "✅ GOOD - Minor improvements needed"
    elif [ "$SCORE" -ge 60 ]; then
        echo "⚠️  FAIR - Some issues to fix"
    else
        echo "❌ NEEDS WORK - Critical issues found"
    fi
fi

echo ""
echo "Test artifacts saved to: $TEST_DIR"
echo "Logs: test1.log, test2.log, etc."
