#!/bin/bash
# Verify function call detection in knowledge graph

echo "=== Test File: test-calls.ts ==="
cat test-calls.ts
echo ""
echo "=== Expected Relationships ==="
echo "bar -> foo (1 call)"
echo "baz -> foo (1 call)"
echo "baz -> bar (1 call)"
echo "main -> baz (1 call)"
echo "main -> foo (1 call)"
echo ""
echo "=== Extracting Knowledge Graph ==="
bun run --silent src/cli.ts extract_knowledge_graph --path . 2>/dev/null | grep -A 100 "test-calls.ts" | head -50
