import React from "react";
import { Box, Text, useInput } from "ink";
import { colors } from "../theme.js";

export function MultipleChoiceAnswer({ onAnswer, options }: { onAnswer: (answer: string) => void; options: string[] }) {
  useInput((input) => {
    const option = options[Number(input) - 1];
    if (option) onAnswer(option);
  });
  return (
    <Box gap={3} flexWrap="wrap">
      {options.map((option, index) => (
        <Text key={index}>
          <Text color={colors.brand} bold>{index + 1}</Text> {option}
        </Text>
      ))}
    </Box>
  );
}
