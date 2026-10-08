import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sentence } from "../src/api.js";

const files = new Set<string>();
const spawned: { args: string[]; command: string; playback: FakePlayback }[] = [];

class FakePlayback extends EventEmitter {
  kill = vi.fn(() => this.emit("exit"));
  finish() {
    this.emit("exit");
  }
  fail() {
    this.emit("error", new Error("ENOENT"));
  }
}

vi.mock("node:fs", () => {
  const fs = {
    existsSync: (file: string) => files.has(file),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn((file: string) => files.add(file)),
  };
  return { default: fs, ...fs };
});

vi.mock("node:child_process", () => ({
  spawn: vi.fn((command: string, args: string[]) => {
    const playback = new FakePlayback();
    spawned.push({ args, command, playback });
    return playback;
  }),
}));

vi.mock("../src/api.js", () => ({ getSentenceAudioUrl: vi.fn(async () => "https://example.com/7.mp3") }));

const sentence = { id: 7 } as Sentence;
const BIN = "/test-bin";

async function loadAudio({ installed, platform }: { installed: string[]; platform: NodeJS.Platform }) {
  vi.resetModules();
  vi.stubEnv("PATH", BIN);
  vi.stubEnv("XDG_CACHE_HOME", "/cache");
  Object.defineProperty(process, "platform", { value: platform });
  installed.forEach((command) => files.add(path.join(BIN, command)));
  return import("../src/audio.js");
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function lastSpawn() {
  await flush();
  return spawned.at(-1)!;
}

const originalPlatform = process.platform;

describe("audio", () => {
  beforeEach(() => {
    files.clear();
    spawned.length = 0;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("plays a sentence with afplay on macOS", async () => {
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    const played = audio.playSentenceAudio(sentence);
    const { args, command, playback } = await lastSpawn();
    expect(command).toBe("afplay");
    expect(args).toEqual(["/cache/clozemaster/audio/7.mp3"]);
    playback.finish();
    expect(await played).toBe(true);
  });

  it("plays at half speed with afplay's rate option on macOS", async () => {
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    audio.playSentenceAudioAtHalfSpeed(sentence);
    expect(await lastSpawn()).toMatchObject({ args: ["-r", "0.5", "-q", "1", "/cache/clozemaster/audio/7.mp3"], command: "afplay" });
  });

  it("downloads a sentence's audio into the cache", async () => {
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    audio.playSentenceAudio(sentence);
    await lastSpawn();
    expect(fetch).toHaveBeenCalledWith("https://example.com/7.mp3");
    expect(files.has("/cache/clozemaster/audio/7.mp3")).toBe(true);
  });

  it("plays cached audio without downloading it again", async () => {
    files.add("/cache/clozemaster/audio/7.mp3");
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    audio.playSentenceAudio(sentence);
    await lastSpawn();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("downloads once when preloading and then playing", async () => {
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    audio.preloadSentenceAudio(sentence);
    audio.playSentenceAudio(sentence);
    await lastSpawn();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("plays with mpg123 first on Linux", async () => {
    const audio = await loadAudio({ installed: [], platform: "linux" });
    audio.playSentenceAudio(sentence);
    expect(await lastSpawn()).toMatchObject({ args: ["-q", "/cache/clozemaster/audio/7.mp3"], command: "mpg123" });
  });

  it("falls back to ffplay and then mpv when a player is missing", async () => {
    const audio = await loadAudio({ installed: [], platform: "linux" });
    const played = audio.playSentenceAudio(sentence);
    (await lastSpawn()).playback.fail();
    expect(spawned.at(-1)).toMatchObject({ args: ["-nodisp", "-autoexit", "-loglevel", "quiet", "/cache/clozemaster/audio/7.mp3"], command: "ffplay" });
    spawned.at(-1)!.playback.fail();
    expect(spawned.at(-1)).toMatchObject({ args: ["--no-video", "--really-quiet", "/cache/clozemaster/audio/7.mp3"], command: "mpv" });
    spawned.at(-1)!.playback.fail();
    expect(await played).toBe(true);
  });

  it("plays at half speed with ffplay, then mpv, on Linux", async () => {
    const audio = await loadAudio({ installed: [], platform: "linux" });
    audio.playSentenceAudioAtHalfSpeed(sentence);
    const ffplay = await lastSpawn();
    expect(ffplay).toMatchObject({ args: ["-nodisp", "-autoexit", "-loglevel", "quiet", "-af", "atempo=0.5", "/cache/clozemaster/audio/7.mp3"], command: "ffplay" });
    ffplay.playback.fail();
    expect(spawned.at(-1)).toMatchObject({ args: ["--no-video", "--really-quiet", "--speed=0.5", "/cache/clozemaster/audio/7.mp3"], command: "mpv" });
  });

  it("can play at half speed on Linux with ffplay or mpv installed", async () => {
    expect((await loadAudio({ installed: ["mpv"], platform: "linux" })).canPlayAtHalfSpeed).toBe(true);
  });

  it("can't play at half speed on Linux with only mpg123 installed", async () => {
    expect((await loadAudio({ installed: ["mpg123"], platform: "linux" })).canPlayAtHalfSpeed).toBe(false);
  });

  it("can play at half speed on macOS with afplay installed", async () => {
    expect((await loadAudio({ installed: ["afplay"], platform: "darwin" })).canPlayAtHalfSpeed).toBe(true);
  });

  it("stops the playing sentence and resolves false", async () => {
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    const played = audio.playSentenceAudio(sentence);
    const { playback } = await lastSpawn();
    audio.stopAudio();
    expect(playback.kill).toHaveBeenCalled();
    expect(await played).toBe(false);
  });

  it("stops the playing sentence when another starts", async () => {
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    const first = audio.playSentenceAudio(sentence);
    const { playback } = await lastSpawn();
    audio.playSentenceAudio({ id: 8 } as Sentence);
    expect(playback.kill).toHaveBeenCalled();
    expect(await first).toBe(false);
  });

  it("resolves true when a sentence has no audio", async () => {
    const api = await import("../src/api.js");
    vi.mocked(api.getSentenceAudioUrl).mockResolvedValueOnce(undefined);
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    expect(await audio.playSentenceAudio(sentence)).toBe(true);
    expect(spawned).toHaveLength(0);
  });

  it("writes a sound effect into the cache and plays it", async () => {
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    const played = audio.playSoundEffect("correct");
    const { args, playback } = spawned.at(-1)!;
    expect(args).toEqual(["/cache/clozemaster/audio/correct.mp3"]);
    expect(files.has("/cache/clozemaster/audio/correct.mp3")).toBe(true);
    playback.finish();
    expect(await played).toBe(true);
  });

  it("resolves false when a sound effect is cut short", async () => {
    const audio = await loadAudio({ installed: [], platform: "darwin" });
    const played = audio.playSoundEffect("success");
    audio.stopAudio();
    expect(await played).toBe(false);
  });
});
