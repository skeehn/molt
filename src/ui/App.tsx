import React from 'react';
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
  const showPrompt = state.phase === 'idle' || state.phase === 'complete';
  const showApproval = state.phase === 'waiting_approval' && state.plan && !state.plan.approved;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text bold color="cyan">molt</Text>
        <Text dimColor> v0.3.0 • {state.sessionId.slice(0, 8)}</Text>
      </Box>

      {/* Phase Indicator */}
      <PhaseIndicator phase={state.phase} />

      {/* Thinking */}
      {state.thinking && (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>{state.thinking}</Text>
        </Box>
      )}

      {/* Plan */}
      {state.plan && <PlanView plan={state.plan} />}

      {/* Approval Needed */}
      {showApproval && (
        <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
          <Text color="yellow" bold>⚠️  Approval Required</Text>
          <Newline />
          <Text dimColor>Press </Text>
          <Text color="green" bold>y</Text>
          <Text dimColor> to proceed, </Text>
          <Text color="red" bold>n</Text>
          <Text dimColor> to cancel</Text>
        </Box>
      )}

      {/* Tool Output */}
      {state.toolOutput && <ToolOutput output={state.toolOutput} />}

      {/* Error */}
      {state.error && (
        <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
          <Text color="red" bold>❌ Error</Text>
          <Newline />
          <Text>{state.error}</Text>
        </Box>
      )}

      {/* User Input Prompt */}
      {showPrompt && <UserPrompt onSubmit={onInput} />}
      
      {/* Approval Input */}
      {showApproval && <ApprovalPrompt onApprove={onApprove} onReject={onReject} />}
    </Box>
  );
};

// Separate component for approval input
import { useInput } from 'ink';

interface ApprovalPromptProps {
  onApprove: () => void;
  onReject: () => void;
}

const ApprovalPrompt: React.FC<ApprovalPromptProps> = ({ onApprove, onReject }) => {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') {
      onApprove();
    } else if (input === 'n' || input === 'N') {
      onReject();
    }
  });

  return (
    <Box marginTop={1}>
      <Text dimColor>[y/n]: </Text>
      <Text inverse> </Text>
    </Box>
  );
};
