import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { beforeEach, vi } from "vitest";

// A throwaway config dir per worker so tests never touch the real saved login or settings, nor race each other's.
process.env.XDG_CONFIG_HOME = path.join(os.tmpdir(), `clozemaster-cli-test-${process.pid}-${process.env.VITEST_POOL_ID}`);
process.env.XDG_CACHE_HOME = path.join(os.tmpdir(), `clozemaster-cli-test-cache-${process.pid}-${process.env.VITEST_POOL_ID}`);

// Tests must never open the browser, play real audio or reach the network.
vi.mock("open", () => ({ default: vi.fn(async () => undefined) }));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const playback = Object.assign(new EventEmitter(), { kill: vi.fn() });
    setTimeout(() => playback.emit("exit"), 0);
    return playback;
  }),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: unknown) => Promise.reject(new TypeError(`Tests can't reach the network: ${String(input)}`))));
});
