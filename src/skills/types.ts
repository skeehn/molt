/**
 * Skills System Types
 * 
 * Skills are reusable problem-solving patterns that grain learns from successful executions.
 */

/**
 * Pattern matching configuration for skill triggers
 */
export interface SkillPattern {
  /** Regex patterns to match against user input */
  regex?: string[];
  /** Keywords that indicate this skill should be used */
  keywords?: string[];
  /** Semantic description for similarity matching */
  semantic?: string;
}

/**
 * Example of successful skill usage
 */
export interface SkillExample {
  /** Description of the problem */
  problem: string;
  /** What was executed */
  execution: string;
  /** Outcome/result */
  outcome: string;
  /** Timestamp of when this was successful */
  timestamp: string;
}

/**
 * Metadata about skill performance
 */
export interface SkillMetadata {
  /** Number of times this skill has been used */
  times_used: number;
  /** Success rate (0-1) */
  success_rate: number;
  /** When the skill was created */
  created_at: string;
  /** When the skill was last used */
  last_used?: string;
  /** When the skill was last updated */
  updated_at: string;
  /** Tags for categorization */
  tags?: string[];
  /** Estimated complexity (1-5) */
  complexity?: number;
}

/**
 * A reusable skill that grain has learned
 */
export interface Skill {
  /** Unique identifier for the skill */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this skill does */
  description: string;
  /** Pattern matching configuration */
  pattern: SkillPattern;
  /** Approach/steps to execute (markdown format) */
  approach: string;
  /** Code snippets or commands to execute */
  code?: string[];
  /** Examples of successful usage */
  examples: SkillExample[];
  /** Performance metadata */
  metadata: SkillMetadata;
}

/**
 * Result of matching a skill against user input
 */
export interface SkillMatch {
  /** The matched skill */
  skill: Skill;
  /** Confidence score (0-1) */
  confidence: number;
  /** What triggered the match */
  trigger: 'regex' | 'keyword' | 'semantic';
  /** Matched pattern/keyword */
  matched: string;
}

/**
 * Result of executing a skill
 */
export interface SkillExecutionResult {
  /** The skill that was executed */
  skill: Skill;
  /** Whether execution was successful */
  success: boolean;
  /** Output/result from execution */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  duration: number;
  /** Timestamp of execution */
  timestamp: string;
}

/**
 * Configuration for skill creation
 */
export interface CreateSkillConfig {
  name: string;
  description: string;
  pattern: SkillPattern;
  approach: string;
  code?: string[];
  example: Omit<SkillExample, 'timestamp'>;
  tags?: string[];
  complexity?: number;
}
