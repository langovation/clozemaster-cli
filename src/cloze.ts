import { cycledIndex } from "./cycle.js";

export type ClozeParts = { after: string; before: string; cloze: string };

type WordSpan = { end: number; start: number };

const WORD = /[\p{L}\p{M}\p{N}'’-]+/gu;

export function splitCloze(text: string): ClozeParts {
  const [before, rest = ""] = text.split("{{");
  const [cloze, after = ""] = rest.split("}}");
  return { after, before, cloze };
}

export function clearClozeMarkers(text: string): string {
  return text.replace(/\{\{|\}\}/g, "");
}

export function moveCloze(text: string, step: number): string {
  const plain = clearClozeMarkers(text);
  const words = wordSpans(plain);
  if (words.length === 0) return text;
  const { end, start } = words[nextClozeWord(text, words, step)];
  return `${plain.slice(0, start)}{{${plain.slice(start, end)}}}${plain.slice(end)}`;
}

function wordSpans(text: string): WordSpan[] {
  return [...text.matchAll(WORD)].map((match) => ({ end: match.index + match[0].length, start: match.index }));
}

function nextClozeWord(text: string, words: WordSpan[], step: number): number {
  const clozeStart = text.indexOf("{{");
  const current = clozeStart === -1 ? -1 : words.findIndex((word) => word.end > clozeStart);
  return current === -1 ? 0 : cycledIndex(current, step, words.length);
}
