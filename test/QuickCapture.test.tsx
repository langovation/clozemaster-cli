import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { configDirectory } from "../src/config.js";
import { startFakeServer } from "./fakeServer.js";
import { ENTER, ESCAPE, press, waitForText } from "./helpers.js";

const TAB = "\t";

describe("Quick Capture", () => {
  let server: ReturnType<typeof startFakeServer>;

  beforeEach(() => {
    fs.rmSync(path.join(configDirectory, "settings.json"), { force: true });
    vi.stubEnv("CLOZEMASTER_TOKEN", "1:test");
    server = startFakeServer();
  });

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

  it("goes back to the menu on esc", async () => {
    const { lastFrame, stdin } = await openQuickCapture();
    await press(stdin, ESCAPE);
    await waitForText(lastFrame, "What do you want to play?");
  });
});
