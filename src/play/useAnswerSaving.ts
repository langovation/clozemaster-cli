import { useState } from "react";
import { markSentenceKnown, saveAnswer, type LanguagePairingProgress, type PlayMode, type Sentence } from "../api.js";
import { answerUrlFor, upsertUrlFor, type RoundChoice } from "../roundChoice.js";

export type SubmittedAnswer = { isCorrect: boolean; mode: PlayMode; secondsSpent: number; sentence: Sentence; usedHint: boolean };

type AnswerSavingOptions = { choice: RoundChoice; onProgress: (progress: LanguagePairingProgress) => void };

const UNKNOWN_COLLECTION = "this round doesn't say which collection the sentence is in.";

export function useAnswerSaving({ choice, onProgress }: AnswerSavingOptions) {
  const [progress, setProgress] = useState<LanguagePairingProgress>();
  const [saveError, setSaveError] = useState<Error>();

  async function saveAnswerOf({ isCorrect, mode, secondsSpent, sentence, usedHint }: SubmittedAnswer) {
    try {
      const answerUrl = answerUrlFor(sentence, choice);
      if (!answerUrl) throw new Error(UNKNOWN_COLLECTION);
      const saved = await saveAnswer({ answerUrl, correct: isCorrect, mode, secondsSpent, sentence, usedHint });
      setProgress(saved.languagePairing);
      onProgress(saved.languagePairing);
      setSaveError(undefined);
    } catch (error) {
      setSaveError(error as Error);
    }
  }

  async function saveKnown(sentence: Sentence) {
    try {
      const upsertUrl = upsertUrlFor(sentence, choice);
      if (!upsertUrl) throw new Error(UNKNOWN_COLLECTION);
      await markSentenceKnown({ sentence, upsertUrl });
    } catch (error) {
      setSaveError(error as Error);
    }
  }

  return { progress, saveAnswerOf, saveError, saveKnown };
}
