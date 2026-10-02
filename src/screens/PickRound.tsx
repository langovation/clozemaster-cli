import React from "react";
import { Box, Text, useInput } from "ink";
import { getCollections, type LanguagePairing, type PlayMode } from "../api.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { PixelArt } from "../components/PixelArt.js";
import { Select, type SelectItem } from "../components/Select.js";
import { Spinner } from "../components/Spinner.js";
import { FLAME } from "../sprites.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";

export type RoundChoice = { answerUrl?: string; playDataUrl: string; scope?: string; title: string };

export const MODE_LABELS: Record<PlayMode, string> = {
  multiple_choice: "Multiple choice",
  text_input: "Text input",
};

type PickRoundProps = {
  mode: PlayMode;
  onBack: () => void;
  onPick: (choice: RoundChoice) => void;
  onToggleMode: () => void;
  pairing: LanguagePairing;
};

export function PickRound({ mode, onBack, onPick, onToggleMode, pairing }: PickRoundProps) {
  const { data: collections, error, isLoading } = useRequest(() => getCollections(pairing), [pairing.id]);

  useInput((_input, key) => {
    if (key.escape) onBack();
    if (key.tab) onToggleMode();
  });

  const choices: SelectItem<RoundChoice>[] = [
    { label: "Review", description: "sentences due for review", value: { playDataUrl: pairing.playDataUrl, scope: "ready_for_review", title: "Review" } },
    { label: "Most Common Words", value: { playDataUrl: pairing.playDataUrl, scope: "frequency_collections", title: "Most Common Words" } },
    ...(collections || [])
      .filter((collection) => collection.playing)
      .map((collection) => ({
        description: `${collection.numPlaying} playing · ${collection.numReadyForReview} to review${collection.proOnly ? " · Pro" : ""}`,
        label: collection.name,
        value: { answerUrl: collection.collectionClozeSentencesAnswerUrl, playDataUrl: collection.playDataUrl, title: collection.name },
      })),
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={2} alignItems="center">
        <PixelArt sprite={FLAME} />
        <Box flexDirection="column">
          <Text bold>{pairing.targetLanguageName} from {pairing.baseLanguageName}</Text>
          <Text>
            <Text color={colors.streak}>{pairing.currentStreakDays} day streak</Text>
            <Text dimColor> · </Text>
            <Text color={colors.gold}>{pairing.numPointsToday} points today</Text>
          </Text>
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text bold>What do you want to play?</Text>
        <Select items={choices} onSelect={onPick} />
        {isLoading && <Spinner label="Loading collections…" />}
        {error && <ErrorMessage error={error} />}
      </Box>
      <Text>Mode: <Text color={colors.brand}>{MODE_LABELS[mode]}</Text></Text>
      <Hints hints={["enter to play", "tab to switch mode", "esc to go back"]} />
    </Box>
  );
}
