import React from "react";
import { Text } from "ink";
import { colors } from "../theme.js";

const MAX_SQUARES = 10;

// Like the mobile app, the bar fills on correct answers only; a missed sentence comes back later, so it adds to what's left.
export function RoundProgress({ results, total }: { results: boolean[]; total: number }) {
  const correctCount = results.filter(Boolean).length;
  const barTotal = correctCount + total - results.length;
  const squareCount = Math.min(Math.max(barTotal, 1), MAX_SQUARES);
  const filledUnits = barTotal > 0 ? (correctCount / barTotal) * squareCount : 0;
  const fullSquares = Math.floor(filledUnits);
  const hasPartialSquare = filledUnits > fullSquares;
  return (
    <Text>
      <Text color={colors.brand}>{"■".repeat(fullSquares)}</Text>
      {hasPartialSquare && <Text color={colors.brandLight}>■</Text>}
      <Text dimColor>{"□".repeat(squareCount - fullSquares - (hasPartialSquare ? 1 : 0))}</Text>
      <Text dimColor> {Math.min(results.length + 1, total)}/{total}</Text>
    </Text>
  );
}
