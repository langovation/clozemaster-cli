import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { getRound, saveAnswer, type AnswerResult, type PlayMode, type Sentence } from "../api.js";
import { playSentenceAudio, stopAudio } from "../audio.js";
import { isCorrectAnswer, multipleChoiceOptions, pointsFor } from "../answers.js";
import { canExplain, ExplanationPanel } from "../components/ExplanationPanel.js";
import { FlashcardAnswer } from "../components/FlashcardAnswer.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Hints } from "../components/Hints.js";
import { MultipleChoiceAnswer } from "../components/MultipleChoiceAnswer.js";
import { RoundProgress } from "../components/RoundProgress.js";
import { SentenceCard, type AnsweredSentence } from "../components/SentenceCard.js";
import { Spinner } from "../components/Spinner.js";
import { TextAnswer } from "../components/TextAnswer.js";
import { useSettings } from "../SettingsContext.js";
import { colors } from "../theme.js";
import { useRequest } from "../useRequest.js";
import { MODE_LABELS, nextMode } from "./PickMode.js";
import type { RoundChoice } from "./PickRound.js";
import { RoundSummary, type RoundResult } from "./RoundSummary.js";
import { SettingsScreen } from "./SettingsScreen.js";

const ANSWER_HINTS: Record<PlayMode, string> = {
  flashcard: "space to reveal",
  multiple_choice: "1-4 to answer",
  text_input: "→ hint · ↑ accent",
};

type PlayProps = {
  choice: RoundChoice;
  mode: PlayMode;
  onMenu: () => void;
  onProgress: (progress: AnswerResult["languagePairing"]) => void;
  onToggleMode: () => void;
};

export function Play({ choice, mode, onMenu, onProgress, onToggleMode }: PlayProps) {
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
        <Hints hints={["esc to go back"]} />
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
      onProgress={onProgress}
      onToggleMode={onToggleMode}
      sentences={round.collectionClozeSentences}
      wordBank={round.wordBank}
    />
  );
}

type PendingAnswer = RoundResult & { index: number; secondsSpent: number };

type PlayRoundProps = Omit<PlayProps, "choice"> & {
  choice: RoundChoice;
  onPlayAgain: () => void;
  sentences: Sentence[];
  wordBank: string[];
};

