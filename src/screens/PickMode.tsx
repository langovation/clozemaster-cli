import React from "react";
import { Box, Text, useInput } from "ink";
import type { PlayMode } from "../api.js";
import { Hints } from "../components/Hints.js";
import { Select } from "../components/Select.js";

export const MODE_LABELS: Record<PlayMode, string> = {
  flashcard: "Flashcards",
  multiple_choice: "Multiple choice",
  text_input: "Text input",
};

const MODE_ORDER: PlayMode[] = ["multiple_choice", "text_input", "flashcard"];

export function nextMode(mode: PlayMode): PlayMode {
  return MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length];
}

type PickModeProps = { onBack: () => void; onPick: (mode: PlayMode) => void; title: string };

export function PickMode({ onBack, onPick, title }: PickModeProps) {
  useInput((_input, key) => {
    if (key.escape) onBack();
  });
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>{title}</Text>
      <Box flexDirection="column">
        <Text bold>How do you want to answer?</Text>
        <Select
          items={[
            { detail: "pick from 4", label: MODE_LABELS.multiple_choice, value: "multiple_choice" as const },
            { detail: "type the word", label: MODE_LABELS.text_input, value: "text_input" as const },
            { detail: "reveal and self-grade", label: MODE_LABELS.flashcard, value: "flashcard" as const },
          ]}
          onSelect={onPick}
        />
      </Box>
      <Hints hints={["enter to pick", "esc to go back"]} />
    </Box>
  );
}
