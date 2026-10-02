import { describe, expect, it } from "vitest";
import type { Sentence } from "../src/api.js";
import { isCorrectAnswer, multipleChoiceOptions, pointsFor, splitCloze } from "../src/answers.js";

const sentence: Sentence = {
  alternativeAnswers: ["mucho"],
  id: 1,
  level: 1,
  multipleChoiceOptions: ["poco", "muy", "tanto"],
  nextReview: null,
  text: "Tengo {{mucha}} hambre.",
  translation: "I'm very hungry.",
};

describe("splitCloze", () => {
  it("splits the sentence around the cloze word", () => {
    expect(splitCloze(sentence.text)).toEqual({ after: " hambre.", before: "Tengo ", cloze: "mucha" });
  });
});

describe("isCorrectAnswer", () => {
  it("accepts the cloze word ignoring case, accents and surrounding spaces", () => {
    expect(isCorrectAnswer(" Mućha ", sentence)).toBe(true);
  });

  it("accepts an alternative answer", () => {
    expect(isCorrectAnswer("mucho", sentence)).toBe(true);
  });

  it("rejects a wrong word", () => {
    expect(isCorrectAnswer("poco", sentence)).toBe(false);
  });
});

describe("multipleChoiceOptions", () => {
  it("offers the answer plus three distractors", () => {
    const options = multipleChoiceOptions(sentence, []);
    expect(options).toHaveLength(4);
    expect(options).toContain("mucha");
  });

  it("falls back to the word bank when the sentence has no options", () => {
    const options = multipleChoiceOptions({ ...sentence, multipleChoiceOptions: [] }, ["uno", "dos", "tres", "mucha"]);
    expect([...options].sort()).toEqual(["dos", "mucha", "tres", "uno"]);
  });
});

describe("pointsFor", () => {
  it("scores the next level times 8 for text input", () => {
    expect(pointsFor({ correct: true, mode: "text_input", sentence })).toBe(16);
  });

  it("scores nothing for a wrong answer", () => {
    expect(pointsFor({ correct: false, mode: "multiple_choice", sentence })).toBe(0);
  });
});
