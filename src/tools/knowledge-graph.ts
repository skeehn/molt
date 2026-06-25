// Knowledge Graph Extraction - Extract entities and relationships from code
// Provides deeper understanding than project-explainer: functions, types, data flows

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import type { Tool, ToolResult } from '../providers/types.js';
import { getContextTracker } from '../agent/context-tracker.js';

export interface Entity {
  id: string;
  name: string;
  type: 'function' | 'class' | 'struct' | 'type' | 'module' | 'const' | 'enum';
  file: string;
  line?: number;
  signature?: string;
  docstring?: string;
  visibility?: 'public' | 'private' | 'internal';
}

export interface Relationship {
  from: string; // entity id
  to: string; // entity id  
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'uses' | 'contains';
  weight?: number; // call frequency, importance
}

export interface KnowledgeGraph {
  entities: Entity[];
  relationships: Relationship[];
  modules: string[]; // top-level modules/crates
  entryPoints: string[]; // main functions
}

// Extract knowledge graph from project
export async function extractKnowledgeGraph(projectPath: string): Promise<KnowledgeGraph> {
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];
  const modules: string[] = [];
  const entryPoints: string[] = [];
  
  // Detect project type
  const files = readdirSync(projectPath);
  let projectType: 'rust' | 'typescript' | 'go' | 'python' | 'unknown' = 'unknown';
  
  if (files.includes('Cargo.toml')) projectType = 'rust';
  else if (files.includes('package.json') && files.includes('tsconfig.json')) projectType = 'typescript';
  else if (files.includes('go.mod')) projectType = 'go';
  else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) projectType = 'python';
  
  // Extract based on project type
  switch (projectType) {
    case 'rust':
      await extractRustKnowledgeGraph(projectPath, entities, relationships, modules, entryPoints);
      break;
    case 'typescript':
      await extractTypeScriptKnowledgeGraph(projectPath, entities, relationships, modules, entryPoints);
      break;
    default:
      // Generic extraction
      await extractGenericKnowledgeGraph(projectPath, entities, relationships);
  }
  
  return { entities, relationships, modules, entryPoints };
}

