import type { PlayMode, Sentence } from "./api.js";

export type ClozeParts = { after: string; before: string; cloze: string };

export function splitCloze(text: string): ClozeParts {
  const [before, rest = ""] = text.split("{{");
  const [cloze, after = ""] = rest.split("}}");
  return { after, before, cloze };
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\s]+/gu, " ")
    .trim();
}

export function isCorrectAnswer(answer: string, sentence: Sentence): boolean {
  const accepted = [splitCloze(sentence.text).cloze, ...(sentence.alternativeAnswers || [])];
  return accepted.some((acceptedAnswer) => normalize(acceptedAnswer) === normalize(answer));
}

export function multipleChoiceOptions(sentence: Sentence, wordBank: string[]): string[] {
  const { cloze } = splitCloze(sentence.text);
  const distractors = (sentence.multipleChoiceOptions?.length ? sentence.multipleChoiceOptions : wordBank)
    .filter((option) => normalize(option) !== normalize(cloze));
  return shuffle([cloze, ...shuffle(distractors).slice(0, 3)]);
}

// Same formula as the apps, for display only; the server works out the real score.
export function pointsFor({ correct, mode, sentence }: { correct: boolean; mode: PlayMode; sentence: Sentence }) {
  if (!correct) return 0;
  const newLevel = Math.min((sentence.level || 0) + 1, 4);
  const points = newLevel * (mode === "multiple_choice" ? 4 : 8);
  const isEarlyReview = sentence.nextReview !== null && new Date(sentence.nextReview) > new Date();
  return isEarlyReview ? Math.floor(points / 2) : points;
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}
