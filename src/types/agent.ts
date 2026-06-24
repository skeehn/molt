// Core agent types for multi-phase execution

export type AgentPhase = 
  | 'idle'
  | 'understanding'
  | 'planning'
  | 'waiting_approval'
  | 'executing'
  | 'verifying'
  | 'reflecting'
  | 'complete'
  | 'error';

export type StepStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped';

export interface PlanStep {
  id: string;
  description: string;
  status: StepStatus;
  tool?: string;
  result?: string;
  error?: string;
}

export interface AgentPlan {
  steps: PlanStep[];
  currentStepIndex: number;
  needsApproval: boolean;
  approved: boolean;
}

export interface AgentState {
  phase: AgentPhase;
  plan?: AgentPlan;
  thinking?: string;
  toolOutput?: string;
  error?: string;
  sessionId: string;
}

export interface AgentConfig {
  autoApprove: boolean;  // Skip approval, auto-execute plans
  verifySteps: boolean;  // Run verification after each step
  reflectOnComplete: boolean;  // Reflect phase after completion
  maxRetries: number;
  provider: string;
  model?: string;
}
