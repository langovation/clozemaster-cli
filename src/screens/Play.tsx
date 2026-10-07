import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { getRound, isTypedMode, markSentenceKnown, saveAnswer, type AnswerResult, type PlayMode, type Sentence } from "../api.js";
import { playSentenceAudio, playSoundEffect, preloadSentenceAudio, stopAudio } from "../audio.js";
import { isCorrectAnswer, multipleChoiceOptions, pointsFor, splitCloze } from "../answers.js";
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
import { EditSentence } from "./EditSentence.js";
import { RoundSummary, type RoundResult } from "./RoundSummary.js";
import { SettingsScreen } from "./SettingsScreen.js";

const ANSWER_HINTS: Record<PlayMode, string> = {
  flashcard: "space to reveal",
  listening: "↑ accent",
  multiple_choice: "1-4 to answer",
  text_input: "↑ accent",
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
    // Listening is its own skill with its own due sentences, so switching to or from it fetches a new round.
    [roundNumber, mode === "listening"],
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
        <Hints hints={["esc back"]} />
      </Box>
    );
  }

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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function tomorrow(): string {
  return new Date(Date.now() + ONE_DAY_MS).toISOString();
}

type PendingAnswer = RoundResult & { index: number; mode: PlayMode; secondsSpent: number };

type PlayRoundProps = Omit<PlayProps, "choice"> & {
  choice: RoundChoice;
  isTextEditable: boolean;
  onPlayAgain: () => void;
  sentences: Sentence[];
  wordBank: string[];
};

function ListeningCard() {
  return (
    <Box borderStyle="round" borderColor={colors.subtle} paddingX={1}>
      <Text color={colors.gold}>♪ Listen…</Text>
    </Box>
  );
}

