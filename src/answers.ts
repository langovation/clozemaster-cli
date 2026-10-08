import type { PlayMode, Sentence } from "./api.js";
import { splitCloze } from "./cloze.js";
import { isTypedMode } from "./playModes.js";

export type AnswerCheck = { strictAccents: boolean };

export const MASTERED_LEVEL = 4;

const STRICT: AnswerCheck = { strictAccents: true };
const MAX_LETTERS_OFF_FOR_SPELLING_HINT = 2;
const DISTRACTOR_COUNT = 3;
const POINTS_PER_LEVEL_TYPED = 8;
const POINTS_PER_LEVEL_PICKED = 4;

export function isCorrectAnswer(answer: string, sentence: Sentence, check: AnswerCheck): boolean {
  return acceptedAnswers(sentence).some((accepted) => normalize(accepted, check) === normalize(answer, check));
}

export function isOnTrack(typed: string, sentence: Sentence, check: AnswerCheck): boolean {
  return acceptedAnswers(sentence).some((accepted) => normalize(accepted, check).startsWith(normalize(typed, check)));
}

export function withNextLetter(typed: string, sentence: Sentence, check: AnswerCheck): string {
  const { cloze } = splitCloze(sentence.text);
  return cloze.slice(0, Math.min(matchingPrefixLength(typed, cloze, check) + 1, cloze.length));
}

export function lettersOff(answer: string, sentence: Sentence, check: AnswerCheck): number | undefined {
  const distance = editDistance(normalize(answer, check), normalize(splitCloze(sentence.text).cloze, check));
  return distance > 0 && distance <= MAX_LETTERS_OFF_FOR_SPELLING_HINT ? distance : undefined;
}

export function multipleChoiceOptions(sentence: Sentence, wordBank: string[]): string[] {
  const { cloze } = splitCloze(sentence.text);
  const candidates = sentence.multipleChoiceOptions?.length ? sentence.multipleChoiceOptions : wordBank;
  const distractors = candidates.filter((option) => normalize(option, STRICT) !== normalize(cloze, STRICT));
  return shuffle([cloze, ...shuffle([...new Set(distractors)]).slice(0, DISTRACTOR_COUNT)]);
}

export function levelAfterAnswer({ correct, sentence }: { correct: boolean; sentence: Sentence }): number {
  return correct ? Math.min((sentence.level || 0) + 1, MASTERED_LEVEL) : 0;
}

// The apps' formula, for display only: the server works out the real score.
export function pointsFor({ correct, mode, sentence, usedHint = false }: { correct: boolean; mode: PlayMode; sentence: Sentence; usedHint?: boolean }) {
  if (!correct) return 0;
  let points = levelAfterAnswer({ correct, sentence }) * (isTypedMode(mode) ? POINTS_PER_LEVEL_TYPED : POINTS_PER_LEVEL_PICKED);
  if (usedHint) points /= 2;
  if (isAnsweredBeforeDue(sentence)) points /= 2;
  return Math.floor(points);
}

function acceptedAnswers(sentence: Sentence): string[] {
  return [splitCloze(sentence.text).cloze, ...(sentence.alternativeAnswers || [])];
}

// The web treats ё and е as the same letter whatever the accent setting.
function normalize(text: string, { strictAccents }: AnswerCheck): string {
  const folded = text.normalize("NFC").toLowerCase().replace(/ё/g, "е").trim();
  return strictAccents ? folded : stripAccents(folded);
}

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
}

function matchingPrefixLength(typed: string, cloze: string, check: AnswerCheck): number {
  let length = 0;
  while (length < typed.length && length < cloze.length && normalize(typed[length], check) === normalize(cloze[length], check)) {
    length++;
  }
  return length;
}

function isAnsweredBeforeDue(sentence: Sentence): boolean {
  return sentence.nextReview !== null && new Date(sentence.nextReview) > new Date();
}

function editDistance(first: string, second: string): number {
  let previousRow = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let i = 1; i <= first.length; i++) {
    const row = [i];
    for (let j = 1; j <= second.length; j++) {
      const substitution = previousRow[j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1);
      row.push(Math.min(previousRow[j] + 1, row[j - 1] + 1, substitution));
    }
    previousRow = row;
  }
  return previousRow[second.length];
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}
