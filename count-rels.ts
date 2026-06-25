import { extractKnowledgeGraph } from './src/tools/knowledge-graph';

const graph = await extractKnowledgeGraph('.');
const relationshipCounts = graph.relationships.reduce((acc: Record<string, number>, rel) => {
  acc[rel.type] = (acc[rel.type] || 0) + 1;
  return acc;
}, {});

const sorted = Object.entries(relationshipCounts)
  .sort(([,a], [,b]) => (b as number) - (a as number));

console.log('\nRelationship Type Counts:');
console.log('========================');
sorted.forEach(([type, count]) => {
  console.log(`${type}: ${count}`);
});
console.log('========================');
console.log(`Total: ${graph.relationships.length} relationships\n`);
