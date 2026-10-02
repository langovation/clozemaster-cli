import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "ink-testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import { configDirectory } from "../src/config.js";
import { Play } from "../src/screens/Play.js";
import { saveSettings, DEFAULT_SETTINGS, type Settings } from "../src/settings.js";
import { SettingsProvider } from "../src/SettingsContext.js";
import { ENTER, press, RIGHT_ARROW, settle, showsInColor, stripAnsi } from "./helpers.js";

const sentence: api.Sentence = {
  alternativeAnswers: [],
  collectionClozeSentencesAnswerUrl: "https://example.com/answer",
  id: 7,
  level: 0,
  multipleChoiceOptions: ["poco", "muy", "tanto"],
  nextReview: null,
  text: "Tengo {{mucha}} hambre.",
  translation: "I'm very hungry.",
};

const choice = { playDataUrl: "https://example.com/play", title: "Core 1,000 Collection" };

const progress = { currentStreakDays: 12, dailyGoalPointsPerDay: 100, level: 7, numPointsToday: 40, score: 900 };

function renderPlay(mode: api.PlayMode, settings: Partial<Settings> = {}) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settings });
  return render(
    <SettingsProvider>
      <Play choice={choice} mode={mode} onMenu={vi.fn()} onToggleMode={vi.fn()} />
    </SettingsProvider>,
  );
}

describe("Play", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(path.join(configDirectory, "settings.json"), { force: true });
    vi.spyOn(api, "getRound").mockResolvedValue({ collectionClozeSentences: [sentence], wordBank: [] });
    vi.spyOn(api, "saveAnswer").mockResolvedValue({ languagePairing: progress });
  });

  it("fills in a correct answer in green and finishes the round", async () => {
    const { lastFrame, stdin } = renderPlay("multiple_choice");
    await settle();
    await press(stdin, stripAnsi(lastFrame()!).match(/(\d) mucha/)![1]);

    expect(showsInColor(lastFrame()!, "mucha", "brand")).toBe(true);
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "multiple_choice" }));

    await press(stdin, ENTER);
    const summary = stripAnsi(lastFrame()!);
    expect(summary).toContain("Round complete!");
    expect(summary).toMatch(/1\s+0\s+100%/);
    expect(summary).toContain("40/100 points today");
    expect(summary).toContain("12 day streak");
    expect(summary).toContain("✓ Tengo mucha hambre.");
  });

  it("shows a wrong answer in red with the right one in green below", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "poco", ENTER);

    expect(showsInColor(lastFrame()!, "poco", "danger")).toBe(true);
    expect(showsInColor(lastFrame()!, "mucha", "brand")).toBe(true);
    expect(stripAnsi(lastFrame()!)).not.toContain("answer was");
  });

  it("sends a missed sentence to the back of the round", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "poco", ENTER, ENTER);

    expect(stripAnsi(lastFrame()!)).toContain("2/2");
    expect(lastFrame()).toContain("I'm very hungry.");

    await press(stdin, "mucha", ENTER, ENTER);
    expect(stripAnsi(lastFrame()!)).toMatch(/1\s+1\s+50%/);
    expect(stripAnsi(lastFrame()!)).toContain("✗ Tengo mucha hambre.");
  });

  it("colours typing red once it stops matching", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "muc");
    expect(showsInColor(lastFrame()!, "muc", "brand")).toBe(true);
    await press(stdin, "x");
    expect(showsInColor(lastFrame()!, "mucx", "danger")).toBe(true);
  });

  it("nudges a near miss once before grading it", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mucah", ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("Off by 2 letters");
    expect(api.saveAnswer).not.toHaveBeenCalled();

    await press(stdin, ENTER);
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });

  it("grades a near miss straight away with spelling hints off", async () => {
    const { stdin } = renderPlay("text_input", { spellingHints: false });
    await settle();
    await press(stdin, "mucah", ENTER);
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });

  it("hides the translation until answering when set to after", async () => {
    const { lastFrame, stdin } = renderPlay("text_input", { translation: "after" });
    await settle();
    expect(lastFrame()).not.toContain("I'm very hungry.");
    await press(stdin, "mucha", ENTER);
    expect(lastFrame()).toContain("I'm very hungry.");
  });

  it("reveals a flashcard and saves the self-grade", async () => {
    const { lastFrame, stdin } = renderPlay("flashcard");
    await settle();
    expect(stripAnsi(lastFrame()!)).not.toContain("mucha");

    await press(stdin, " ");
    expect(stripAnsi(lastFrame()!)).toContain("Tengo mucha hambre.");

    await press(stdin, "2");
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "flashcard" }));
    expect(stripAnsi(lastFrame()!)).toContain("Round complete!");
  });

  it("goes back to the previous flashcard and only saves the final grade", async () => {
    const second = { ...sentence, id: 8, text: "Tengo {{sueño}}.", translation: "I'm sleepy." };
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [sentence, second], wordBank: [] });
    const { lastFrame, stdin } = renderPlay("flashcard");
    await settle();

    await press(stdin, " ", "1");
    expect(stripAnsi(lastFrame()!)).toContain("2/3");
    await press(stdin, "b");
    expect(stripAnsi(lastFrame()!)).toContain("Tengo mucha hambre.");
    expect(stripAnsi(lastFrame()!)).toContain("1/2");

    await press(stdin, "2", " ", "2");
    expect(vi.mocked(api.saveAnswer).mock.calls.map(([saved]) => [saved.sentence.id, saved.correct])).toEqual([
      [7, true],
      [8, true],
    ]);
  });

  it("fills in the next letter for a hint and halves the points", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mx", RIGHT_ARROW);
    expect(stripAnsi(lastFrame()!)).toContain("❯ mu");
    await press(stdin, "cha", ENTER);
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, usedHint: true }));
    await press(stdin, ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("+4 points");
  });

  it("shows the explanation after answering", async () => {
    const explained = {
      ...sentence,
      structuredExplanation: {
        alternative: null,
        breakdown: [{ features: ["feminine", "singular"], gloss: "a lot of", lemma: "mucho", note: "Agrees with hambre.", pos: "determiner", reading: null, surface: "mucha" }],
        literalTranslation: "I have much hunger.",
        sections: [{ body: "Hambre is feminine.", examples: [], type: "pitfall" as const }],
        sentenceReading: null,
        translation: "I'm very hungry.",
      },
    };
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [explained], wordBank: [] });
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mucha", ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("e explain");

    await press(stdin, "e");
    const frame = stripAnsi(lastFrame()!);
    expect(frame).toContain("Explanation");
    expect(frame).toContain("mucha a lot of");
    expect(frame).toContain("mucho · determiner, feminine, singular");
    expect(frame).toContain("Literally");
    expect(frame).toContain("Common mistake");
  });

  it("doesn't offer explain when there's nothing to explain", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mucha", ENTER);
    expect(stripAnsi(lastFrame()!)).not.toContain("explain");
  });
});