// Extract Rust knowledge graph - parse functions, structs, traits
async function extractRustKnowledgeGraph(
  projectPath: string,
  entities: Entity[],
  relationships: Relationship[],
  modules: string[],
  entryPoints: string[]
): Promise<void> {
  // Find all .rs files
  const rsFiles = findFiles(projectPath, '.rs');
  
  for (const file of rsFiles) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const relPath = relative(projectPath, file);
    
    // Extract public functions
    const fnRegex = /^(pub\s+)?(async\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    const structRegex = /^(pub\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    const enumRegex = /^(pub\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    const traitRegex = /^(pub\s+)?trait\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      // Functions
      const fnMatch = trimmed.match(fnRegex);
      if (fnMatch) {
        const isPublic = !!fnMatch[1];
        const name = fnMatch[3];
        entities.push({
          id: `${relPath}::${name}`,
          name,
          type: 'function',
          file: relPath,
          line: idx + 1,
          visibility: isPublic ? 'public' : 'private',
        });
        
        // Check for main function (entry point)
        if (name === 'main') {
          entryPoints.push(`${relPath}::main`);
        }
      }
      
      // Structs
      const structMatch = trimmed.match(structRegex);
      if (structMatch) {
        entities.push({
          id: `${relPath}::${structMatch[2]}`,
          name: structMatch[2],
          type: 'struct',
          file: relPath,
          line: idx + 1,
          visibility: structMatch[1] ? 'public' : 'private',
        });
      }
      
      // Enums
      const enumMatch = trimmed.match(enumRegex);
      if (enumMatch) {
        entities.push({
          id: `${relPath}::${enumMatch[2]}`,
          name: enumMatch[2],
          type: 'enum',
          file: relPath,
          line: idx + 1,
          visibility: enumMatch[1] ? 'public' : 'private',
        });
      }
      
      // Extract imports
      if (trimmed.startsWith('use ') || trimmed.startsWith('mod ')) {
        const importMatch = trimmed.match(/use\s+(?:crate::)?([a-zA-Z_][a-zA-Z0-9_:]*)/);
        if (importMatch) {
          const imported = importMatch[1].split('::')[0];
          // Find if we have this entity
          const targetEntity = entities.find(e => e.name === imported);
          if (targetEntity) {
            relationships.push({
              from: `${relPath}`,
              to: targetEntity.id,
              type: 'imports',
            });
          }
        }
      }
    });
  }
  
  // Extract module structure from Cargo.toml
  const cargoPath = join(projectPath, 'Cargo.toml');
  if (existsSync(cargoPath)) {
    const content = readFileSync(cargoPath, 'utf-8');
    const membersMatch = content.match(/members\s*=\s*\[([\s\S]*?)\]/);
    if (membersMatch) {
      const members = membersMatch[1]
        .split(',')
        .map(m => m.trim().replace(/"/g, ''))
        .filter(m => m);
      modules.push(...members);
    }
  }
}

// Extract TypeScript knowledge graph - parse functions, classes, types
async function extractTypeScriptKnowledgeGraph(
  projectPath: string,
  entities: Entity[],
  relationships: Relationship[],
  modules: string[],
  entryPoints: string[]
): Promise<void> {
  // Find all .ts/.tsx files (excluding node_modules, dist)
  const tsFiles = findFiles(projectPath, '.ts', '.tsx').filter(f => 
    !f.includes('node_modules') && !f.includes('dist') && !f.includes('.d.ts')
  );
  
  // FIRST PASS: Extract all entities
  for (const file of tsFiles) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const relPath = relative(projectPath, file);
    
    // Extract functions
    const fnRegex = /^export\s+(async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    const arrowFnRegex = /^export\s+const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(async\s*)?\(/;
    const classRegex = /^export\s+class\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    const interfaceRegex = /^export\s+interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    const typeRegex = /^export\s+type\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      // Functions
      const fnMatch = trimmed.match(fnRegex);
      if (fnMatch) {
        entities.push({
          id: `${relPath}::${fnMatch[2]}`,
          name: fnMatch[2],
          type: 'function',
          file: relPath,
          line: idx + 1,
          visibility: 'public',
        });
      }
      
      // Arrow functions
      const arrowMatch = trimmed.match(arrowFnRegex);
      if (arrowMatch) {
        entities.push({
          id: `${relPath}::${arrowMatch[1]}`,
          name: arrowMatch[1],
          type: 'function',
          file: relPath,
          line: idx + 1,
          visibility: 'public',
        });
      }
      
      // Classes
      const classMatch = trimmed.match(classRegex);
      if (classMatch) {
        entities.push({
          id: `${relPath}::${classMatch[1]}`,
          name: classMatch[1],
          type: 'class',
          file: relPath,
          line: idx + 1,
          visibility: 'public',
        });
      }
      
      // Interfaces
      const interfaceMatch = trimmed.match(interfaceRegex);
      if (interfaceMatch) {
        entities.push({
          id: `${relPath}::${interfaceMatch[1]}`,
          name: interfaceMatch[1],
          type: 'type',
          file: relPath,
          line: idx + 1,
          visibility: 'public',
        });
      }
      
      // Types
      const typeMatch = trimmed.match(typeRegex);
      if (typeMatch) {
        entities.push({
          id: `${relPath}::${typeMatch[1]}`,
          name: typeMatch[1],
          type: 'type',
          file: relPath,
          line: idx + 1,
          visibility: 'public',
        });
      }
      
      // Extract imports - track relationships
      if (trimmed.startsWith('import ')) {
        // Match: import { foo, bar } from './path'
        // Match: import * as foo from './path'
        // Match: import foo from './path'
        const namedImportMatch = trimmed.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
        const namespaceImportMatch = trimmed.match(/import\s+\*\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+from\s+['"]([^'"]+)['"]/);
        const defaultImportMatch = trimmed.match(/import\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+from\s+['"]([^'"]+)['"]/);
        
        if (namedImportMatch) {
          const imported = namedImportMatch[1].split(',').map(s => s.trim().replace(/\s+as\s+.*/, ''));
          imported.forEach(name => {
            // Find if we have this entity
            const targetEntity = entities.find(e => e.name === name);
            if (targetEntity) {
              relationships.push({
                from: relPath,
                to: targetEntity.id,
                type: 'imports',
              });
            }
          });
        } else if (namespaceImportMatch) {
          const name = namespaceImportMatch[1];
          const targetEntity = entities.find(e => e.name === name);
          if (targetEntity) {
            relationships.push({
              from: relPath,
              to: targetEntity.id,
              type: 'imports',
            });
          }
        } else if (defaultImportMatch) {
          const name = defaultImportMatch[1];
          const targetEntity = entities.find(e => e.name === name);
          if (targetEntity) {
            relationships.push({
              from: relPath,
              to: targetEntity.id,
              type: 'imports',
            });
          }
        }
      }
    });
  }
  
  // Build entity name lookup for fast function call matching
  const entityByName = new Map<string, Entity[]>();
  entities.forEach(entity => {
    if (!entityByName.has(entity.name)) {
      entityByName.set(entity.name, []);
    }
    entityByName.get(entity.name)!.push(entity);
  });
  
  // SECOND PASS: Detect function calls
  for (const file of tsFiles) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const relPath = relative(projectPath, file);
    
    let currentFunction: string | null = null;
    let braceDepth = 0;
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      // Track current function context
      const fnRegex = /^export\s+(async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
      const arrowFnRegex = /^export\s+const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(async\s*)?\(/;
      
      const fnMatch = trimmed.match(fnRegex);
      const arrowMatch = trimmed.match(arrowFnRegex);
      
      if (fnMatch) {
        currentFunction = `${relPath}::${fnMatch[2]}`;
        braceDepth = 0;
      } else if (arrowMatch) {
        currentFunction = `${relPath}::${arrowMatch[1]}`;
        braceDepth = 0;
      }
      
      // Track brace depth to know when we exit function
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      
      if (braceDepth <= 0 && currentFunction) {
        currentFunction = null;
      }
      
      // Find function calls: functionName(
      // Match word characters followed by opening paren
      const callRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      let match;
      
      while ((match = callRegex.exec(line)) !== null) {
        const calledName = match[1];
        
        // Skip common keywords and control structures
        const skipWords = ['if', 'for', 'while', 'switch', 'catch', 'function', 'return'];
        if (skipWords.includes(calledName)) continue;
        
        // Check if this function exists in our entities
        const targetEntities = entityByName.get(calledName);
        if (targetEntities && targetEntities.length > 0) {
          // Prefer entity from same file, otherwise take first match
          let targetEntity = targetEntities.find(e => e.file === relPath) || targetEntities[0];
          
          // Determine caller context (current function or file)
          const callerId = currentFunction || relPath;
          
          // Check if relationship already exists (to avoid duplicates)
          const existingRelationship = relationships.find(
            r => r.from === callerId && r.to === targetEntity.id && r.type === 'calls'
          );
          
          if (!existingRelationship) {
            relationships.push({
              from: callerId,
              to: targetEntity.id,
              type: 'calls',
              weight: 1,
            });
          } else {
            // Increment weight for repeated calls
            existingRelationship.weight = (existingRelationship.weight || 1) + 1;
          }
        }
      }
    });
  }
  
  // Detect modules from src/ directory structure
  const srcDir = join(projectPath, 'src');
  if (existsSync(srcDir)) {
    const items = readdirSync(srcDir);
    items.forEach(item => {
      const fullPath = join(srcDir, item);
      if (statSync(fullPath).isDirectory()) {
        modules.push(item);
      }
    });
  }
}

