import React from "react";
import { Box, Text, useInput } from "ink";
import { getCollections, getLanguagePairing, type Collection, type LanguagePairing } from "../api.js";
import { myCollections } from "../collectionSort.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { PixelArt } from "../components/PixelArt.js";
import { Select, type SelectItem } from "../components/Select.js";
import { Spinner } from "../components/Spinner.js";
import { openFeedbackEmail } from "../feedback.js";
import { collectionRoundChoice, reviewRoundChoice, type RoundChoice } from "../roundChoice.js";
import { FLAME } from "../sprites.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";

const BROWSE = "browse";

type PickRoundProps = {
  onBack: () => void;
  onBrowse: () => void;
  onOpenQuickCapture: () => void;
  onOpenSettings: () => void;
  onPick: (choice: RoundChoice) => void;
  pairing: LanguagePairing;
};

export function PickRound({ onBack, onBrowse, onOpenQuickCapture, onOpenSettings, onPick, pairing }: PickRoundProps) {
  const { error, isLoading, result: collections } = useRequest(() => getCollections(pairing), [pairing.id]);
  const { result: rankedPairing } = useRequest(() => getLanguagePairing(pairing), [pairing.id]);

  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === "c") onOpenQuickCapture();
    if (input === "s") onOpenSettings();
    if (input === "f") openFeedbackEmail();
  });

  if (isLoading) return <Spinner label="Loading your collections…" />;
  if (error || !collections) return <ErrorMessage error={error || new Error("No collections")} />;

  return (
    <Box flexDirection="column" gap={1}>
      <PairingStats leaderboardRank={rankedPairing?.currentWeekLeaderboardRank} pairing={pairing} />
      <Box flexDirection="column">
        <Text bold>What do you want to play?</Text>
        <Select<RoundChoice | typeof BROWSE>
          items={[
            reviewItem(pairing, collections),
            ...myCollections(collections).map(collectionItem),
            { label: "Browse all collections…", value: BROWSE },
          ]}
          onSelect={(picked) => (picked === BROWSE ? onBrowse() : onPick(picked))}
        />
      </Box>
      <Hints hints={["enter to pick", "c quick capture", "s settings", "f feedback", "esc back"]} />
    </Box>
  );
}

function PairingStats({ leaderboardRank, pairing }: { leaderboardRank?: number; pairing: LanguagePairing }) {
  return (
    <Box gap={2} alignItems="center">
      <PixelArt sprite={FLAME} />
      <Box flexDirection="column">
        <Text bold>{pairing.targetLanguageName} from {pairing.baseLanguageName}</Text>
        <Text>
          Level {pairing.level} · <Text color={colors.streak}>{pairing.currentStreakDays} day streak</Text>
        </Text>
        <Text>
          <Text color={colors.gold}>{pairing.numPointsToday.toLocaleString("en")} points today</Text> · {pairing.score.toLocaleString("en")} total
        </Text>
        {leaderboardRank ? <Text>{ordinal(leaderboardRank)} on this week's leaderboard</Text> : null}
      </Box>
    </Box>
  );
}

function reviewItem(pairing: LanguagePairing, collections: Collection[]): SelectItem<RoundChoice> {
  const numDue = collections.reduce((sum, collection) => sum + collection.numReadyForReview, 0);
  return { detail: `${numDue} due`, label: "Review", value: reviewRoundChoice(pairing) };
}

function collectionItem(collection: Collection): SelectItem<RoundChoice> {
  const numNew = Math.max(0, collection.numSentences - collection.numPlaying);
  return { detail: `${numNew} new · ${collection.numReadyForReview} due`, label: collection.name, value: collectionRoundChoice(collection) };
}

const ORDINAL_SUFFIXES: Record<string, string> = { few: "rd", one: "st", other: "th", two: "nd" };

function ordinal(rank: number): string {
  return `${rank}${ORDINAL_SUFFIXES[new Intl.PluralRules("en", { type: "ordinal" }).select(rank)]}`;
}