function PlayRound({ choice, isTextEditable, mode, onMenu, onPlayAgain, onProgress, onToggleMode, sentences, wordBank }: PlayRoundProps) {
  const [deck, setDeck] = useState(sentences);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<AnsweredSentence>();
  const [results, setResults] = useState<RoundResult[]>([]);
  const [progress, setProgress] = useState<AnswerResult["languagePairing"]>();
  const [startedAt] = useState(Date.now());
  const { settings } = useSettings();
  const [saveError, setSaveError] = useState<Error>();
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasUsedHint, setHasUsedHint] = useState(false);
  const [isListening, setIsListening] = useState(mode === "listening");
  const shownAt = useRef(Date.now());
  const pendingGrade = useRef<PendingAnswer | undefined>(undefined);

  const sentence = deck[index];
  const options = useMemo(() => sentence && multipleChoiceOptions(sentence, wordBank), [sentence]);

  useEffect(() => {
    if (!sentence) savePendingGrade();
  }, [sentence]);

  const [isExplaining, setIsExplaining] = useState(false);
  const [isShowingSettings, setIsShowingSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isDone = Boolean(answered || (mode === "flashcard" && isRevealed));
  const isExplainable = Boolean(sentence && isDone && canExplain(sentence));
  const canPlayAudio = Boolean(sentence && isDone && (mode === "listening" || settings.audio));
  const canOpenSettings = !isTypedMode(mode) || Boolean(answered);
  const upsertUrl = sentence?.collectionClozeSentencesUpsertUrl || choice.upsertUrl;
  const canGoBack = mode === "flashcard" && Boolean(pendingGrade.current);

  // So the audio plays straight away once the card flips.
  useEffect(() => {
    if (mode !== "listening" && !settings.audio) return;
    [deck[index], deck[index + 1]].forEach((upcoming) => upcoming && preloadSentenceAudio(upcoming));
  }, [sentence]);

  // Like the web's listening skill: the sentence stays hidden until its audio has played once.
  useEffect(() => {
    if (isListening) listenToSentence();
  }, [sentence]);

  useEffect(() => {
    if (answered) playAfterAnswering(answered);
  }, [answered]);

  useEffect(() => {
    if (isRevealed && settings.audio) playSentenceAudio(sentence);
  }, [isRevealed, sentence]);

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
    if (input === "p" && isListening && !answered) listenToSentence();
    else if (input === "p" && canPlayAudio) playSentenceAudio(sentence);
    // Not once a flashcard is revealed, or the next mode would show the answer it asks for.
    if (key.tab && !answered && !isRevealed) onToggleMode();
    if (key.return && answered) goToNextSentence();
    if (mode === "flashcard" && (input === "b" || key.backspace || key.delete)) goBackToPreviousCard();
    if (mode === "flashcard" && key.rightArrow && !isRevealed) setHasUsedHint(true);
    if (input === "s" && canOpenSettings) setIsShowingSettings(true);
    if (input === "c" && canOpenSettings && upsertUrl) setIsEditing(true);
  }, { isActive: !isShowingSettings && !isEditing });

  // Like the mobile app: the chime for a right answer, then the sentence.
  async function playAfterAnswering({ isCorrect }: AnsweredSentence) {
    const isChimeDone = isCorrect && settings.soundEffects ? await playSoundEffect("correct") : true;
    if (isChimeDone && mode !== "listening" && settings.audio) playSentenceAudio(sentence);
  }

  // Only reveals when this sentence's audio finished, not when moving on or a replay cut it short.
  async function listenToSentence() {
    if (await playSentenceAudio(sentence)) {
      setIsListening(false);
      shownAt.current = Date.now();
    }
  }

  // Flashcards are self-graded, so there's nothing to show: straight on to the next card.
  // The grade is held back until the next one so "back" can take it back without a server undo.
  function gradeFlashcard(isCorrect: boolean) {
    savePendingGrade();
    pendingGrade.current = { ...record({ answer: "", isCorrect, usedHint: hasUsedHint }), index, mode, sentence };
    goToNextSentence();
    if (isCorrect && settings.soundEffects) playSoundEffect("correct");
  }

  async function markKnown() {
    savePendingGrade();
    setResults((previous) => [...previous, { answer: "", isCorrect: true, points: 0, sentence, usedHint: false }]);
    goToNextSentence();
    try {
      if (!upsertUrl) throw new Error("this round doesn't say which collection the sentence is in.");
      await markSentenceKnown({ sentence, upsertUrl });
    } catch (error) {
      setSaveError(error as Error);
    }
  }

  function goBackToPreviousCard() {
    const previous = pendingGrade.current;
    if (!previous) return;
    pendingGrade.current = undefined;
    setResults((current) => current.slice(0, -1));
    if (!previous.isCorrect) setDeck((current) => current.slice(0, -1));
    setAnswered(undefined);
    setIsRevealed(true);
    setHasUsedHint(previous.usedHint);
    setIndex(previous.index);
    shownAt.current = Date.now() - previous.secondsSpent * 1000;
  }

  function savePendingGrade() {
    if (pendingGrade.current) submit(pendingGrade.current);
    pendingGrade.current = undefined;
  }

  function answer(attempt: string) {
    const isCorrect = isCorrectAnswer(attempt, sentence, { strictAccents: settings.strictAccents });
    const result = record({ answer: attempt.trim(), isCorrect, usedHint: hasUsedHint });
    setAnswered(result);
    submit({ ...result, mode, sentence });
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
    // Same as the web: a miss resets the sentence and sends it to the back of the round, now due tomorrow so its retry scores like the server's.
    if (!isCorrect) setDeck((current) => [...current, { ...sentence, level: 0, nextReview: tomorrow() }]);
    return result;
  }

  async function submit({ isCorrect, mode, secondsSpent, sentence, usedHint }: Pick<PendingAnswer, "isCorrect" | "mode" | "secondsSpent" | "sentence" | "usedHint">) {
    try {
      const answerUrl = sentence.collectionClozeSentencesAnswerUrl || choice.answerUrl;
      if (!answerUrl) throw new Error("this round doesn't say which collection the sentence is in.");
      const saved = await saveAnswer({
        answerUrl,
        correct: isCorrect,
        mode,
        secondsSpent,
        sentence,
        usedHint,
      });
      setProgress(saved.languagePairing);
      onProgress(saved.languagePairing);
      setSaveError(undefined);
    } catch (error) {
      setSaveError(error as Error);
    }
  }

  // A missed sentence is in the deck twice, so both copies take the edit.
  function showEditedSentence(edited: Sentence) {
    setDeck((current) => current.map((card) => (card.id === edited.id ? { ...card, text: edited.text, translation: edited.translation } : card)));
    setIsEditing(false);
  }

  // Leaves the copies already played so the cards before this one stay where they are.
  function removeDeletedSentence(deleted: Sentence) {
    setDeck((current) => current.filter((card, position) => position < index || card.id !== deleted.id));
    setIsEditing(false);
  }

  function goToNextSentence() {
    stopAudio();
    setAnswered(undefined);
    setIsRevealed(false);
    setHasUsedHint(false);
    setIsListening(mode === "listening");
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
  if (isEditing && upsertUrl) {
    return <EditSentence isTextEditable={isTextEditable} onBack={() => setIsEditing(false)} onDeleted={removeDeletedSentence} onSaved={showEditedSentence} sentence={sentence} upsertUrl={upsertUrl} />;
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box justifyContent="space-between">
        <Text bold>{choice.title}</Text>
        <RoundProgress results={results.map((result) => result.isCorrect)} total={deck.length} />
      </Box>
      {isListening && !answered ? <ListeningCard /> : <SentenceCard answered={answered} hintedLetters={mode === "flashcard" && hasUsedHint ? splitCloze(sentence.text).cloze[0] : undefined} isRevealed={isRevealed} sentence={sentence} />}
      {isExplaining && <ExplanationPanel sentence={sentence} />}
      {!answered && mode === "multiple_choice" && <MultipleChoiceAnswer onAnswer={answer} options={options} />}
      {!answered && !isListening && isTypedMode(mode) && <TextAnswer key={index} hasUsedHint={hasUsedHint} onAnswer={answer} onHint={() => setHasUsedHint(true)} sentence={sentence} />}
      {!answered && mode === "flashcard" && (
        <FlashcardAnswer isRevealed={isRevealed} onGrade={gradeFlashcard} onKnown={markKnown} onReveal={() => setIsRevealed(true)} />
      )}
      {saveError && <Text color={colors.danger}>Couldn't save an answer: {saveError.message}</Text>}
      <Hints
        hints={
          isListening && !answered
            ? ["p replay", "esc back"]
            : answered
            ? ["enter to continue", ...(canPlayAudio ? ["p replay"] : []), ...(isExplainable ? [isExplaining ? "e hide explanation" : "e explain"] : []), "s settings", ...(upsertUrl ? ["c edit card"] : []), "esc back"]
            : [
                ...((isTypedMode(mode) || (mode === "flashcard" && !isRevealed)) && !hasUsedHint ? ["→ hint"] : []),
                ...(isRevealed ? [] : [ANSWER_HINTS[mode]]),
                ...(isRevealed && canPlayAudio ? ["p replay"] : []),
                ...(isExplainable ? ["e explain"] : []),
                ...(canGoBack ? ["b previous card"] : []),
                ...(isRevealed ? [] : [`tab: ${MODE_LABELS[nextMode(mode)].toLowerCase()}`]),
                ...(canOpenSettings ? ["s settings"] : []),
                ...(canOpenSettings && upsertUrl ? ["c edit card"] : []),
                "esc back",
              ]
        }
      />
    </Box>
  );
}
