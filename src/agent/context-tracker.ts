// Context Tracker - Session and cross-session context management via engram
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { homedir } from 'os';
import { executeEngram } from '../tools/engram.js';

interface SessionContext {
  sessionId: string;
  startTime: number;
  workingDirectory: string;
  
  // File tracking
  lastModifiedFile?: string;
  lastReadFile?: string;
  recentFiles: string[]; // Last 10 files touched
  
  // Operation tracking
  lastOperation?: string; // 'read', 'write', 'test', 'build', etc.
  operationHistory: Array<{
    operation: string;
    files: string[];
    timestamp: number;
  }>;
  
  // Project context
  projectName?: string;
  projectType?: string; // 'rust-workspace', 'typescript', etc.
  currentModule?: string; // Current crate/package being worked on
  
  // Task context
  currentTask?: string;
  taskContext?: Record<string, any>;
}

interface ProjectCache {
  projectPath: string;
  projectName: string;
  lastAnalyzed: number;
  gitCommit?: string;
  
  // Cached analysis
  structure?: any; // ProjectStructure from project-explainer
  summary?: string;
  modules?: any[];
  
  // Quick lookups
  fileIndex?: Map<string, string>; // filename -> full path
  moduleIndex?: Map<string, string>; // module name -> path
}

class ContextTracker {
  private sessionPath: string;
  private cachePath: string;
  private session: SessionContext;
  
  constructor() {
    const baseDir = join(homedir(), '.grain', 'context');
    this.sessionPath = join(baseDir, 'session');
    this.cachePath = join(baseDir, 'cache');
    
    // Ensure directories exist
    [this.sessionPath, this.cachePath].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
    
    // Load or create session
    this.session = this.loadSession();
  }
  
  private loadSession(): SessionContext {
    const sessionFile = join(this.sessionPath, 'current.json');
    
    if (existsSync(sessionFile)) {
      try {
        const data = readFileSync(sessionFile, 'utf-8');
        return JSON.parse(data);
      } catch (e) {
        // Corrupted session, start fresh
      }
    }
    
    // New session
    return {
      sessionId: Date.now().toString(),
      startTime: Date.now(),
      workingDirectory: process.cwd(),
      recentFiles: [],
      operationHistory: [],
    };
  }
  
  private saveSession() {
    const sessionFile = join(this.sessionPath, 'current.json');
    writeFileSync(sessionFile, JSON.stringify(this.session, null, 2));
  }
  
  // Track file operations
  trackFileRead(path: string) {
    this.session.lastReadFile = path;
    this.addRecentFile(path);
    this.trackOperation('read', [path]);
  }
  
  trackFileWrite(path: string) {
    this.session.lastModifiedFile = path;
    this.addRecentFile(path);
    this.trackOperation('write', [path]);
  }
  
  trackFileEdit(path: string) {
    this.session.lastModifiedFile = path;
    this.addRecentFile(path);
    this.trackOperation('edit', [path]);
  }
  
  private addRecentFile(path: string) {
    // Remove if already exists
    this.session.recentFiles = this.session.recentFiles.filter(f => f !== path);
    // Add to front
    this.session.recentFiles.unshift(path);
    // Keep only last 10
    this.session.recentFiles = this.session.recentFiles.slice(0, 10);
    this.saveSession();
  }
  
  private trackOperation(operation: string, files: string[]) {
    this.session.lastOperation = operation;
    this.session.operationHistory.push({
      operation,
      files,
      timestamp: Date.now(),
    });
    // Keep only last 50 operations
    if (this.session.operationHistory.length > 50) {
      this.session.operationHistory = this.session.operationHistory.slice(-50);
    }
    this.saveSession();
  }
  
  // Resolve ambiguous references
  resolveReference(ref: string): string | null {
    const normalized = ref.toLowerCase().trim();
    
    // "that file" / "the file" = last modified or last read
    if (normalized.match(/^(that|the|this)\s+file$/)) {
      return this.session.lastModifiedFile || this.session.lastReadFile || null;
    }
    
    // "that test" / "the test" = last test file
    if (normalized.match(/^(that|the|this)\s+test/)) {
      const testFile = this.session.recentFiles.find(f => 
        f.includes('.test.') || f.includes('.spec.') || f.includes('_test.')
      );
      return testFile || null;
    }
    
    // "that module" / "the module" = current module
    if (normalized.match(/^(that|the|this)\s+module/)) {
      return this.session.currentModule || null;
    }
    
    // "the last file" = last read/modified
    if (normalized.match(/last\s+file/)) {
      return this.session.lastModifiedFile || this.session.lastReadFile || null;
    }
    
    return null;
  }
  
