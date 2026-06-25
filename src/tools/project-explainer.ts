// Project Explainer - Universal codebase understanding
// Detects project type, analyzes structure, generates comprehensive explanation
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, extname, relative } from 'path';
import { execSync } from 'child_process';
import type { ToolResult } from '../providers/types.js';

interface ProjectType {
  primary: string; // 'rust' | 'typescript' | 'go' | 'python' | 'nextjs' | 'web' | 'monorepo'
  frameworks: string[]; // ['next.js', 'react', 'tailwind']
  languages: string[]; // ['typescript', 'rust', 'python']
  buildSystems: string[]; // ['cargo', 'bun', 'npm', 'make']
}

interface ProjectStructure {
  name: string;
  type: ProjectType;
  rootPath: string;
  
  // Key files
  entryPoints: string[];
  configFiles: string[];
  documentation: string[];
  
  // Structure
  modules: ModuleInfo[];
  dependencies: DependencyInfo[];
  
  // Status
  tests: TestInfo;
  build: BuildInfo;
  deployment: DeploymentInfo | null;
  
  // Metrics
  fileCount: number;
  lineCount: number;
  languages: Record<string, number>;
}

interface ModuleInfo {
  name: string;
  path: string;
  type: 'crate' | 'package' | 'module' | 'component' | 'page';
  purpose?: string; // Extracted from docs
  dependencies: string[];
  exports?: string[];
  size: number; // lines of code
}

interface DependencyInfo {
  from: string;
  to: string;
  type: 'direct' | 'transitive';
}

interface TestInfo {
  hasTests: boolean;
  testFiles: string[];
  framework?: string; // 'jest', 'pytest', 'cargo test', 'go test'
  coverage?: number;
}

interface BuildInfo {
  system: string; // 'cargo', 'npm', 'make', 'docker'
  commands: string[]; // ['cargo build --profile fast', 'bun run build']
  targets?: string[]; // ['dev', 'prod', 'test']
}

interface DeploymentInfo {
  platform: string; // 'fly.io', 'vercel', 'aws', 'docker'
  config: string; // path to fly.toml, vercel.json, etc.
  regions?: string[];
  url?: string;
}