// Generic extraction - just find files and basic structure
async function extractGenericKnowledgeGraph(
  projectPath: string,
  entities: Entity[],
  relationships: Relationship[]
): Promise<void> {
  // Find all code files
  const codeFiles = findFiles(projectPath, '.rs', '.ts', '.js', '.go', '.py');
  
  entities.push({
    id: 'project',
    name: 'Project',
    type: 'module',
    file: '.',
  });
  
  // Basic file-level entities
  codeFiles.forEach(file => {
    const relPath = relative(projectPath, file);
    entities.push({
      id: relPath,
      name: relPath,
      type: 'module',
      file: relPath,
    });
  });
}

// Find files by extension recursively
function findFiles(dir: string, ...exts: string[]): string[] {
  const results: string[] = [];
  
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      // Skip common directories
      if (item === 'node_modules' || item === 'target' || item === 'dist' || item === '.git') {
        continue;
      }
      
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        results.push(...findFiles(fullPath, ...exts));
      } else if (stat.isFile()) {
        const ext = extname(item);
        if (exts.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }
  
  return results;
}

// Generate visualization of knowledge graph
export function visualizeKnowledgeGraph(graph: KnowledgeGraph): string {
  let output = '# Knowledge Graph\n\n';
  
  // Summary
  output += `## Summary\n\n`;
  output += `- **Entities:** ${graph.entities.length}\n`;
  output += `- **Relationships:** ${graph.relationships.length}\n`;
  output += `- **Modules:** ${graph.modules.length}\n`;
  output += `- **Entry Points:** ${graph.entryPoints.length}\n\n`;
  
  // Modules
  if (graph.modules.length > 0) {
    output += `## Modules\n\n`;
    graph.modules.forEach(m => output += `- ${m}\n`);
    output += '\n';
  }
  
  // Entry Points
  if (graph.entryPoints.length > 0) {
    output += `## Entry Points\n\n`;
    graph.entryPoints.forEach(e => output += `- ${e}\n`);
    output += '\n';
  }
  
  // Entities by type
  const byType: Record<string, Entity[]> = {};
  graph.entities.forEach(e => {
    if (!byType[e.type]) byType[e.type] = [];
    byType[e.type].push(e);
  });
  
  Object.keys(byType).forEach(type => {
    output += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s (${byType[type].length})\n\n`;
    byType[type].slice(0, 20).forEach(e => {
      output += `- **${e.name}** (${e.file}:${e.line || '?'})\n`;
    });
    if (byType[type].length > 20) {
      output += `\n... and ${byType[type].length - 20} more\n`;
    }
    output += '\n';
  });
  
  return output;
}

// Tool definition
export const knowledgeGraphTool: Tool = {
  name: 'extract_knowledge_graph',
  description: 'Extract knowledge graph (entities and relationships) from a codebase. Provides deeper understanding than project_explainer: functions, classes, types, and how they relate.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the project root directory',
      },
      visualize: {
        type: 'boolean',
        description: 'Generate visualization (default: true)',
      },
    },
    required: ['path'],
  },
};

// Tool execution
export async function executeExtractKnowledgeGraph(input: any): Promise<ToolResult> {
  const path = input.path || process.cwd();
  const visualize = input.visualize !== false;
  
  try {
    const graph = await extractKnowledgeGraph(path);
    
    // Track context
    getContextTracker().updateProjectContext(path, 'knowledge-graph');
    
    let content = `Extracted knowledge graph from: ${path}\n\n`;
    content += `Found: ${graph.entities.length} entities, ${graph.relationships.length} relationships\n`;
    content += `Modules: ${graph.modules.join(', ')}\n`;
    content += `Entry points: ${graph.entryPoints.join(', ')}\n\n`;
    
    if (visualize) {
      content += visualizeKnowledgeGraph(graph);
    }
    
    return {
      content,
      is_error: false,
    };
  } catch (error) {
    return {
      content: `Error extracting knowledge graph: ${error}`,
      is_error: true,
    };
  }
}
