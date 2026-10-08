import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import open from "open";
import * as api from "../src/api.js";
import { ErrorMessage } from "../src/components/ErrorMessage.js";
import { ExplanationPanel } from "../src/components/ExplanationPanel.js";
import { Select } from "../src/components/Select.js";
import { DOWN, ENTER, press, settle, showsInColor, stripAnsi, UP, waitForText } from "./helpers.js";

vi.mock("open", () => ({ default: vi.fn(async () => undefined) }));

const items = (count: number) => Array.from({ length: count }, (_, index) => ({ label: `Item ${index + 1}`, value: index + 1 }));

describe("Select", () => {
  it("highlights the first item", () => {
    const { lastFrame } = render(<Select items={items(3)} onSelect={vi.fn()} />);
    expect(stripAnsi(lastFrame()!)).toBe("❯ Item 1\n  Item 2\n  Item 3");
    expect(showsInColor(lastFrame()!, "❯ Item 1", "brand")).toBe(true);
  });

  it("shows each item's detail", () => {
    const { lastFrame } = render(<Select items={[{ detail: "level 7", label: "Español", value: 1 }]} onSelect={vi.fn()} />);
    expect(stripAnsi(lastFrame()!)).toMatch(/❯ Español\s+level 7/);
  });

  it("picks the highlighted item with enter", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(<Select items={items(3)} onSelect={onSelect} />);
    await press(stdin, DOWN, ENTER);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("moves with j and k", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(<Select items={items(3)} onSelect={onSelect} />);
    await press(stdin, "j", "j", "k", ENTER);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("wraps around both ends", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(<Select items={items(3)} onSelect={onSelect} />);
    await press(stdin, UP, ENTER, DOWN, ENTER);
    expect(onSelect.mock.calls).toEqual([[3], [1]]);
  });

  it("shows twelve items at a time with the position in a longer list", () => {
    const { lastFrame } = render(<Select items={items(15)} onSelect={vi.fn()} />);
    const frame = stripAnsi(lastFrame()!);
    expect(frame).toContain("Item 12");
    expect(frame).not.toContain("Item 13");
    expect(frame).toContain("  1/15");
  });

  it("scrolls to keep the highlighted item visible", async () => {
    const { lastFrame, stdin } = render(<Select items={items(15)} onSelect={vi.fn()} />);
    await press(stdin, UP);
    const frame = stripAnsi(lastFrame()!);
    expect(frame).toContain("❯ Item 15");
    expect(frame).not.toContain("Item 3\n");
    expect(frame).toContain("15/15");
  });
});

describe("ErrorMessage", () => {
  it("shows the error's message in red", () => {
    const { lastFrame } = render(<ErrorMessage error={new Error("Something broke")} />);
    expect(showsInColor(lastFrame()!, "Something broke", "danger")).toBe(true);
  });

  it("shows where to upgrade for a Pro feature", () => {
    const { lastFrame } = render(<ErrorMessage error={new api.ProRequiredError("Listening needs Pro.", "listening")} />);
    const frame = stripAnsi(lastFrame()!);
    expect(frame).toContain("Listening needs Pro.");
    expect(frame).toMatch(/Upgrade at https?:\/\/\S+\/pro\?placement=cli_listening/);
    expect(frame).toContain("u open upgrade page");
  });

  it("opens the upgrade page with u", async () => {
    const error = new api.ProRequiredError("Listening needs Pro.", "listening");
    const { stdin } = render(<ErrorMessage error={error} />);
    await press(stdin, "u");
    expect(open).toHaveBeenCalledWith(error.upgradeUrl);
  });
});

describe("ExplanationPanel", () => {
  const sentence = { explanation: "Mucha agrees with hambre.", id: 1 } as api.Sentence;

  afterEach(() => vi.restoreAllMocks());

  it("shows a plain text explanation", async () => {
    const { lastFrame } = render(<ExplanationPanel sentence={sentence} />);
    await waitForText(lastFrame, "Mucha agrees with hambre.");
    expect(stripAnsi(lastFrame()!)).toContain("Explanation");
  });

  it("says it's explaining while the explanation is written", async () => {
    vi.spyOn(api, "getExplanation").mockReturnValue(new Promise(() => {}));
    const { lastFrame } = render(<ExplanationPanel sentence={sentence} />);
    await settle();
    expect(stripAnsi(lastFrame()!)).toContain("Explaining… this may take a few seconds");
  });

  it("shows why there's no explanation", async () => {
    vi.spyOn(api, "getExplanation").mockRejectedValue(new api.ExplanationLimitError("You've used all your explanations this month."));
    const { lastFrame } = render(<ExplanationPanel sentence={sentence} />);
    await waitForText(lastFrame, "You've used all your explanations this month.");
  });

  it("shows a word's reading, a different lemma, its tags and note, and section examples", async () => {
    const structured: api.StructuredExplanation = {
      alternative: "Tengo bastante hambre.",
      breakdown: [{ features: ["past_tense"], gloss: "ate", lemma: "食べる", note: "Polite form.", pos: "verb", reading: "たべた", surface: "食べた" }],
      literalTranslation: null,
      sections: [{ body: "Use the past.", examples: [{ text: "Comí.", translation: "I ate." }], type: "grammar" }],
      sentenceReading: "わたしはたべた",
      translation: "I ate.",
    };
    const { lastFrame, stdin } = render(<ExplanationPanel sentence={{ ...sentence, structuredExplanation: structured }} />);
    await waitForText(lastFrame, "Alternative");
    const frame = stripAnsi(lastFrame()!);
    expect(frame).toContain("わたしはたべた");
    expect(frame).toContain("食べた [たべた] ate");
    expect(frame).toContain("食べる · verb, past tense");
    expect(frame).toContain("Polite form.");
    expect(frame).not.toContain("Literally");

    await press(stdin, ...Array<string>(10).fill(DOWN));
    expect(stripAnsi(lastFrame()!)).toContain("Grammar");
    expect(stripAnsi(lastFrame()!)).toContain("Comí. - I ate.");
  });
});
