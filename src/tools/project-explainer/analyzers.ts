// Project analysis functions - workspace, tests, deployment, build system
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import type { ProjectType } from './detectors.js';
import { countLinesInDir } from './file-utils.js';

export interface ModuleInfo {
  name: string;
  path: string;
  type: 'crate' | 'package' | 'module';
  purpose?: string;
  dependencies?: string[];
  size?: number;
}

export interface TestInfo {
  hasTests: boolean;
  testFiles: string[];
  framework?: string;
}

export interface DeploymentInfo {
  platform: string;
  config: string;
  regions?: string[];
  url?: string;
}

export interface BuildInfo {
  system: string;
  commands: string[];
  targets?: string[];
}

// Analyze Rust workspace - parse Cargo.toml and extract crate info
export function analyzeRustWorkspace(path: string): ModuleInfo[] {
  const modules: ModuleInfo[] = [];
  const cargoToml = join(path, 'Cargo.toml');
  
  if (!existsSync(cargoToml)) return modules;
  
  const content = readFileSync(cargoToml, 'utf-8');
  
  // Parse workspace members
  const membersMatch = content.match(/members\s*=\s*\[([\s\S]*?)\]/);
  if (membersMatch) {
    const members = membersMatch[1]
      .split(',')
      .map(m => m.trim().replace(/"/g, ''))
      .filter(m => m);
    
    members.forEach(member => {
      const memberPath = join(path, member);
      const memberCargo = join(memberPath, 'Cargo.toml');
      
      if (existsSync(memberCargo)) {
        const memberContent = readFileSync(memberCargo, 'utf-8');
        const nameMatch = memberContent.match(/\[package\]\s*name\s*=\s*"([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : basename(member);
        
        // Extract purpose from lib.rs docs
        const libPath = join(memberPath, 'src/lib.rs');
        let purpose: string | undefined;
        if (existsSync(libPath)) {
          const libContent = readFileSync(libPath, 'utf-8');
          const docMatch = libContent.match(/\/\/!\s*#\s*([^\n]+)/);
          if (docMatch) purpose = docMatch[1];
        }
        
        // Count LOC
        let size = 0;
        const srcDir = join(memberPath, 'src');
        if (existsSync(srcDir)) {
          size = countLinesInDir(srcDir);
        }
        
        // Parse dependencies
        const depsMatch = memberContent.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
        const dependencies: string[] = [];
        if (depsMatch) {
          const depsSection = depsMatch[1];
          const lines = depsSection.split('\n');
          lines.forEach(line => {
            const depMatch = line.match(/^([a-z0-9_-]+)\s*=/);
            if (depMatch) dependencies.push(depMatch[1]);
          });
        }
        
        modules.push({
          name,
          path: member,
          type: 'crate',
          purpose,
          dependencies,
          size,
        });
      }
    });
  }
  
  return modules;
}

// Find tests - detect test framework and locate test files
export function findTests(path: string, type: ProjectType): TestInfo {
  const testFiles: string[] = [];
  let framework: string | undefined;
  
  if (type.primary === 'rust' || type.primary === 'rust-workspace') {
    framework = 'cargo test';
    try {
      const result = execSync('find . -name "*.rs" -type f | xargs grep -l "#\\[test\\]" | head -20', {
        cwd: path,
        encoding: 'utf-8',
      });
      testFiles.push(...result.trim().split('\n').filter(Boolean));
    } catch (e) {
      // No tests found
    }
  }
  
  if (type.languages.includes('typescript') || type.languages.includes('javascript')) {
    // Check for Jest, Vitest, etc.
    const pkgPath = join(path, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.devDependencies?.jest || pkg.dependencies?.jest) {
        framework = 'jest';
      } else if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest) {
        framework = 'vitest';
      }
    }
    
    // Find test files
    try {
      const result = execSync('find . -name "*.test.*" -o -name "*.spec.*" | head -20', {
        cwd: path,
        encoding: 'utf-8',
      });
      testFiles.push(...result.trim().split('\n').filter(Boolean));
    } catch (e) {
      // No tests found
    }
  }
  
  return {
    hasTests: testFiles.length > 0,
    testFiles,
    framework,
  };
}

// Detect deployment configuration
export function detectDeployment(path: string): DeploymentInfo | null {
  // Fly.io
  if (existsSync(join(path, 'fly.toml'))) {
    return {
      platform: 'fly.io',
      config: 'fly.toml',
    };
  }
  
  // Vercel
  if (existsSync(join(path, 'vercel.json'))) {
    return {
      platform: 'vercel',
      config: 'vercel.json',
    };
  }
  
  // Docker
  if (existsSync(join(path, 'Dockerfile'))) {
    return {
      platform: 'docker',
      config: 'Dockerfile',
    };
  }
  
  return null;
}

// Analyze build system - extract build commands and targets
export function analyzeBuildSystem(path: string, type: ProjectType): BuildInfo {
  const commands: string[] = [];
  const targets: string[] = [];
  let system = 'unknown';
  
  if (type.buildSystems.includes('cargo')) {
    system = 'cargo';
    commands.push('cargo build', 'cargo test', 'cargo run');
    targets.push('debug', 'release');
  }
  
  if (type.buildSystems.includes('bun') || type.buildSystems.includes('npm')) {
    system = type.buildSystems.includes('bun') ? 'bun' : 'npm';
    
    // Parse package.json scripts
    const pkgPath = join(path, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts) {
        Object.keys(pkg.scripts).forEach(script => {
          commands.push(`${system} run ${script}`);
        });
      }
    }
  }
  
  if (type.buildSystems.includes('make')) {
    system = 'make';
    
    // Parse Makefile targets
    const makefilePath = join(path, 'Makefile');
    if (existsSync(makefilePath)) {
      const content = readFileSync(makefilePath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach(line => {
        const match = line.match(/^([a-zA-Z0-9_-]+):/);
        if (match) {
          targets.push(match[1]);
          commands.push(`make ${match[1]}`);
        }
      });
    }
  }
  
  return { system, commands, targets };
}
