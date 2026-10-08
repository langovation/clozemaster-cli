import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { getRound, type LanguagePairingProgress, type PlayMode } from "../api.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { Spinner } from "../components/Spinner.js";
import type { RoundChoice } from "../roundChoice.js";
import { useRequest } from "../useRequest.js";
import { PlayRound } from "./PlayRound.js";

type PlayProps = {
  choice: RoundChoice;
  mode: PlayMode;
  onMenu: () => void;
  onProgress: (progress: LanguagePairingProgress) => void;
  onToggleMode: () => void;
};

export function Play({ choice, mode, onMenu, onProgress, onToggleMode }: PlayProps) {
  const [roundNumber, setRoundNumber] = useState(0);
  const { error, isLoading, result: round } = useRequest(
    () => getRound({ mode, playDataUrl: choice.playDataUrl, scope: choice.scope }),
    // Listening has its own due sentences, so only switching to or from it needs a new round.
    [roundNumber, mode === "listening"],
  );
  const isEmpty = round?.collectionClozeSentences.length === 0;

  useInput((_input, key) => {
    if (key.escape && (isLoading || error || isEmpty)) onMenu();
  });

  if (isLoading) return <Spinner label={`Loading ${choice.title}…`} />;
  if (error) return <ErrorMessage error={error} />;
  if (!round || isEmpty) return <NothingToPlay title={choice.title} />;

  return (
    <PlayRound
      key={roundNumber}
      choice={choice}
      isTextEditable={Boolean(round.collection?.isEditable)}
      mode={mode}
      onMenu={onMenu}
      onPlayAgain={() => setRoundNumber((number) => number + 1)}
      onProgress={onProgress}
      onToggleMode={onToggleMode}
      sentences={round.collectionClozeSentences}
      wordBank={round.wordBank}
    />
  );
}

function NothingToPlay({ title }: { title: string }) {
  return (
    <Box flexDirection="column" gap={1}>
      <Text>Nothing to play in {title} right now.</Text>
      <Hints hints={["esc back"]} />
    </Box>
  );
}
