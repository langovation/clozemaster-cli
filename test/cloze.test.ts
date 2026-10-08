import { describe, expect, it } from "vitest";
import { clearClozeMarkers, moveCloze, splitCloze } from "../src/cloze.js";

describe("splitCloze", () => {
  it("splits the sentence around the cloze word", () => {
    expect(splitCloze("Tengo {{mucha}} hambre.")).toEqual({ after: " hambre.", before: "Tengo ", cloze: "mucha" });
  });
});

describe("moveCloze", () => {
  it("moves the cloze to the next word", () => {
    expect(moveCloze("El {{gato}} duerme.", 1)).toBe("El gato {{duerme}}.");
  });

  it("moves the cloze to the previous word", () => {
    expect(moveCloze("El {{gato}} duerme.", -1)).toBe("{{El}} gato duerme.");
  });

  it("wraps around the ends of the sentence", () => {
    expect(moveCloze("El gato {{duerme}}.", 1)).toBe("{{El}} gato duerme.");
  });

  it("starts at the first word when there's no cloze", () => {
    expect(moveCloze("El gato duerme.", 1)).toBe("{{El}} gato duerme.");
  });

  it("keeps accents and apostrophes inside a word", () => {
    expect(moveCloze("{{C'est}} très bien.", 1)).toBe("C'est {{très}} bien.");
  });
});

describe("clearClozeMarkers", () => {
  it("removes the cloze braces", () => {
    expect(clearClozeMarkers("El {{gato}} duerme.")).toBe("El gato duerme.");
  });
});
