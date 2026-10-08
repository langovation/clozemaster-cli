import React from "react";
import { Text } from "ink";
import { splitCloze } from "../cloze.js";
import { colors } from "../theme.js";

export function ClozeSentence({ color = colors.brand, text }: { color?: string; text: string }) {
  const { after, before, cloze } = splitCloze(text);
  return (
    <Text>
      {before}
      <Text bold color={color}>{cloze}</Text>
      {after}
    </Text>
  );
}
