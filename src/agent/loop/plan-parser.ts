export interface PlanStep {
  id: number;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  tool?: string;
  error?: string;
}

export function parsePlanFromText(text: string): PlanStep[] {
  const lines = text.split('\n');
  const steps: PlanStep[] = [];
  let inPlan = false;
  let stepId = 0;

  for (const line of lines) {
    if (line.toUpperCase().includes('PLAN:')) {
      inPlan = true;
      continue;
    }

    if (!inPlan) continue;

    // Match numbered steps
    const match = line.match(/^\s*(\d+)[\.\)]\s*(.+)$/);
    if (match) {
      const description = match[2].trim();
      steps.push({
        id: ++stepId,
        description,
        status: 'pending',
      });
    } else if (line.trim() && !line.match(/^\s*\d/)) {
      // End of plan
      break;
    }
  }

  return steps;
}
