// Cost tracking - token usage and budget monitoring
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

interface CostEntry {
  timestamp: number;
  session_id: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface CostSummary {
  total_sessions: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  by_model: Record<string, { tokens: number; cost: number }>;
  by_date: Record<string, { tokens: number; cost: number }>;
}

const COST_DB_PATH = join(homedir(), '.grain', 'cost-tracking.json');

// Pricing per 1M tokens (as of June 2026)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4': { input: 3.00, output: 15.00 },
  'claude-sonnet-3.5': { input: 3.00, output: 15.00 },
  'claude-haiku': { input: 0.25, output: 1.25 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
};

function getCostPath(): string {
  mkdirSync(dirname(COST_DB_PATH), { recursive: true });
  return COST_DB_PATH;
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Try to find pricing
  const modelKey = Object.keys(MODEL_PRICING).find(k => model.toLowerCase().includes(k));
  if (!modelKey) {
    // Default to sonnet pricing
    return (inputTokens * 3.00 + outputTokens * 15.00) / 1_000_000;
  }
  
  const pricing = MODEL_PRICING[modelKey];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export function trackCost(
  sessionId: string,
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number
): void {
  const entry: CostEntry = {
    timestamp: Date.now(),
    session_id: sessionId,
    model,
    provider,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: calculateCost(model, inputTokens, outputTokens),
  };
  
  const path = getCostPath();
  const line = JSON.stringify(entry) + '\n';
  
  try {
    writeFileSync(path, line, { flag: 'a' });
  } catch (err) {
    // Silent fail - don't break execution
  }
}

function loadCosts(): CostEntry[] {
  const path = getCostPath();
  if (!existsSync(path)) return [];
  
  try {
    const content = readFileSync(path, 'utf-8');
    return content
      .split('\n')
      .filter(l => l.trim())
      .map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

export function getCostSummary(since?: Date): CostSummary {
  const entries = loadCosts();
  const filtered = since 
    ? entries.filter(e => e.timestamp >= since.getTime())
    : entries;
  
  const summary: CostSummary = {
    total_sessions: new Set(filtered.map(e => e.session_id)).size,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cost_usd: 0,
    by_model: {},
    by_date: {},
  };
  
  for (const entry of filtered) {
    summary.total_input_tokens += entry.input_tokens;
    summary.total_output_tokens += entry.output_tokens;
    summary.total_cost_usd += entry.cost_usd;
    
    // By model
    if (!summary.by_model[entry.model]) {
      summary.by_model[entry.model] = { tokens: 0, cost: 0 };
    }
    summary.by_model[entry.model].tokens += entry.input_tokens + entry.output_tokens;
    summary.by_model[entry.model].cost += entry.cost_usd;
    
    // By date
    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    if (!summary.by_date[date]) {
      summary.by_date[date] = { tokens: 0, cost: 0 };
    }
    summary.by_date[date].tokens += entry.input_tokens + entry.output_tokens;
    summary.by_date[date].cost += entry.cost_usd;
  }
  
  return summary;
}

export const costTrackingTool = {
  name: 'cost_summary',
  description: 'View token usage and cost summary. Shows total spend, breakdown by model and date, sessions count.',
  input_schema: {
    type: 'object',
    properties: {
      period: { 
        type: 'string', 
        description: 'Time period: all, today, week, month',
        default: 'all',
      },
    },
  },
};

export async function executeCostSummary(input: { period?: string }): Promise<{ content: string }> {
  const period = input.period || 'all';
  
  let since: Date | undefined;
  const now = new Date();
  
  switch (period) {
    case 'today':
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      since = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }
  
  const summary = getCostSummary(since);
  
  let output = `💰 Cost Summary (${period}):\n\n`;
  
  output += `Sessions: ${summary.total_sessions}\n`;
  output += `Input tokens: ${summary.total_input_tokens.toLocaleString()}\n`;
  output += `Output tokens: ${summary.total_output_tokens.toLocaleString()}\n`;
  output += `Total tokens: ${(summary.total_input_tokens + summary.total_output_tokens).toLocaleString()}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━\n`;
  output += `Total cost: $${summary.total_cost_usd.toFixed(4)} USD\n`;
  
  if (Object.keys(summary.by_model).length > 0) {
    output += `\n📊 By Model:\n`;
    const sorted = Object.entries(summary.by_model)
      .sort((a, b) => b[1].cost - a[1].cost);
    for (const [model, data] of sorted) {
      output += `  ${model}: $${data.cost.toFixed(4)} (${data.tokens.toLocaleString()} tokens)\n`;
    }
  }
  
  if (Object.keys(summary.by_date).length > 1) {
    output += `\n📅 Recent Days:\n`;
    const sorted = Object.entries(summary.by_date)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7);
    for (const [date, data] of sorted) {
      output += `  ${date}: $${data.cost.toFixed(4)} (${data.tokens.toLocaleString()} tokens)\n`;
    }
  }
  
  return { content: output };
}
