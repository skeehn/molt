import { extractKnowledgeGraph } from './dist/tools/knowledge-graph.js';
import { readFileSync } from 'fs';

const graph = await extractKnowledgeGraph('test-inheritance-dir');

console.log('=== ENTITIES ===');
graph.entities.forEach(e => {
  console.log(`${e.id} | ${e.type} | ${e.name} | ${e.file}:${e.line}`);
});

console.log('\n=== RELATIONSHIPS ===');
graph.relationships.forEach(r => {
  console.log(`${r.from} --[${r.type}]--> ${r.to}`);
});
