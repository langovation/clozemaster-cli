import React from "react";
import { Box, Text, useInput } from "ink";
import type { AnswerResult, Sentence } from "../api.js";
import { splitCloze } from "../answers.js";
import { Hints } from "../components/Hints.js";
import { PixelArt } from "../components/PixelArt.js";
import type { AnsweredSentence } from "../components/SentenceCard.js";
import { TROPHY } from "../sprites.js";
import { colors } from "../theme.js";

export type RoundResult = AnsweredSentence & { sentence: Sentence; usedHint: boolean };

type RoundSummaryProps = {
  elapsedSeconds: number;
  onMenu: () => void;
  onPlayAgain: () => void;
  progress?: AnswerResult["languagePairing"];
  results: RoundResult[];
};

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Stat({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <Box flexDirection="column" alignItems="center" flexGrow={1}>
      <Text bold color={color}>{value}</Text>
      <Text dimColor>{label}</Text>
    </Box>
  );
}

// A sentence counts by its first attempt, the same as the apps' results list.
function firstAttempts(results: RoundResult[]): RoundResult[] {
  const seen = new Set<number>();
  return results.filter(({ sentence }) => !seen.has(sentence.id) && seen.add(sentence.id));
}

function PlayedSentence({ result }: { result: RoundResult }) {
  const { after, before, cloze } = splitCloze(result.sentence.text);
  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end">
        <Text color={result.isCorrect ? colors.brand : colors.danger}>{result.isCorrect ? "✓ " : "✗ "}</Text>
        {before}
        <Text bold color={result.isCorrect ? colors.brand : colors.danger}>{cloze}</Text>
        {after}
      </Text>
      <Text dimColor wrap="truncate-end">  {result.sentence.translation}</Text>
    </Box>
  );
}

function DailyGoal({ progress }: { progress: AnswerResult["languagePairing"] }) {
  const goal = progress.dailyGoalPointsPerDay;
  const hasReachedGoal = Boolean(goal && progress.numPointsToday >= goal);
  return (
    <Text>
      <Text color={hasReachedGoal ? colors.brand : colors.gold} bold>{progress.numPointsToday}</Text>
      {goal ? <Text dimColor>/{goal}</Text> : null}
      <Text dimColor> points today{hasReachedGoal ? " · goal reached" : ""} · </Text>
      <Text color={colors.streak}>{progress.currentStreakDays} day streak</Text>
    </Text>
  );
}

export function RoundSummary({ elapsedSeconds, onMenu, onPlayAgain, progress, results }: RoundSummaryProps) {
  useInput((_input, key) => {
    if (key.return) onPlayAgain();
    if (key.escape) onMenu();
  });

  const numCorrect = results.filter((result) => result.isCorrect).length;
  const numIncorrect = results.length - numCorrect;
  const accuracy = results.length ? Math.round((numCorrect / results.length) * 100) : 0;
  const points = results.reduce((sum, result) => sum + result.points, 0);

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={3} alignItems="center">
        <PixelArt sprite={TROPHY} />
        <Box flexDirection="column">
          <Text bold color={colors.gold}>Round complete!</Text>
          <Text color={colors.gold}>+{points} points</Text>
        </Box>
      </Box>
      <Box borderStyle="round" borderColor={colors.subtle}>
        <Stat color={colors.brand} label="Correct" value={String(numCorrect)} />
        <Stat color={colors.danger} label="Incorrect" value={String(numIncorrect)} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="Time" value={formatTime(elapsedSeconds)} />
      </Box>
      {progress && <DailyGoal progress={progress} />}
      <Box flexDirection="column">
        {firstAttempts(results).map((result) => (
          <PlayedSentence key={result.sentence.id} result={result} />
        ))}
      </Box>
      <Hints hints={["enter: next round", "esc: menu"]} />
    </Box>
  );
}
