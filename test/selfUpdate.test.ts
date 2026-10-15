import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canSelfUpdate, installVersion } from "../src/selfUpdate.js";

vi.mock("node:child_process", async (importOriginal) => importOriginal());

const OLD_BINARY = "#!/bin/sh\necho 0.1.0\n";
const NEW_BINARY = "#!/bin/sh\necho 0.2.0\n";
const ASSET = `clozemaster-${process.platform}-${process.arch}`;
const RELEASE_URL = "https://github.com/langovation/clozemaster-cli/releases/download/v0.2.0";

let directory: string;
let binaryPath: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "clozemaster-self-update-"));
  binaryPath = path.join(directory, "clozemaster");
  fs.writeFileSync(binaryPath, OLD_BINARY, { mode: 0o755 });
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function stubRelease({ binary = NEW_BINARY, checksum = sha256(binary) } = {}) {
  const files: Record<string, string> = {
    [`${RELEASE_URL}/${ASSET}`]: binary,
    [`${RELEASE_URL}/SHA256SUMS`]: `${checksum}  ${ASSET}\n`,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (url in files ? new Response(files[url]) : new Response("", { status: 404 }))),
  );
}

function install() {
  return installVersion({ binaryPath, version: "0.2.0", signal: new AbortController().signal });
}

function installedBinary(): string {
  return fs.readFileSync(binaryPath, "utf8");
}

describe("installVersion", () => {
  it("replaces the binary with the release's", async () => {
    stubRelease();
    await install();
    expect(installedBinary()).toBe(NEW_BINARY);
  });

  it("keeps the binary executable", async () => {
    stubRelease();
    await install();
    expect(fs.statSync(binaryPath).mode & 0o777).toBe(0o755);
  });

  it("leaves no download or lock behind", async () => {
    stubRelease();
    await install();
    expect(fs.readdirSync(directory)).toEqual(["clozemaster"]);
  });

  it("keeps the old binary when the checksum doesn't match", async () => {
    stubRelease({ checksum: sha256("something else") });
    await expect(install()).rejects.toThrow("Checksum mismatch");
    expect(installedBinary()).toBe(OLD_BINARY);
  });

  it("keeps the old binary when the release has no checksum for this platform", async () => {
    stubRelease();
    vi.mocked(fetch).mockImplementation(async (url) =>
      new Response(String(url).endsWith("SHA256SUMS") ? `${sha256(NEW_BINARY)}  clozemaster-other-platform\n` : NEW_BINARY),
    );
    await expect(install()).rejects.toThrow("Checksum mismatch");
    expect(installedBinary()).toBe(OLD_BINARY);
  });

  it("keeps the old binary when the new one reports the wrong version", async () => {
    stubRelease({ binary: "#!/bin/sh\necho 0.1.5\n" });
    await expect(install()).rejects.toThrow("expected 0.2.0");
    expect(installedBinary()).toBe(OLD_BINARY);
  });

  it("keeps the old binary when the new one crashes", async () => {
    stubRelease({ binary: "#!/bin/sh\nexit 1\n" });
    await expect(install()).rejects.toThrow();
    expect(installedBinary()).toBe(OLD_BINARY);
  });

  it("keeps the old binary when the download fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(install()).rejects.toThrow("Download failed");
    expect(installedBinary()).toBe(OLD_BINARY);
  });

  it("leaves the update to another process that's already downloading", async () => {
    stubRelease();
    fs.writeFileSync(path.join(directory, ".clozemaster-update.lock"), "123");
    await expect(install()).rejects.toThrow("already updating");
    expect(installedBinary()).toBe(OLD_BINARY);
  });

  it("takes over a lock left by a process that died long ago", async () => {
    stubRelease();
    const lockPath = path.join(directory, ".clozemaster-update.lock");
    fs.writeFileSync(lockPath, "123");
    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    fs.utimesSync(lockPath, anHourAgo, anHourAgo);
    await install();
    expect(installedBinary()).toBe(NEW_BINARY);
  });

  it("removes downloads left by killed processes", async () => {
    stubRelease();
    fs.writeFileSync(path.join(directory, ".clozemaster-update-999.download"), "partial");
    await install();
    expect(fs.readdirSync(directory)).toEqual(["clozemaster"]);
  });
});

describe("canSelfUpdate", () => {
  it("is off when running from source", () => {
    expect(canSelfUpdate()).toBe(false);
  });

  it("is off when running from source even if the compiled flag is set, since the executable is node", () => {
    vi.stubEnv("CLOZEMASTER_COMPILED", "1");
    expect(canSelfUpdate()).toBe(false);
  });
});
