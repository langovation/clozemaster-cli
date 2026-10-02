import React from "react";
import { Box, Text } from "ink";
import type { Sentence } from "../api.js";
import { splitCloze } from "../answers.js";
import { colors } from "../theme.js";

export function SentenceCard({ isCorrect, sentence }: { isCorrect?: boolean; sentence: Sentence }) {
  const { after, before, cloze } = splitCloze(sentence.text);
  const isAnswered = isCorrect !== undefined;
  return (
    <Box borderStyle="round" borderColor={colors.subtle} flexDirection="column" paddingX={1}>
      <Text>
        {before}
        {isAnswered ? (
          <Text bold color={isCorrect ? colors.brand : colors.danger}>{cloze}</Text>
        ) : (
          <Text color={colors.brand}>{"_".repeat(Math.max(cloze.length, 3))}</Text>
        )}
        {after}
      </Text>
      <Text dimColor>{sentence.translation}</Text>
    </Box>
  );
}
