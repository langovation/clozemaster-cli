import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { LanguagePairingProgress, PlayMode, Sentence } from "../api.js";
import { canPlayAtHalfSpeed, playSentenceAudio, playSentenceAudioAtHalfSpeed, playSoundEffect, stopAudio } from "../audio.js";
import { isCorrectAnswer, multipleChoiceOptions, pointsFor } from "../answers.js";
import { splitCloze } from "../cloze.js";
import { canExplain, ExplanationPanel } from "../components/ExplanationPanel.js";
import { FlashcardAnswer } from "../components/FlashcardAnswer.js";
import { Hints } from "../components/Hints.js";
import { ListeningCard } from "../components/ListeningCard.js";
import { MultipleChoiceAnswer } from "../components/MultipleChoiceAnswer.js";
import { RoundProgress } from "../components/RoundProgress.js";
import { SentenceCard, type AnsweredSentence } from "../components/SentenceCard.js";
import { TextAnswer } from "../components/TextAnswer.js";
import { playRoundHints } from "../play/hints.js";
import { useAnswerSaving } from "../play/useAnswerSaving.js";
import { useDeck } from "../play/useDeck.js";
import { useHeldFlashcardGrade } from "../play/useHeldFlashcardGrade.js";
import { useListening, type PlaySentence } from "../play/useListening.js";
import { useRoundAudio } from "../play/useRoundAudio.js";
import { isTypedMode } from "../playModes.js";
import { upsertUrlFor, type RoundChoice } from "../roundChoice.js";
import { useSettings } from "../SettingsContext.js";
import { colors } from "../theme.js";
import { EditSentence } from "./EditSentence.js";
import { RoundSummary, type RoundResult } from "./RoundSummary.js";
import { SettingsScreen } from "./SettingsScreen.js";

export type PlayRoundProps = {
  choice: RoundChoice;
  isTextEditable: boolean;
  mode: PlayMode;
  onMenu: () => void;
  onPlayAgain: () => void;
  onProgress: (progress: LanguagePairingProgress) => void;
  onToggleMode: () => void;
  sentences: Sentence[];
  wordBank: string[];
};

type Grade = { answer: string; isCorrect: boolean; usedHint: boolean };

