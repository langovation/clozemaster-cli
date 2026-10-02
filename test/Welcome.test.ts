import { describe, expect, it } from "vitest";
import { logoForWidth } from "../src/components/Welcome.js";
import { LOGO, SMALL_STACKED_LOGO, STACKED_LOGO } from "../src/sprites.js";

describe("logoForWidth", () => {
  it("uses the big logo when it fits", () => {
    expect(logoForWidth(80)).toBe(LOGO);
  });

  it("stacks the logo in a narrow terminal", () => {
    expect(logoForWidth(44)).toBe(STACKED_LOGO);
  });

  it("uses the small font in a very narrow terminal", () => {
    expect(logoForWidth(30)).toBe(SMALL_STACKED_LOGO);
  });

  it("gives up on pixel art when even the small logo would wrap", () => {
    expect(logoForWidth(20)).toBeUndefined();
  });
});
