import { describe, expect, it } from "vitest";
import { mergeChecksums } from "../scripts/checksums.js";

const hash = (digit: string) => digit.repeat(64);

describe("mergeChecksums", () => {
  it("writes a line per built file in sha256sum's format", () => {
    expect(mergeChecksums("", [{ file: "clozemaster-linux-x64", sha256: hash("a") }])).toBe(`${hash("a")}  clozemaster-linux-x64\n`);
  });

  it("keeps the lines for targets that weren't rebuilt", () => {
    const existing = `${hash("a")}  clozemaster-darwin-x64\n${hash("b")}  clozemaster-linux-x64\n`;
    expect(mergeChecksums(existing, [{ file: "clozemaster-darwin-arm64", sha256: hash("c") }])).toBe(
      `${hash("c")}  clozemaster-darwin-arm64\n${hash("a")}  clozemaster-darwin-x64\n${hash("b")}  clozemaster-linux-x64\n`,
    );
  });

  it("replaces the line for a rebuilt target", () => {
    const existing = `${hash("a")}  clozemaster-darwin-arm64\n`;
    expect(mergeChecksums(existing, [{ file: "clozemaster-darwin-arm64", sha256: hash("d") }])).toBe(`${hash("d")}  clozemaster-darwin-arm64\n`);
  });

  it("ignores lines that aren't checksums", () => {
    expect(mergeChecksums("garbage\n\n", [{ file: "clozemaster-linux-arm64", sha256: hash("e") }])).toBe(`${hash("e")}  clozemaster-linux-arm64\n`);
  });
});
