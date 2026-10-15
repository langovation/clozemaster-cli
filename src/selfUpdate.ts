import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { configDirectory } from "./config.js";
import { fetchNewerVersion } from "./updateCheck.js";

const RELEASES_URL = "https://github.com/langovation/clozemaster-cli/releases/download";
const RELEASE_TARGETS = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64"];
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const STALE_LOCK_MS = 15 * 60 * 1000;
const PREFLIGHT_TIMEOUT_MS = 10_000;
const LOCK_NAME = ".clozemaster-update.lock";
const DOWNLOAD_NAME = /^\.clozemaster-update-\d+\.download$/;
const lastCheckPath = path.join(configDirectory, "last-update-check");

// Set by scripts/build-binary.ts, so running from source (where execPath is node) never replaces anything.
export function canSelfUpdate(): boolean {
  return (
    process.env.CLOZEMASTER_COMPILED === "1" &&
    !process.env.CLOZEMASTER_NO_AUTO_UPDATE &&
    RELEASE_TARGETS.includes(releaseTarget()) &&
    path.basename(installedBinaryPath()).startsWith("clozemaster")
  );
}

export async function updateInBackground(signal: AbortSignal): Promise<string | undefined> {
  try {
    if (!canSelfUpdate() || wasCheckedRecently()) return undefined;
    const version = await fetchNewerVersion(signal);
    signal.throwIfAborted();
    if (version) await installVersion({ binaryPath: installedBinaryPath(), version, signal });
    recordCheck();
    return version;
  } catch {
    // Retry on the next launch if the client quit mid-download, but not after a bad download.
    if (!signal.aborted) recordCheck();
    return undefined;
  }
}

export async function installVersion({ binaryPath, version, signal }: { binaryPath: string; version: string; signal: AbortSignal }) {
  const directory = path.dirname(binaryPath);
  const lockPath = path.join(directory, LOCK_NAME);
  if (!acquireLock(lockPath)) throw new Error("Another process is already updating");
  const downloadPath = path.join(directory, `.clozemaster-update-${process.pid}.download`);
  try {
    removeLeftoverDownloads(directory);
    const asset = `clozemaster-${releaseTarget()}`;
    const [binary, checksums] = await Promise.all([
      download(`${RELEASES_URL}/v${version}/${asset}`, signal),
      download(`${RELEASES_URL}/v${version}/SHA256SUMS`, signal),
    ]);
    verifyChecksum(binary, asset, checksums.toString("utf8"));
    fs.writeFileSync(downloadPath, binary, { mode: fs.statSync(binaryPath).mode });
    await checkItRuns(downloadPath, version, signal);
    fs.renameSync(downloadPath, binaryPath);
  } finally {
    fs.rmSync(downloadPath, { force: true });
    fs.rmSync(lockPath, { force: true });
  }
}

function releaseTarget(): string {
  return `${process.platform}-${process.arch}`;
}

// Replace the real file, not a symlink pointing at it.
function installedBinaryPath(): string {
  return fs.realpathSync(process.execPath);
}

function wasCheckedRecently(): boolean {
  try {
    return Date.now() - fs.statSync(lastCheckPath).mtimeMs < CHECK_INTERVAL_MS;
  } catch {
    return false;
  }
}

function recordCheck() {
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.writeFileSync(lastCheckPath, new Date().toISOString());
}

function acquireLock(lockPath: string): boolean {
  try {
    fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    if (Date.now() - fs.statSync(lockPath).mtimeMs < STALE_LOCK_MS) return false;
    fs.rmSync(lockPath, { force: true });
    return acquireLock(lockPath);
  }
}

function removeLeftoverDownloads(directory: string) {
  for (const name of fs.readdirSync(directory)) {
    if (DOWNLOAD_NAME.test(name)) fs.rmSync(path.join(directory, name), { force: true });
  }
}

async function download(url: string, signal: AbortSignal): Promise<Buffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Download failed: ${url} (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

function verifyChecksum(binary: Buffer, asset: string, checksums: string) {
  const expected = checksums.split("\n").find((line) => line.endsWith(`  ${asset}`))?.split(" ")[0];
  const actual = createHash("sha256").update(binary).digest("hex");
  if (!expected || expected !== actual) throw new Error(`Checksum mismatch for ${asset}`);
}

async function checkItRuns(binaryPath: string, version: string, signal: AbortSignal) {
  const { stdout } = await promisify(execFile)(binaryPath, ["--version"], { signal, timeout: PREFLIGHT_TIMEOUT_MS });
  if (stdout.trim() !== version) throw new Error(`Downloaded binary reports ${stdout.trim()}, expected ${version}`);
}
