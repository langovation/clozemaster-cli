import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { Sentence } from "../src/api.js";
import { RoundSummary, type RoundResult } from "../src/screens/RoundSummary.js";
import { SettingsProvider } from "../src/SettingsContext.js";
import { DOWN, press, settle, stripAnsi, UP } from "./helpers.js";

vi.mock("../src/audio.js", () => ({ playSoundEffect: vi.fn(async () => true) }));

function result(id: number): RoundResult {
  const sentence = { id, text: `Frase {{número}} ${id}.`, translation: `Sentence ${id}.` } as Sentence;
  return { isCorrect: true, points: 1, sentence, usedHint: false } as RoundResult;
}

// The test terminal reports no height, so the summary sizes itself for the default 24 rows: room for 2 sentences.
function renderSummary(sentenceCount: number) {
  const results = Array.from({ length: sentenceCount }, (_, index) => result(index + 1));
  return render(<SettingsProvider><RoundSummary elapsedSeconds={60} onMenu={vi.fn()} onPlayAgain={vi.fn()} results={results} /></SettingsProvider>);
}

describe("RoundSummary", () => {
  it("shows only as many sentences as fit the terminal, from the top", async () => {
    const { lastFrame } = renderSummary(30);
    await settle();
    const frame = stripAnsi(lastFrame()!);
    expect(frame).toContain("Sentence 1.");
    expect(frame).toContain("Sentence 2.");
    expect(frame).not.toContain("Sentence 3.");
    expect(frame).toContain("↑↓ scroll 1–2/30");
    expect(frame.split("\n").length).toBeLessThan(24);
  });

  it("scrolls the sentences with the arrow keys, stopping at the ends", async () => {
    const { lastFrame, stdin } = renderSummary(4);
    await settle();
    await press(stdin, DOWN, DOWN, DOWN);
    expect(stripAnsi(lastFrame()!)).toContain("↑↓ scroll 3–4/4");
    await press(stdin, UP, UP, UP);
    expect(stripAnsi(lastFrame()!)).toContain("↑↓ scroll 1–2/4");
  });

  it("shows every sentence without a scroll hint when they all fit", async () => {
    const { lastFrame } = renderSummary(2);
    await settle();
    expect(stripAnsi(lastFrame()!)).toContain("Sentence 2.");
    expect(stripAnsi(lastFrame()!)).not.toContain("scroll");
  });
});
