import React from 'react';
import { Box, Text } from 'ink';
import type { AgentPhase } from '../types/agent.js';

interface PhaseIndicatorProps {
  phase: AgentPhase;
}

const PHASE_LABELS: Record<AgentPhase, { label: string; icon: string; color: string }> = {
  idle: { label: 'Idle', icon: '⏸', color: 'gray' },
  understanding: { label: 'Understanding', icon: '💭', color: 'cyan' },
  planning: { label: 'Planning', icon: '📋', color: 'blue' },
  waiting_approval: { label: 'Waiting for Approval', icon: '⏳', color: 'yellow' },
  executing: { label: 'Executing', icon: '🔧', color: 'green' },
  verifying: { label: 'Verifying', icon: '✓', color: 'magenta' },
  reflecting: { label: 'Reflecting', icon: '🤔', color: 'blue' },
  complete: { label: 'Complete', icon: '✅', color: 'green' },
  error: { label: 'Error', icon: '❌', color: 'red' },
};

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ phase }) => {
  const { label, icon, color } = PHASE_LABELS[phase];

  return (
    <Box marginY={1}>
      <Text color={color as any} bold>
        {icon} {label.toUpperCase()}
      </Text>
    </Box>
  );
};
