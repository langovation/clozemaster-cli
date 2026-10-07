export function clearClozeMarkers(text: string): string {
  return text.replace(/\{\{|\}\}/g, "");
}

const WORD = /[\p{L}\p{M}\p{N}'’-]+/gu;

function words(text: string): { end: number; start: number }[] {
  return [...text.matchAll(WORD)].map((match) => ({ end: match.index + match[0].length, start: match.index }));
}

export function moveCloze(text: string, step: number): string {
  const plain = clearClozeMarkers(text);
  const sentenceWords = words(plain);
  if (sentenceWords.length === 0) return text;
  const clozeStart = text.indexOf("{{");
  const current = clozeStart === -1 ? -1 : sentenceWords.findIndex((word) => word.end > clozeStart);
  const next = current === -1 ? 0 : (current + step + sentenceWords.length) % sentenceWords.length;
  const { end, start } = sentenceWords[next];
  return `${plain.slice(0, start)}{{${plain.slice(start, end)}}}${plain.slice(end)}`;
}
