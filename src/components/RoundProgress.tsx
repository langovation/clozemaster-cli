import React from "react";
import { Text } from "ink";
import { colors } from "../theme.js";

const MAX_SQUARES = 50;

type Square = { isComplete: boolean; results: boolean[] };

// A long round shares each square between several sentences so the bar stays one line.
function squaresFor(results: boolean[], sentencesPerSquare: number, total: number): Square[] {
  const squares: Square[] = [];
  for (let start = 0; start < results.length; start += sentencesPerSquare) {
    const squareResults = results.slice(start, start + sentencesPerSquare);
    const capacity = Math.max(Math.min(sentencesPerSquare, total - start), 1);
    squares.push({ isComplete: squareResults.length >= capacity, results: squareResults });
  }
  return squares;
}

function squareColor({ isComplete, results }: Square): string {
  if (results.includes(false)) return colors.danger;
  return isComplete ? colors.brand : colors.brandLight;
}

export function RoundProgress({ results, total }: { results: boolean[]; total: number }) {
  const sentencesPerSquare = Math.max(Math.ceil(total / MAX_SQUARES), 1);
  const squares = squaresFor(results, sentencesPerSquare, total);
  const squareCount = Math.ceil(total / sentencesPerSquare);
  return (
    <Text>
      {squares.map((square, index) => (
        <Text key={index} color={squareColor(square)}>■</Text>
      ))}
      <Text dimColor>{"□".repeat(Math.max(squareCount - squares.length, 0))}</Text>
      <Text dimColor> {Math.min(results.length + 1, total)}/{total}</Text>
    </Text>
  );
}
