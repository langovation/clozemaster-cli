import React from "react";
import { Text } from "ink";
import type { LanguagePairing } from "../api.js";
import { colors } from "../theme.js";

const BAR_WIDTH = 16;

export function LevelProgress({ pairing }: { pairing: LanguagePairing }) {
  const filledCells = Math.round(levelFraction(pairing) * BAR_WIDTH);
  return (
    <Text>
      Level {pairing.level} <Text color={colors.brand}>{"■".repeat(filledCells)}</Text>
      <Text dimColor>{"□".repeat(BAR_WIDTH - filledCells)}</Text> Level {pairing.level + 1}
    </Text>
  );
}

function levelFraction({ currentLevelPoints, nextLevelPoints, score }: LanguagePairing): number {
  const fraction = (score - currentLevelPoints) / (nextLevelPoints - currentLevelPoints);
  return Math.min(Math.max(fraction, 0), 1);
}
