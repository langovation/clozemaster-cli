import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "ink-testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import { playSentenceAudio, playSentenceAudioAtHalfSpeed, playSoundEffect, preloadSentenceAudio } from "../src/audio.js";
import { configDirectory } from "../src/config.js";
import { Play } from "../src/screens/Play.js";
import { saveSettings, DEFAULT_SETTINGS, type Settings } from "../src/settings.js";
import { SettingsProvider } from "../src/SettingsContext.js";
import { DOWN, ENTER, ESCAPE, eventually, press, RIGHT_ARROW, showsInColor, stripAnsi, unwrapped, waitForText } from "./helpers.js";

const sentence: api.Sentence = {
  alternativeAnswers: [],
  collectionClozeSentencesAnswerUrl: "https://example.com/answer",
  id: 7,
  level: 0,
  multipleChoiceOptions: ["poco", "muy", "tanto"],
  nextReview: null,
  text: "Tengo {{mucha}} hambre.",
  translation: "I'm very hungry.",
};

const choice = { playDataUrl: "https://example.com/play", title: "Core 1,000 Collection", upsertUrl: "https://example.com/upsert" };

const progress = { currentStreakDays: 12, dailyGoalPointsPerDay: 100, level: 7, numPointsToday: 40, score: 900 };

type PlayProps = React.ComponentProps<typeof Play>;

function renderPlay(mode: api.PlayMode, settings: Partial<Settings> = {}, props: Partial<PlayProps> = {}) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settings });
  const allProps = { choice, mode, onMenu: vi.fn(), onProgress: vi.fn(), onToggleMode: vi.fn(), ...props };
  const withProviders = (playProps: PlayProps) => (
    <SettingsProvider>
      <Play {...playProps} />
    </SettingsProvider>
  );
  const app = render(withProviders(allProps));
  return { ...app, switchMode: (nextMode: api.PlayMode) => app.rerender(withProviders({ ...allProps, mode: nextMode })) };
}

type PlayApp = Pick<ReturnType<typeof renderPlay>, "lastFrame" | "stdin">;

const waitForRoundToLoad = (lastFrame: PlayApp["lastFrame"]) => waitForText(lastFrame, "esc back");

async function submitAnswer({ lastFrame, stdin }: PlayApp, answer: string) {
  await press(stdin, answer);
  await waitForText(lastFrame, `❯ ${answer}`);
  await press(stdin, ENTER);
}

const unknownCollectionChoice = { playDataUrl: "https://example.com/play", title: "Review" };

vi.mock("../src/audio.js", () => ({ canPlayAtHalfSpeed: true, playSentenceAudio: vi.fn(async () => true), playSentenceAudioAtHalfSpeed: vi.fn(async () => true), playSoundEffect: vi.fn(async () => true), preloadSentenceAudio: vi.fn(), stopAudio: vi.fn() }));

