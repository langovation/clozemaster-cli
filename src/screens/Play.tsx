import React, { useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { getRound, saveAnswer, type PlayMode, type Sentence } from "../api.js";
import { isCorrectAnswer, multipleChoiceOptions, pointsFor, splitCloze } from "../answers.js";
import { AnswerFeedback, type AnsweredSentence } from "../components/AnswerFeedback.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { MultipleChoiceAnswer } from "../components/MultipleChoiceAnswer.js";
import { RoundProgress } from "../components/RoundProgress.js";
import { SentenceCard } from "../components/SentenceCard.js";
import { Spinner } from "../components/Spinner.js";
import { TextAnswer } from "../components/TextAnswer.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";
import { MODE_LABELS } from "./PickMode.js";
import type { RoundChoice } from "./PickRound.js";
import { RoundSummary } from "./RoundSummary.js";

type PlayProps = { choice: RoundChoice; mode: PlayMode; onMenu: () => void; onToggleMode: () => void };

export function Play({ choice, mode, onMenu, onToggleMode }: PlayProps) {
  const [roundNumber, setRoundNumber] = useState(0);
  const { data: round, error, isLoading } = useRequest(
    () => getRound({ mode, playDataUrl: choice.playDataUrl, scope: choice.scope }),
    [roundNumber],
  );

  useInput((_input, key) => {
    if (key.escape && (isLoading || error || round?.collectionClozeSentences.length === 0)) onMenu();
  });

  if (isLoading) return <Spinner label={`Loading ${choice.title}…`} />;
  if (error) return <ErrorMessage error={error} />;
  if (!round || round.collectionClozeSentences.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text>Nothing to play in {choice.title} right now.</Text>
        <Hints hints={["esc for menu"]} />
      </Box>
    );
  }

  return (
    <PlayRound
      key={roundNumber}
      choice={choice}
      mode={mode}
      onMenu={onMenu}
      onPlayAgain={() => setRoundNumber((number) => number + 1)}
      onToggleMode={onToggleMode}
      sentences={round.collectionClozeSentences}
      wordBank={round.wordBank}
    />
  );
}

type PlayRoundProps = Omit<PlayProps, "choice"> & {
  choice: RoundChoice;
  onPlayAgain: () => void;
  sentences: Sentence[];
  wordBank: string[];
};

function PlayRound({ choice, mode, onMenu, onPlayAgain, onToggleMode, sentences, wordBank }: PlayRoundProps) {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<AnsweredSentence>();
  const [results, setResults] = useState<AnsweredSentence[]>([]);
  const [numPointsToday, setNumPointsToday] = useState<number>();
  const [saveError, setSaveError] = useState<Error>();
  const shownAt = useRef(Date.now());

  const sentence = sentences[index];
  const options = useMemo(() => sentence && multipleChoiceOptions(sentence, wordBank), [sentence]);

  useInput((_input, key) => {
    if (key.escape) onMenu();
    if (key.tab && !answered) onToggleMode();
    if (key.return && answered) goToNextSentence();
  });

  function answer(attempt: string) {
    const isCorrect = isCorrectAnswer(attempt, sentence);
    const result = {
      answer: attempt.trim(),
      correctAnswer: splitCloze(sentence.text).cloze,
      isCorrect,
      points: pointsFor({ correct: isCorrect, mode, sentence }),
    };
    setAnswered(result);
    setResults((previous) => [...previous, result]);
    submit(isCorrect);
  }

  async function submit(isCorrect: boolean) {
    try {
      const saved = await saveAnswer({
        answerUrl: sentence.collectionClozeSentencesAnswerUrl || choice.answerUrl!,
        correct: isCorrect,
        mode,
        secondsSpent: Math.round((Date.now() - shownAt.current) / 1000),
        sentence,
      });
      setNumPointsToday(saved.languagePairing?.numPointsToday);
    } catch (error) {
      setSaveError(error as Error);
    }
  }

  function goToNextSentence() {
    setAnswered(undefined);
    setIndex((current) => current + 1);
    shownAt.current = Date.now();
  }

  if (!sentence) {
    return (
      <RoundSummary
        numCorrect={results.filter((result) => result.isCorrect).length}
        numPointsToday={numPointsToday}
        onMenu={onMenu}
        onPlayAgain={onPlayAgain}
        points={results.reduce((sum, result) => sum + result.points, 0)}
        total={sentences.length}
      />
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box justifyContent="space-between">
        <Text bold>{choice.title}</Text>
        <RoundProgress results={results.map((result) => result.isCorrect)} total={sentences.length} />
      </Box>
      <SentenceCard isCorrect={answered?.isCorrect} sentence={sentence} />
      {answered && <AnswerFeedback answered={answered} />}
      {!answered && mode === "multiple_choice" && <MultipleChoiceAnswer onAnswer={answer} options={options} />}
      {!answered && mode === "text_input" && <TextAnswer onAnswer={answer} />}
      {saveError && <Text color={colors.danger}>Couldn't save an answer: {saveError.message}</Text>}
      <Hints
        hints={
          answered
            ? ["enter to continue", "esc for menu"]
            : [
                mode === "multiple_choice" ? "1-4 to answer" : "enter to answer",
                `tab: ${MODE_LABELS[mode === "multiple_choice" ? "text_input" : "multiple_choice"].toLowerCase()}`,
                "esc menu",
              ]
        }
      />
    </Box>
  );
}
