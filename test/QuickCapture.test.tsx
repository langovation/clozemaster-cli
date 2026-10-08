import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import { App } from "../src/App.js";
import { configDirectory } from "../src/config.js";
import { startFakeServer } from "./fakeServer.js";
import { DOWN, ENTER, ESCAPE, press, RIGHT_ARROW, stripAnsi, unwrapped, waitForText } from "./helpers.js";

const TAB = "\t";

describe("Quick Capture", () => {
  let server: ReturnType<typeof startFakeServer>;

  function startServer(options?: Parameters<typeof startFakeServer>[0]) {
    fs.rmSync(path.join(configDirectory, "settings.json"), { force: true });
    vi.stubEnv("CLOZEMASTER_TOKEN", "1:test");
    server = startFakeServer(options);
  }

  beforeEach(() => startServer());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function openQuickCapture() {
    const app = render(<App />);
    await waitForText(app.lastFrame, "What are you learning today?");
    await press(app.stdin, ENTER);
    await waitForText(app.lastFrame, "What do you want to play?");
    await press(app.stdin, "c");
    await waitForText(app.lastFrame, "Nothing captured yet.");
    return app;
  }

  it("saves a typed word and lists it with its translation", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    expect(server.quickCaptureEntries().map((entry) => entry.text)).toEqual(["gato"]);
  });

  it("deletes the picked word", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER, "perro", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, "d");
    await waitForText(lastFrame, "gato (translated)");
    expect(lastFrame()).not.toContain("perro");
    expect(server.quickCaptureEntries().map((entry) => entry.text)).toEqual(["gato"]);
  });

  it("deletes a word added after emptying the list", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, "d", "perro", ENTER);
    await waitForText(lastFrame, "perro (translated)");
    await press(stdin, TAB, "d");
    await waitForText(lastFrame, "Nothing captured yet.");
    expect(server.quickCaptureEntries()).toEqual([]);
  });

  it("shows the example sentence only for the highlighted word", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    expect(lastFrame()).not.toContain("Veo un gato aquí.");
    await press(stdin, TAB);
    await waitForText(lastFrame, "Veo un gato aquí.");
  });

  it("moves the hidden word and edits the translation, then saves", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, ENTER);
    await waitForText(lastFrame, "move the hidden word");
    await press(stdin, RIGHT_ARROW, "t", " Mine.", ENTER, ENTER);
    await waitForText(lastFrame, "I see a gato here. Mine.");

    expect(server.quickCaptureEntries()[0]).toMatchObject({ sentence: "Veo un gato {{aquí}}.", sentenceTranslation: "I see a gato here. Mine." });
  });

  it("imports all words into a picked collection", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER, "perro", ENTER);
    await waitForText(lastFrame, "perro (translated)");
    await press(stdin, TAB, "i");
    await waitForText(lastFrame, "Import all 2 words into a Español collection");
    await press(stdin, DOWN, ENTER);
    await waitForText(lastFrame, "Importing 2 into Travel");

    expect(server.imports()).toEqual([{ collection_id: 6, pin_to_dashboard: true, quick_capture_entry_ids: ["2", "1"] }]);
    expect(lastFrame()).toContain("Nothing captured yet.");
  });

  it("imports all words into a new collection", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, "i");
    await waitForText(lastFrame, "Import all 1 word");
    await press(stdin, DOWN, DOWN, ENTER, "Animals", ENTER);
    await waitForText(lastFrame, "Importing 1 into Animals");

    expect(server.imports()).toEqual([{ collection_id: 99, pin_to_dashboard: true, quick_capture_entry_ids: ["1"] }]);
  });

  it("says importing is a Pro feature for free users", async () => {
    startServer({ isPro: false });
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, "i");
    await waitForText(lastFrame, "needs Clozemaster Pro");
    expect(lastFrame()).toContain("/pro?placement=cli_quick_capture_import");
    await press(stdin, ESCAPE);
    await waitForText(lastFrame, "gato (translated)");
    expect(server.imports()).toEqual([]);
  });

  it("goes back to the menu on esc", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, ESCAPE);
    await waitForText(lastFrame, "What do you want to play?");
  });

  it("shows how to add a word and how to pick one", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    expect(stripAnsi(lastFrame()!)).toContain("enter to save · tab to pick a word · esc back");
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB);
    expect(unwrapped(lastFrame()!)).toContain("↑↓ to move · enter edit sentence · i import all · d delete · tab to type · esc back");
  });

  it("doesn't pick from an empty list", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, TAB);
    expect(stripAnsi(lastFrame()!)).toContain("enter to save · tab to pick a word");
  });

  it("ignores saving nothing", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "  ", ENTER);
    expect(server.quickCaptureEntries()).toEqual([]);
    expect(lastFrame()).toContain("Nothing captured yet.");
  });

  it("moves between words with the arrows, wrapping around", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER, "perro", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB);
    expect(stripAnsi(lastFrame()!)).toContain("❯ perro");
    await press(stdin, DOWN);
    expect(stripAnsi(lastFrame()!)).toContain("❯ gato");
    await press(stdin, DOWN);
    expect(stripAnsi(lastFrame()!)).toContain("❯ perro");
  });

  it("keeps checking until a word is translated", async () => {
    const queued = { id: "1", status: "queued" as const, text: "gato", translation: null, url: "https://example.com/qce/1" };
    vi.spyOn(api, "getQuickCaptureEntries")
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ ...queued, status: "processed", translation: "cat" }]);
    vi.spyOn(api, "addQuickCaptureEntry").mockResolvedValue(queued);
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "translating…");
    await waitForText(lastFrame, "cat", 5000);
  }, 10_000);

  it("marks a word that couldn't be translated", async () => {
    vi.spyOn(api, "getQuickCaptureEntries").mockResolvedValue([{ id: "1", status: "failed", text: "gato", translation: null, url: "https://example.com/qce/1" }]);
    const app = render(<App />);
    await waitForText(app.lastFrame, "What are you learning today?");
    await press(app.stdin, ENTER);
    await waitForText(app.lastFrame, "What do you want to play?");
    await press(app.stdin, "c");
    await waitForText(app.lastFrame, "failed");
  });

  it("shows a failure to save a word", async () => {
    vi.spyOn(api, "addQuickCaptureEntry").mockRejectedValue(new Error("offline"));
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "offline");
  });

  it("edits the example sentence's text", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, ENTER, "e");
    await waitForText(lastFrame, "enter done · esc stop editing");
    await press(stdin, " Sí.", ENTER, ENTER);
    await waitForText(lastFrame, "i import all");
    expect(server.quickCaptureEntries()[0]).toMatchObject({ sentence: "Veo un {{gato}} aquí. Sí." });
  });

  it("says when a word has no example sentence yet", async () => {
    vi.spyOn(api, "getQuickCaptureEntries").mockResolvedValue([{ id: "1", status: "processed", text: "gato", translation: "cat", url: "https://example.com/qce/1" }]);
    const app = render(<App />);
    await waitForText(app.lastFrame, "What are you learning today?");
    await press(app.stdin, ENTER);
    await waitForText(app.lastFrame, "What do you want to play?");
    await press(app.stdin, "c");
    await waitForText(app.lastFrame, "cat");
    await press(app.stdin, TAB, ENTER);
    await waitForText(app.lastFrame, "No example sentence yet.");
  });

  it("goes back to the list from editing on esc without saving", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, ENTER, RIGHT_ARROW, ESCAPE);
    await waitForText(lastFrame, "i import all");
    expect(server.quickCaptureEntries()[0]).toMatchObject({ sentence: "Veo un {{gato}} aquí." });
  });

  it("shows a failure to save the edited sentence", async () => {
    vi.spyOn(api, "updateQuickCaptureEntry").mockRejectedValue(new Error("offline"));
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, ENTER, ENTER);
    await waitForText(lastFrame, "offline");
  });

  it("ignores a blank name for a new collection", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, "i");
    await waitForText(lastFrame, "Import all 1 word");
    await press(stdin, DOWN, DOWN, ENTER);
    expect(stripAnsi(lastFrame()!)).toContain("enter to create and import · esc back");
    await press(stdin, "  ", ENTER);
    expect(server.imports()).toEqual([]);
  });

  it("goes back from naming a new collection to the list of collections on esc", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, "i");
    await waitForText(lastFrame, "Import all 1 word");
    await press(stdin, DOWN, DOWN, ENTER, ESCAPE);
    await waitForText(lastFrame, "Pick one of your collections or make a new one.");
  });

  it("shows a failure to import", async () => {
    vi.spyOn(api, "importQuickCaptureEntries").mockRejectedValue(new Error("offline"));
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, "i");
    await waitForText(lastFrame, "Import all 1 word");
    await press(stdin, ENTER);
    await waitForText(lastFrame, "offline");
  });
});