describe("Play", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(playSentenceAudio).mockClear();
    vi.mocked(playSentenceAudioAtHalfSpeed).mockClear();
    vi.mocked(playSoundEffect).mockClear();
    fs.rmSync(path.join(configDirectory, "settings.json"), { force: true });
    vi.spyOn(api, "getRound").mockResolvedValue({ collectionClozeSentences: [sentence], wordBank: [] });
    vi.spyOn(api, "saveAnswer").mockResolvedValue({ languagePairing: progress });
  });

  it("asks for a round as long as the round length setting", async () => {
    renderPlay("multiple_choice", { roundLength: 30 });
    await eventually(() => expect(api.getRound).toHaveBeenCalledWith(expect.objectContaining({ roundLength: 30 })));
  });

  it("fills in a correct answer in green and finishes the round", async () => {
    const { lastFrame, stdin } = renderPlay("multiple_choice");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, stripAnsi(lastFrame()!).match(/(\d) mucha/)![1]);
    await waitForText(lastFrame, "enter to continue");

    expect(showsInColor(lastFrame()!, "mucha", "brand")).toBe(true);
    await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "multiple_choice" })));

    await press(stdin, ENTER);
    await waitForText(lastFrame, "Round complete!");
    await eventually(() => {
      const summary = stripAnsi(lastFrame()!);
      expect(summary).toMatch(/1\s+0\s+100%/);
      expect(summary).toContain("40/100 points today");
      expect(summary).toContain("12 day streak");
      expect(summary).toContain("✓ Tengo mucha hambre.");
    });
  });

  it("shows a wrong answer in red with the right one in green below", async () => {
    const app = renderPlay("text_input");
    const { lastFrame } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "poco");
    await waitForText(lastFrame, "enter to continue");

    expect(showsInColor(lastFrame()!, "poco", "danger")).toBe(true);
    expect(showsInColor(lastFrame()!, "mucha", "brand")).toBe(true);
    expect(stripAnsi(lastFrame()!)).not.toContain("answer was");
  });

  it("shows the sentence's mastery after answering", async () => {
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, level: 2 }], wordBank: [] });
    const app = renderPlay("text_input");
    const { lastFrame } = app;
    await waitForRoundToLoad(lastFrame);
    expect(stripAnsi(lastFrame()!)).not.toContain("mastered");

    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "✔ ✔ ✔ ✔ 75% mastered");
    expect(showsInColor(lastFrame()!, "✔ ✔ ✔ ", "brand")).toBe(true);
  });

  it("resets mastery to nothing on a miss", async () => {
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, level: 3 }], wordBank: [] });
    const app = renderPlay("text_input");
    await waitForRoundToLoad(app.lastFrame);
    await submitAnswer(app, "poco");
    await waitForText(app.lastFrame, "0% mastered");
  });

  it("shows mastery before answering with that setting on", async () => {
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, level: 1 }], wordBank: [] });
    const { lastFrame } = renderPlay("text_input", { masteryBeforeAnswering: true });
    await waitForRoundToLoad(lastFrame);
    expect(stripAnsi(lastFrame()!)).toContain("25% mastered");
  });

  it("sends a missed sentence to the back of the round", async () => {
    const app = renderPlay("text_input");
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "poco");
    await waitForText(lastFrame, "enter to continue");
    await press(stdin, ENTER);
    await waitForText(lastFrame, "type the missing word");

    expect(stripAnsi(lastFrame()!)).toContain("2/2");
    expect(lastFrame()).toContain("I'm very hungry.");

    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "enter to continue");
    await press(stdin, ENTER);
    await waitForText(lastFrame, "Round complete!");
    expect(stripAnsi(lastFrame()!)).toMatch(/1\s+1\s+50%/);
    expect(stripAnsi(lastFrame()!)).toContain("✗ Tengo mucha hambre.");
  });

  it("scores a missed sentence's retry at half, like the server does once it's due tomorrow", async () => {
    const app = renderPlay("text_input");
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "poco");
    await waitForText(lastFrame, "enter to continue");
    await press(stdin, ENTER);
    await waitForText(lastFrame, "type the missing word");
    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "enter to continue");
    await press(stdin, ENTER);
    await waitForText(lastFrame, "+4 points");
  });

  it("ignores enter with nothing typed", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, ENTER);
    expect(api.saveAnswer).not.toHaveBeenCalled();
  });

  it("clears a save error once a later answer saves", async () => {
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [sentence, { ...sentence, id: 8 }], wordBank: [] });
    vi.mocked(api.saveAnswer).mockRejectedValueOnce(new Error("offline"));
    const app = renderPlay("text_input");
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "Couldn't save an answer: offline");

    await press(stdin, ENTER);
    await waitForText(lastFrame, "type the missing word");
    await submitAnswer(app, "mucha");
    await eventually(() => expect(stripAnsi(lastFrame()!)).not.toContain("Couldn't save"));
  });

  it("colours typing red once it stops matching", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, "muc");
    await waitForText(lastFrame, "❯ muc");
    expect(showsInColor(lastFrame()!, "muc", "brand")).toBe(true);
    await press(stdin, "x");
    await waitForText(lastFrame, "❯ mucx");
    expect(showsInColor(lastFrame()!, "mucx", "danger")).toBe(true);
  });

  it("nudges a near miss once before grading it", async () => {
    const app = renderPlay("text_input");
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "mucah");
    await waitForText(lastFrame, "Off by 2 letters");
    expect(api.saveAnswer).not.toHaveBeenCalled();

    await press(stdin, ENTER);
    await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: false })));
  });

  it("grades a near miss straight away with spelling hints off", async () => {
    const app = renderPlay("text_input", { spellingHints: false });
    await waitForRoundToLoad(app.lastFrame);
    await submitAnswer(app, "mucah");
    await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: false })));
  });

  it("hides the translation until answering when set to after", async () => {
    const app = renderPlay("text_input", { translation: "after" });
    const { lastFrame } = app;
    await waitForRoundToLoad(lastFrame);
    expect(lastFrame()).not.toContain("I'm very hungry.");
    await submitAnswer(app, "mucha");
    await eventually(() => expect(lastFrame()).toContain("I'm very hungry."));
  });

  it("reveals a flashcard and saves the self-grade", async () => {
    const { lastFrame, stdin } = renderPlay("flashcard");
    await waitForRoundToLoad(lastFrame);
    expect(stripAnsi(lastFrame()!)).not.toContain("mucha");

    await press(stdin, " ");
    await waitForText(lastFrame, "Tengo mucha hambre.");

    await press(stdin, "2");
    await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "flashcard" })));
    await waitForText(lastFrame, "Round complete!");
  });

  it("shows a flashcard's first letter for a hint, once, and halves the points", async () => {
    const { lastFrame, stdin } = renderPlay("flashcard");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, RIGHT_ARROW, RIGHT_ARROW);
    await waitForText(lastFrame, "Tengo m____ hambre.");
    expect(stripAnsi(lastFrame()!)).not.toContain("→ hint");

    await press(stdin, " ");
    await waitForText(lastFrame, "Known");
    await press(stdin, "2");
    await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, usedHint: true })));
    await waitForText(lastFrame, "+2 points");
  });

  it("marks a revealed flashcard as known without grading it", async () => {
    vi.spyOn(api, "markSentenceKnown").mockResolvedValue();
    const { lastFrame, stdin } = renderPlay("flashcard");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, " ");
    await waitForText(lastFrame, "k Known");

    await press(stdin, "k");
    await eventually(() => expect(api.markSentenceKnown).toHaveBeenCalledWith({ sentence, upsertUrl: "https://example.com/upsert" }));
    await waitForText(lastFrame, "Round complete!");
    expect(api.saveAnswer).not.toHaveBeenCalled();
  });

  it("doesn't switch mode once a flashcard is revealed", async () => {
    const onToggleMode = vi.fn();
    const { lastFrame, stdin } = renderPlay("flashcard", {}, { onToggleMode });
    await waitForRoundToLoad(lastFrame);
    await press(stdin, " ");
    await waitForText(lastFrame, "Known");
    await press(stdin, "\t");
    expect(onToggleMode).not.toHaveBeenCalled();
  });

  it("goes back to the previous flashcard and only saves the final grade", async () => {
    const second = { ...sentence, id: 8, text: "Tengo {{sueño}}.", translation: "I'm sleepy." };
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [sentence, second], wordBank: [] });
    const { lastFrame, stdin } = renderPlay("flashcard");
    await waitForRoundToLoad(lastFrame);

    await press(stdin, " ");
    await waitForText(lastFrame, "Known");
    await press(stdin, "1");
    await waitForText(lastFrame, "2/3");
    await press(stdin, "b");
    await waitForText(lastFrame, "1/2");
    expect(stripAnsi(lastFrame()!)).toContain("Tengo mucha hambre.");

    await press(stdin, "2");
    await waitForText(lastFrame, "2/2");
    await press(stdin, " ");
    await waitForText(lastFrame, "Known");
    await press(stdin, "2");
    await eventually(() =>
      expect(vi.mocked(api.saveAnswer).mock.calls.map(([saved]) => [saved.sentence.id, saved.correct])).toEqual([
        [7, true],
        [8, true],
      ]),
    );
  });

  it("fills in the next letter for a hint and halves the points", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, "mx");
    await waitForText(lastFrame, "❯ mx");
    await press(stdin, RIGHT_ARROW);
    await waitForText(lastFrame, "❯ mu");
    await press(stdin, "cha");
    await waitForText(lastFrame, "❯ mucha");
    await press(stdin, ENTER);
    await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, usedHint: true })));
    await waitForText(lastFrame, "enter to continue");
    await press(stdin, ENTER);
    await waitForText(lastFrame, "+4 points");
  });

  it("gives only one hint per sentence", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, RIGHT_ARROW);
    await waitForText(lastFrame, "❯ m");
    await press(stdin, RIGHT_ARROW);
    const frame = stripAnsi(lastFrame()!);
    expect(frame).toContain("❯ m\n");
    expect(frame).not.toContain("→ hint");
  });

  it("shows the explanation after answering", async () => {
    const explained = {
      ...sentence,
      structuredExplanation: {
        alternative: null,
        breakdown: [{ features: ["feminine", "singular"], gloss: "a lot of", lemma: "mucho", note: "Agrees with hambre.", pos: "determiner", reading: null, surface: "mucha" }],
        literalTranslation: "I have much hunger.",
        sections: [{ body: "Hambre is feminine.", examples: [], type: "pitfall" as const }],
        sentenceReading: null,
        translation: "I'm very hungry.",
      },
    };
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [explained], wordBank: [] });
    const app = renderPlay("text_input");
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "e explain");

    await press(stdin, "e");
    await waitForText(lastFrame, "Literally");
    const frame = stripAnsi(lastFrame()!);
    expect(frame).toContain("Explanation");
    expect(frame).toContain("mucha a lot of");
    expect(frame).toContain("mucho · determiner, feminine, singular");

    await press(stdin, ...Array<string>(10).fill(DOWN));
    await eventually(() => expect(stripAnsi(lastFrame()!)).toContain("Common mistake"));
  });

  it("scrolls an explanation too long for the terminal", async () => {
    const word = (index: number) => ({ features: [], gloss: `gloss ${index}`, lemma: `word${index}`, note: null, pos: "noun", reading: null, surface: `word${index}` });
    const explained = {
      ...sentence,
      structuredExplanation: {
        alternative: null,
        breakdown: Array.from({ length: 20 }, (_, index) => word(index)),
        literalTranslation: null,
        sections: [],
        sentenceReading: null,
        translation: "I'm very hungry.",
      },
    };
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [explained], wordBank: [] });
    const { lastFrame, stdin } = renderPlay("multiple_choice");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, stripAnsi(lastFrame()!).match(/(\d) mucha/)![1]);
    await waitForText(lastFrame, "e explain");
    await press(stdin, "e");
    await waitForText(lastFrame, "↑↓ scroll · 0%");
    expect(stripAnsi(lastFrame()!)).not.toContain("word19");

    await press(stdin, ...Array<string>(40).fill(DOWN));
    await eventually(() => {
      expect(stripAnsi(lastFrame()!)).toContain("word19");
      expect(stripAnsi(lastFrame()!)).toContain("↑↓ scroll · 100%");
    });
  });

  it("doesn't offer explain when there's nothing to explain", async () => {
    const app = renderPlay("text_input");
    await waitForRoundToLoad(app.lastFrame);
    await submitAnswer(app, "mucha");
    await waitForText(app.lastFrame, "enter to continue");
    expect(stripAnsi(app.lastFrame()!)).not.toContain("explain");
  });

  it("plays the sentence after answering and replays it with p", async () => {
    const app = renderPlay("text_input");
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    expect(playSentenceAudio).not.toHaveBeenCalled();

    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "p replay");
    await eventually(() => expect(playSentenceAudio).toHaveBeenCalledWith(sentence));

    await press(stdin, "p");
    await eventually(() => expect(playSentenceAudio).toHaveBeenCalledTimes(2));
  });

  it("replays the sentence at half speed with h", async () => {
    const app = renderPlay("text_input");
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "h half speed");

    await press(stdin, "h");
    expect(playSentenceAudioAtHalfSpeed).toHaveBeenCalledWith(sentence);
  });

  it("reveals a listening sentence once it has played at half speed", async () => {
    vi.mocked(playSentenceAudio).mockResolvedValueOnce(false);
    const { lastFrame, stdin } = renderPlay("listening");
    await waitForText(lastFrame, "Listen…");

    await press(stdin, "h");
    expect(playSentenceAudioAtHalfSpeed).toHaveBeenCalledWith(sentence);
    await eventually(() => expect(stripAnsi(lastFrame()!)).not.toContain("Listen…"));
  });

  it("downloads the sentence's audio before it's answered", async () => {
    vi.mocked(preloadSentenceAudio).mockClear();
    renderPlay("text_input");

    await eventually(() => expect(preloadSentenceAudio).toHaveBeenCalledWith(sentence));
    expect(playSentenceAudio).not.toHaveBeenCalled();
  });

  it("plays a flashcard's sentence once it's revealed", async () => {
    const { lastFrame, stdin } = renderPlay("flashcard");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, " ");

    await eventually(() => expect(playSentenceAudio).toHaveBeenCalledWith(sentence));
  });

  it("stays silent with audio off", async () => {
    const app = renderPlay("text_input", { audio: false });
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "enter to continue");
    await press(stdin, "p");

    expect(playSentenceAudio).not.toHaveBeenCalled();
    expect(stripAnsi(lastFrame()!)).not.toContain("p replay");
  });

  it("hides a listening sentence until its audio has played", async () => {
    let finishPlaying = (_hasFinished: boolean) => {};
    vi.mocked(playSentenceAudio).mockReturnValueOnce(new Promise((resolve) => (finishPlaying = resolve)));
    const { lastFrame } = renderPlay("listening");
    await waitForText(lastFrame, "Listen…");
    await eventually(() => expect(playSentenceAudio).toHaveBeenCalledWith(sentence));
    expect(stripAnsi(lastFrame()!)).not.toContain("Tengo");

    finishPlaying(true);
    await waitForText(lastFrame, "Tengo");
  });

  it("keeps a listening sentence hidden when its audio is cut short", async () => {
    vi.mocked(playSentenceAudio).mockResolvedValueOnce(false);
    const { lastFrame } = renderPlay("listening");
    await waitForText(lastFrame, "Listen…");
    await eventually(() => expect(playSentenceAudio).toHaveBeenCalled());
    await vi.mocked(playSentenceAudio).mock.results[0].value;
    expect(stripAnsi(lastFrame()!)).toContain("Listen…");
    expect(stripAnsi(lastFrame()!)).toContain("p replay");
    expect(stripAnsi(lastFrame()!)).not.toContain("type the missing word");
  });

  it("types the word for a listening sentence and scores it like text input", async () => {
    const app = renderPlay("listening", { audio: false });
    const { lastFrame, stdin } = app;
    await waitForText(lastFrame, "type the missing word");
    await submitAnswer(app, "mucha");

    await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "listening" })));
    await waitForText(lastFrame, "enter to continue");
    await press(stdin, ENTER);
    await waitForText(lastFrame, "+8 points");
  });

  it("chimes for a right answer, then plays the sentence, then the round's done sound", async () => {
    const app = renderPlay("text_input");
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "mucha");
    await eventually(() => expect(playSoundEffect).toHaveBeenCalledWith("correct"));
    await eventually(() => expect(playSentenceAudio).toHaveBeenCalledWith(sentence));

    await waitForText(lastFrame, "enter to continue");
    await press(stdin, ENTER);
    await eventually(() => expect(playSoundEffect).toHaveBeenLastCalledWith("success"));
  });

  it("lets the round's done sound play out at the end of a listening round", async () => {
    const app = renderPlay("listening");
    const { lastFrame, stdin } = app;
    await waitForText(lastFrame, "type the missing word");
    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "enter to continue");
    await press(stdin, ENTER);

    await eventually(() => expect(playSoundEffect).toHaveBeenLastCalledWith("success"));
    expect(playSentenceAudio).not.toHaveBeenCalledWith(undefined);
  });

  it("doesn't chime for a wrong answer", async () => {
    const app = renderPlay("text_input");
    await waitForRoundToLoad(app.lastFrame);
    await submitAnswer(app, "poco");
    await eventually(() => expect(playSentenceAudio).toHaveBeenCalledWith(sentence));
    expect(playSoundEffect).not.toHaveBeenCalled();
  });

  it("plays no sound effects with them turned off", async () => {
    const app = renderPlay("text_input", { soundEffects: false });
    const { lastFrame, stdin } = app;
    await waitForRoundToLoad(lastFrame);
    await submitAnswer(app, "mucha");
    await waitForText(lastFrame, "enter to continue");
    await press(stdin, ENTER);
    await waitForText(lastFrame, "Round complete!");
    await eventually(() => expect(playSentenceAudio).toHaveBeenCalledWith(sentence));
    expect(playSoundEffect).not.toHaveBeenCalled();
  });

  it("opens settings mid-round and comes back to the same sentence", async () => {
    const { lastFrame, stdin } = renderPlay("multiple_choice");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, "s");
    await waitForText(lastFrame, "Settings");

    await press(stdin, ESCAPE);
    await waitForText(lastFrame, "I'm very hungry.");
  });

  it("types s into a text answer instead of opening settings", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await waitForRoundToLoad(lastFrame);
    await press(stdin, "s");
    await waitForText(lastFrame, "❯ s");

    expect(stripAnsi(lastFrame()!)).not.toContain("Settings");
  });

  describe("editing the card", () => {
    beforeEach(() => {
      vi.spyOn(api, "isProSubscriber").mockResolvedValue(true);
      vi.spyOn(api, "updateSentence").mockResolvedValue();
    });

    it("saves a fixed translation and shows it on the card", async () => {
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");
      await waitForText(lastFrame, "t edit translation");
      await press(stdin, "t");
      await waitForText(lastFrame, "enter done");
      await press(stdin, " Really.");
      await waitForText(lastFrame, "I'm very hungry. Really.");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "enter save");
      await press(stdin, ENTER);

      await eventually(() =>
        expect(api.updateSentence).toHaveBeenCalledWith({
          sentence: expect.objectContaining({ id: 7, text: sentence.text, translation: "I'm very hungry. Really." }),
          upsertUrl: "https://example.com/upsert",
        }),
      );
      await waitForText(lastFrame, "1-4 to answer");
      expect(stripAnsi(lastFrame()!)).toContain("I'm very hungry. Really.");
    });

    it("deletes a sentence from the user's own collection and moves on to the next card", async () => {
      vi.spyOn(api, "deleteSentence").mockResolvedValue();
      const ownSentence = { ...sentence, url: "https://example.com/ccs/7" };
      const nextSentence = { ...sentence, id: 8, text: "Tengo {{poco}} tiempo.", translation: "I have little time." };
      vi.mocked(api.getRound).mockResolvedValue({ collection: { isEditable: true }, collectionClozeSentences: [ownSentence, nextSentence], wordBank: [] });
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");
      await waitForText(lastFrame, "d delete");
      await press(stdin, "d");
      await waitForText(lastFrame, "Delete this sentence");
      await press(stdin, "y");

      await eventually(() => expect(api.deleteSentence).toHaveBeenCalledWith(ownSentence));
      await waitForText(lastFrame, "I have little time.");
    });

    it("keeps the sentence when the delete isn't confirmed", async () => {
      vi.spyOn(api, "deleteSentence").mockResolvedValue();
      vi.mocked(api.getRound).mockResolvedValue({ collection: { isEditable: true }, collectionClozeSentences: [{ ...sentence, url: "https://example.com/ccs/7" }], wordBank: [] });
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");
      await waitForText(lastFrame, "d delete");
      await press(stdin, "d");
      await waitForText(lastFrame, "Delete this sentence");
      await press(stdin, "n");
      await eventually(() => expect(stripAnsi(lastFrame()!)).not.toContain("Delete this sentence"));

      expect(api.deleteSentence).not.toHaveBeenCalled();
    });

    it("only offers the translation in a collection the user doesn't own", async () => {
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");
      await waitForText(lastFrame, "Only the translation can be changed");

      expect(stripAnsi(lastFrame()!)).not.toContain("e edit sentence");
      expect(stripAnsi(lastFrame()!)).not.toContain("d delete");
    });

    it("asks free users to upgrade", async () => {
      vi.mocked(api.isProSubscriber).mockResolvedValue(false);
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");

      await waitForText(lastFrame, "Editing sentences needs Clozemaster Pro.");
    });
  });

  describe("hints", () => {
    // The hints are the last line, which wraps when it's longer than the terminal.
    function expectHints(frame: string, hints: string) {
      expect(unwrapped(frame)).toMatch(new RegExp(`(?<!·) ${hints.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    }

    it("shows how to answer multiple choice", async () => {
      const { lastFrame } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      expectHints(lastFrame()!, "1-4 to answer · tab: text input · s settings · c edit card · esc back");
    });

    it("shows how to answer text input", async () => {
      const { lastFrame } = renderPlay("text_input");
      await waitForRoundToLoad(lastFrame);
      expectHints(lastFrame()!, "→ hint · ↑ accent · tab: listening · esc back");
    });

    it("drops the hint once it's used", async () => {
      const { lastFrame, stdin } = renderPlay("text_input");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, RIGHT_ARROW);
      await waitForText(lastFrame, "❯ m");
      expectHints(lastFrame()!, "↑ accent · tab: listening · esc back");
    });

    it("shows how to continue after answering", async () => {
      const app = renderPlay("text_input");
      await waitForRoundToLoad(app.lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(app.lastFrame, "enter to continue");
      expectHints(app.lastFrame()!, "enter to continue · p replay · h half speed · s settings · c edit card · esc back");
    });

    it("leaves out replaying after answering with audio off", async () => {
      const app = renderPlay("text_input", { audio: false });
      await waitForRoundToLoad(app.lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(app.lastFrame, "enter to continue");
      expectHints(app.lastFrame()!, "enter to continue · s settings · c edit card · esc back");
    });

    it("offers to explain and then hide the explanation", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, explanation: "Because." }], wordBank: [] });
      const app = renderPlay("text_input");
      const { lastFrame, stdin } = app;
      await waitForRoundToLoad(lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(lastFrame, "e explain");
      expectHints(lastFrame()!, "enter to continue · p replay · h half speed · e explain · s settings · c edit card · esc back");
      await press(stdin, "e");
      await waitForText(lastFrame, "e hide explanation");
      expectHints(lastFrame()!, "enter to continue · p replay · h half speed · e hide explanation · s settings · c edit card · esc back");
    });

    it("leaves out editing when the round doesn't say where the sentence is", async () => {
      const { lastFrame } = renderPlay("multiple_choice", {}, { choice: unknownCollectionChoice });
      await waitForRoundToLoad(lastFrame);
      expectHints(lastFrame()!, "1-4 to answer · tab: text input · s settings · esc back");
    });

    it("shows how to reveal a flashcard", async () => {
      const { lastFrame } = renderPlay("flashcard");
      await waitForRoundToLoad(lastFrame);
      expectHints(lastFrame()!, "→ hint · space to reveal · tab: multiple choice · s settings · c edit card · esc back");
    });

    it("shows replay but not switching mode once a flashcard is revealed", async () => {
      const { lastFrame, stdin } = renderPlay("flashcard");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, " ");
      await waitForText(lastFrame, "Known");
      expectHints(lastFrame()!, "p replay · h half speed · s settings · c edit card · esc back");
    });

    it("offers the previous flashcard after grading one", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [sentence, { ...sentence, id: 8 }], wordBank: [] });
      const { lastFrame, stdin } = renderPlay("flashcard");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, " ");
      await waitForText(lastFrame, "Known");
      await press(stdin, "2");
      await waitForText(lastFrame, "b previous card");
      expectHints(lastFrame()!, "→ hint · space to reveal · b previous card · tab: multiple choice · s settings · c edit card · esc back");
    });

    it("only offers replay while listening", async () => {
      vi.mocked(playSentenceAudio).mockResolvedValueOnce(false);
      const { lastFrame } = renderPlay("listening");
      await waitForRoundToLoad(lastFrame);
      expectHints(lastFrame()!, "p replay · h half speed · esc back");
    });

    it("shows how to answer once the listening sentence has played", async () => {
      const { lastFrame } = renderPlay("listening");
      await waitForText(lastFrame, "tab: flashcards");
      expectHints(lastFrame()!, "→ hint · ↑ accent · tab: flashcards · esc back");
    });
  });

  describe("loading and leaving the round", () => {

    it("says when there's nothing to play and goes back on esc", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [], wordBank: [] });
      const onMenu = vi.fn();
      const { lastFrame, stdin } = renderPlay("text_input", {}, { onMenu });
      await waitForText(lastFrame, "Nothing to play in Core 1,000 Collection right now.");
      await press(stdin, ESCAPE);
      expect(onMenu).toHaveBeenCalled();
    });

    it("shows a failure to load and goes back on esc", async () => {
      vi.mocked(api.getRound).mockRejectedValue(new Error("offline"));
      const onMenu = vi.fn();
      const { lastFrame, stdin } = renderPlay("text_input", {}, { onMenu });
      await waitForText(lastFrame, "offline");
      await press(stdin, ESCAPE);
      expect(onMenu).toHaveBeenCalled();
    });

    it("says what it's loading", async () => {
      vi.mocked(api.getRound).mockReturnValue(new Promise(() => {}));
      const { lastFrame } = renderPlay("text_input");
      await waitForText(lastFrame, "Loading Core 1,000 Collection…");
    });

    it("asks for the round in the mode being played", async () => {
      renderPlay("listening");
      await eventually(() => expect(api.getRound).toHaveBeenCalledWith({ mode: "listening", playDataUrl: choice.playDataUrl, roundLength: 10, scope: undefined }));
    });

    it("loads a new round when switching to listening", async () => {
      const { lastFrame, switchMode } = renderPlay("text_input");
      await waitForRoundToLoad(lastFrame);
      switchMode("listening");
      await eventually(() => expect(api.getRound).toHaveBeenCalledTimes(2));
    });

    it("keeps the round when switching between other modes", async () => {
      const { lastFrame, switchMode } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      switchMode("text_input");
      await waitForText(lastFrame, "type the missing word");
      expect(api.getRound).toHaveBeenCalledTimes(1);
    });

    it("switches mode with tab before answering", async () => {
      const onToggleMode = vi.fn();
      const { lastFrame, stdin } = renderPlay("multiple_choice", {}, { onToggleMode });
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "\t");
      expect(onToggleMode).toHaveBeenCalled();
    });

    it("doesn't switch mode once answered", async () => {
      const onToggleMode = vi.fn();
      const app = renderPlay("text_input", {}, { onToggleMode });
      await waitForRoundToLoad(app.lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(app.lastFrame, "enter to continue");
      await press(app.stdin, "\t");
      expect(onToggleMode).not.toHaveBeenCalled();
    });

    it("passes on the saved progress", async () => {
      const onProgress = vi.fn();
      const app = renderPlay("text_input", {}, { onProgress });
      await waitForRoundToLoad(app.lastFrame);
      await submitAnswer(app, "mucha");
      await eventually(() => expect(onProgress).toHaveBeenCalledWith(progress));
    });

    it("goes back mid-round on esc", async () => {
      const onMenu = vi.fn();
      const { lastFrame, stdin } = renderPlay("text_input", {}, { onMenu });
      await waitForRoundToLoad(lastFrame);
      await press(stdin, ESCAPE);
      expect(onMenu).toHaveBeenCalled();
    });

    it("saves a held flashcard grade when going back mid-round", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [sentence, { ...sentence, id: 8 }], wordBank: [] });
      const { lastFrame, stdin } = renderPlay("flashcard");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, " ");
      await waitForText(lastFrame, "Known");
      await press(stdin, "2");
      await waitForText(lastFrame, "2/2");
      expect(api.saveAnswer).not.toHaveBeenCalled();
      await press(stdin, ESCAPE);
      await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "flashcard" })));
    });

    it("closes the explanation on esc without leaving the round", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, explanation: "Because." }], wordBank: [] });
      const onMenu = vi.fn();
      const app = renderPlay("text_input", {}, { onMenu });
      const { lastFrame, stdin } = app;
      await waitForRoundToLoad(lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(lastFrame, "e explain");
      await press(stdin, "e");
      await waitForText(lastFrame, "Because.");
      await press(stdin, ESCAPE);
      await eventually(() => expect(stripAnsi(lastFrame()!)).not.toContain("Because."));
      expect(onMenu).not.toHaveBeenCalled();
    });
  });

  describe("saving", () => {
    it("says when the round doesn't say where to save an answer", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, collectionClozeSentencesAnswerUrl: undefined }], wordBank: [] });
      const app = renderPlay("text_input", {}, { choice: unknownCollectionChoice });
      await waitForRoundToLoad(app.lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(app.lastFrame, "Couldn't save an answer: this round doesn't say which collection the sentence is in.");
    });

    it("saves to the round's answer url when the sentence has none", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, collectionClozeSentencesAnswerUrl: undefined }], wordBank: [] });
      const app = renderPlay("text_input", {}, { choice: { ...choice, answerUrl: "https://example.com/round-answer" } });
      await waitForRoundToLoad(app.lastFrame);
      await submitAnswer(app, "mucha");
      await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ answerUrl: "https://example.com/round-answer" })));
    });

    it("sends the time spent on the sentence", async () => {
      const app = renderPlay("text_input");
      await waitForRoundToLoad(app.lastFrame);
      await submitAnswer(app, "mucha");
      await eventually(() => expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ secondsSpent: 0, sentence, usedHint: false })));
    });

    it("shows a failure to mark a sentence known", async () => {
      vi.spyOn(api, "markSentenceKnown").mockRejectedValue(new Error("offline"));
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [sentence, { ...sentence, id: 8 }], wordBank: [] });
      const { lastFrame, stdin } = renderPlay("flashcard");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, " ");
      await waitForText(lastFrame, "Known");
      await press(stdin, "k");
      await waitForText(lastFrame, "Couldn't save an answer: offline");
    });
  });

  describe("the card", () => {
    it("shows the sentence's hint before answering only", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, hint: "a lot" }], wordBank: [] });
      const app = renderPlay("text_input");
      const { lastFrame } = app;
      await waitForRoundToLoad(lastFrame);
      expect(stripAnsi(lastFrame()!)).toContain("hint: a lot");
      await submitAnswer(app, "mucha");
      await waitForText(lastFrame, "enter to continue");
      expect(stripAnsi(lastFrame()!)).not.toContain("hint: a lot");
    });

    it("hides the sentence's hint with hints off", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, hint: "a lot" }], wordBank: [] });
      const { lastFrame } = renderPlay("text_input", { hints: false });
      await waitForRoundToLoad(lastFrame);
      expect(stripAnsi(lastFrame()!)).not.toContain("hint: a lot");
    });

    it("shows the pronunciation after answering", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, pronunciation: "TEN-go" }], wordBank: [] });
      const app = renderPlay("text_input");
      const { lastFrame } = app;
      await waitForRoundToLoad(lastFrame);
      expect(stripAnsi(lastFrame()!)).not.toContain("TEN-go");
      await submitAnswer(app, "mucha");
      await waitForText(lastFrame, "TEN-go");
    });

    it("hides the pronunciation with it turned off", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, pronunciation: "TEN-go" }], wordBank: [] });
      const app = renderPlay("text_input", { pronunciation: false });
      await waitForRoundToLoad(app.lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(app.lastFrame, "enter to continue");
      expect(stripAnsi(app.lastFrame()!)).not.toContain("TEN-go");
    });

    it("never shows the translation when hidden", async () => {
      const app = renderPlay("text_input", { translation: "hidden" });
      await waitForRoundToLoad(app.lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(app.lastFrame, "enter to continue");
      expect(app.lastFrame()).not.toContain("I'm very hungry.");
    });

    it("shows the blank as underscores the length of the word", async () => {
      const { lastFrame } = renderPlay("text_input");
      await waitForRoundToLoad(lastFrame);
      expect(stripAnsi(lastFrame()!)).toContain("Tengo _____ hambre.");
    });

    it("shows at least three underscores for a short word", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, text: "{{Yo}} tengo hambre." }], wordBank: [] });
      const { lastFrame } = renderPlay("text_input");
      await waitForRoundToLoad(lastFrame);
      expect(stripAnsi(lastFrame()!)).toContain("___ tengo hambre.");
    });

    it("shows the answer in a self-graded flashcard's colour", async () => {
      vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [sentence, { ...sentence, id: 8 }], wordBank: [] });
      const { lastFrame, stdin } = renderPlay("flashcard");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, " ");
      await waitForText(lastFrame, "Known");
      await press(stdin, "1");
      await waitForText(lastFrame, "□□ 2/3");
    });

    it("shows the round's title", async () => {
      const { lastFrame } = renderPlay("text_input");
      await waitForRoundToLoad(lastFrame);
      expect(stripAnsi(lastFrame()!)).toMatch(/Core 1,000 Collection\s+□ 1\/1/);
    });
  });

  describe("the round summary", () => {
    it("lists each sentence once, by its first attempt", async () => {
      const app = renderPlay("text_input");
      const { lastFrame, stdin } = app;
      await waitForRoundToLoad(lastFrame);
      await submitAnswer(app, "poco");
      await waitForText(lastFrame, "enter to continue");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "type the missing word");
      await submitAnswer(app, "mucha");
      await waitForText(lastFrame, "enter to continue");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "Round complete!");
      expect(stripAnsi(lastFrame()!).match(/Tengo mucha hambre\./g)).toHaveLength(1);
    });

    it("shows the time taken and how to go on", async () => {
      const app = renderPlay("text_input");
      const { lastFrame, stdin } = app;
      await waitForRoundToLoad(lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(lastFrame, "enter to continue");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "Round complete!");
      const frame = stripAnsi(lastFrame()!);
      expect(frame).toMatch(/100%\s+0:00/);
      expect(frame).toContain("enter: next round · esc back");
    });

    it("says when the daily goal is reached", async () => {
      vi.mocked(api.saveAnswer).mockResolvedValue({ languagePairing: { ...progress, numPointsToday: 120 } });
      const app = renderPlay("text_input");
      const { lastFrame, stdin } = app;
      await waitForRoundToLoad(lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(lastFrame, "enter to continue");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "120/100 points today · goal reached · 12 day streak");
    });

    it("plays another round with enter", async () => {
      const app = renderPlay("text_input");
      const { lastFrame, stdin } = app;
      await waitForRoundToLoad(lastFrame);
      await submitAnswer(app, "mucha");
      await waitForText(lastFrame, "enter to continue");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "Round complete!");
      await press(stdin, ENTER);
      await eventually(() => expect(api.getRound).toHaveBeenCalledTimes(2));
      await waitForText(lastFrame, "Tengo _____ hambre.");
    });
  });

  describe("editing the sentence text", () => {
    beforeEach(() => {
      vi.spyOn(api, "isProSubscriber").mockResolvedValue(true);
      vi.mocked(api.getRound).mockResolvedValue({ collection: { isEditable: true }, collectionClozeSentences: [sentence], wordBank: [] });
    });

    it("saves an edited sentence in the user's own collection", async () => {
      vi.spyOn(api, "updateSentence").mockResolvedValue();
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");
      await waitForText(lastFrame, "e edit sentence · t edit translation · enter save · esc back");
      await press(stdin, "e");
      await waitForText(lastFrame, "enter done");
      await press(stdin, " Sí.");
      await waitForText(lastFrame, "Sí.");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "enter save");
      await press(stdin, ENTER);
      await eventually(() =>
        expect(api.updateSentence).toHaveBeenCalledWith({
          sentence: expect.objectContaining({ text: "Tengo {{mucha}} hambre. Sí." }),
          upsertUrl: "https://example.com/upsert",
        }),
      );
    });

    it("shows a failure to save the edit", async () => {
      vi.spyOn(api, "updateSentence").mockRejectedValue(new Error("offline"));
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");
      await waitForText(lastFrame, "enter save");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "offline");
    });

    it("shows how to finish editing a field", async () => {
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");
      await waitForText(lastFrame, "t edit translation");
      await press(stdin, "t");
      await waitForText(lastFrame, "enter done · esc stop editing");
      await press(stdin, ESCAPE);
      await waitForText(lastFrame, "t edit translation");
    });

    it("goes back to the card on esc", async () => {
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");
      await waitForText(lastFrame, "t edit translation");
      await press(stdin, ESCAPE);
      await waitForText(lastFrame, "1-4 to answer");
    });

    it("goes back to the card on esc from the upgrade notice", async () => {
      vi.mocked(api.isProSubscriber).mockResolvedValue(false);
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await waitForRoundToLoad(lastFrame);
      await press(stdin, "c");
      await waitForText(lastFrame, "Editing sentences needs Clozemaster Pro.");
      await press(stdin, ESCAPE);
      await waitForText(lastFrame, "1-4 to answer");
    });
  });
});
