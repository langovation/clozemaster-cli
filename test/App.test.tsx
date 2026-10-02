import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { splitCloze } from "../src/answers.js";
import { startFakeServer } from "./fakeServer.js";
import { DOWN, ENTER, ESCAPE, press, settle, stripAnsi } from "./helpers.js";

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));
const pairing = fixture("language_pairings").languagePairings[0];
const collections = fixture("collections").collections;
const collectionRound = fixture("round_collection").collectionClozeSentences;
const core = collections.find((collection: { name: string }) => collection.name === "Core 1,000 Collection");

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

  it("lists only my dashboard collections, custom ones included, in the web's order", async () => {
    const frame = stripAnsi((await openPairing()).lastFrame()!);
    const names = ["Review", "500 Most Common", "Core 1,000 Collection", "My Words", "Verbs"];
    const positions = names.map((name) => frame.indexOf(name));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(frame).not.toContain("Beginner A1");
    expect(frame).not.toContain("Most Common Words");
    expect(frame).toMatch(/My Words\s+3 due/);
  });

  it("asks how to answer after picking a collection, flashcards included", async () => {
    const { lastFrame, stdin } = await openPairing();
    await press(stdin, DOWN, DOWN, ENTER);
    expect(lastFrame()).toContain("How do you want to answer?");
    expect(lastFrame()).toContain("Flashcards");
  });

  it("says when there is nothing to review and goes back on esc", async () => {
    const { lastFrame, stdin } = await openPairing();
    await press(stdin, ENTER, ENTER);
    expect(lastFrame()).toContain("Nothing to play in Review right now");
    await press(stdin, ESCAPE);
    expect(lastFrame()).toContain("What do you want to play?");
  });

  it("plays a full multiple choice round, saving each answer to the collection", async () => {
    const { lastFrame, stdin } = await openPairing();
    await press(stdin, DOWN, DOWN, ENTER, ENTER);

    for (const sentence of collectionRound) {
      const cloze = splitCloze(sentence.text).cloze;
      const optionNumber = stripAnsi(lastFrame()!).match(new RegExp(`(\\d) ${cloze}(\\s|$)`))![1];
      await press(stdin, optionNumber, ENTER);
    }

    expect(stripAnsi(lastFrame()!)).toContain(`${collectionRound.length} correct · 0 missed`);
    expect(server.answers()).toHaveLength(collectionRound.length);
    expect(server.answers().every((answer) => answer.url.toString() === core.collectionClozeSentencesAnswerUrl)).toBe(true);
    expect(server.answers()[0].body).toMatchObject({ correct: true, id: collectionRound[0].id, mode: "multiple_choice" });
  });

  it("plays text input, replaying a miss at the end of the round", async () => {
    const { lastFrame, stdin } = await openPairing();
    await press(stdin, DOWN, DOWN, ENTER, DOWN, ENTER);

    await press(stdin, "nope", ENTER);
    expect(stripAnsi(lastFrame()!)).toContain(`2/${collectionRound.length + 1}`);
    expect(server.answers()[0].body).toMatchObject({ correct: false, id: collectionRound[0].id, mode: "text_input" });
  });
});
