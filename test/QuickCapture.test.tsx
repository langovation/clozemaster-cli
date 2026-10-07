import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { configDirectory } from "../src/config.js";
import { startFakeServer } from "./fakeServer.js";
import { DOWN, ENTER, ESCAPE, press, waitForText } from "./helpers.js";

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

  it("imports the selected words into a picked collection", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER, "perro", ENTER, "casa", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, " ", DOWN, DOWN, " ", "i");
    await waitForText(lastFrame, "Import 2 words");
    await press(stdin, DOWN, ENTER);
    await waitForText(lastFrame, "Importing 2 into Travel");

    expect(server.imports()).toEqual([{ collection_id: 6, pin_to_dashboard: true, quick_capture_entry_ids: ["3", "1"] }]);
    expect(lastFrame()).toContain("perro");
    expect(lastFrame()).not.toContain("gato");
  });

  it("imports the highlighted word into a new collection", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, "gato", ENTER);
    await waitForText(lastFrame, "gato (translated)");
    await press(stdin, TAB, "i");
    await waitForText(lastFrame, "Import 1 word");
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
    await waitForText(lastFrame, "Clozemaster Pro feature");
    await press(stdin, ESCAPE);
    await waitForText(lastFrame, "gato (translated)");
    expect(server.imports()).toEqual([]);
  });

  it("goes back to the menu on esc", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, ESCAPE);
    await waitForText(lastFrame, "What do you want to play?");
  });
});
