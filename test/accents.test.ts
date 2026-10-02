import { describe, expect, it } from "vitest";
import { cycleLastLetterAccent } from "../src/accents.js";

describe("cycleLastLetterAccent", () => {
  it("puts the first accent on the last letter", () => {
    expect(cycleLastLetterAccent("adio")).toBe("adió");
  });

  it("keeps cycling and wraps back to the plain letter", () => {
    let word = "n";
    word = cycleLastLetterAccent(word);
    word = cycleLastLetterAccent(word);
    word = cycleLastLetterAccent(word);
    expect(word).toBe("n");
  });

  it("cycles backwards", () => {
    expect(cycleLastLetterAccent("o", -1)).toBe("ō");
  });

  it("keeps the case", () => {
    expect(cycleLastLetterAccent("E")).toBe("É");
  });

  it("leaves letters without accents alone", () => {
    expect(cycleLastLetterAccent("x")).toBe("x");
  });
});