  // Get context summary for injection into prompts
  getContextSummary(): string {
    const lines: string[] = [];
    
    lines.push('## Current Session Context');
    lines.push('');
    
    if (this.session.projectName) {
      lines.push(`**Project:** ${this.session.projectName} (${this.session.projectType || 'unknown type'})`);
    }
    
    lines.push(`**Working Directory:** ${this.session.workingDirectory}`);
    
    if (this.session.currentModule) {
      lines.push(`**Current Module:** ${this.session.currentModule}`);
    }
    
    if (this.session.currentTask) {
      lines.push(`**Current Task:** ${this.session.currentTask}`);
    }
    
    lines.push('');
    
    if (this.session.lastModifiedFile) {
      lines.push(`**Last Modified:** ${this.session.lastModifiedFile}`);
    }
    
    if (this.session.lastReadFile && this.session.lastReadFile !== this.session.lastModifiedFile) {
      lines.push(`**Last Read:** ${this.session.lastReadFile}`);
    }
    
    if (this.session.recentFiles.length > 0) {
      lines.push('');
      lines.push('**Recent Files:**');
      this.session.recentFiles.slice(0, 5).forEach(f => {
        lines.push(`  - ${f}`);
      });
    }
    
    if (this.session.operationHistory.length > 0) {
      lines.push('');
      lines.push('**Recent Operations:**');
      this.session.operationHistory.slice(-5).forEach(op => {
        const timeAgo = Math.floor((Date.now() - op.timestamp) / 1000);
        lines.push(`  - ${op.operation} (${timeAgo}s ago): ${op.files.join(', ')}`);
      });
    }
    
    return lines.join('\n');
  }
  
  // Update project context
  setProjectContext(name: string, type: string, module?: string) {
    this.session.projectName = name;
    this.session.projectType = type;
    if (module) {
      this.session.currentModule = module;
    }
    this.saveSession();
  }
  
  // Update task context
  setTaskContext(task: string, context?: Record<string, any>) {
    this.session.currentTask = task;
    this.session.taskContext = context;
    this.saveSession();
  }
  
  clearTaskContext() {
    this.session.currentTask = undefined;
    this.session.taskContext = undefined;
    this.saveSession();
  }
  
  // Project caching via engram
  async cacheProjectAnalysis(projectPath: string, analysis: any) {
    try {
      // Get git commit for cache invalidation
      let gitCommit: string | undefined;
      try {
        const { execSync } = await import('child_process');
        gitCommit = execSync('git rev-parse HEAD', { cwd: projectPath, encoding: 'utf-8' }).trim();
      } catch (e) {
        // Not a git repo or git not available
      }
      
      // Store in engram with structured tags
      await executeEngram({
        action: 'store',
        content: JSON.stringify(analysis),
        tags: [
          'project-analysis',
          `project:${basename(projectPath)}`,
          `type:${analysis.type?.primary || 'unknown'}`,
          `path:${projectPath}`,
          gitCommit ? `commit:${gitCommit}` : 'no-git',
        ],
      });
      
      // Also store quick summary
      const summary = this.generateProjectSummary(analysis);
      await executeEngram({
        action: 'store',
        content: summary,
        tags: [
          'project-summary',
          `project:${basename(projectPath)}`,
          `path:${projectPath}`,
        ],
      });
      
      console.log(`📦 Cached project analysis for ${basename(projectPath)}`);
    } catch (error: any) {
      console.warn(`Warning: Could not cache project analysis: ${error.message}`);
    }
  }
  
