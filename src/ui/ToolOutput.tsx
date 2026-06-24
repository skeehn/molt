import React from 'react';
import { Box, Text, Newline } from 'ink';

interface ToolOutputProps {
  output: string;
}

export const ToolOutput: React.FC<ToolOutputProps> = ({ output }) => {
  const lines = output.split('\n').slice(0, 10); // Show first 10 lines
  const truncated = output.split('\n').length > 10;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={2} paddingY={1} marginY={1}>
      <Text dimColor bold>🔧 TOOL OUTPUT</Text>
      <Newline />
      {lines.map((line, idx) => (
        <Text key={idx} dimColor>{line}</Text>
      ))}
      {truncated && <Text dimColor>... ({output.split('\n').length - 10} more lines)</Text>}
    </Box>
  );
};
