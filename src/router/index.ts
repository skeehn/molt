// Model router - intelligent model selection based on task complexity
import type { Message } from '../providers/types.js';

export enum TaskComplexity {
  TRIVIAL = 'trivial',
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  CRITICAL = 'critical',
}

export interface ModelConfig {
  provider: string;
  model: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  speedRating: number;
}

// Real model tiers with actual differentiation
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'haiku': {
    provider: 'bedrock',
    model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
    speedRating: 10,
  },
  'sonnet': {
    provider: 'bedrock',
    model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    speedRating: 7,
  },
  'opus': {
    provider: 'bedrock',
    model: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    speedRating: 4,
  },
};

// Complexity to model mapping
const COMPLEXITY_TO_MODEL: Record<TaskComplexity, string> = {
  [TaskComplexity.TRIVIAL]: 'haiku',
  [TaskComplexity.SIMPLE]: 'haiku',
  [TaskComplexity.MODERATE]: 'sonnet',
  [TaskComplexity.COMPLEX]: 'opus',
  [TaskComplexity.CRITICAL]: 'opus',
};

// Keywords for task classification
const KEYWORD_PATTERNS = {
  trivial: [
    /^(show|read|display|list|get|fetch|check|status|what|how\smany)/i,
    /^git\sstatus/i,
    /^scan/i,
  ],
  simple: [
    /comment|doc|readme|format|lint|style/i,
    /typo|fix\stypo|rename/i,
    /add\slog|console\.log|debug/i,
  ],
  critical: [
    /security|auth|password|token|secret|key|encrypt|decrypt/i,
    /payment|billing|transaction|money|credit\scard|stripe/i,
    /deploy|production|release|publish|ship/i,
    /delete.*database|drop.*table|truncate/i,
  ],
  complex: [
    /architecture|design|pattern|refactor\s(entire|whole|all)/i,
    /algorithm|optimization|performance/i,
    /database\sschema|migration|model/i,
    /api\sdesign|rest\sapi|graphql/i,
    /website|landing|web\sapp|frontend/i,
  ],
};

export function classifyTaskComplexity(prompt: string, _conversationHistory?: Message[]): TaskComplexity {
  // Check for critical patterns first
  for (const pattern of KEYWORD_PATTERNS.critical) {
    if (pattern.test(prompt)) return TaskComplexity.CRITICAL;
  }

  // Check for complex patterns
  for (const pattern of KEYWORD_PATTERNS.complex) {
    if (pattern.test(prompt)) return TaskComplexity.COMPLEX;
  }

  // Check for trivial patterns
  for (const pattern of KEYWORD_PATTERNS.trivial) {
    if (pattern.test(prompt)) return TaskComplexity.TRIVIAL;
  }

  // Check for simple patterns
  for (const pattern of KEYWORD_PATTERNS.simple) {
    if (pattern.test(prompt)) return TaskComplexity.SIMPLE;
  }

  // Heuristics
  const wordCount = prompt.split(/\s+/).length;
  const hasMultipleSteps = /\d\.\s|\band\s.*\band\s/.test(prompt);

  if (wordCount < 10) return TaskComplexity.TRIVIAL;
  if (wordCount < 30 && !hasMultipleSteps) return TaskComplexity.SIMPLE;
  if (wordCount > 100 || hasMultipleSteps) return TaskComplexity.COMPLEX;

  return TaskComplexity.MODERATE;
}

export function routeModel(
  complexity: TaskComplexity,
  options?: { preferFast?: boolean; preferCheap?: boolean; forceModel?: string; }
): ModelConfig {
  if (options?.forceModel && MODEL_CONFIGS[options.forceModel]) {
    return MODEL_CONFIGS[options.forceModel];
  }

  let modelKey = COMPLEXITY_TO_MODEL[complexity];

  if (options?.preferCheap) modelKey = 'haiku';
  if (options?.preferFast) modelKey = 'haiku';

  return MODEL_CONFIGS[modelKey];
}

export function estimateCost(inputTokens: number, outputTokens: number, model: ModelConfig): number {
  return (inputTokens / 1_000_000) * model.inputCostPer1M + (outputTokens / 1_000_000) * model.outputCostPer1M;
}

export function explainRouting(complexity: TaskComplexity, model: ModelConfig): string {
  const reasons: Record<TaskComplexity, string> = {
    [TaskComplexity.TRIVIAL]: 'Quick task → Haiku (fast, cheap)',
    [TaskComplexity.SIMPLE]: 'Simple edit → Haiku (fast, cheap)',
    [TaskComplexity.MODERATE]: 'Standard task → Sonnet (balanced)',
    [TaskComplexity.COMPLEX]: 'Complex work → Opus (most capable)',
    [TaskComplexity.CRITICAL]: 'Critical → Opus (most capable)',
  };
  return `${reasons[complexity]} [${model.model.split('.').pop()?.split('-')[0] || model.model}]`;
}
