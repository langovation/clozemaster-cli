import React from "react";
import { Box, Text, useInput } from "ink";
import { getCollections, languagePairingPlayPath, type Collection, type LanguagePairing } from "../api.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { PixelArt } from "../components/PixelArt.js";
import { Select, type SelectItem } from "../components/Select.js";
import { Spinner } from "../components/Spinner.js";
import { FLAME } from "../sprites.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";

export type RoundChoice = { answerUrl?: string; playDataUrl: string; scope?: string; title: string };

type PickRoundProps = { onBack: () => void; onPick: (choice: RoundChoice) => void; pairing: LanguagePairing };

export function PickRound({ onBack, onPick, pairing }: PickRoundProps) {
  const { data: collections, error, isLoading } = useRequest(() => getCollections(pairing), [pairing.id]);

  useInput((_input, key) => {
    if (key.escape) onBack();
  });

  const playPath = languagePairingPlayPath(pairing);
  const choices: SelectItem<RoundChoice>[] = [
    { label: "Review", description: "sentences due", value: { playDataUrl: playPath, scope: "ready_for_review", title: "Review" } },
    { label: "Most Common Words", value: { playDataUrl: playPath, scope: "frequency_collections", title: "Most Common Words" } },
    ...playingFirst(collections || []).map((collection) => ({
      description: collection.playing ? `${collection.numReadyForReview} to review` : collection.proOnly ? "Pro" : undefined,
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
          <Text color={colors.streak}>{pairing.currentStreakDays} day streak</Text>
          <Text color={colors.gold}>{pairing.numPointsToday} points today</Text>
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text bold>What do you want to play?</Text>
        <Select items={choices} onSelect={onPick} />
        {isLoading && <Spinner label="Loading collections…" />}
        {error && <ErrorMessage error={error} />}
      </Box>
      <Hints hints={["enter to pick", "esc to go back"]} />
    </Box>
  );
}

function playingFirst(collections: Collection[]): Collection[] {
  return [...collections].sort((first, second) => Number(second.playing) - Number(first.playing));
}
