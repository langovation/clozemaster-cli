import React from "react";
import { render } from "ink-testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import { Play } from "../src/screens/Play.js";
import { ENTER, press, settle, showsInColor, stripAnsi } from "./helpers.js";

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

function renderPlay(mode: api.PlayMode) {
  return render(<Play choice={choice} mode={mode} onMenu={vi.fn()} onToggleMode={vi.fn()} />);
}

describe("Play", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getRound").mockResolvedValue({ collectionClozeSentences: [sentence], wordBank: [] });
    vi.spyOn(api, "saveAnswer").mockResolvedValue({ languagePairing: { numPointsToday: 40, score: 900 } });
  });

  it("fills in a correct answer in green and finishes the round", async () => {
    const { lastFrame, stdin } = renderPlay("multiple_choice");
    await settle();
    await press(stdin, stripAnsi(lastFrame()!).match(/(\d) mucha/)![1]);

    expect(showsInColor(lastFrame()!, "mucha", "brand")).toBe(true);
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "multiple_choice" }));

    await press(stdin, ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("1 correct · 0 missed");
    expect(lastFrame()).toContain("40 points today");
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
    expect(stripAnsi(lastFrame()!)).toContain("1 correct · 1 missed");
  });

  it("reveals a flashcard and saves the self-grade as multiple choice", async () => {
    const { lastFrame, stdin } = renderPlay("flashcard");
    await settle();
    expect(stripAnsi(lastFrame()!)).not.toContain("mucha");

    await press(stdin, " ");
    expect(stripAnsi(lastFrame()!)).toContain("Tengo mucha hambre.");

    await press(stdin, "2");
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "flashcard" }));
    expect(stripAnsi(lastFrame()!)).toContain("1 correct · 0 missed");
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
});
