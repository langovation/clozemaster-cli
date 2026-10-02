import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { colors } from "../theme.js";

export function TextAnswer({ onAnswer }: { onAnswer: (answer: string) => void }) {
  const [answer, setAnswer] = useState("");
  return (
    <Box>
      <Text color={colors.brand}>❯ </Text>
      <TextInput value={answer} onChange={setAnswer} onSubmit={onAnswer} placeholder="type the missing word" />
    </Box>
  );
}