export function PlayRound({ choice, isTextEditable, mode, onMenu, onPlayAgain, onProgress, onToggleMode, sentences, wordBank }: PlayRoundProps) {
  const { settings } = useSettings();
  const deck = useDeck(sentences);
  const { sentence } = deck;
  const [results, setResults] = useState<RoundResult[]>([]);
  const [startedAt] = useState(Date.now());
  const [answered, setAnswered] = useState<AnsweredSentence>();
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasUsedHint, setHasUsedHint] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isShowingSettings, setIsShowingSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const shownAt = useRef(Date.now());
  const { progress, saveAnswerOf, saveError, saveKnown } = useAnswerSaving({ choice, onProgress });
  const heldGrade = useHeldFlashcardGrade(saveAnswerOf);
  const options = useMemo(() => sentence && multipleChoiceOptions(sentence, wordBank), [sentence]);

  useEffect(() => {
    if (deck.isFinished) heldGrade.saveHeldGrade();
  }, [sentence]);

  useRoundAudio({ answered, isRevealed, mode, sentence, upcoming: deck.upcoming });
  const { isListening, listen, listenToNextSentence } = useListening({ mode, onHeard: markShown, sentence });

  const isDone = Boolean(answered || (mode === "flashcard" && isRevealed));
  const isExplainable = isDone && canExplain(sentence);
  const canPlayAudio = isDone && (mode === "listening" || settings.audio);
  const canOpenSettings = !isTypedMode(mode) || Boolean(answered);
  const upsertUrl = deck.isFinished ? undefined : upsertUrlFor(sentence, choice);
  const isHearingSentence = isListening && !answered;

  useInput((input, key) => {
    if (key.escape && isExplaining) {
      setIsExplaining(false);
      return;
    }
    if (key.escape) {
      heldGrade.saveHeldGrade();
      onMenu();
    }
    if (input === "e" && isExplainable) setIsExplaining((current) => !current);
    if (input === "p") replaySentence(playSentenceAudio);
    if (input === "h" && canPlayAtHalfSpeed) replaySentence(playSentenceAudioAtHalfSpeed);
    // Not once a flashcard is revealed, or the next mode would show the answer it asks for.
    if (key.tab && !answered && !isRevealed) onToggleMode();
    if (key.return && answered) goToNextSentence();
    if (mode === "flashcard" && (input === "b" || key.backspace || key.delete)) goBackToPreviousCard();
    if (mode === "flashcard" && key.rightArrow && !isRevealed) setHasUsedHint(true);
    if (input === "s" && canOpenSettings) setIsShowingSettings(true);
    if (input === "c" && canOpenSettings && upsertUrl) setIsEditing(true);
  }, { isActive: !isShowingSettings && !isEditing });

  function replaySentence(play: PlaySentence) {
    if (isHearingSentence) listen(play);
    else if (canPlayAudio) play(sentence);
  }

  function answer(attempt: string) {
    const result = recordGrade({ answer: attempt.trim(), isCorrect: isCorrectAnswer(attempt, sentence, { strictAccents: settings.strictAccents }), usedHint: hasUsedHint });
    setAnswered(result);
    saveAnswerOf({ ...result, mode });
  }

  function gradeFlashcard(isCorrect: boolean) {
    heldGrade.holdGrade({ ...recordGrade({ answer: "", isCorrect, usedHint: hasUsedHint }), index: deck.index, mode });
    goToNextSentence();
    if (isCorrect && settings.soundEffects) playSoundEffect("correct");
  }

  function markKnown() {
    heldGrade.saveHeldGrade();
    setResults((previous) => [...previous, { answer: "", isCorrect: true, points: 0, sentence, usedHint: false }]);
    goToNextSentence();
    saveKnown(sentence);
  }

  function recordGrade({ answer: attempt, isCorrect, usedHint }: Grade) {
    const result = {
      answer: attempt,
      isCorrect,
      points: pointsFor({ correct: isCorrect, mode, sentence, usedHint }),
      secondsSpent: Math.round((Date.now() - shownAt.current) / 1000),
      sentence,
      usedHint,
    };
    setResults((previous) => [...previous, result]);
    if (!isCorrect) deck.requeueMissed(sentence);
    return result;
  }

  function goBackToPreviousCard() {
    const previous = heldGrade.takeBackGrade();
    if (!previous) return;
    setResults((current) => current.slice(0, -1));
    if (!previous.isCorrect) deck.dropLastRequeued();
    setAnswered(undefined);
    setIsRevealed(true);
    setHasUsedHint(previous.usedHint);
    deck.moveTo(previous.index);
    shownAt.current = Date.now() - previous.secondsSpent * 1000;
  }

  function goToNextSentence() {
    stopAudio();
    setAnswered(undefined);
    setIsRevealed(false);
    setHasUsedHint(false);
    listenToNextSentence();
    setIsExplaining(false);
    deck.advance();
    markShown();
  }

  function markShown() {
    shownAt.current = Date.now();
  }

  function showEditedSentence(edited: Sentence) {
    deck.applyEdit(edited);
    setIsEditing(false);
  }

  function removeDeletedSentence(deleted: Sentence) {
    deck.removeUpcoming(deleted);
    setIsEditing(false);
  }

  if (deck.isFinished) {
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
  if (isEditing && upsertUrl) {
    return (
      <EditSentence
        isTextEditable={isTextEditable}
        onBack={() => setIsEditing(false)}
        onDeleted={removeDeletedSentence}
        onSaved={showEditedSentence}
        sentence={sentence}
        upsertUrl={upsertUrl}
      />
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box justifyContent="space-between">
        <Text bold>{choice.title}</Text>
        <RoundProgress results={results.map((result) => result.isCorrect)} total={deck.size} />
      </Box>
      {isHearingSentence ? (
        <ListeningCard />
      ) : (
        <SentenceCard answered={answered} hintedLetters={mode === "flashcard" && hasUsedHint ? firstLetter(sentence) : undefined} isRevealed={isRevealed} sentence={sentence} />
      )}
      {isExplaining && <ExplanationPanel sentence={sentence} />}
      {!answered && mode === "multiple_choice" && <MultipleChoiceAnswer onAnswer={answer} options={options} />}
      {!answered && !isListening && isTypedMode(mode) && (
        <TextAnswer key={deck.index} hasUsedHint={hasUsedHint} onAnswer={answer} onHint={() => setHasUsedHint(true)} sentence={sentence} />
      )}
      {!answered && mode === "flashcard" && (
        <FlashcardAnswer isRevealed={isRevealed} onGrade={gradeFlashcard} onKnown={markKnown} onReveal={() => setIsRevealed(true)} />
      )}
      {saveError && <Text color={colors.danger}>Couldn't save an answer: {saveError.message}</Text>}
      <Hints
        hints={playRoundHints({
          canEditCard: Boolean(upsertUrl),
          canGoBack: mode === "flashcard" && heldGrade.hasHeldGrade,
          canOpenSettings,
          canPlayAudio,
          hasUsedHint,
          isAnswered: Boolean(answered),
          isExplainable,
          isExplaining,
          isListening,
          isRevealed,
          mode,
        })}
      />
    </Box>
  );
}

function firstLetter(sentence: Sentence): string {
  return splitCloze(sentence.text).cloze[0];
}
