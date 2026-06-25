// Git integration - checkpoints, auto-commit, rollback
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { ToolResult } from '../providers/types.js';

export const gitCheckpointTool = {
  name: 'git_checkpoint',
  description: 'Create a git checkpoint (commit) with optional auto-push. Use before risky operations for easy rollback.',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
      push: { type: 'boolean', description: 'Push to remote after commit', default: false },
      tag: { type: 'string', description: 'Optional tag for this checkpoint' },
    },
    required: ['message'],
  },
};

export const gitRollbackTool = {
  name: 'git_rollback',
  description: 'Rollback to a previous checkpoint (commit or tag). Destructive - creates backup branch first.',
  input_schema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Commit hash, tag, or HEAD~N to rollback to' },
      hard: { type: 'boolean', description: 'Hard reset (discard changes) vs soft (keep in working dir)', default: false },
    },
    required: ['target'],
  },
};

export const gitStatusTool = {
  name: 'git_status',
  description: 'Check git status - modified files, branch, commits ahead/behind, clean/dirty state.',
  input_schema: {
    type: 'object',
    properties: {
      porcelain: { type: 'boolean', description: 'Machine-readable output', default: false },
    },
  },
};

function execGit(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });

    proc.on('error', (err) => {
      resolve({ stdout, stderr: err.message, code: 1 });
    });
  });
}

async function isGitRepo(cwd?: string): Promise<boolean> {
  const { code } = await execGit(['rev-parse', '--git-dir'], cwd);
  return code === 0;
}

export async function executeGitCheckpoint(input: {
  message: string;
  push?: boolean;
  tag?: string;
}): Promise<ToolResult> {
  const cwd = process.cwd();

  if (!(await isGitRepo(cwd))) {
    return { content: 'Not a git repository', is_error: true };
  }

  // Stage all changes
  const addResult = await execGit(['add', '-A'], cwd);
  if (addResult.code !== 0) {
    return { content: `git add failed: ${addResult.stderr}`, is_error: true };
  }

  // Check if there's anything to commit
  const statusResult = await execGit(['status', '--porcelain'], cwd);
  if (!statusResult.stdout.trim()) {
    return { content: 'No changes to commit - working tree clean' };
  }

  // Commit
  const commitResult = await execGit(['commit', '-m', input.message], cwd);
  if (commitResult.code !== 0) {
    return { content: `git commit failed: ${commitResult.stderr}`, is_error: true };
  }

  let output = `✓ Checkpoint created: ${input.message}\n`;
  
  // Get commit hash
  const hashResult = await execGit(['rev-parse', 'HEAD'], cwd);
  const commitHash = hashResult.stdout.trim().substring(0, 7);
  output += `  Commit: ${commitHash}\n`;

  // Tag if requested
  if (input.tag) {
    const tagResult = await execGit(['tag', input.tag], cwd);
    if (tagResult.code === 0) {
      output += `  Tag: ${input.tag}\n`;
    } else {
      output += `  ⚠️  Tag failed: ${tagResult.stderr}\n`;
    }
  }

  // Push if requested
  if (input.push) {
    const pushResult = await execGit(['push'], cwd);
    if (pushResult.code === 0) {
      output += `  ✓ Pushed to remote\n`;
      
      if (input.tag) {
        await execGit(['push', 'origin', input.tag], cwd);
        output += `  ✓ Pushed tag: ${input.tag}\n`;
      }
    } else {
      output += `  ⚠️  Push failed: ${pushResult.stderr}\n`;
    }
  }

  return { content: output };
}

export async function executeGitRollback(input: {
  target: string;
  hard?: boolean;
}): Promise<ToolResult> {
  const cwd = process.cwd();

  if (!(await isGitRepo(cwd))) {
    return { content: 'Not a git repository', is_error: true };
  }

  // Validate target exists
  const validateResult = await execGit(['rev-parse', '--verify', input.target], cwd);
  if (validateResult.code !== 0) {
    return { content: `Invalid target: ${input.target}`, is_error: true };
  }

  const targetHash = validateResult.stdout.trim().substring(0, 7);

  // Create backup branch first
  const currentBranch = await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  const branchName = currentBranch.stdout.trim();
  const backupName = `backup-${branchName}-${Date.now()}`;
  
  const backupResult = await execGit(['branch', backupName], cwd);
  if (backupResult.code !== 0) {
    return { content: `Failed to create backup branch: ${backupResult.stderr}`, is_error: true };
  }

  // Reset
  const resetType = input.hard ? '--hard' : '--soft';
  const resetResult = await execGit(['reset', resetType, input.target], cwd);
  if (resetResult.code !== 0) {
    return {
      content: `Rollback failed: ${resetResult.stderr}\nBackup saved to: ${backupName}`,
      is_error: true,
    };
  }

  let output = `✓ Rolled back to ${targetHash}\n`;
  output += `  Mode: ${input.hard ? 'hard (changes discarded)' : 'soft (changes in working dir)'}\n`;
  output += `  Backup branch: ${backupName}\n`;
  output += `\nTo restore: git checkout ${backupName}`;

  return { content: output };
}

export async function executeGitStatus(): Promise<ToolResult> {
  const cwd = process.cwd();

  if (!(await isGitRepo(cwd))) {
    return { content: 'Not a git repository' };
  }

  const statusResult = await execGit(['status', '--porcelain', '--branch'], cwd);
  
  let output = '📊 Git Status:\n\n';

  const lines = statusResult.stdout.split('\n').filter(l => l.trim());
  
  // Parse branch info
  const branchLine = lines.find(l => l.startsWith('##'));
  if (branchLine) {
    output += branchLine.substring(3) + '\n\n';
  }

  // Parse file changes
  const changes = lines.filter(l => !l.startsWith('##'));
  if (changes.length === 0) {
    output += '✓ Working tree clean - no changes\n';
  } else {
    output += `Modified files (${changes.length}):\n`;
    for (const change of changes.slice(0, 20)) {
      const status = change.substring(0, 2);
      const path = change.substring(3);
      
      let symbol = '📝';
      if (status.includes('M')) symbol = '📝';
      if (status.includes('A')) symbol = '✨';
      if (status.includes('D')) symbol = '🗑️';
      if (status.includes('?')) symbol = '❓';
      
      output += `  ${symbol} ${path}\n`;
    }
    
    if (changes.length > 20) {
      output += `  ... (${changes.length - 20} more)\n`;
    }
  }

  // Get last commit
  const logResult = await execGit(['log', '-1', '--pretty=format:%h %s'], cwd);
  if (logResult.code === 0) {
    output += `\nLast commit: ${logResult.stdout}\n`;
  }

  return { content: output };
}
