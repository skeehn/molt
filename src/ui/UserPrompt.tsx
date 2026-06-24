import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface UserPromptProps {
  onSubmit: (input: string) => void;
}

export const UserPrompt: React.FC<UserPromptProps> = ({ onSubmit }) => {
  const [input, setInput] = useState('');

  useInput((inputChar, key) => {
    if (key.return) {
      // Only submit if input is non-empty
      // Empty enter does nothing (continuous REPL mode)
      if (input.trim()) {
        onSubmit(input);
        setInput('');
      }
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (key.ctrl && inputChar === 'c') {
      // Allow Ctrl+C to exit
      process.exit(0);
    } else if (!key.ctrl && !key.meta && inputChar) {
      setInput(prev => prev + inputChar);
    }
  });

  return (
    <Box marginTop={1}>
      <Text color="cyan" bold>You</Text>
      <Text dimColor>: </Text>
      <Text>{input}</Text>
      <Text inverse> </Text>
    </Box>
  );
};