// Detect project type by examining files
function detectProjectType(path: string): ProjectType {
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

// Find entry points
function findEntryPoints(path: string, type: ProjectType): string[] {
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

// Find documentation
function findDocumentation(path: string): string[] {
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

// Analyze Rust workspace
function analyzeRustWorkspace(path: string): ModuleInfo[] {
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

// Count lines in directory
function countLinesInDir(dir: string): number {
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

// Find tests
function findTests(path: string, type: ProjectType): TestInfo {
  const testFiles: string[] = [];
  let framework: string | undefined;
  
  if (type.primary === 'rust' || type.primary === 'rust-workspace') {
    framework = 'cargo test';
    // Rust tests are inline, count #[test] and #[cfg(test)]
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

// Detect deployment
function detectDeployment(path: string): DeploymentInfo | null {
  if (existsSync(join(path, 'fly.toml'))) {
    const content = readFileSync(join(path, 'fly.toml'), 'utf-8');
    const appMatch = content.match(/app\s*=\s*"([^"]+)"/);
    return {
      platform: 'fly.io',
      config: 'fly.toml',
      url: appMatch ? `https://${appMatch[1]}.fly.dev` : undefined,
    };
  }
  
  if (existsSync(join(path, 'vercel.json'))) {
    return {
      platform: 'vercel',
      config: 'vercel.json',
    };
  }
  
  if (existsSync(join(path, 'netlify.toml'))) {
    return {
      platform: 'netlify',
      config: 'netlify.toml',
    };
  }
  
  if (existsSync(join(path, 'Dockerfile'))) {
    return {
      platform: 'docker',
      config: 'Dockerfile',
    };
  }
  
  return null;
}

// Analyze build system
function analyzeBuildSystem(path: string, type: ProjectType): BuildInfo {
  const commands: string[] = [];
  
  if (type.buildSystems.includes('cargo')) {
    const cargoToml = join(path, 'Cargo.toml');
    if (existsSync(cargoToml)) {
      const content = readFileSync(cargoToml, 'utf-8');
      
      // Check for custom profiles
      if (content.includes('[profile.fast]')) {
        commands.push('cargo build --profile fast');
      } else {
        commands.push('cargo build');
        commands.push('cargo build --release');
      }
      
      commands.push('cargo test');
    }
  }
  
  if (type.buildSystems.includes('bun')) {
    const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf-8'));
    if (pkg.scripts) {
      Object.keys(pkg.scripts).forEach(script => {
        commands.push(`bun run ${script}`);
      });
    }
  }
  
  if (type.buildSystems.includes('make')) {
    try {
      const result = execSync('grep "^[a-z]" Makefile | cut -d: -f1', {
        cwd: path,
        encoding: 'utf-8',
      });
      const targets = result.trim().split('\n');
      targets.forEach(t => commands.push(`make ${t}`));
    } catch (e) {
      commands.push('make');
    }
  }
  
  return {
    system: type.buildSystems[0] || 'unknown',
    commands,
  };
}

// Main analysis function
export async function analyzeProject(path: string): Promise<ProjectStructure> {
  const type = detectProjectType(path);
  const name = basename(path);
  
  const entryPoints = findEntryPoints(path, type);
  const documentation = findDocumentation(path);
  
  let modules: ModuleInfo[] = [];
  if (type.primary === 'rust-workspace') {
    modules = analyzeRustWorkspace(path);
  }
  
  const tests = findTests(path, type);
  const build = analyzeBuildSystem(path, type);
  const deployment = detectDeployment(path);
  
  // Count files and LOC
  const fileCount = execSync('find . -type f | wc -l', { cwd: path, encoding: 'utf-8' }).trim();
  const lineCount = countLinesInDir(path);
  
  return {
    name,
    type,
    rootPath: path,
    entryPoints,
    configFiles: [], // TODO
    documentation,
    modules,
    dependencies: [], // TODO: build dep graph
    tests,
    build,
    deployment,
    fileCount: parseInt(fileCount),
    lineCount,
    languages: {}, // TODO
  };
}

// Generate text explanation
export function explainProject(structure: ProjectStructure): string {
  const lines: string[] = [];
  
  lines.push(`# ${structure.name}`);
  lines.push('');
  
  // Type
  lines.push(`**Type:** ${structure.type.primary}`);
  if (structure.type.frameworks.length > 0) {
    lines.push(`**Frameworks:** ${structure.type.frameworks.join(', ')}`);
  }
  lines.push(`**Languages:** ${structure.type.languages.join(', ')}`);
  lines.push(`**Build:** ${structure.type.buildSystems.join(', ')}`);
  lines.push('');
  
  // Stats
  lines.push(`**Size:** ${structure.fileCount} files, ${structure.lineCount.toLocaleString()} lines`);
  lines.push('');
  
  // Entry points
  if (structure.entryPoints.length > 0) {
    lines.push(`**Entry Points:**`);
    structure.entryPoints.forEach(e => lines.push(`  - ${e}`));
    lines.push('');
  }
  
  // Modules/Crates
  if (structure.modules.length > 0) {
    lines.push(`**Modules/Crates (${structure.modules.length}):**`);
    structure.modules.forEach(m => {
      lines.push(`  - **${m.name}** (${m.path})`);
      if (m.purpose) {
        lines.push(`    ${m.purpose}`);
      }
      if (m.dependencies.length > 0) {
        lines.push(`    Dependencies: ${m.dependencies.slice(0, 5).join(', ')}${m.dependencies.length > 5 ? '...' : ''}`);
      }
      lines.push(`    ${m.size.toLocaleString()} lines`);
    });
    lines.push('');
  }
  
  // Tests
  lines.push(`**Tests:**`);
  if (structure.tests.hasTests) {
    lines.push(`  - Framework: ${structure.tests.framework}`);
    lines.push(`  - Test files: ${structure.tests.testFiles.length}`);
  } else {
    lines.push(`  - No tests found`);
  }
  lines.push('');
  
  // Build
  lines.push(`**Build Commands:**`);
  structure.build.commands.slice(0, 5).forEach(cmd => {
    lines.push(`  - ${cmd}`);
  });
  lines.push('');
  
  // Deployment
  if (structure.deployment) {
    lines.push(`**Deployment:**`);
    lines.push(`  - Platform: ${structure.deployment.platform}`);
    lines.push(`  - Config: ${structure.deployment.config}`);
    if (structure.deployment.url) {
      lines.push(`  - URL: ${structure.deployment.url}`);
    }
    lines.push('');
  }
  
  // Documentation
  if (structure.documentation.length > 0) {
    lines.push(`**Documentation:**`);
    structure.documentation.forEach(d => lines.push(`  - ${d}`));
    lines.push('');
  }
  
  return lines.join('\n');
}

// Generate ASCII diagram
export function generateAsciiDiagram(structure: ProjectStructure): string {
  if (structure.type.primary === 'rust-workspace') {
    return generateRustWorkspaceDiagram(structure);
  }
  // TODO: other types
  return 'Diagram generation not yet implemented for this project type';
}

function generateRustWorkspaceDiagram(structure: ProjectStructure): string {
  const lines: string[] = [];
  
  lines.push('┌─────────────────────────────────────┐');
  lines.push(`│  ${structure.name.padEnd(35)} │`);
  lines.push('└────────────┬────────────────────────┘');
  lines.push('             │');
  
  structure.modules.forEach((mod, idx) => {
    const isLast = idx === structure.modules.length - 1;
    const prefix = isLast ? '└──' : '├──';
    const continuation = isLast ? '   ' : '│  ';
    
    lines.push(`             ${prefix} ${mod.name}`);
    if (mod.purpose) {
      lines.push(`             ${continuation}    ${mod.purpose.slice(0, 50)}`);
    }
  });
  
  return lines.join('\n');
}

// Tool definition
export const projectExplainerTool = {
  name: 'explain_project',
  description: 'Analyze and explain a codebase (Rust, TypeScript, Go, Python, Next.js, etc.). Provides comprehensive understanding: structure, modules, dependencies, build system, tests, deployment, and documentation.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to project root (defaults to current directory)',
      },
      format: {
        type: 'string',
        enum: ['text', 'diagram', 'both'],
        description: 'Output format: text explanation, ASCII diagram, or both',
      },
    },
  },
};

export async function executeExplainProject(input: any): Promise<ToolResult> {
  const path = input.path || process.cwd();
  const format = input.format || 'both';
  
  try {
    const structure = await analyzeProject(path);
    
    let output = '';
    
    if (format === 'text' || format === 'both') {
      output += explainProject(structure);
    }
    
    if (format === 'diagram' || format === 'both') {
      if (format === 'both') output += '\n\n';
      output += '```\n';
      output += generateAsciiDiagram(structure);
      output += '\n```';
    }
    
    return {
      content: output,
      is_error: false,
    };
  } catch (error: any) {
    return {
      content: `Error analyzing project: ${error.message}`,
      is_error: true,
    };
  }
}
