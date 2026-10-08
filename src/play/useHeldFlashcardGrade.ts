import { useRef } from "react";
import type { RoundResult } from "../screens/RoundSummary.js";
import type { SubmittedAnswer } from "./useAnswerSaving.js";

export type HeldGrade = RoundResult & SubmittedAnswer & { index: number };

// A flashcard's grade is saved only once the next card is graded, so going back can take it back without a server undo.
export function useHeldFlashcardGrade(save: (answer: SubmittedAnswer) => void) {
  const held = useRef<HeldGrade | undefined>(undefined);

  function saveHeldGrade() {
    if (held.current) save(held.current);
    held.current = undefined;
  }

  function holdGrade(grade: HeldGrade) {
    saveHeldGrade();
    held.current = grade;
  }

  function takeBackGrade(): HeldGrade | undefined {
    const grade = held.current;
    held.current = undefined;
    return grade;
  }

  return { hasHeldGrade: Boolean(held.current), holdGrade, saveHeldGrade, takeBackGrade };
}
