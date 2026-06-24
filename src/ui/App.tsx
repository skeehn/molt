import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import { PhaseIndicator } from './PhaseIndicator.js';
import { PlanView } from './PlanView.js';
import { ToolOutput } from './ToolOutput.js';
import { UserPrompt } from './UserPrompt.js';
import type { AgentState } from '../types/agent.js';

interface AppProps {
  state: AgentState;
  onInput: (input: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export const App: React.FC<AppProps> = ({ state, onInput, onApprove, onReject }) => {
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={0} marginBottom={1}>
        <Text bold color="cyan">molt</Text>
        <Text dimColor> • session: {state.sessionId.slice(0, 8)}</Text>
      </Box>

      {/* Phase Indicator */}
      <PhaseIndicator phase={state.phase} />

      {/* Thinking */}
      {state.thinking && (
        <Box flexDirection="column" marginY={1}>
          <Text dimColor>💭 </Text>
          <Text>{state.thinking}</Text>
        </Box>
      )}

      {/* Plan */}
      {state.plan && <PlanView plan={state.plan} />}

      {/* Approval Needed */}
      {state.phase === 'waiting_approval' && state.plan && !state.plan.approved && (
        <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="yellow" paddingX={2}>
          <Text color="yellow" bold>⚠️  Approval Required</Text>
          <Newline />
          <Text dimColor>Press </Text>
          <Text color="green" bold>y</Text>
          <Text dimColor> to proceed, </Text>
          <Text color="red" bold>n</Text>
          <Text dimColor> to cancel, or </Text>
          <Text color="cyan" bold>m</Text>
          <Text dimColor> to modify the plan.</Text>
        </Box>
      )}

      {/* Tool Output */}
      {state.toolOutput && <ToolOutput output={state.toolOutput} />}

      {/* Error */}
      {state.error && (
        <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="red" paddingX={2}>
          <Text color="red" bold>❌ Error</Text>
          <Newline />
          <Text>{state.error}</Text>
        </Box>
      )}

      {/* User Input Prompt */}
      {(state.phase === 'idle' || state.phase === 'complete') && (
        <UserPrompt onSubmit={onInput} />
      )}
    </Box>
  );
};
