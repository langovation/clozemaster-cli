import type { PlayMode } from "../api.js";
import { canPlayAtHalfSpeed } from "../audio.js";
import { isTypedMode, MODE_LABELS, nextMode } from "../playModes.js";

export type PlayRoundHintState = {
  canEditCard: boolean;
  canGoBack: boolean;
  canOpenSettings: boolean;
  canPlayAudio: boolean;
  hasUsedHint: boolean;
  isAnswered: boolean;
  isExplainable: boolean;
  isExplaining: boolean;
  isListening: boolean;
  isRevealed: boolean;
  mode: PlayMode;
};

const ANSWER_HINTS: Record<PlayMode, string> = {
  flashcard: "space to reveal",
  listening: "↑ accent",
  multiple_choice: "1-4 to answer",
  text_input: "↑ accent",
};

const REPLAY_HINTS = canPlayAtHalfSpeed ? ["p replay", "h half speed"] : ["p replay"];

export function playRoundHints(state: PlayRoundHintState): string[] {
  if (state.isListening && !state.isAnswered) return [...REPLAY_HINTS, "esc back"];
  const cardHints = state.isAnswered ? answeredHints(state) : answeringHints(state);
  return [...cardHints, ...menuHints(state)];
}

function answeredHints(state: PlayRoundHintState): string[] {
  return [
    "enter to continue",
    ...onlyIf(state.canPlayAudio, ...REPLAY_HINTS),
    ...onlyIf(state.isExplainable, state.isExplaining ? "e hide explanation" : "e explain"),
  ];
}

function answeringHints(state: PlayRoundHintState): string[] {
  return [
    ...onlyIf(canAskForHint(state), "→ hint"),
    ...onlyIf(!state.isRevealed, ANSWER_HINTS[state.mode]),
    ...onlyIf(state.canPlayAudio, ...REPLAY_HINTS),
    ...onlyIf(state.isExplainable, "e explain"),
    ...onlyIf(state.canGoBack, "b previous card"),
    ...onlyIf(!state.isRevealed, `tab: ${MODE_LABELS[nextMode(state.mode)].toLowerCase()}`),
  ];
}

function menuHints(state: PlayRoundHintState): string[] {
  return [...onlyIf(state.canOpenSettings, "s settings"), ...onlyIf(state.canOpenSettings && state.canEditCard, "c edit card"), "esc back"];
}

function canAskForHint({ hasUsedHint, isRevealed, mode }: PlayRoundHintState): boolean {
  return !hasUsedHint && (isTypedMode(mode) || (mode === "flashcard" && !isRevealed));
}

function onlyIf(condition: boolean, ...hints: string[]): string[] {
  return condition ? hints : [];
}
