// Model router - intelligent model selection based on task complexity
import type { Message } from '../providers/types.js';

export enum TaskComplexity {
  TRIVIAL = 'trivial',      // Read, status check, simple questions
  SIMPLE = 'simple',        // Small edits, docs, comments
  MODERATE = 'moderate',    // Features, refactors, tests
  COMPLEX = 'complex',      // Architecture, algorithms
  CRITICAL = 'critical',    // Security, payments, prod
}

export interface ModelConfig {
  provider: string;
  model: string;
  inputCostPer1M: number;   // USD per 1M tokens
  outputCostPer1M: number;
  speedRating: number;      // 1-10, higher = faster
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'haiku': {
    provider: 'bedrock',
    model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',  // Fallback to Sonnet 4 (Haiku not available in this region yet)
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    speedRating: 10,
  },
  'sonnet-3.5': {
    provider: 'bedrock',
    model: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    speedRating: 8,
  },
  'sonnet-4': {
    provider: 'bedrock',
    model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    speedRating: 7,
  },
  'opus': {
    provider: 'bedrock',
    model: 'anthropic.claude-3-opus-20240229-v1:0',
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    speedRating: 3,
  },
  'qwen-local': {
    provider: 'ollama',
    model: 'qwen2.5-coder:32b',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    speedRating: 6,
  },
};

// Complexity to model mapping
const COMPLEXITY_TO_MODEL: Record<TaskComplexity, string> = {
  [TaskComplexity.TRIVIAL]: 'haiku',
  [TaskComplexity.SIMPLE]: 'haiku',
  [TaskComplexity.MODERATE]: 'sonnet-3.5',
  [TaskComplexity.COMPLEX]: 'sonnet-4',
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
  ],
};

export function classifyTaskComplexity(prompt: string, conversationHistory?: Message[]): TaskComplexity {
  const lowerPrompt = prompt.toLowerCase();
  
  // Check for critical patterns first (security, money)
  for (const pattern of KEYWORD_PATTERNS.critical) {
    if (pattern.test(prompt)) {
      return TaskComplexity.CRITICAL;
    }
  }
  
  // Check for complex patterns
  for (const pattern of KEYWORD_PATTERNS.complex) {
    if (pattern.test(prompt)) {
      return TaskComplexity.COMPLEX;
    }
  }
  
  // Check for trivial patterns
  for (const pattern of KEYWORD_PATTERNS.trivial) {
    if (pattern.test(prompt)) {
      return TaskComplexity.TRIVIAL;
    }
  }
  
  // Check for simple patterns
  for (const pattern of KEYWORD_PATTERNS.simple) {
    if (pattern.test(prompt)) {
      return TaskComplexity.SIMPLE;
    }
  }
  
  // Heuristics based on prompt characteristics
  const wordCount = prompt.split(/\s+/).length;
  const hasCodeBlock = /```/.test(prompt);
  const hasMultipleSteps = /\d\.\s|\band\s.*\band\s/.test(prompt);
  
  // Very short, no code, no steps → likely trivial
  if (wordCount < 10 && !hasCodeBlock && !hasMultipleSteps) {
    return TaskComplexity.TRIVIAL;
  }
  
  // Short with code or couple steps → simple
  if (wordCount < 30 && !hasMultipleSteps) {
    return TaskComplexity.SIMPLE;
  }
  
  // Long or multi-step → complex
  if (wordCount > 100 || hasMultipleSteps) {
    return TaskComplexity.COMPLEX;
  }
  
  // Default to moderate
  return TaskComplexity.MODERATE;
}

export function routeModel(
  complexity: TaskComplexity,
  options?: {
    preferFast?: boolean;
    preferCheap?: boolean;
    forceModel?: string;
  }
): ModelConfig {
  // User override
  if (options?.forceModel && MODEL_CONFIGS[options.forceModel]) {
    return MODEL_CONFIGS[options.forceModel];
  }
  
  // Default routing by complexity
  let modelKey = COMPLEXITY_TO_MODEL[complexity];
  
  // If user prefers cheap, downgrade one tier (unless already cheapest)
  if (options?.preferCheap && complexity !== TaskComplexity.TRIVIAL) {
    const tiers = [TaskComplexity.TRIVIAL, TaskComplexity.SIMPLE, TaskComplexity.MODERATE, TaskComplexity.COMPLEX, TaskComplexity.CRITICAL];
    const currentIndex = tiers.indexOf(complexity);
    if (currentIndex > 0) {
      const cheaperComplexity = tiers[currentIndex - 1];
      modelKey = COMPLEXITY_TO_MODEL[cheaperComplexity];
    }
  }
  
  // If user prefers fast, use Haiku for anything under complex
  if (options?.preferFast && complexity !== TaskComplexity.CRITICAL && complexity !== TaskComplexity.COMPLEX) {
    modelKey = 'haiku';
  }
  
  return MODEL_CONFIGS[modelKey];
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelConfig
): number {
  const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M;
  return inputCost + outputCost;
}

export function explainRouting(complexity: TaskComplexity, model: ModelConfig): string {
  const reasons: Record<TaskComplexity, string> = {
    [TaskComplexity.TRIVIAL]: 'Simple task (read/status) → using fastest, cheapest model',
    [TaskComplexity.SIMPLE]: 'Basic edit → using fast, cheap model',
    [TaskComplexity.MODERATE]: 'Standard coding task → using balanced model',
    [TaskComplexity.COMPLEX]: 'Complex logic/architecture → using powerful model',
    [TaskComplexity.CRITICAL]: 'Security/money/production → using most capable model',
  };
  
  return `${reasons[complexity]} (${model.model}, ~$${model.inputCostPer1M.toFixed(2)}/$${model.outputCostPer1M.toFixed(2)} per 1M tokens)`;
}
