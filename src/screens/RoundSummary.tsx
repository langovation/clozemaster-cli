import React, { useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { LanguagePairingProgress, Sentence } from "../api.js";
import { playSoundEffect } from "../audio.js";
import { ClozeSentence } from "../components/ClozeSentence.js";
import { Hints } from "../components/Hints.js";
import { PixelArt } from "../components/PixelArt.js";
import type { AnsweredSentence } from "../components/SentenceCard.js";
import { useSettings } from "../SettingsContext.js";
import { TROPHY } from "../sprites.js";
import { colors } from "../theme.js";

export type RoundResult = AnsweredSentence & { sentence: Sentence; usedHint: boolean };

type RoundSummaryProps = {
  elapsedSeconds: number;
  onMenu: () => void;
  onPlayAgain: () => void;
  progress?: LanguagePairingProgress;
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
  return results.filter(({ sentence }) => {
    if (seen.has(sentence.id)) return false;
    seen.add(sentence.id);
    return true;
  });
}

function PlayedSentence({ result }: { result: RoundResult }) {
  const resultColor = result.isCorrect ? colors.brand : colors.danger;
  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end">
        <Text color={resultColor}>{result.isCorrect ? "✓ " : "✗ "}</Text>
        <ClozeSentence color={resultColor} text={result.sentence.text} />
      </Text>
      <Text dimColor wrap="truncate-end">  {result.sentence.translation}</Text>
    </Box>
  );
}

function RoundStats({ elapsedSeconds, results }: { elapsedSeconds: number; results: RoundResult[] }) {
  const numCorrect = results.filter((result) => result.isCorrect).length;
  const accuracy = results.length ? Math.round((numCorrect / results.length) * 100) : 0;
  return (
    <Box borderStyle="round" borderColor={colors.subtle}>
      <Stat color={colors.brand} label="Correct" value={String(numCorrect)} />
      <Stat color={colors.danger} label="Incorrect" value={String(results.length - numCorrect)} />
      <Stat label="Accuracy" value={`${accuracy}%`} />
      <Stat label="Time" value={formatTime(elapsedSeconds)} />
    </Box>
  );
}

function DailyGoal({ progress }: { progress: LanguagePairingProgress }) {
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
  const { settings } = useSettings();

  useEffect(() => {
    if (settings.soundEffects) playSoundEffect("success");
  }, []);

  useInput((_input, key) => {
    if (key.return) onPlayAgain();
    if (key.escape) onMenu();
  });

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
      <RoundStats elapsedSeconds={elapsedSeconds} results={results} />
      {progress && <DailyGoal progress={progress} />}
      <Box flexDirection="column">
        {firstAttempts(results).map((result) => (
          <PlayedSentence key={result.sentence.id} result={result} />
        ))}
      </Box>
      <Hints hints={["enter: next round", "esc back"]} />
    </Box>
  );
}
