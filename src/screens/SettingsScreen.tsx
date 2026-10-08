import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Hints } from "../components/Hints.js";
import { ListRow } from "../components/ListRow.js";
import { cycledIndex } from "../cycle.js";
import type { Settings, TranslationVisibility } from "../settings.js";
import { useSettings } from "../SettingsContext.js";
import { colors } from "../theme.js";

type SettingRow = {
  description: string;
  key: keyof Settings;
  label: string;
  values: Settings[keyof Settings][];
};

const TRANSLATION_LABELS: Record<TranslationVisibility, string> = {
  after: "after answering",
  hidden: "hidden",
  visible: "always",
};

const ROWS: SettingRow[] = [
  { description: "green while you're on track, red once you're not", key: "typingColorHint", label: "Typing color hint", values: [true, false] },
  { description: "say when an answer is off by a letter or two", key: "spellingHints", label: "Spelling hints", values: [true, false] },
  { description: "an answer missing an accent is wrong", key: "strictAccents", label: "Strict accents", values: [true, false] },
  { description: "when to show the translation", key: "translation", label: "Translation", values: ["visible", "after", "hidden"] },
  { description: "show the sentence's hint before answering", key: "hints", label: "Hints", values: [true, false] },
  { description: "show the sentence's mastery checkmarks before answering too", key: "masteryBeforeAnswering", label: "Mastery before answering", values: [true, false] },
  { description: "show pronunciation after answering", key: "pronunciation", label: "Pronunciation", values: [true, false] },
  { description: "play the sentence out loud after answering, p to replay", key: "audio", label: "Audio", values: [true, false] },
  { description: "a chime for a right answer and a finished round", key: "soundEffects", label: "Sound effects", values: [true, false] },
];

function valueLabel(value: Settings[keyof Settings]): string {
  if (typeof value === "boolean") return value ? "on" : "off";
  return TRANSLATION_LABELS[value];
}

function cycledValue(row: SettingRow, settings: Settings, step: number): Settings[keyof Settings] {
  return row.values[cycledIndex(row.values.indexOf(settings[row.key]), step, row.values.length)];
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useSettings();
  const [highlighted, setHighlighted] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === "q") onBack();
    if (key.upArrow || input === "k") setHighlighted((index) => cycledIndex(index, -1, ROWS.length));
    if (key.downArrow || input === "j") setHighlighted((index) => cycledIndex(index, 1, ROWS.length));
    if (key.return || input === " " || key.rightArrow || key.leftArrow) {
      const row = ROWS[highlighted];
      updateSettings({ [row.key]: cycledValue(row, settings, key.leftArrow ? -1 : 1) });
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Settings</Text>
      <Box flexDirection="column">
        {ROWS.map((row, index) => {
          const isHighlighted = index === highlighted;
          return (
            <ListRow key={row.key} isHighlighted={isHighlighted} label={row.label}>
              <Text bold={isHighlighted} color={isHighlighted ? colors.brand : undefined}>{valueLabel(settings[row.key])}</Text>
            </ListRow>
          );
        })}
      </Box>
      <Text dimColor>{ROWS[highlighted].description}</Text>
      <Hints hints={["enter to change", "esc back"]} />
    </Box>
  );
}
