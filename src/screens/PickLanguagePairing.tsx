import React from "react";
import { Box, Text, useInput } from "ink";
import { getLanguagePairings, type LanguagePairing } from "../api.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { openFeedbackEmail } from "../feedback.js";
import { Select } from "../components/Select.js";
import { Spinner } from "../components/Spinner.js";
import { Welcome } from "../components/Welcome.js";
import { useRequest } from "../useRequest.js";

type PickLanguagePairingProps = { onOpenSettings: () => void; onPick: (pairing: LanguagePairing) => void; username?: string };

export function PickLanguagePairing({ onOpenSettings, onPick, username }: PickLanguagePairingProps) {
  const { data: pairings, error, isLoading } = useRequest(getLanguagePairings);

  useInput((input) => {
    if (input === "s") onOpenSettings();
    if (input === "f") openFeedbackEmail();
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Welcome subtitle={username ? `Welcome back, ${username}!` : "Welcome back!"} />
      {isLoading && <Spinner label="Loading your languages…" />}
      {error && <ErrorMessage error={error} />}
      {pairings?.length === 0 && <Text>Add a language on clozemaster.com first, then come back.</Text>}
      {pairings && pairings.length > 0 && (
        <Box flexDirection="column">
          <Text bold>What are you learning today?</Text>
          <Select
            items={pairings.map((pairing) => ({
              detail: `level ${pairing.level}`,
              label: `${pairing.targetLanguageName} from ${pairing.baseLanguageName}`,
              value: pairing,
            }))}
            onSelect={onPick}
          />
        </Box>
      )}
      <Hints hints={["enter to pick", "s settings", "f feedback", "ctrl+c to quit"]} />
    </Box>
  );
}
