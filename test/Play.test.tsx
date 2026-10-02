import React from "react";
import { render } from "ink-testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import { Play } from "../src/screens/Play.js";

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

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("Play", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getRound").mockResolvedValue({ collectionClozeSentences: [sentence], wordBank: [] });
    vi.spyOn(api, "saveAnswer").mockResolvedValue({ languagePairing: { numPointsToday: 40, score: 900 } });
  });

  const choice = { playDataUrl: "https://example.com/play", title: "Most Common Words" };

  it("saves a correct multiple choice answer and shows the round summary", async () => {
    const { lastFrame, stdin } = render(<Play choice={choice} mode="multiple_choice" onMenu={vi.fn()} onToggleMode={vi.fn()} />);
    await flush();
    const frame = lastFrame()!;
    const correctOptionNumber = frame.match(/(\d) mucha/)![1];

    stdin.write(correctOptionNumber);
    await flush();
    expect(lastFrame()).toContain("Correct!");
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "multiple_choice" }));

    stdin.write("\r");
    await flush();
    expect(lastFrame()).toContain("Round complete!");
    expect(lastFrame()).toContain("40 points today");
  });

  it("marks a wrong typed answer incorrect and shows the right word", async () => {
    const { lastFrame, stdin } = render(<Play choice={choice} mode="text_input" onMenu={vi.fn()} onToggleMode={vi.fn()} />);
    await flush();

    stdin.write("poco");
    await flush();
    stdin.write("\r");
    await flush();
    expect(lastFrame()).toContain("The answer was mucha");
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: false, mode: "text_input" }));
  });
});