function PlayRound({ choice, mode, onMenu, onPlayAgain, onProgress, onToggleMode, sentences, wordBank }: PlayRoundProps) {
  const [deck, setDeck] = useState(sentences);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<AnsweredSentence>();
  const [results, setResults] = useState<RoundResult[]>([]);
  const [progress, setProgress] = useState<AnswerResult["languagePairing"]>();
  const [startedAt] = useState(Date.now());
  const { settings } = useSettings();
  const [saveError, setSaveError] = useState<Error>();
  const [isRevealed, setIsRevealed] = useState(false);
  const shownAt = useRef(Date.now());
  const pendingGrade = useRef<PendingAnswer | undefined>(undefined);

  const sentence = deck[index];
  const options = useMemo(() => sentence && multipleChoiceOptions(sentence, wordBank), [sentence]);

  useEffect(() => {
    if (!sentence) savePendingGrade();
  }, [sentence]);

  const [isExplaining, setIsExplaining] = useState(false);
  const [isShowingSettings, setIsShowingSettings] = useState(false);
  const isDone = Boolean(answered || (mode === "flashcard" && isRevealed));
  const isExplainable = Boolean(sentence && isDone && canExplain(sentence));
  const canPlayAudio = Boolean(sentence && isDone && settings.audio);
  const canOpenSettings = mode !== "text_input" || Boolean(answered);

  useEffect(() => {
    if (canPlayAudio) playSentenceAudio(sentence);
  }, [canPlayAudio, sentence]);

  useEffect(() => stopAudio, []);

  useInput((input, key) => {
    if (key.escape && isExplaining) {
      setIsExplaining(false);
      return;
    }
    if (key.escape) {
      savePendingGrade();
      onMenu();
    }
    if (input === "e" && isExplainable) setIsExplaining((current) => !current);
    if (input === "p" && canPlayAudio) playSentenceAudio(sentence);
    if (key.tab && !answered) onToggleMode();
    if (key.return && answered) goToNextSentence();
    if (mode === "flashcard" && (input === "b" || key.backspace || key.delete)) goBackToPreviousCard();
    if (input === "s" && canOpenSettings) setIsShowingSettings(true);
  }, { isActive: !isShowingSettings });

  // Flashcards are self-graded, so there's nothing to show: straight on to the next card.
  // The grade is held back until the next one so "back" can take it back without a server undo.
  function gradeFlashcard(isCorrect: boolean) {
    savePendingGrade();
    pendingGrade.current = { ...record({ answer: "", isCorrect }), index, sentence };
    goToNextSentence();
  }

  function goBackToPreviousCard() {
    const previous = pendingGrade.current;
    if (!previous) return;
    pendingGrade.current = undefined;
    setResults((current) => current.slice(0, -1));
    if (!previous.isCorrect) setDeck((current) => current.slice(0, -1));
    setAnswered(undefined);
    setIsRevealed(true);
    setIndex(previous.index);
    shownAt.current = Date.now() - previous.secondsSpent * 1000;
  }

  function savePendingGrade() {
    if (pendingGrade.current) submit(pendingGrade.current);
    pendingGrade.current = undefined;
  }

  function answer(attempt: string, usedHint = false) {
    const isCorrect = isCorrectAnswer(attempt, sentence, { strictAccents: settings.strictAccents });
    const result = record({ answer: attempt.trim(), isCorrect, usedHint });
    setAnswered(result);
    submit({ ...result, sentence });
  }

  function record({ answer: attempt, isCorrect, usedHint = false }: { answer: string; isCorrect: boolean; usedHint?: boolean }) {
    const result = {
      answer: attempt,
      isCorrect,
      points: pointsFor({ correct: isCorrect, mode, sentence, usedHint }),
      usedHint,
      sentence,
      secondsSpent: Math.round((Date.now() - shownAt.current) / 1000),
    };
    setResults((previous) => [...previous, result]);
    // Same as the web: a miss resets the sentence and sends it to the back of the round.
    if (!isCorrect) setDeck((current) => [...current, { ...sentence, level: 0 }]);
    return result;
  }

  async function submit({ isCorrect, secondsSpent, sentence, usedHint }: Pick<PendingAnswer, "isCorrect" | "secondsSpent" | "sentence" | "usedHint">) {
    try {
      const saved = await saveAnswer({
        answerUrl: sentence.collectionClozeSentencesAnswerUrl || choice.answerUrl!,
        correct: isCorrect,
        mode,
        secondsSpent,
        sentence,
        usedHint,
      });
      setProgress(saved.languagePairing);
      onProgress(saved.languagePairing);
    } catch (error) {
      setSaveError(error as Error);
    }
  }

  function goToNextSentence() {
    stopAudio();
    setAnswered(undefined);
    setIsRevealed(false);
    setIsExplaining(false);
    setIndex((current) => current + 1);
    shownAt.current = Date.now();
  }

  if (!sentence) {
    return (
      <RoundSummary
        elapsedSeconds={Math.round((Date.now() - startedAt) / 1000)}
        onMenu={onMenu}
        onPlayAgain={onPlayAgain}
        progress={progress}
        results={results}
      />
    );
  }

  if (isShowingSettings) return <SettingsScreen onBack={() => setIsShowingSettings(false)} />;

  return (
    <Box flexDirection="column" gap={1}>
      <Box justifyContent="space-between">
        <Text bold>{choice.title}</Text>
        <RoundProgress results={results.map((result) => result.isCorrect)} total={deck.length} />
      </Box>
      <SentenceCard answered={answered} isRevealed={isRevealed} sentence={sentence} />
      {isExplaining && <ExplanationPanel sentence={sentence} />}
      {!answered && mode === "multiple_choice" && <MultipleChoiceAnswer onAnswer={answer} options={options} />}
      {!answered && mode === "text_input" && <TextAnswer key={index} onAnswer={answer} sentence={sentence} />}
      {!answered && mode === "flashcard" && (
        <FlashcardAnswer isRevealed={isRevealed} onGrade={gradeFlashcard} onReveal={() => setIsRevealed(true)} />
      )}
      {saveError && <Text color={colors.danger}>Couldn't save an answer: {saveError.message}</Text>}
      <Hints
        hints={
          answered
            ? ["enter to continue", ...(canPlayAudio ? ["p replay"] : []), ...(isExplainable ? [isExplaining ? "e hide explanation" : "e explain"] : []), "s settings", "esc to go back"]
            : [
                ANSWER_HINTS[mode],
                ...(isExplainable ? ["e explain"] : []),
                ...(mode === "flashcard" && results.length > 0 ? ["b back"] : []),
                `tab: ${MODE_LABELS[nextMode(mode)].toLowerCase()}`,
                ...(canOpenSettings ? ["s settings"] : []),
                "esc to go back",
              ]
        }
      />
    </Box>
  );
}
