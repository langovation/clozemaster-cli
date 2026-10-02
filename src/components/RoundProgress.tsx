import React from "react";
import { Text } from "ink";
import { colors } from "../theme.js";

export function RoundProgress({ results, total }: { results: boolean[]; total: number }) {
  return (
    <Text>
      {results.map((isCorrect, index) => (
        <Text key={index} color={isCorrect ? colors.brand : colors.danger}>■</Text>
      ))}
      <Text dimColor>{"□".repeat(Math.max(total - results.length, 0))}</Text>
      <Text dimColor> {Math.min(results.length + 1, total)}/{total}</Text>
    </Text>
  );
}
