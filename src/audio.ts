import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSentenceAudioUrl, type Sentence } from "./api.js";
import { SOUND_EFFECT_FILES } from "./soundEffectFiles.js";

type AudioPlayer = { args: string[]; command: string };

const PLAYERS: AudioPlayer[] =
  process.platform === "darwin"
    ? [{ args: [], command: "afplay" }]
    : [
        { args: ["-q"], command: "mpg123" },
        { args: ["-nodisp", "-autoexit", "-loglevel", "quiet"], command: "ffplay" },
        { args: ["--no-video", "--really-quiet"], command: "mpv" },
      ];

// Same players at half speed, keeping the pitch. mpg123 can't, so it isn't one.
const HALF_SPEED_PLAYERS: AudioPlayer[] =
  process.platform === "darwin"
    ? [{ args: ["-r", "0.5", "-q", "1"], command: "afplay" }]
    : [
        { args: ["-nodisp", "-autoexit", "-loglevel", "quiet", "-af", "atempo=0.5"], command: "ffplay" },
        { args: ["--no-video", "--really-quiet", "--speed=0.5"], command: "mpv" },
      ];

function isOnPath(command: string): boolean {
  return (process.env.PATH || "").split(path.delimiter).some((directory) => fs.existsSync(path.join(directory, command)));
}

export const canPlayAtHalfSpeed = HALF_SPEED_PLAYERS.some((player) => isOnPath(player.command));

// Per user rather than the shared temp dir, so nobody else on the machine can plant files in it.
const cacheDirectory = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "clozemaster", "audio");
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

// Resolves true once the sentence has played (or couldn't be), false if something else stopped it.
export function playSentenceAudio(sentence: Sentence): Promise<boolean> {
  return playSentence(sentence, PLAYERS);
}

export function playSentenceAudioAtHalfSpeed(sentence: Sentence): Promise<boolean> {
  return playSentence(sentence, HALF_SPEED_PLAYERS);
}

async function playSentence(sentence: Sentence, players: AudioPlayer[]): Promise<boolean> {
  stopAudio();
  const request = latestRequest;
  try {
    const audioPath = await downloadAudio(sentence);
    if (audioPath && request === latestRequest) await playFile(audioPath, players);
  } catch {}
  return request === latestRequest;
}
