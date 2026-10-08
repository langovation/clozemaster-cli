import React from "react";
import { Box, Text, useInput } from "ink";
import type { PlayMode } from "../api.js";
import { Hints } from "../components/Hints.js";
import { Select } from "../components/Select.js";
import { MODE_LABELS, MODE_ORDER } from "../playModes.js";

const MODE_DETAILS: Record<PlayMode, string> = {
  flashcard: "reveal and self-grade",
  listening: "hear it, then type the word",
  multiple_choice: "pick from 4",
  text_input: "type the word",
};

const MODE_ITEMS = MODE_ORDER.map((mode) => ({ detail: MODE_DETAILS[mode], label: MODE_LABELS[mode], value: mode }));

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
        <Select items={MODE_ITEMS} onSelect={onPick} />
      </Box>
      <Hints hints={["enter to pick", "esc back"]} />
    </Box>
  );
}
