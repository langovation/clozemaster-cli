import React from "react";
import { Box, Text } from "ink";
import { CHECK, CROSS } from "../sprites.js";
import { colors } from "../theme.js";
import { PixelArt } from "./PixelArt.js";

export type AnsweredSentence = { answer: string; correctAnswer: string; isCorrect: boolean; points: number };

export function AnswerFeedback({ answered }: { answered: AnsweredSentence }) {
  return (
    <Box gap={2} alignItems="center">
      <PixelArt sprite={answered.isCorrect ? CHECK : CROSS} />
      {answered.isCorrect ? (
        <Text color={colors.brand} bold>Correct! <Text color={colors.gold}>+{answered.points} points</Text></Text>
      ) : (
        <Box flexDirection="column">
          <Text color={colors.danger} bold>{answered.answer ? `Not “${answered.answer}”` : "Skipped"}</Text>
          <Text>The answer was <Text bold>{answered.correctAnswer}</Text></Text>
        </Box>
      )}
    </Box>
  );
}