  async getCachedProjectAnalysis(projectPath: string): Promise<any | null> {
    try {
      // Check if git commit changed
      let currentCommit: string | undefined;
      try {
        const { execSync } = await import('child_process');
        currentCommit = execSync('git rev-parse HEAD', { cwd: projectPath, encoding: 'utf-8' }).trim();
      } catch (e) {
        // Not a git repo
      }
      
      // Query engram for cached analysis
      const result = await executeEngram({
        action: 'search',
        query: `project analysis ${basename(projectPath)}`,
        tags: ['project-analysis', `path:${projectPath}`],
        limit: 1,
      });
      
      if (result.is_error || !result.content) {
        return null;
      }
      
      // Parse results
      const lines = result.content.split('\n');
      let analysisContent: string | null = null;
      let cachedCommit: string | null = null;
      
      for (const line of lines) {
        if (line.startsWith('Content:')) {
          analysisContent = line.substring('Content:'.length).trim();
        }
        if (line.includes('commit:')) {
          const match = line.match(/commit:([a-f0-9]+)/);
          if (match) cachedCommit = match[1];
        }
      }
      
      if (!analysisContent) {
        return null;
      }
      
      // Invalidate cache if git commit changed
      if (currentCommit && cachedCommit && currentCommit !== cachedCommit) {
        console.log('📦 Cache invalid (git commit changed), re-analyzing...');
        return null;
      }
      
      // Parse and return cached analysis
      try {
        const analysis = JSON.parse(analysisContent);
        console.log(`⚡ Loaded cached project analysis for ${basename(projectPath)}`);
        return analysis;
      } catch (e) {
        // Corrupted cache
        return null;
      }
    } catch (error: any) {
      console.warn(`Warning: Could not load cached analysis: ${error.message}`);
      return null;
    }
  }
  
  private generateProjectSummary(analysis: any): string {
    const lines: string[] = [];
    
    lines.push(`# ${analysis.name}`);
    lines.push('');
    lines.push(`**Type:** ${analysis.type?.primary || 'unknown'}`);
    
    if (analysis.type?.languages?.length > 0) {
      lines.push(`**Languages:** ${analysis.type.languages.join(', ')}`);
    }
    
    if (analysis.modules?.length > 0) {
      lines.push(`**Modules:** ${analysis.modules.length} (${analysis.modules.map((m: any) => m.name).join(', ')})`);
    }
    
    lines.push(`**Size:** ${analysis.fileCount || '?'} files, ${(analysis.lineCount || 0).toLocaleString()} lines`);
    
    if (analysis.build?.system) {
      lines.push(`**Build:** ${analysis.build.system}`);
    }
    
    if (analysis.deployment?.platform) {
      lines.push(`**Deploy:** ${analysis.deployment.platform}`);
    }
    
    return lines.join('\n');
  }
  
  // Store learning in engram
  async storeLearn(content: string, tags: string[]) {
    try {
      await executeEngram({
        action: 'store',
        content,
        tags: ['learning', ...tags],
      });
    } catch (error: any) {
      console.warn(`Warning: Could not store learning: ${error.message}`);
    }
  }
  
  // Recall relevant context from engram
  async recallContext(query: string, tags?: string[]): Promise<string> {
    try {
      const result = await executeEngram({
        action: 'search',
        query,
        tags,
        limit: 5,
      });
      
      if (result.is_error || !result.content) {
        return '';
      }
      
      return result.content;
    } catch (error: any) {
      return '';
    }
  }
}

// Singleton instance
let tracker: ContextTracker | null = null;

export function getContextTracker(): ContextTracker {
  if (!tracker) {
    tracker = new ContextTracker();
  }
  return tracker;
}

export function resetContextTracker() {
  tracker = null;
}

// Convenience wrappers for common operations
export function loadSessionContext(sessionId: string) {
  return getContextTracker().loadSession(sessionId);
}

export function saveSessionContext(sessionId: string) {
  return getContextTracker().saveSession(sessionId);
}

export function trackToolCall(toolName: string, input: any, result: any) {
  const tracker = getContextTracker();
  
  // Track file operations
  if (toolName === 'write' && input.path) {
    tracker.trackFileWrite(input.path);
  } else if (toolName === 'read' && input.path) {
    tracker.trackFileRead(input.path);
  } else if (toolName === 'patch' && input.path) {
    tracker.trackFileEdit(input.path);
  }
  
  // Track operation
  tracker.trackOperation(toolName, [input.path].filter(Boolean));
}

export function getContextSummary(): string {
  return getContextTracker().getContextSummary();
}

export function resolveFileReference(input: any): any {
  // For now, just return input as-is
  // TODO: Implement smart reference resolution ("that file" → actual path)
  return input;
}
