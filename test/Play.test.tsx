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
import { DOWN, ENTER, ESCAPE, press, RIGHT_ARROW, settle, showsInColor, stripAnsi } from "./helpers.js";

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

function renderPlay(mode: api.PlayMode, settings: Partial<Settings> = {}, onToggleMode = vi.fn()) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settings });
  return render(
    <SettingsProvider>
      <Play choice={choice} mode={mode} onMenu={vi.fn()} onProgress={vi.fn()} onToggleMode={onToggleMode} />
    </SettingsProvider>,
  );
}

vi.mock("../src/audio.js", () => ({ playSentenceAudio: vi.fn(async () => true), playSentenceAudioAtHalfSpeed: vi.fn(async () => true), playSoundEffect: vi.fn(async () => true), preloadSentenceAudio: vi.fn(), stopAudio: vi.fn() }));

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

  it("fills in a correct answer in green and finishes the round", async () => {
    const { lastFrame, stdin } = renderPlay("multiple_choice");
    await settle();
    await press(stdin, stripAnsi(lastFrame()!).match(/(\d) mucha/)![1]);

    expect(showsInColor(lastFrame()!, "mucha", "brand")).toBe(true);
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "multiple_choice" }));

    await press(stdin, ENTER);
    const summary = stripAnsi(lastFrame()!);
    expect(summary).toContain("Round complete!");
    expect(summary).toMatch(/1\s+0\s+100%/);
    expect(summary).toContain("40/100 points today");
    expect(summary).toContain("12 day streak");
    expect(summary).toContain("✓ Tengo mucha hambre.");
  });

  it("shows a wrong answer in red with the right one in green below", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "poco", ENTER);

    expect(showsInColor(lastFrame()!, "poco", "danger")).toBe(true);
    expect(showsInColor(lastFrame()!, "mucha", "brand")).toBe(true);
    expect(stripAnsi(lastFrame()!)).not.toContain("answer was");
  });

  it("shows the sentence's mastery after answering", async () => {
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, level: 2 }], wordBank: [] });
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    expect(stripAnsi(lastFrame()!)).not.toContain("mastered");

    await press(stdin, "mucha", ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("✔ ✔ ✔ ✔ 75% mastered");
    expect(showsInColor(lastFrame()!, "✔ ✔ ✔ ", "brand")).toBe(true);
  });

  it("resets mastery to nothing on a miss", async () => {
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, level: 3 }], wordBank: [] });
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "poco", ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("0% mastered");
  });

  it("shows mastery before answering with that setting on", async () => {
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [{ ...sentence, level: 1 }], wordBank: [] });
    const { lastFrame } = renderPlay("text_input", { masteryBeforeAnswering: true });
    await settle();
    expect(stripAnsi(lastFrame()!)).toContain("25% mastered");
  });

  it("sends a missed sentence to the back of the round", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "poco", ENTER, ENTER);

    expect(stripAnsi(lastFrame()!)).toContain("2/2");
    expect(lastFrame()).toContain("I'm very hungry.");

    await press(stdin, "mucha", ENTER, ENTER);
    expect(stripAnsi(lastFrame()!)).toMatch(/1\s+1\s+50%/);
    expect(stripAnsi(lastFrame()!)).toContain("✗ Tengo mucha hambre.");
  });

  it("scores a missed sentence's retry at half, like the server does once it's due tomorrow", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "poco", ENTER, ENTER, "mucha", ENTER, ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("+4 points");
  });

  it("ignores enter with nothing typed", async () => {
    const { stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, ENTER);
    expect(api.saveAnswer).not.toHaveBeenCalled();
  });

  it("clears a save error once a later answer saves", async () => {
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [sentence, { ...sentence, id: 8 }], wordBank: [] });
    vi.mocked(api.saveAnswer).mockRejectedValueOnce(new Error("offline"));
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mucha", ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("Couldn't save an answer: offline");

    await press(stdin, ENTER, "mucha", ENTER);
    expect(stripAnsi(lastFrame()!)).not.toContain("Couldn't save");
  });

  it("colours typing red once it stops matching", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "muc");
    expect(showsInColor(lastFrame()!, "muc", "brand")).toBe(true);
    await press(stdin, "x");
    expect(showsInColor(lastFrame()!, "mucx", "danger")).toBe(true);
  });

  it("nudges a near miss once before grading it", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mucah", ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("Off by 2 letters");
    expect(api.saveAnswer).not.toHaveBeenCalled();

    await press(stdin, ENTER);
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });

  it("grades a near miss straight away with spelling hints off", async () => {
    const { stdin } = renderPlay("text_input", { spellingHints: false });
    await settle();
    await press(stdin, "mucah", ENTER);
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });

  it("hides the translation until answering when set to after", async () => {
    const { lastFrame, stdin } = renderPlay("text_input", { translation: "after" });
    await settle();
    expect(lastFrame()).not.toContain("I'm very hungry.");
    await press(stdin, "mucha", ENTER);
    expect(lastFrame()).toContain("I'm very hungry.");
  });

  it("reveals a flashcard and saves the self-grade", async () => {
    const { lastFrame, stdin } = renderPlay("flashcard");
    await settle();
    expect(stripAnsi(lastFrame()!)).not.toContain("mucha");

    await press(stdin, " ");
    expect(stripAnsi(lastFrame()!)).toContain("Tengo mucha hambre.");

    await press(stdin, "2");
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "flashcard" }));
    expect(stripAnsi(lastFrame()!)).toContain("Round complete!");
  });

  it("shows a flashcard's first letter for a hint, once, and halves the points", async () => {
    const { lastFrame, stdin } = renderPlay("flashcard");
    await settle();
    await press(stdin, RIGHT_ARROW, RIGHT_ARROW);
    expect(stripAnsi(lastFrame()!)).toContain("Tengo m____ hambre.");
    expect(stripAnsi(lastFrame()!)).not.toContain("→ hint");

    await press(stdin, " ", "2");
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, usedHint: true }));
    expect(stripAnsi(lastFrame()!)).toContain("+2 points");
  });

  it("marks a revealed flashcard as known without grading it", async () => {
    vi.spyOn(api, "markSentenceKnown").mockResolvedValue();
    const { lastFrame, stdin } = renderPlay("flashcard");
    await settle();
    await press(stdin, " ");
    expect(stripAnsi(lastFrame()!)).toContain("k Known");

    await press(stdin, "k");
    expect(api.markSentenceKnown).toHaveBeenCalledWith({ sentence, upsertUrl: "https://example.com/upsert" });
    expect(api.saveAnswer).not.toHaveBeenCalled();
    expect(stripAnsi(lastFrame()!)).toContain("Round complete!");
  });

  it("doesn't switch mode once a flashcard is revealed", async () => {
    const onToggleMode = vi.fn();
    const { stdin } = renderPlay("flashcard", {}, onToggleMode);
    await settle();
    await press(stdin, " ", "\t");
    expect(onToggleMode).not.toHaveBeenCalled();
  });

  it("goes back to the previous flashcard and only saves the final grade", async () => {
    const second = { ...sentence, id: 8, text: "Tengo {{sueño}}.", translation: "I'm sleepy." };
    vi.mocked(api.getRound).mockResolvedValue({ collectionClozeSentences: [sentence, second], wordBank: [] });
    const { lastFrame, stdin } = renderPlay("flashcard");
    await settle();

    await press(stdin, " ", "1");
    expect(stripAnsi(lastFrame()!)).toContain("2/3");
    await press(stdin, "b");
    expect(stripAnsi(lastFrame()!)).toContain("Tengo mucha hambre.");
    expect(stripAnsi(lastFrame()!)).toContain("1/2");

    await press(stdin, "2", " ", "2");
    expect(vi.mocked(api.saveAnswer).mock.calls.map(([saved]) => [saved.sentence.id, saved.correct])).toEqual([
      [7, true],
      [8, true],
    ]);
  });

  it("fills in the next letter for a hint and halves the points", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mx", RIGHT_ARROW);
    expect(stripAnsi(lastFrame()!)).toContain("❯ mu");
    await press(stdin, "cha", ENTER);
    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, usedHint: true }));
    await press(stdin, ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("+4 points");
  });

  it("gives only one hint per sentence", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, RIGHT_ARROW, RIGHT_ARROW);
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
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mucha", ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("e explain");

    await press(stdin, "e");
    const frame = stripAnsi(lastFrame()!);
    expect(frame).toContain("Explanation");
    expect(frame).toContain("mucha a lot of");
    expect(frame).toContain("mucho · determiner, feminine, singular");
    expect(frame).toContain("Literally");

    await press(stdin, ...Array<string>(10).fill(DOWN));
    expect(stripAnsi(lastFrame()!)).toContain("Common mistake");
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
    await settle();
    await press(stdin, stripAnsi(lastFrame()!).match(/(\d) mucha/)![1], "e");
    await settle();
    expect(stripAnsi(lastFrame()!)).toContain("↑↓ scroll · 0%");
    expect(stripAnsi(lastFrame()!)).not.toContain("word19");

    await press(stdin, ...Array<string>(40).fill(DOWN));
    expect(stripAnsi(lastFrame()!)).toContain("word19");
    expect(stripAnsi(lastFrame()!)).toContain("↑↓ scroll · 100%");
  });

  it("doesn't offer explain when there's nothing to explain", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mucha", ENTER);
    expect(stripAnsi(lastFrame()!)).not.toContain("explain");
  });

  it("plays the sentence after answering and replays it with p", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    expect(playSentenceAudio).not.toHaveBeenCalled();

    await press(stdin, "mucha", ENTER);
    expect(playSentenceAudio).toHaveBeenCalledWith(sentence);
    expect(stripAnsi(lastFrame()!)).toContain("p replay");

    await press(stdin, "p");
    expect(playSentenceAudio).toHaveBeenCalledTimes(2);
  });

  it("replays the sentence at half speed with h", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mucha", ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("h half speed");

    await press(stdin, "h");
    expect(playSentenceAudioAtHalfSpeed).toHaveBeenCalledWith(sentence);
  });

  it("reveals a listening sentence once it has played at half speed", async () => {
    vi.mocked(playSentenceAudio).mockResolvedValueOnce(false);
    const { lastFrame, stdin } = renderPlay("listening");
    await settle();
    expect(stripAnsi(lastFrame()!)).toContain("Listen…");

    await press(stdin, "h");
    expect(playSentenceAudioAtHalfSpeed).toHaveBeenCalledWith(sentence);
    expect(stripAnsi(lastFrame()!)).not.toContain("Listen…");
  });

  it("downloads the sentence's audio before it's answered", async () => {
    vi.mocked(preloadSentenceAudio).mockClear();
    renderPlay("text_input");
    await settle();

    expect(preloadSentenceAudio).toHaveBeenCalledWith(sentence);
    expect(playSentenceAudio).not.toHaveBeenCalled();
  });

  it("plays a flashcard's sentence once it's revealed", async () => {
    const { stdin } = renderPlay("flashcard");
    await settle();
    await press(stdin, " ");

    expect(playSentenceAudio).toHaveBeenCalledWith(sentence);
  });

  it("stays silent with audio off", async () => {
    const { lastFrame, stdin } = renderPlay("text_input", { audio: false });
    await settle();
    await press(stdin, "mucha", ENTER, "p");

    expect(playSentenceAudio).not.toHaveBeenCalled();
    expect(stripAnsi(lastFrame()!)).not.toContain("p replay");
  });

  it("hides a listening sentence until its audio has played", async () => {
    let finishPlaying = (_hasFinished: boolean) => {};
    vi.mocked(playSentenceAudio).mockReturnValueOnce(new Promise((resolve) => (finishPlaying = resolve)));
    const { lastFrame } = renderPlay("listening");
    await settle();
    expect(playSentenceAudio).toHaveBeenCalledWith(sentence);
    expect(stripAnsi(lastFrame()!)).toContain("Listen…");
    expect(stripAnsi(lastFrame()!)).not.toContain("Tengo");

    finishPlaying(true);
    await settle();
    expect(stripAnsi(lastFrame()!)).toContain("Tengo");
  });

  it("keeps a listening sentence hidden when its audio is cut short", async () => {
    vi.mocked(playSentenceAudio).mockResolvedValueOnce(false);
    const { lastFrame } = renderPlay("listening");
    await settle();
    expect(stripAnsi(lastFrame()!)).toContain("Listen…");
    expect(stripAnsi(lastFrame()!)).toContain("p replay");
    expect(stripAnsi(lastFrame()!)).not.toContain("type the missing word");
  });

  it("types the word for a listening sentence and scores it like text input", async () => {
    const { lastFrame, stdin } = renderPlay("listening", { audio: false });
    await settle();
    await press(stdin, "mucha", ENTER);

    expect(api.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true, mode: "listening" }));
    await press(stdin, ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("+8 points");
  });

  it("chimes for a right answer, then plays the sentence, then the round's done sound", async () => {
    const { stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "mucha", ENTER);
    expect(playSoundEffect).toHaveBeenCalledWith("correct");
    expect(playSentenceAudio).toHaveBeenCalledWith(sentence);

    await press(stdin, ENTER);
    expect(playSoundEffect).toHaveBeenLastCalledWith("success");
  });

  it("doesn't chime for a wrong answer", async () => {
    const { stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "poco", ENTER);
    expect(playSoundEffect).not.toHaveBeenCalled();
  });

  it("plays no sound effects with them turned off", async () => {
    const { stdin } = renderPlay("text_input", { soundEffects: false });
    await settle();
    await press(stdin, "mucha", ENTER, ENTER);
    expect(playSoundEffect).not.toHaveBeenCalled();
    expect(playSentenceAudio).toHaveBeenCalledWith(sentence);
  });

  it("opens settings mid-round and comes back to the same sentence", async () => {
    const { lastFrame, stdin } = renderPlay("multiple_choice");
    await settle();
    await press(stdin, "s");
    expect(stripAnsi(lastFrame()!)).toContain("Settings");

    await press(stdin, ESCAPE);
    expect(stripAnsi(lastFrame()!)).toContain("I'm very hungry.");
  });

  it("types s into a text answer instead of opening settings", async () => {
    const { lastFrame, stdin } = renderPlay("text_input");
    await settle();
    await press(stdin, "s");

    expect(stripAnsi(lastFrame()!)).not.toContain("Settings");
  });

  describe("editing the card", () => {
    beforeEach(() => {
      vi.spyOn(api, "isProSubscriber").mockResolvedValue(true);
      vi.spyOn(api, "updateSentence").mockResolvedValue();
    });

    it("saves a fixed translation and shows it on the card", async () => {
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await settle();
      await press(stdin, "c", "t", " Really.", ENTER, ENTER);

      expect(api.updateSentence).toHaveBeenCalledWith({
        sentence: expect.objectContaining({ id: 7, text: sentence.text, translation: "I'm very hungry. Really." }),
        upsertUrl: "https://example.com/upsert",
      });
      expect(stripAnsi(lastFrame()!)).toContain("I'm very hungry. Really.");
    });

    it("deletes a sentence from the user's own collection and moves on to the next card", async () => {
      vi.spyOn(api, "deleteSentence").mockResolvedValue();
      const ownSentence = { ...sentence, url: "https://example.com/ccs/7" };
      const nextSentence = { ...sentence, id: 8, text: "Tengo {{poco}} tiempo.", translation: "I have little time." };
      vi.mocked(api.getRound).mockResolvedValue({ collection: { isEditable: true }, collectionClozeSentences: [ownSentence, nextSentence], wordBank: [] });
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await settle();
      await press(stdin, "c", "d", "y");

      expect(api.deleteSentence).toHaveBeenCalledWith(ownSentence);
      expect(stripAnsi(lastFrame()!)).toContain("I have little time.");
    });

    it("keeps the sentence when the delete isn't confirmed", async () => {
      vi.spyOn(api, "deleteSentence").mockResolvedValue();
      vi.mocked(api.getRound).mockResolvedValue({ collection: { isEditable: true }, collectionClozeSentences: [{ ...sentence, url: "https://example.com/ccs/7" }], wordBank: [] });
      const { stdin } = renderPlay("multiple_choice");
      await settle();
      await press(stdin, "c", "d", "n");

      expect(api.deleteSentence).not.toHaveBeenCalled();
    });

    it("only offers the translation in a collection the user doesn't own", async () => {
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await settle();
      await press(stdin, "c");

      expect(stripAnsi(lastFrame()!)).toContain("Only the translation can be changed");
      expect(stripAnsi(lastFrame()!)).not.toContain("e edit sentence");
      expect(stripAnsi(lastFrame()!)).not.toContain("d delete");
    });

    it("asks free users to upgrade", async () => {
      vi.mocked(api.isProSubscriber).mockResolvedValue(false);
      const { lastFrame, stdin } = renderPlay("multiple_choice");
      await settle();
      await press(stdin, "c");

      expect(stripAnsi(lastFrame()!)).toContain("Editing sentences needs Clozemaster Pro.");
    });
  });
});
