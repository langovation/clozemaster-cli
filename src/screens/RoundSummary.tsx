import React from "react";
import { Box, Text, useInput } from "ink";
import { Hints } from "../components/Hints.js";
import { PixelArt } from "../components/PixelArt.js";
import { TROPHY } from "../sprites.js";
import { colors } from "../theme.js";

type RoundSummaryProps = {
  numCorrect: number;
  numPointsToday?: number;
  onMenu: () => void;
  onPlayAgain: () => void;
  points: number;
  total: number;
};

export function RoundSummary({ numCorrect, numPointsToday, onMenu, onPlayAgain, points, total }: RoundSummaryProps) {
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
          <Text>{numCorrect}/{total} correct · <Text color={colors.gold}>+{points} points</Text></Text>
          {numPointsToday !== undefined && <Text dimColor>{numPointsToday} points today</Text>}
        </Box>
      </Box>
      <Hints hints={["enter for another round", "esc for menu"]} />
    </Box>
  );
}
