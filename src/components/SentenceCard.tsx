import React from "react";
import { Box, Text } from "ink";
import type { Sentence } from "../api.js";
import { levelAfterAnswer, MASTERED_LEVEL } from "../answers.js";
import { splitCloze } from "../cloze.js";
import { useSettings } from "../SettingsContext.js";
import { colors } from "../theme.js";

export type AnsweredSentence = { answer: string; isCorrect: boolean; points: number };

type SentenceCardProps = { answered?: AnsweredSentence; hintedLetters?: string; isRevealed?: boolean; sentence: Sentence };

const MIN_BLANK_LENGTH = 3;

function Blank({ answered, cloze, hintedLetters = "", isRevealed }: { answered?: AnsweredSentence; cloze: string; hintedLetters?: string; isRevealed?: boolean }) {
  if (answered) return <Text bold color={answered.isCorrect ? colors.brand : colors.danger}>{answered.answer || cloze}</Text>;
  if (isRevealed) return <Text bold>{cloze}</Text>;
  return <Text color={colors.brand}>{hintedLetters}{"_".repeat(blankLength(cloze, hintedLetters))}</Text>;
}

function blankLength(cloze: string, hintedLetters: string): number {
  return Math.max(Math.max(cloze.length, MIN_BLANK_LENGTH) - hintedLetters.length, 0);
}

function MasteryChecks({ level }: { level: number }) {
  return (
    <Text>
      {Array.from({ length: MASTERED_LEVEL }, (_, index) => (
        <Text key={index} color={index < level ? colors.brand : colors.subtle}>✔ </Text>
      ))}
      <Text dimColor>{level * 25}% mastered</Text>
    </Text>
  );
}

function masteryLevel(sentence: Sentence, answered?: AnsweredSentence): number {
  return answered ? levelAfterAnswer({ correct: answered.isCorrect, sentence }) : sentence.level || 0;
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
        {(answered || settings.masteryBeforeAnswering) && <MasteryChecks level={masteryLevel(sentence, answered)} />}
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
