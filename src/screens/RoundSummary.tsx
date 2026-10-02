import React from "react";
import { Box, Text, useInput } from "ink";
import { Hints } from "../components/Hints.js";
import { PixelArt } from "../components/PixelArt.js";
import { TROPHY } from "../sprites.js";
import { colors } from "../theme.js";

type RoundSummaryProps = {
  numCorrect: number;
  numMissed: number;
  numPointsToday?: number;
  onMenu: () => void;
  onPlayAgain: () => void;
  points: number;
};

export function RoundSummary({ numCorrect, numMissed, numPointsToday, onMenu, onPlayAgain, points }: RoundSummaryProps) {
  useInput((_input, key) => {
    if (key.return) onPlayAgain();
    if (key.escape) onMenu();
  });
  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={3} alignItems="center">
        <PixelArt sprite={TROPHY} />
        <Box flexDirection="column">
          <Text bold color={colors.gold}>Round complete!</Text>
          <Text>{numCorrect} correct · {numMissed} missed</Text>
          <Text color={colors.gold}>+{points} points</Text>
          {numPointsToday !== undefined && <Text dimColor>{numPointsToday} points today</Text>}
        </Box>
      </Box>
      <Hints hints={["enter: another round", "esc: menu"]} />
    </Box>
  );
}
