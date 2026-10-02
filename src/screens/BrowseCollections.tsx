import React from "react";
import { Box, Text, useInput } from "ink";
import { getCollections, type Collection, type LanguagePairing } from "../api.js";
import { otherCollections } from "../collectionSort.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { Select } from "../components/Select.js";
import { Spinner } from "../components/Spinner.js";
import { useRequest } from "../useRequest.js";
import { collectionRoundChoice, type RoundChoice } from "./PickRound.js";

type BrowseCollectionsProps = { onBack: () => void; onPick: (choice: RoundChoice) => void; pairing: LanguagePairing };

function collectionDetail(collection: Collection): string {
  const sentences = `${collection.numSentences.toLocaleString()} sentences`;
  return collection.proOnly ? `Pro · ${sentences}` : sentences;
}

export function BrowseCollections({ onBack, onPick, pairing }: BrowseCollectionsProps) {
  const { data: collections, error, isLoading } = useRequest(() => getCollections(pairing), [pairing.id]);

  useInput((_input, key) => {
    if (key.escape) onBack();
  });

  if (isLoading) return <Spinner label="Loading collections…" />;
  if (error || !collections) return <ErrorMessage error={error || new Error("No collections")} />;

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>All {pairing.targetLanguageName} collections</Text>
        <Text dimColor>Playing one adds it to your dashboard.</Text>
      </Box>
      <Select
        items={otherCollections(collections).map((collection) => ({
          detail: collectionDetail(collection),
          label: collection.name,
          value: collectionRoundChoice(collection),
        }))}
        onSelect={onPick}
      />
      <Hints hints={["enter to pick", "esc to go back"]} />
    </Box>
  );
}
