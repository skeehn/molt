// Project type detection - examines files to determine language/framework/build system
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ProjectType {
  primary: string; // 'rust' | 'typescript' | 'go' | 'python' | 'nextjs' | 'web' | 'monorepo'
  frameworks: string[]; // ['next.js', 'react', 'tailwind']
  languages: string[]; // ['typescript', 'rust', 'python']
  buildSystems: string[]; // ['cargo', 'bun', 'npm', 'make']
}

// Detect project type by examining files
export function detectProjectType(path: string): ProjectType {
  const files = readdirSync(path);
  const frameworks: string[] = [];
  const languages: string[] = [];
  const buildSystems: string[] = [];
  
  // Check for specific markers
  if (files.includes('Cargo.toml')) {
    languages.push('rust');
    buildSystems.push('cargo');
  }
  
  if (files.includes('package.json')) {
    const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf-8'));
    
    if (pkg.dependencies?.next || pkg.devDependencies?.next) {
      frameworks.push('next.js');
    }
    if (pkg.dependencies?.react || pkg.devDependencies?.react) {
      frameworks.push('react');
    }
    if (pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss) {
      frameworks.push('tailwind');
    }
    
    // Detect package manager
    if (files.includes('bun.lockb')) {
      buildSystems.push('bun');
    } else if (files.includes('pnpm-lock.yaml')) {
      buildSystems.push('pnpm');
    } else if (files.includes('yarn.lock')) {
      buildSystems.push('yarn');
    } else if (files.includes('package-lock.json')) {
      buildSystems.push('npm');
    }
    
    // TypeScript if tsconfig exists
    if (files.includes('tsconfig.json')) {
      languages.push('typescript');
    } else {
      languages.push('javascript');
    }
  }
  
  if (files.includes('go.mod')) {
    languages.push('go');
    buildSystems.push('go');
  }
  
  if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
    languages.push('python');
    if (files.includes('pyproject.toml')) {
      buildSystems.push('poetry');
    } else {
      buildSystems.push('pip');
    }
  }
  
  if (files.includes('Makefile')) {
    buildSystems.push('make');
  }
  
  if (files.includes('Dockerfile')) {
    buildSystems.push('docker');
  }
  
  // Determine primary type
  let primary = 'unknown';
  if (frameworks.includes('next.js')) {
    primary = 'nextjs';
  } else if (files.includes('Cargo.toml') && files.includes('crates')) {
    primary = 'rust-workspace';
  } else if (languages.includes('rust')) {
    primary = 'rust';
  } else if (languages.includes('typescript')) {
    primary = 'typescript';
  } else if (languages.includes('go')) {
    primary = 'go';
  } else if (languages.includes('python')) {
    primary = 'python';
  }
  
  return { primary, frameworks, languages, buildSystems };
}
