// File and directory utilities for project analysis
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import type { ProjectType } from './detectors.js';

// Find entry points based on project type
export function findEntryPoints(path: string, type: ProjectType): string[] {
  const entries: string[] = [];
  
  // Rust
  if (type.primary === 'rust' || type.primary === 'rust-workspace') {
    const srcMain = join(path, 'src/main.rs');
    const srcLib = join(path, 'src/lib.rs');
    if (existsSync(srcMain)) entries.push('src/main.rs');
    if (existsSync(srcLib)) entries.push('src/lib.rs');
    
    // Check for bins
    const binDir = join(path, 'src/bin');
    if (existsSync(binDir)) {
      readdirSync(binDir).forEach(f => entries.push(`src/bin/${f}`));
    }
  }
  
  // TypeScript/JavaScript
  if (type.languages.includes('typescript') || type.languages.includes('javascript')) {
    const candidates = ['src/index.ts', 'src/main.ts', 'src/cli.ts', 'index.ts', 'main.ts'];
    candidates.forEach(c => {
      if (existsSync(join(path, c))) entries.push(c);
    });
    
    // Next.js
    if (type.frameworks.includes('next.js')) {
      if (existsSync(join(path, 'app'))) {
        entries.push('app/page.tsx', 'app/layout.tsx');
      } else if (existsSync(join(path, 'pages'))) {
        entries.push('pages/index.tsx', 'pages/_app.tsx');
      }
    }
  }
  
  // Go
  if (type.languages.includes('go')) {
    const mainGo = join(path, 'main.go');
    if (existsSync(mainGo)) entries.push('main.go');
    
    const cmdDir = join(path, 'cmd');
    if (existsSync(cmdDir)) {
      readdirSync(cmdDir).forEach(d => {
        const mainPath = join(cmdDir, d, 'main.go');
        if (existsSync(mainPath)) entries.push(`cmd/${d}/main.go`);
      });
    }
  }
  
  // Python
  if (type.languages.includes('python')) {
    const candidates = ['__main__.py', 'main.py', 'app.py', 'cli.py'];
    candidates.forEach(c => {
      if (existsSync(join(path, c))) entries.push(c);
    });
  }
  
  return entries.filter(e => existsSync(join(path, e)));
}

// Find documentation files
export function findDocumentation(path: string): string[] {
  const docs: string[] = [];
  const candidates = [
    'README.md', 'CLAUDE.md', 'AGENTS.md', 'ARCHITECTURE.md',
    'CONTRIBUTING.md', 'DESIGN.md', 'API.md', 'WALKTHROUGH.md',
    'docs/README.md', 'docs/ARCHITECTURE.md', 'docs/API_REFERENCE.md'
  ];
  
  candidates.forEach(c => {
    if (existsSync(join(path, c))) docs.push(c);
  });
  
  return docs;
}

// Count lines of code in directory (recursive)
export function countLinesInDir(dir: string): number {
  let total = 0;
  try {
    const items = readdirSync(dir);
    items.forEach(item => {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        total += countLinesInDir(fullPath);
      } else if (stat.isFile() && /\.(rs|ts|tsx|js|jsx|go|py)$/.test(item)) {
        const content = readFileSync(fullPath, 'utf-8');
        total += content.split('\n').length;
      }
    });
  } catch (e) {
    // Ignore errors
  }
  return total;
}
