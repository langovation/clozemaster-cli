import { describe, expect, it } from "vitest";
import { renderSprite } from "../src/pixels.js";

describe("renderSprite", () => {
  it("packs two pixel rows into one line of half blocks", () => {
    const rendered = renderSprite({ palette: { a: "#ff0000", b: "#0000ff" }, rows: ["ab", "b."] });
    expect(rendered).toBe("\x1b[38;2;255;0;0;48;2;0;0;255m▀\x1b[0m\x1b[38;2;0;0;255m▀\x1b[0m");
  });

  it("leaves fully transparent cells blank", () => {
    expect(renderSprite({ palette: { a: "#ffffff" }, rows: ["..a", "..."] })).toBe("  \x1b[38;2;255;255;255m▀\x1b[0m");
  });
});
