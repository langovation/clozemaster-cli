import { describe, expect, it } from "vitest";
import { logoForWidth } from "../src/components/Welcome.js";
import { LOGO, STACKED_LOGO } from "../src/sprites.js";

describe("logoForWidth", () => {
  it("uses the big logo when it fits", () => {
    expect(logoForWidth(80)).toBe(LOGO);
  });

  it("stacks the logo in a narrow terminal", () => {
    expect(logoForWidth(44)).toBe(STACKED_LOGO);
  });

  it("gives up on pixel art when even the stacked logo would wrap", () => {
    expect(logoForWidth(30)).toBeUndefined();
  });
});
