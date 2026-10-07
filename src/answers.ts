import { isTypedMode, type PlayMode, type Sentence } from "./api.js";

export type ClozeParts = { after: string; before: string; cloze: string };

export type AnswerCheck = { strictAccents: boolean };

export function splitCloze(text: string): ClozeParts {
  const [before, rest = ""] = text.split("{{");
  const [cloze, after = ""] = rest.split("}}");
  return { after, before, cloze };
}

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
}

// The web treats ё and е as the same letter whatever the accent setting.
function normalize(text: string, { strictAccents }: AnswerCheck): string {
  const folded = text.normalize("NFC").toLowerCase().replace(/ё/g, "е").trim();
  return strictAccents ? folded : stripAccents(folded);
}

function acceptedAnswers(sentence: Sentence): string[] {
  return [splitCloze(sentence.text).cloze, ...(sentence.alternativeAnswers || [])];
}

export function isCorrectAnswer(answer: string, sentence: Sentence, check: AnswerCheck): boolean {
  return acceptedAnswers(sentence).some((accepted) => normalize(accepted, check) === normalize(answer, check));
}

// What the typing colour hint goes by: still a prefix of something that would be right.
export function isOnTrack(typed: string, sentence: Sentence, check: AnswerCheck): boolean {
  return acceptedAnswers(sentence).some((accepted) => normalize(accepted, check).startsWith(normalize(typed, check)));
}

// The web's next-letter hint: keep what's right so far and add the next letter of the cloze.
export function withNextLetter(typed: string, sentence: Sentence, check: AnswerCheck): string {
  const cloze = splitCloze(sentence.text).cloze;
  let matching = 0;
  while (matching < typed.length && matching < cloze.length && normalize(typed[matching], check) === normalize(cloze[matching], check)) {
    matching++;
  }
  return cloze.slice(0, Math.min(matching + 1, cloze.length));
}

// How many letters a wrong answer is off by, when it's close enough (2 or fewer) for a spelling hint.
export function lettersOff(answer: string, sentence: Sentence, check: AnswerCheck): number | undefined {
  const distance = levenshtein(normalize(answer, check), normalize(splitCloze(sentence.text).cloze, check));
  return distance > 0 && distance <= 2 ? distance : undefined;
}

function levenshtein(first: string, second: string): number {
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

export function multipleChoiceOptions(sentence: Sentence, wordBank: string[]): string[] {
  const { cloze } = splitCloze(sentence.text);
  const check = { strictAccents: true };
  const distractors = (sentence.multipleChoiceOptions?.length ? sentence.multipleChoiceOptions : wordBank)
    .filter((option) => normalize(option, check) !== normalize(cloze, check));
  return shuffle([cloze, ...shuffle(distractors).slice(0, 3)]);
}

export const MASTERED_LEVEL = 4;

// Like the apps: a right answer moves the sentence up a level, a miss sends it back to 0.
export function levelAfterAnswer({ correct, sentence }: { correct: boolean; sentence: Sentence }): number {
  return correct ? Math.min((sentence.level || 0) + 1, MASTERED_LEVEL) : 0;
}

// Same formula as the apps, for display only; the server works out the real score.
export function pointsFor({ correct, mode, sentence, usedHint = false }: { correct: boolean; mode: PlayMode; sentence: Sentence; usedHint?: boolean }) {
  if (!correct) return 0;
  const newLevel = levelAfterAnswer({ correct, sentence });
  let points = newLevel * (isTypedMode(mode) ? 8 : 4);
  if (usedHint) points /= 2;
  if (sentence.nextReview !== null && new Date(sentence.nextReview) > new Date()) points /= 2;
  return Math.floor(points);
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}
