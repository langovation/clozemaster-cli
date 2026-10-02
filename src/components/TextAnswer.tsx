import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { cycleLastLetterAccent } from "../accents.js";
import { colors } from "../theme.js";

export function TextAnswer({ onAnswer }: { onAnswer: (answer: string) => void }) {
  const [answer, setAnswer] = useState("");
  useInput((_input, key) => {
    if (key.upArrow) setAnswer((current) => cycleLastLetterAccent(current, 1));
    if (key.downArrow) setAnswer((current) => cycleLastLetterAccent(current, -1));
  });
  return (
    <Box>
      <Text color={colors.brand}>❯ </Text>
      <TextInput value={answer} onChange={setAnswer} onSubmit={onAnswer} placeholder="type the missing word" />
    </Box>
  );
}
