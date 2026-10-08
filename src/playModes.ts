import type { PlayMode } from "./api.js";
import { cycledIndex } from "./cycle.js";

export const MODE_ORDER: PlayMode[] = ["multiple_choice", "text_input", "listening", "flashcard"];

export const MODE_LABELS: Record<PlayMode, string> = {
  flashcard: "Flashcards",
  listening: "Listening",
  multiple_choice: "Multiple choice",
  text_input: "Text input",
};

export function nextMode(mode: PlayMode): PlayMode {
  return MODE_ORDER[cycledIndex(MODE_ORDER.indexOf(mode), 1, MODE_ORDER.length)];
}

export function isTypedMode(mode: PlayMode): boolean {
  return mode === "text_input" || mode === "listening";
}
