// Minimal test to verify Ink works
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';

const TestApp = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  useInput((char, key) => {
    if (key.return) {
      if (input.trim()) {
        setMessages(prev => [...prev, `You: ${input}`, `molt: Echo - ${input}`]);
        setInput('');
      }
    } else if (key.backspace) {
      setInput(prev => prev.slice(0, -1));
    } else if (key.ctrl && char === 'c') {
      process.exit(0);
    } else if (!key.ctrl && !key.meta && char) {
      setInput(prev => prev + char);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text bold color="cyan">molt test</Text>
      </Box>

      {messages.map((msg, i) => (
        <Text key={i} dimColor={msg.startsWith('molt')}>{msg}</Text>
      ))}

      <Box marginTop={1}>
        <Text color="cyan" bold>You: </Text>
        <Text>{input}</Text>
        <Text inverse> </Text>
      </Box>
    </Box>
  );
};

render(<TestApp />);
