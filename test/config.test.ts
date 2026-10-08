import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseUrl, clearLogin, configDirectory, getAuthToken, getStoredUsername, isUsingSavedLogin, saveLogin } from "../src/config.js";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../src/settings.js";

const loginsPath = path.join(configDirectory, "logins.json");

describe("config", () => {
  beforeEach(() => {
    fs.rmSync(loginsPath, { force: true });
    vi.stubEnv("CLOZEMASTER_TOKEN", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("has no login before one is saved", () => {
    expect(getAuthToken()).toBeUndefined();
    expect(getStoredUsername()).toBeUndefined();
  });

  it("remembers a saved login", () => {
    saveLogin({ authToken: "1:abc", username: "learner" });
    expect(getAuthToken()).toBe("1:abc");
    expect(getStoredUsername()).toBe("learner");
  });

  it("prefers the token from the environment", () => {
    saveLogin({ authToken: "1:abc", username: "learner" });
    vi.stubEnv("CLOZEMASTER_TOKEN", "2:env");
    expect(getAuthToken()).toBe("2:env");
  });

  it("keeps logins per server", () => {
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(loginsPath, JSON.stringify({ "http://localhost:3000": { authToken: "9:local", username: "dev" } }));
    saveLogin({ authToken: "1:abc", username: "learner" });
    expect(JSON.parse(fs.readFileSync(loginsPath, "utf8"))).toEqual({
      "http://localhost:3000": { authToken: "9:local", username: "dev" },
      [baseUrl]: { authToken: "1:abc", username: "learner" },
    });
  });

  it("saves logins readable only by the user", () => {
    saveLogin({ authToken: "1:abc", username: "learner" });
    expect(fs.statSync(loginsPath).mode & 0o777).toBe(0o600);
  });

  it("forgets this server's login and keeps the others", () => {
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(loginsPath, JSON.stringify({ "http://localhost:3000": { authToken: "9:local", username: "dev" } }));
    saveLogin({ authToken: "1:abc", username: "learner" });
    clearLogin();
    expect(getAuthToken()).toBeUndefined();
    expect(JSON.parse(fs.readFileSync(loginsPath, "utf8"))).toEqual({ "http://localhost:3000": { authToken: "9:local", username: "dev" } });
  });

  it("uses the saved login when there's no token in the environment", () => {
    saveLogin({ authToken: "1:abc", username: "learner" });
    expect(isUsingSavedLogin()).toBe(true);
  });

  it("isn't using the saved login when the environment has a token", () => {
    saveLogin({ authToken: "1:abc", username: "learner" });
    vi.stubEnv("CLOZEMASTER_TOKEN", "2:env");
    expect(isUsingSavedLogin()).toBe(false);
  });

  it("isn't using a saved login when there is none", () => {
    expect(isUsingSavedLogin()).toBe(false);
  });

  it("treats an unreadable logins file as no logins", () => {
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(loginsPath, "not json");
    expect(getAuthToken()).toBeUndefined();
  });
});

describe("settings", () => {
  const settingsPath = path.join(configDirectory, "settings.json");

  beforeEach(() => fs.rmSync(settingsPath, { force: true }));

  it("uses the defaults before anything is saved", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("loads saved settings", () => {
    saveSettings({ ...DEFAULT_SETTINGS, audio: false, translation: "hidden" });
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, audio: false, translation: "hidden" });
  });

  it("fills in settings missing from the saved file with defaults", () => {
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ audio: false }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, audio: false });
  });

  it("uses the defaults when the saved file is unreadable", () => {
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(settingsPath, "{");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
