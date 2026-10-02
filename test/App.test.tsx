import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { splitCloze } from "../src/answers.js";
import { startFakeServer } from "./fakeServer.js";

const ENTER = "\r";
const DOWN = "\u001B[B";
const ESCAPE = "\u001B";

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));
const pairing = fixture("language_pairings").languagePairings[0];
const collections = fixture("collections").collections;
const commonWordsRound = fixture("round_frequency_collections").collectionClozeSentences;
const collectionRound = fixture("round_collection").collectionClozeSentences;
const playingCollection = collections.find((collection: { playing: boolean }) => collection.playing);

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

async function press(stdin: { write: (input: string) => void }, ...keys: string[]) {
  for (const key of keys) {
    stdin.write(key);
    await settle();
  }
}

function correctOptionNumber(frame: string, sentence: { text: string }) {
  const cloze = splitCloze(sentence.text).cloze;
  return frame.match(new RegExp(`(\\d) ${cloze}(\\s|$)`))![1];
}

describe("App against recorded API responses", () => {
  let server: ReturnType<typeof startFakeServer>;

  beforeEach(() => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "1:test");
    server = startFakeServer();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function openPairing() {
    const app = render(<App />);
    await settle();
    expect(app.lastFrame()).toContain(`${pairing.targetLanguageName} from ${pairing.baseLanguageName}`);
    await press(app.stdin, ENTER);
    return app;
  }

  it("lists the pairing's collections, playing ones first", async () => {
    const { lastFrame } = await openPairing();
    const frame = lastFrame()!;
    expect(frame).toContain("Review");
    expect(frame).toContain("Most Common Words");
    expect(frame.indexOf(playingCollection.name)).toBeLessThan(frame.indexOf(collections.find((c: { playing: boolean }) => !c.playing).name));
    expect(frame).not.toContain("Cannot read properties");
  });

  it("asks for the answer mode after picking what to play", async () => {
    const { lastFrame, stdin } = await openPairing();
    await press(stdin, DOWN, ENTER);
    expect(lastFrame()).toContain("How do you want to answer?");
  });

  it("says when there is nothing to review and goes back on esc", async () => {
    const { lastFrame, stdin } = await openPairing();
    await press(stdin, ENTER, ENTER);
    expect(lastFrame()).toContain("Nothing to play in Review right now");
    await press(stdin, ESCAPE);
    expect(lastFrame()).toContain("What do you want to play?");
  });

  it("plays a full multiple choice round of Most Common Words", async () => {
    const { lastFrame, stdin } = await openPairing();
    await press(stdin, DOWN, ENTER, ENTER);

    for (const sentence of commonWordsRound) {
      expect(lastFrame()).toContain(sentence.translation);
      await press(stdin, correctOptionNumber(lastFrame()!, sentence));
      expect(lastFrame()).toContain("Correct!");
      await press(stdin, ENTER);
    }

    expect(lastFrame()).toContain("Round complete!");
    expect(lastFrame()).toContain(`${commonWordsRound.length}/${commonWordsRound.length} correct`);
    expect(lastFrame()).toContain("52 points today");
    expect(server.answers().map((answer) => answer.url.pathname)).toEqual(
      commonWordsRound.map((sentence: { collectionClozeSentencesAnswerUrl: string }) => new URL(sentence.collectionClozeSentencesAnswerUrl).pathname),
    );
    expect(server.answers()[0].body).toMatchObject({ correct: true, id: commonWordsRound[0].id, mode: "multiple_choice" });
  });

  it("plays a collection with text input, saving to the collection's answer url", async () => {
    const { lastFrame, stdin } = await openPairing();
    await press(stdin, DOWN, DOWN, ENTER, DOWN, ENTER);
    expect(lastFrame()).toContain(playingCollection.name);

    await press(stdin, ...splitCloze(collectionRound[0].text).cloze, ENTER);
    expect(lastFrame()).toContain("Correct!");
    await press(stdin, ENTER, "nope", ENTER);
    expect(lastFrame()).toContain(`The answer was ${splitCloze(collectionRound[1].text).cloze}`);

    expect(server.answers().map((answer) => answer.body)).toMatchObject([
      { correct: true, id: collectionRound[0].id, mode: "text_input" },
      { correct: false, id: collectionRound[1].id, mode: "text_input" },
    ]);
    expect(server.answers()[0].url.toString()).toBe(playingCollection.collectionClozeSentencesAnswerUrl);
  });
});
