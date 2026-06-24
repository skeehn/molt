import React from 'react';
import { Box, Text, Newline } from 'ink';
import type { AgentPlan, StepStatus } from '../types/agent.js';

interface PlanViewProps {
  plan: AgentPlan;
}

const STATUS_ICONS: Record<StepStatus, { icon: string; color: string }> = {
  pending: { icon: '⏸', color: 'gray' },
  running: { icon: '→', color: 'cyan' },
  complete: { icon: '✓', color: 'green' },
  failed: { icon: '✗', color: 'red' },
  skipped: { icon: '⊘', color: 'yellow' },
};

export const PlanView: React.FC<PlanViewProps> = ({ plan }) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={2} paddingY={1} marginY={1}>
      <Text color="blue" bold>📋 PLAN</Text>
      <Newline />
      {plan.steps.map((step, idx) => {
        const { icon, color } = STATUS_ICONS[step.status];
        const isCurrent = idx === plan.currentStepIndex;
        
        return (
          <Box key={step.id} flexDirection="column" marginBottom={idx < plan.steps.length - 1 ? 1 : 0}>
            <Box>
              <Text color={color as any} bold={isCurrent}>
                {icon} {idx + 1}. {step.description}
              </Text>
            </Box>
            {step.tool && (
              <Box marginLeft={4}>
                <Text dimColor>Tool: </Text>
                <Text color="cyan">{step.tool}</Text>
              </Box>
            )}
            {step.result && (
              <Box marginLeft={4}>
                <Text dimColor>Result: </Text>
                <Text>{step.result.slice(0, 60)}{step.result.length > 60 ? '...' : ''}</Text>
              </Box>
            )}
            {step.error && (
              <Box marginLeft={4}>
                <Text color="red">Error: {step.error}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
