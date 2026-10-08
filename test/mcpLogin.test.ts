import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import open from "open";
import { pollCliLogin, startCliLogin } from "../src/api.js";
import { saveLogin } from "../src/config.js";

vi.mock("../src/api.js", () => ({ pollCliLogin: vi.fn(), startCliLogin: vi.fn() }));
vi.mock("../src/config.js", () => ({ saveLogin: vi.fn() }));

const login = { deviceCode: "device", expiresIn: 600, pollInterval: 2, userCode: "ABCD-1234", verificationUrl: "https://example.com/cli" };

async function loadMcpLogin() {
  vi.resetModules();
  return import("../src/mcpLogin.js");
}

describe("startOrResumeBrowserLogin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(startCliLogin).mockResolvedValue(login);
    vi.mocked(pollCliLogin).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("opens the browser at the login's verification url", async () => {
    const { startOrResumeBrowserLogin } = await loadMcpLogin();
    expect(await startOrResumeBrowserLogin()).toEqual(login);
    expect(open).toHaveBeenCalledWith("https://example.com/cli");
  });

  it("still returns the login when the browser can't be opened", async () => {
    vi.mocked(open).mockRejectedValueOnce(new Error("no browser"));
    const { startOrResumeBrowserLogin } = await loadMcpLogin();
    expect(await startOrResumeBrowserLogin()).toEqual(login);
  });

  it("reuses the pending login instead of starting another", async () => {
    const { startOrResumeBrowserLogin } = await loadMcpLogin();
    await startOrResumeBrowserLogin();
    await startOrResumeBrowserLogin();
    expect(startCliLogin).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("starts a new login once the pending one has expired", async () => {
    const { startOrResumeBrowserLogin } = await loadMcpLogin();
    await startOrResumeBrowserLogin();
    await vi.advanceTimersByTimeAsync(600_000);
    await startOrResumeBrowserLogin();
    expect(startCliLogin).toHaveBeenCalledTimes(2);
  });

  it("polls at the login's interval until it's approved, then saves it", async () => {
    vi.mocked(pollCliLogin).mockResolvedValueOnce(null).mockResolvedValueOnce({ authToken: "1:approved", username: "learner" });
    const { startOrResumeBrowserLogin } = await loadMcpLogin();
    await startOrResumeBrowserLogin();
    await vi.advanceTimersByTimeAsync(2000);
    expect(pollCliLogin).toHaveBeenCalledWith("device");
    expect(saveLogin).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(saveLogin).toHaveBeenCalledWith({ authToken: "1:approved", username: "learner" });
  });

  it("stops polling once the login is approved", async () => {
    vi.mocked(pollCliLogin).mockResolvedValue({ authToken: "1:approved", username: "learner" });
    const { startOrResumeBrowserLogin } = await loadMcpLogin();
    await startOrResumeBrowserLogin();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pollCliLogin).toHaveBeenCalledTimes(1);
  });

  it("starts a new login after the approved one was saved", async () => {
    vi.mocked(pollCliLogin).mockResolvedValue({ authToken: "1:approved", username: "learner" });
    const { startOrResumeBrowserLogin } = await loadMcpLogin();
    await startOrResumeBrowserLogin();
    await vi.advanceTimersByTimeAsync(2000);
    await startOrResumeBrowserLogin();
    expect(startCliLogin).toHaveBeenCalledTimes(2);
  });

  it("drops the pending login when polling fails, so the next call starts a new one", async () => {
    vi.mocked(pollCliLogin).mockRejectedValue(new Error("expired"));
    const { startOrResumeBrowserLogin } = await loadMcpLogin();
    await startOrResumeBrowserLogin();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pollCliLogin).toHaveBeenCalledTimes(1);

    await startOrResumeBrowserLogin();
    expect(startCliLogin).toHaveBeenCalledTimes(2);
  });

  it("passes on a failure to start the login", async () => {
    vi.mocked(startCliLogin).mockRejectedValue(new Error("offline"));
    const { startOrResumeBrowserLogin } = await loadMcpLogin();
    await expect(startOrResumeBrowserLogin()).rejects.toThrow("offline");
  });
});
