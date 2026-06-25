// Session context tracking - remember last files, operations, state
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

export interface SessionContext {
  sessionId: string;
  workingDirectory: string;
  lastModifiedFiles: string[];
  lastReadFiles: string[];
  currentWorkingFile?: string;
  lastToolCalls: Array<{ tool: string; input: any; timestamp: number }>;
  conversationSummary?: string;
  updatedAt: number;
}

const CONTEXT_DIR = join(homedir(), '.molt', 'context');

function getContextPath(sessionId: string): string {
  mkdirSync(CONTEXT_DIR, { recursive: true });
  return join(CONTEXT_DIR, `${sessionId}.json`);
}

export function loadSessionContext(sessionId: string): SessionContext {
  const path = getContextPath(sessionId);
  if (!existsSync(path)) {
    return {
      sessionId,
      workingDirectory: process.cwd(),
      lastModifiedFiles: [],
      lastReadFiles: [],
      lastToolCalls: [],
      updatedAt: Date.now(),
    };
  }
  
  try {
    const data = readFileSync(path, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      sessionId,
      workingDirectory: process.cwd(),
      lastModifiedFiles: [],
      lastReadFiles: [],
      lastToolCalls: [],
      updatedAt: Date.now(),
    };
  }
}

export function saveSessionContext(context: SessionContext): void {
  context.updatedAt = Date.now();
  const path = getContextPath(context.sessionId);
  writeFileSync(path, JSON.stringify(context, null, 2));
}

export function trackToolCall(
  context: SessionContext,
  tool: string,
  input: any,
  output?: any
): void {
  // Track recent tool calls (keep last 20)
  context.lastToolCalls.push({
    tool,
    input,
    timestamp: Date.now(),
  });
  if (context.lastToolCalls.length > 20) {
    context.lastToolCalls.shift();
  }
  
  // Track file operations
  if (tool === 'write' || tool === 'patch' || tool === 'multi_edit') {
    const files = Array.isArray(input.edits) 
      ? input.edits.map((e: any) => e.path)
      : [input.path];
    
    for (const file of files) {
      if (!context.lastModifiedFiles.includes(file)) {
        context.lastModifiedFiles.push(file);
      }
      context.currentWorkingFile = file;
    }
    
    // Keep only last 10 modified files
    if (context.lastModifiedFiles.length > 10) {
      context.lastModifiedFiles = context.lastModifiedFiles.slice(-10);
    }
  }
  
  if (tool === 'read') {
    const file = input.path;
    if (!context.lastReadFiles.includes(file)) {
      context.lastReadFiles.push(file);
    }
    
    // Keep only last 10 read files
    if (context.lastReadFiles.length > 10) {
      context.lastReadFiles = context.lastReadFiles.slice(-10);
    }
  }
  
  saveSessionContext(context);
}

export function getContextSummary(context: SessionContext): string {
  const parts: string[] = [];
  
  if (context.currentWorkingFile) {
    parts.push(`Currently working on: ${context.currentWorkingFile}`);
  }
  
  if (context.lastModifiedFiles.length > 0) {
    const recent = context.lastModifiedFiles.slice(-5);
    parts.push(`Recently modified: ${recent.join(', ')}`);
  }
  
  if (context.lastReadFiles.length > 0) {
    const recent = context.lastReadFiles.slice(-5);
    parts.push(`Recently viewed: ${recent.join(', ')}`);
  }
  
  if (context.lastToolCalls.length > 0) {
    const recent = context.lastToolCalls.slice(-3);
    const summary = recent.map(t => t.tool).join(' → ');
    parts.push(`Recent operations: ${summary}`);
  }
  
  return parts.length > 0 ? '\n\n' + parts.join('\n') : '';
}

export function resolveFileReference(
  context: SessionContext,
  reference: string
): string | null {
  // Resolve ambiguous references like "that file", "the test file"
  const lower = reference.toLowerCase();
  
  if (lower.includes('that file') || lower.includes('this file') || lower.includes('the file')) {
    return context.currentWorkingFile || context.lastModifiedFiles[context.lastModifiedFiles.length - 1] || null;
  }
  
  if (lower.includes('test file')) {
    const testFile = [...context.lastModifiedFiles, ...context.lastReadFiles]
      .reverse()
      .find(f => f.includes('.test.') || f.includes('.spec.'));
    return testFile || null;
  }
  
  if (lower.includes('last file')) {
    return context.lastModifiedFiles[context.lastModifiedFiles.length - 1] || null;
  }
  
  return null;
}
