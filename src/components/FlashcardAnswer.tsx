import React from "react";
import { Box, Text, useInput } from "ink";
import { colors } from "../theme.js";

type FlashcardAnswerProps = { isRevealed: boolean; onGrade: (isCorrect: boolean) => void; onKnown: () => void; onReveal: () => void };

export function FlashcardAnswer({ isRevealed, onGrade, onKnown, onReveal }: FlashcardAnswerProps) {
  useInput((input, key) => {
    if (!isRevealed && (input === " " || key.return)) onReveal();
    if (isRevealed && (input === "1" || key.leftArrow)) onGrade(false);
    if (isRevealed && (input === "2" || key.rightArrow)) onGrade(true);
    if (isRevealed && input === "k") onKnown();
  });
  if (!isRevealed) return <Text>Press <Text color={colors.brand} bold>space</Text> to reveal</Text>;
  return (
    <Box justifyContent="space-between">
      <Box gap={3}>
        <Text><Text color={colors.danger} bold>1</Text> Again</Text>
        <Text><Text color={colors.brand} bold>2</Text> Good</Text>
      </Box>
      <Text><Text color={colors.gold} bold>k</Text> Known</Text>
    </Box>
  );
}
