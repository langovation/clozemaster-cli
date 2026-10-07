import fs from "node:fs";
import path from "node:path";
import { configDirectory } from "./config.js";

export type TranslationVisibility = "visible" | "after" | "hidden";

export type Settings = {
  audio: boolean;
  hints: boolean;
  masteryBeforeAnswering: boolean;
  pronunciation: boolean;
  soundEffects: boolean;
  spellingHints: boolean;
  strictAccents: boolean;
  translation: TranslationVisibility;
  typingColorHint: boolean;
};

// Same defaults as the mobile app for vocabulary rounds.
export const DEFAULT_SETTINGS: Settings = {
  audio: true,
  hints: true,
  masteryBeforeAnswering: false,
  pronunciation: true,
  soundEffects: true,
  spellingHints: true,
  strictAccents: true,
  translation: "visible",
  typingColorHint: true,
};

const settingsPath = path.join(configDirectory, "settings.json");

// Kept on this machine, like the mobile app does; the API has no endpoint that returns them.
export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsPath, "utf8")) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}
