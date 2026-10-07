import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSentenceAudioUrl, type Sentence } from "./api.js";
import { SOUND_EFFECT_FILES } from "./soundEffectFiles.js";

const PLAYERS: { args: string[]; command: string }[] =
  process.platform === "darwin"
    ? [{ args: [], command: "afplay" }]
    : [
        { args: ["-q"], command: "mpg123" },
        { args: ["-nodisp", "-autoexit", "-loglevel", "quiet"], command: "ffplay" },
        { args: ["--no-video", "--really-quiet"], command: "mpv" },
      ];

const cacheDirectory = path.join(os.tmpdir(), "clozemaster-audio");
let currentPlayback: ChildProcess | undefined;
let latestRequest = 0;
const downloads = new Map<number, Promise<string | undefined>>();

// Shared so playing a sentence that's already downloading waits for that download instead of starting another.
function downloadAudio(sentence: Sentence): Promise<string | undefined> {
  if (!downloads.has(sentence.id)) {
    const download = fetchAudio(sentence).catch(() => undefined);
    downloads.set(sentence.id, download);
    download.then((audioPath) => audioPath || downloads.delete(sentence.id));
  }
  return downloads.get(sentence.id)!;
}

export function preloadSentenceAudio(sentence: Sentence) {
  downloadAudio(sentence);
}

async function fetchAudio(sentence: Sentence): Promise<string | undefined> {
  const audioPath = path.join(cacheDirectory, `${sentence.id}.mp3`);
  if (fs.existsSync(audioPath)) return audioPath;
  const audioUrl = await getSentenceAudioUrl(sentence);
  if (!audioUrl) return undefined;
  const response = await fetch(audioUrl);
  if (!response.ok) return undefined;
  fs.mkdirSync(cacheDirectory, { recursive: true });
  fs.writeFileSync(audioPath, Buffer.from(await response.arrayBuffer()));
  return audioPath;
}

// Resolves once playback ends, is stopped, or no player could play it.
function playFile(audioPath: string, players = PLAYERS): Promise<void> {
  const [player, ...fallbacks] = players;
  if (!player) return Promise.resolve();
  return new Promise((resolve) => {
    const playback = spawn(player.command, [...player.args, audioPath], { stdio: "ignore" });
    playback.on("error", () => {
      resolve(currentPlayback === playback ? playFile(audioPath, fallbacks) : undefined);
    });
    playback.on("exit", () => resolve());
    currentPlayback = playback;
  });
}

export function stopAudio() {
  latestRequest++;
  currentPlayback?.kill();
  currentPlayback = undefined;
}

export type SoundEffect = keyof typeof SOUND_EFFECT_FILES;

// Resolves true once the sound has finished, false if something else stopped it.
export async function playSoundEffect(soundEffect: SoundEffect): Promise<boolean> {
  stopAudio();
  const request = latestRequest;
  const audioPath = path.join(cacheDirectory, `${soundEffect}.mp3`);
  try {
    if (!fs.existsSync(audioPath)) {
      fs.mkdirSync(cacheDirectory, { recursive: true });
      fs.writeFileSync(audioPath, Buffer.from(SOUND_EFFECT_FILES[soundEffect], "base64"));
    }
    await playFile(audioPath);
  } catch {}
  return request === latestRequest;
}

export async function playSentenceAudio(sentence: Sentence) {
  stopAudio();
  const request = latestRequest;
  try {
    const audioPath = await downloadAudio(sentence);
    if (audioPath && request === latestRequest) await playFile(audioPath);
  } catch {}
}
