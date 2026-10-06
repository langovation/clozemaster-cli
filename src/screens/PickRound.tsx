import React from "react";
import { Box, Text, useInput } from "ink";
import { getCollections, languagePairingPlayPath, type Collection, type LanguagePairing } from "../api.js";
import { myCollections } from "../collectionSort.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { openFeedbackEmail } from "../feedback.js";
import { PixelArt } from "../components/PixelArt.js";
import { Select, type SelectItem } from "../components/Select.js";
import { Spinner } from "../components/Spinner.js";
import { FLAME } from "../sprites.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";

export type RoundChoice = { answerUrl?: string; playDataUrl: string; scope?: string; title: string };

const BROWSE = "browse";

type PickRoundProps = {
  onBack: () => void;
  onBrowse: () => void;
  onOpenQuickCapture: () => void;
  onOpenSettings: () => void;
  onPick: (choice: RoundChoice) => void;
  pairing: LanguagePairing;
};

function reviewChoice(pairing: LanguagePairing, collections: Collection[]): SelectItem<RoundChoice> {
  const numDue = collections.reduce((sum, collection) => sum + collection.numReadyForReview, 0);
  return {
    detail: `${numDue} due`,
    label: "Review",
    value: { playDataUrl: languagePairingPlayPath(pairing), scope: "ready_for_review", title: "Review" },
  };
}

export function collectionRoundChoice(collection: Collection): RoundChoice {
  return { answerUrl: collection.collectionClozeSentencesAnswerUrl, playDataUrl: collection.playDataUrl, title: collection.name };
}

function collectionChoice(collection: Collection): SelectItem<RoundChoice> {
  const numNew = Math.max(0, collection.numSentences - collection.numPlaying);
  return { detail: `${numNew} new · ${collection.numReadyForReview} due`, label: collection.name, value: collectionRoundChoice(collection) };
}

export function PickRound({ onBack, onBrowse, onOpenQuickCapture, onOpenSettings, onPick, pairing }: PickRoundProps) {
  const { data: collections, error, isLoading } = useRequest(() => getCollections(pairing), [pairing.id]);

  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === "c") onOpenQuickCapture();
    if (input === "s") onOpenSettings();
    if (input === "f") openFeedbackEmail();
  });

  if (isLoading) return <Spinner label="Loading your collections…" />;
  if (error || !collections) return <ErrorMessage error={error || new Error("No collections")} />;

  const mine = myCollections(collections);

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
        <Select<RoundChoice | typeof BROWSE>
          items={[
            reviewChoice(pairing, collections),
            ...mine.map(collectionChoice),
            { label: "Browse all collections…", value: BROWSE },
          ]}
          onSelect={(picked) => (picked === BROWSE ? onBrowse() : onPick(picked))}
        />
      </Box>
      <Hints hints={["enter to pick", "c quick capture", "s settings", "f feedback", "esc to go back"]} />
    </Box>
  );
}
