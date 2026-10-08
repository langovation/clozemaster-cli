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

describe("startBrowserLogin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(startCliLogin).mockResolvedValue(login);
    vi.mocked(pollCliLogin).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("opens the browser and says which code to approve", async () => {
    const { startBrowserLogin } = await loadMcpLogin();
    const message = await startBrowserLogin();
    expect(open).toHaveBeenCalledWith("https://example.com/cli");
    expect(message).toBe(
      "Not logged in to Clozemaster yet. A browser window opened to log in, showing the code ABCD-1234 (if it didn't open, visit https://example.com/cli). Ask the user to log in and approve it there, then call this tool again.",
    );
  });

  it("still gives the code when the browser can't be opened", async () => {
    vi.mocked(open).mockRejectedValueOnce(new Error("no browser"));
    const { startBrowserLogin } = await loadMcpLogin();
    expect(await startBrowserLogin()).toContain("ABCD-1234");
  });

  it("reuses the pending login instead of starting another", async () => {
    const { startBrowserLogin } = await loadMcpLogin();
    await startBrowserLogin();
    await startBrowserLogin();
    expect(startCliLogin).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("starts a new login once the pending one has expired", async () => {
    const { startBrowserLogin } = await loadMcpLogin();
    await startBrowserLogin();
    await vi.advanceTimersByTimeAsync(600_000);
    await startBrowserLogin();
    expect(startCliLogin).toHaveBeenCalledTimes(2);
  });

  it("polls at the login's interval until it's approved, then saves it", async () => {
    vi.mocked(pollCliLogin).mockResolvedValueOnce(null).mockResolvedValueOnce({ authToken: "1:approved", username: "learner" });
    const { startBrowserLogin } = await loadMcpLogin();
    await startBrowserLogin();
    await vi.advanceTimersByTimeAsync(2000);
    expect(pollCliLogin).toHaveBeenCalledWith("device");
    expect(saveLogin).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(saveLogin).toHaveBeenCalledWith({ authToken: "1:approved", username: "learner" });
  });

  it("stops polling once the login is approved", async () => {
    vi.mocked(pollCliLogin).mockResolvedValue({ authToken: "1:approved", username: "learner" });
    const { startBrowserLogin } = await loadMcpLogin();
    await startBrowserLogin();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pollCliLogin).toHaveBeenCalledTimes(1);
  });

  it("starts a new login after the approved one was saved", async () => {
    vi.mocked(pollCliLogin).mockResolvedValue({ authToken: "1:approved", username: "learner" });
    const { startBrowserLogin } = await loadMcpLogin();
    await startBrowserLogin();
    await vi.advanceTimersByTimeAsync(2000);
    await startBrowserLogin();
    expect(startCliLogin).toHaveBeenCalledTimes(2);
  });

  it("drops the pending login when polling fails, so the next call starts a new one", async () => {
    vi.mocked(pollCliLogin).mockRejectedValue(new Error("expired"));
    const { startBrowserLogin } = await loadMcpLogin();
    await startBrowserLogin();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pollCliLogin).toHaveBeenCalledTimes(1);

    await startBrowserLogin();
    expect(startCliLogin).toHaveBeenCalledTimes(2);
  });

  it("passes on a failure to start the login", async () => {
    vi.mocked(startCliLogin).mockRejectedValue(new Error("offline"));
    const { startBrowserLogin } = await loadMcpLogin();
    await expect(startBrowserLogin()).rejects.toThrow("offline");
  });
});
