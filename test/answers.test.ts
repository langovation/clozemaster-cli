import { describe, expect, it } from "vitest";
import type { Sentence } from "../src/api.js";
import { isCorrectAnswer, isOnTrack, lettersOff, multipleChoiceOptions, pointsFor, splitCloze } from "../src/answers.js";

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

const strict = { strictAccents: true };
const lenient = { strictAccents: false };
const accented: Sentence = { ...sentence, text: "Es un {{camión}}." };

describe("isCorrectAnswer", () => {
  it("accepts the cloze word ignoring case and surrounding spaces", () => {
    expect(isCorrectAnswer(" Mucha ", sentence, strict)).toBe(true);
  });

  it("accepts an alternative answer", () => {
    expect(isCorrectAnswer("mucho", sentence, strict)).toBe(true);
  });

  it("rejects a wrong word", () => {
    expect(isCorrectAnswer("poco", sentence, strict)).toBe(false);
  });

  it("rejects a missing accent with strict accents on", () => {
    expect(isCorrectAnswer("camion", accented, strict)).toBe(false);
  });

  it("accepts a missing accent with strict accents off", () => {
    expect(isCorrectAnswer("camion", accented, lenient)).toBe(true);
  });
});

describe("isOnTrack", () => {
  it("is on track while the input starts an accepted answer", () => {
    expect(isOnTrack("muc", sentence, strict)).toBe(true);
  });

  it("is off track once the input diverges", () => {
    expect(isOnTrack("mux", sentence, strict)).toBe(false);
  });
});

describe("lettersOff", () => {
  it("counts a near miss", () => {
    expect(lettersOff("mucah", sentence, strict)).toBe(2);
  });

  it("ignores answers that are way off", () => {
    expect(lettersOff("tanto", sentence, strict)).toBeUndefined();
  });
});

describe("multipleChoiceOptions", () => {
  it("never offers the same distractor twice", () => {
    const options = multipleChoiceOptions({ ...sentence, multipleChoiceOptions: [] }, ["uno", "uno", "uno", "dos"]);
    expect(options.filter((option) => option === "uno")).toHaveLength(1);
  });

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
