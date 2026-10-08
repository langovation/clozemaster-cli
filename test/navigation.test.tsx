import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api.js";
import { App } from "../src/App.js";
import { clearLogin, configDirectory, saveLogin } from "../src/config.js";
import { openFeedbackEmail } from "../src/feedback.js";
import { startFakeServer } from "./fakeServer.js";
import { DOWN, ENTER, ESCAPE, press, stripAnsi, waitForText } from "./helpers.js";

vi.mock("../src/audio.js", () => ({ canPlayAtHalfSpeed: true, playSentenceAudio: vi.fn(async () => true), playSoundEffect: vi.fn(async () => true), preloadSentenceAudio: vi.fn(), stopAudio: vi.fn() }));
vi.mock("../src/feedback.js", () => ({ openFeedbackEmail: vi.fn() }));

const TAB = "\t";
const LEFT = "\u001B[D";

async function openPairing() {
  const app = render(<App />);
  await waitForText(app.lastFrame, "What are you learning today?");
  await press(app.stdin, ENTER);
  await waitForText(app.lastFrame, "What do you want to play?");
  return app;
}

describe("App navigation", () => {
  beforeEach(() => {
    fs.rmSync(path.join(configDirectory, "settings.json"), { force: true });
    clearLogin();
    vi.stubEnv("CLOZEMASTER_TOKEN", "1:test");
    vi.stubEnv("CLOZEMASTER_COOKIE", "");
    startFakeServer();
  });

  afterEach(() => {
    clearLogin();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("logging in", () => {
    it("asks to log in without a login", () => {
      vi.stubEnv("CLOZEMASTER_TOKEN", "");
      const { lastFrame } = render(<App />);
      expect(stripAnsi(lastFrame()!)).toContain("Press Enter to open the browser and log in.");
    });

    it("counts a session cookie as logged in", async () => {
      vi.stubEnv("CLOZEMASTER_TOKEN", "");
      vi.stubEnv("CLOZEMASTER_COOKIE", "session=abc");
      const { lastFrame } = render(<App />);
      await waitForText(lastFrame, "What are you learning today?");
    });

    it("asks to log in when forced, even with a login", () => {
      const { lastFrame } = render(<App forceLogin />);
      expect(stripAnsi(lastFrame()!)).toContain("Press Enter to open the browser and log in.");
    });

    it("greets the user by name once logged in", async () => {
      vi.stubEnv("CLOZEMASTER_TOKEN", "");
      vi.spyOn(api, "startCliLogin").mockResolvedValue({ deviceCode: "d", expiresIn: 600, pollInterval: 0.01, userCode: "ABCD", verificationUrl: "https://example.com/cli" });
      vi.spyOn(api, "pollCliLogin").mockResolvedValue({ authToken: "1:new", username: "learner" });
      const { lastFrame, stdin } = render(<App />);
      await press(stdin, ENTER);
      await waitForText(lastFrame, "Welcome back, learner!");
    });
  });

  describe("picking a language", () => {
    it("greets a saved login by name", async () => {
      saveLogin({ authToken: "1:saved", username: "learner" });
      const { lastFrame } = render(<App />);
      await waitForText(lastFrame, "Welcome back, learner!");
    });

    it("greets without a name when it isn't known", async () => {
      const { lastFrame } = render(<App />);
      await waitForText(lastFrame, "What are you learning today?");
      expect(stripAnsi(lastFrame()!)).toContain("Welcome back!");
    });

    it("lists each pairing with its level", async () => {
      const { lastFrame } = render(<App />);
      await waitForText(lastFrame, "What are you learning today?");
      expect(stripAnsi(lastFrame()!)).toMatch(/❯ Español from English\s+level 7/);
    });

    it("says to add a language when there are none", async () => {
      vi.spyOn(api, "getLanguagePairings").mockResolvedValue([]);
      const { lastFrame } = render(<App />);
      await waitForText(lastFrame, "Add a language on clozemaster.com first, then come back.");
    });

    it("shows a failure to load the languages", async () => {
      vi.spyOn(api, "getLanguagePairings").mockRejectedValue(new Error("offline"));
      const { lastFrame } = render(<App />);
      await waitForText(lastFrame, "offline");
    });

    it("opens the feedback email with f", async () => {
      const { lastFrame, stdin } = render(<App />);
      await waitForText(lastFrame, "What are you learning today?");
      await press(stdin, "f");
      expect(openFeedbackEmail).toHaveBeenCalled();
    });

    it("shows the menu's hints", async () => {
      const { lastFrame } = render(<App />);
      await waitForText(lastFrame, "What are you learning today?");
      expect(stripAnsi(lastFrame()!)).toContain("enter to pick · s settings · f feedback · ctrl+c to quit");
    });
  });

  describe("picking a round", () => {
    it("goes back to the languages on esc", async () => {
      const { lastFrame, stdin } = await openPairing();
      await press(stdin, ESCAPE);
      await waitForText(lastFrame, "What are you learning today?");
    });

    it("opens the feedback email with f", async () => {
      const { stdin } = await openPairing();
      await press(stdin, "f");
      expect(openFeedbackEmail).toHaveBeenCalled();
    });

    it("opens settings with s and comes back on esc", async () => {
      const { lastFrame, stdin } = await openPairing();
      await press(stdin, "s");
      await waitForText(lastFrame, "Typing color hint");
      await press(stdin, ESCAPE);
      await waitForText(lastFrame, "What do you want to play?");
    });

    it("shows the round menu's hints", async () => {
      const { lastFrame } = await openPairing();
      expect(stripAnsi(lastFrame()!)).toContain("enter to pick · c quick capture · s settings · f feedback · esc back");
    });

    it("leaves out the leaderboard rank when there isn't one", async () => {
      vi.spyOn(api, "getLanguagePairing").mockResolvedValue({ ...(await api.getLanguagePairings())[0], currentWeekLeaderboardRank: undefined });
      const { lastFrame } = await openPairing();
      expect(stripAnsi(lastFrame()!)).not.toContain("leaderboard");
    });

    it("shows a failure to load the collections", async () => {
      vi.spyOn(api, "getCollections").mockRejectedValue(new Error("offline"));
      const { lastFrame, stdin } = render(<App />);
      await waitForText(lastFrame, "What are you learning today?");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "offline");
    });
  });

  describe("browsing collections", () => {
    it("shows each collection's size, marking Pro ones", async () => {
      const [pairing] = await api.getLanguagePairings();
      const collections = await api.getCollections(pairing);
      vi.spyOn(api, "getCollections").mockResolvedValue(collections.map((each) => (each.name === "Beginner A1" ? { ...each, numSentences: 1234, proOnly: true } : each)));
      const { lastFrame, stdin } = await openPairing();
      await press(stdin, "\u001B[A", ENTER);
      await waitForText(lastFrame, "All Español collections");
      const frame = stripAnsi(lastFrame()!);
      expect(frame).toMatch(/Beginner A1\s+Pro · 1,234 sentences/);
      expect(frame).toMatch(/Fluency Fast Track\s+20 sentences/);
      expect(frame).toContain("Playing one adds it to your dashboard.");
    });
  });

  describe("picking a mode", () => {
    it("lists the modes with what each asks for", async () => {
      const { lastFrame, stdin } = await openPairing();
      await press(stdin, DOWN, DOWN, ENTER);
      expect(stripAnsi(lastFrame()!)).toMatch(
        /❯ Multiple choice\s+pick from 4\n\s+Text input\s+type the word\n\s+Listening\s+hear it, then type the word\n\s+Flashcards\s+reveal and self-grade/,
      );
    });

    it("goes back to the round menu on esc", async () => {
      const { lastFrame, stdin } = await openPairing();
      await press(stdin, DOWN, DOWN, ENTER, ESCAPE);
      await waitForText(lastFrame, "What do you want to play?");
    });
  });

  describe("playing", () => {
    async function startMultipleChoice() {
      const app = await openPairing();
      await press(app.stdin, DOWN, DOWN, ENTER, ENTER);
      await waitForText(app.lastFrame, "1-4 to answer");
      return app;
    }

    it("switches to the next mode with tab", async () => {
      const { lastFrame, stdin } = await startMultipleChoice();
      expect(stripAnsi(lastFrame()!)).toContain("tab: text input");
      await press(stdin, TAB);
      await waitForText(lastFrame, "type the missing word");
      expect(stripAnsi(lastFrame()!)).toContain("tab: listening");
    });

    it("goes back to the round menu on esc and asks for the mode again", async () => {
      const { lastFrame, stdin } = await startMultipleChoice();
      await press(stdin, ESCAPE);
      await waitForText(lastFrame, "What do you want to play?");
      await press(stdin, ENTER);
      await waitForText(lastFrame, "How do you want to answer?");
    });

    it("goes back to the round menu, not the browse list, after playing a browsed collection", async () => {
      const app = await openPairing();
      await press(app.stdin, "\u001B[A", ENTER);
      await waitForText(app.lastFrame, "All Español collections");
      await press(app.stdin, ENTER, ENTER);
      await waitForText(app.lastFrame, "1-4 to answer");
      await press(app.stdin, ESCAPE);
      await waitForText(app.lastFrame, "What do you want to play?");
    });
  });

  describe("settings", () => {
    async function openSettings() {
      const app = render(<App />);
      await waitForText(app.lastFrame, "What are you learning today?");
      await press(app.stdin, "s");
      return app;
    }

    it("describes the highlighted setting", async () => {
      const { lastFrame, stdin } = await openSettings();
      expect(stripAnsi(lastFrame()!)).toContain("green while you're on track, red once you're not");
      await press(stdin, DOWN);
      expect(stripAnsi(lastFrame()!)).toContain("say when an answer is off by a letter or two");
    });

    it("cycles the translation setting forwards and backwards", async () => {
      const { lastFrame, stdin } = await openSettings();
      await press(stdin, "j", "j", "j");
      expect(stripAnsi(lastFrame()!)).toMatch(/❯ Translation\s+always/);
      await press(stdin, " ");
      expect(stripAnsi(lastFrame()!)).toMatch(/❯ Translation\s+after answering/);
      await press(stdin, LEFT, LEFT);
      expect(stripAnsi(lastFrame()!)).toMatch(/❯ Translation\s+hidden/);
    });

    it("goes back with q", async () => {
      const { lastFrame, stdin } = await openSettings();
      await press(stdin, "q");
      await waitForText(lastFrame, "What are you learning today?");
    });
  });
});
