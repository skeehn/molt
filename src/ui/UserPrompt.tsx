import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface UserPromptProps {
  onSubmit: (input: string) => void;
}

export const UserPrompt: React.FC<UserPromptProps> = ({ onSubmit }) => {
  const [input, setInput] = useState('');

  useInput((inputChar, key) => {
    if (key.return) {
      if (input.trim()) {
        onSubmit(input);
        setInput('');
      }
      // Don't exit on empty enter - just do nothing
    } else if (key.backspace || key.delete) {
      setInput(input.slice(0, -1));
    } else if (!key.ctrl && !key.meta && inputChar) {
      setInput(input + inputChar);
    }
  });

  return (
    <Box marginY={1}>
      <Text color="cyan" bold>You: </Text>
      <Text>{input}</Text>
      <Text inverse> </Text>
    </Box>
  );
};
