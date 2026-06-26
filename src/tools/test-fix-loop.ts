// Test-run-fix loop — SWE-agent pattern
// Runs tests, parses failures, asks LLM to fix via bash/patch, repeats up to MAX_CYCLES.
// Returns a structured report of what passed/failed after each cycle.

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { ToolResult } from '../providers/types.js';
import { executeBash } from './bash.js';

export const testFixLoopTool = {
  name: 'test_fix_loop',
  description: [
    'Run tests, parse failures, and return structured results so you can fix them.',
    'Use this AFTER writing code to verify it works. Returns: pass count, fail count, and the',
    'exact failure messages so you can patch the code and call this again.',
    'Strategy: call with fail_fast=true first (stops at first failure, fast feedback).',
    'After fixing, call again with fail_fast=false for a full suite regression check.',
    'Max recommended cycles: 3.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      fail_fast: {
        type: 'boolean',
        description: 'Stop at first failure (default: true). Use false for final regression check.',
        default: true,
      },
      test_path: {
        type: 'string',
        description: 'Optional: specific test file or pattern to run (e.g. tests/test_foo.py, src/__tests__/auth.test.ts)',
      },
      framework: {
        type: 'string',
        description: 'Optional: force framework (jest, vitest, pytest, cargo, go, bun)',
        enum: ['jest', 'vitest', 'pytest', 'cargo', 'go', 'bun', 'npm'],
      },
    },
  },
};

function detectFramework(cwd: string): string | null {
  const pkgPath = resolve(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.vitest) return 'vitest';
      if (deps.jest) return 'jest';
      if (deps['bun-test'] || pkg.scripts?.test?.includes('bun test')) return 'bun';
      if (pkg.scripts?.test) return 'npm';
    } catch {}
  }
  if (existsSync(resolve(cwd, 'Cargo.toml'))) return 'cargo';
  if (existsSync(resolve(cwd, 'pytest.ini')) || existsSync(resolve(cwd, 'pyproject.toml'))) return 'pytest';
  if (existsSync(resolve(cwd, 'go.mod'))) return 'go';
  return null;
}

function buildCommand(framework: string, failFast: boolean, testPath?: string): string {
  const target = testPath ? ` ${testPath}` : '';
  switch (framework) {
    case 'vitest': return `npx vitest run${failFast ? ' --bail 1' : ''}${target} 2>&1`;
    case 'jest':   return `npx jest${failFast ? ' --bail' : ''}${target} --no-coverage 2>&1`;
    case 'bun':    return `bun test${failFast ? ' --bail' : ''}${target} 2>&1`;
    case 'npm':    return `npm test -- ${failFast ? '--bail' : ''} 2>&1`;
    case 'cargo':  return `cargo test${failFast ? ' --no-fail-fast' : ''}${target ? ` ${target}` : ''} 2>&1`;
    case 'pytest': return `python3 -m pytest${failFast ? ' -x' : ''}${target} --tb=short -q 2>&1`;
    case 'go':     return `go test${failFast ? ' -failfast' : ''} ./...${target} 2>&1`;
    default:       return `npm test 2>&1`;
  }
}

interface ParsedResults {
  passed: number;
  failed: number;
  total: number;
  failures: Array<{ test: string; message: string; file?: string; line?: number }>;
  raw: string;
}

function parseResults(output: string, framework: string): ParsedResults {
  const failures: ParsedResults['failures'] = [];
  let passed = 0, failed = 0;

  if (framework === 'pytest') {
    // "5 passed, 2 failed"
    const m = output.match(/(\d+) passed/); if (m) passed = parseInt(m[1]);
    const f = output.match(/(\d+) failed/); if (f) failed = parseInt(f[1]);
    // Extract FAILED test::name lines
    const failLines = output.match(/^FAILED .+$/gm) || [];
    for (const line of failLines) {
      const name = line.replace('FAILED ', '').trim();
      // Find the error message after AssertionError or similar
      const errMatch = output.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?E\\s+(.+?)\\n`));
      failures.push({ test: name, message: errMatch?.[1]?.trim() || 'assertion failed' });
    }
  } else if (framework === 'cargo') {
    const m = output.match(/test result.*?(\d+) passed.*?(\d+) failed/);
    if (m) { passed = parseInt(m[1]); failed = parseInt(m[2]); }
    const failLines = output.match(/^FAILED .+$/gm) || [];
    for (const line of failLines) failures.push({ test: line.replace('FAILED ', '').trim(), message: 'test failed' });
  } else {
    // jest/vitest/bun pattern
    const m = output.match(/Tests?:.*?(\d+) passed/); if (m) passed = parseInt(m[1]);
    const f = output.match(/Tests?:.*?(\d+) failed/); if (f) failed = parseInt(f[1]);
    // ● test name
    const failBlocks = output.match(/● .+[\s\S]*?(?=●|$)/g) || [];
    for (const block of failBlocks.slice(0, 5)) {
      const name = block.match(/● (.+)/)?.[1]?.trim() || 'unknown';
      const msg = block.match(/expect\(.+\)\..+\n.+received.+/)?.[0] || block.slice(0, 200);
      failures.push({ test: name, message: msg.trim() });
    }
  }

  return { passed, failed, total: passed + failed, failures, raw: output.slice(0, 4000) };
}

export async function executeTestFixLoop(
  input: { fail_fast?: boolean; test_path?: string; framework?: string },
  cwd?: string,
): Promise<ToolResult> {
  const workdir = cwd || process.cwd();
  const failFast = input.fail_fast !== false;
  const framework = input.framework || detectFramework(workdir);

  if (!framework) {
    return {
      content: 'No test framework detected. Create tests first or specify framework.',
      is_error: true,
    };
  }

  const cmd = buildCommand(framework, failFast, input.test_path);
  const result = await executeBash({ command: cmd, timeout: 120 }, workdir);
  const parsed = parseResults(result.content, framework);

  const lines: string[] = [
    `Test run (${framework}, fail_fast=${failFast}):`,
    `  passed: ${parsed.passed}  failed: ${parsed.failed}  total: ${parsed.total}`,
  ];

  if (parsed.failed === 0) {
    lines.push('  ✓ All tests pass.');
  } else {
    lines.push(`  ${parsed.failed} failure(s):`);
    for (const f of parsed.failures.slice(0, 5)) {
      lines.push(`  ✗ ${f.test}`);
      lines.push(`    ${f.message.split('\n')[0]}`);
    }
    lines.push('');
    lines.push('Fix the failures above, then call test_fix_loop again to verify.');
    if (failFast && parsed.failed > 0) {
      lines.push('(Running with fail_fast=true — there may be more failures not shown)');
    }
  }

  return {
    content: lines.join('\n'),
    is_error: parsed.failed > 0,
  };
}
