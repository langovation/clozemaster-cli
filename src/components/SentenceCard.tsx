import React from "react";
import { Box, Text } from "ink";
import type { Sentence } from "../api.js";
import { splitCloze } from "../answers.js";
import { useSettings } from "../SettingsContext.js";
import { colors } from "../theme.js";

export type AnsweredSentence = { answer: string; isCorrect: boolean; points: number };

type SentenceCardProps = { answered?: AnsweredSentence; hintedLetters?: string; isRevealed?: boolean; sentence: Sentence };

function Blank({ answered, cloze, hintedLetters = "", isRevealed }: { answered?: AnsweredSentence; cloze: string; hintedLetters?: string; isRevealed?: boolean }) {
  if (answered) return <Text bold color={answered.isCorrect ? colors.brand : colors.danger}>{answered.answer || cloze}</Text>;
  if (isRevealed) return <Text bold>{cloze}</Text>;
  return <Text color={colors.brand}>{hintedLetters}{"_".repeat(Math.max(cloze.length - hintedLetters.length, 3 - hintedLetters.length, 0))}</Text>;
}

export function SentenceCard({ answered, hintedLetters, isRevealed, sentence }: SentenceCardProps) {
  const { settings } = useSettings();
  const { after, before, cloze } = splitCloze(sentence.text);
  const isDone = Boolean(answered || isRevealed);
  const showsCorrection = answered && !answered.isCorrect && answered.answer !== "";
  const showsTranslation = settings.translation === "visible" || (settings.translation === "after" && isDone);
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor={colors.subtle} flexDirection="column" paddingX={1}>
        {settings.hints && !isDone && sentence.hint && <Text color={colors.gold}>hint: {sentence.hint}</Text>}
        <Text>
          {before}
          <Blank answered={answered} cloze={cloze} hintedLetters={hintedLetters} isRevealed={isRevealed} />
          {after}
        </Text>
        {settings.pronunciation && isDone && sentence.pronunciation && <Text italic>{sentence.pronunciation}</Text>}
        {showsTranslation && <Text dimColor>{sentence.translation}</Text>}
      </Box>
      {showsCorrection && (
        <Box paddingLeft={2}>
          <Text bold color={colors.brand}>{cloze}</Text>
        </Box>
      )}
    </Box>
  );
}
