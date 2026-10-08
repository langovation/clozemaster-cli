import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import open from "open";
import * as api from "../src/api.js";
import { clearLogin, getStoredUsername } from "../src/config.js";
import { Login } from "../src/screens/Login.js";
import { ENTER, press, stripAnsi, waitForText } from "./helpers.js";

const login = { deviceCode: "device", expiresIn: 600, pollInterval: 0.01, userCode: "ABCD-1234", verificationUrl: "https://example.com/cli" };

describe("Login", () => {
  beforeEach(() => {
    vi.spyOn(api, "startCliLogin").mockResolvedValue(login);
    vi.spyOn(api, "pollCliLogin").mockResolvedValue(null);
  });

  afterEach(() => {
    clearLogin();
    vi.restoreAllMocks();
  });

  it("asks to press enter to log in", () => {
    const { lastFrame } = render(<Login onLoggedIn={vi.fn()} />);
    expect(stripAnsi(lastFrame()!)).toContain("Press Enter to open the browser and log in.");
    expect(stripAnsi(lastFrame()!)).toContain("ctrl+c to quit");
  });

  it("opens the browser and shows the code to approve", async () => {
    const { lastFrame, stdin } = render(<Login onLoggedIn={vi.fn()} />);
    await press(stdin, ENTER);
    await waitForText(lastFrame, "Your code: ABCD-1234");
    expect(stripAnsi(lastFrame()!)).toContain("Browser didn't open? Visit https://example.com/cli");
    expect(stripAnsi(lastFrame()!)).toContain("Waiting for you to log in in the browser…");
    expect(open).toHaveBeenCalledWith("https://example.com/cli");
  });

  it("saves the login and finishes once it's approved", async () => {
    vi.mocked(api.pollCliLogin).mockResolvedValueOnce(null).mockResolvedValue({ authToken: "1:new", username: "learner" });
    const onLoggedIn = vi.fn();
    const { stdin } = render(<Login onLoggedIn={onLoggedIn} />);
    await press(stdin, ENTER);
    await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith("learner"));
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
    expect(getStoredUsername()).toBe("learner");
  });

  it.each([
    [new api.ApiError("Gone", 410), "That login code expired."],
    [new api.ApiError("Not found", 404), "Browser login isn't available on this server yet. Set CLOZEMASTER_TOKEN instead."],
    [new Error("offline"), "Couldn't log in: offline"],
  ])("explains a failed poll: %s", async (error, message) => {
    vi.mocked(api.pollCliLogin).mockRejectedValue(error);
    const { lastFrame, stdin } = render(<Login onLoggedIn={vi.fn()} />);
    await press(stdin, ENTER);
    await waitForText(lastFrame, message);
    expect(stripAnsi(lastFrame()!)).toContain("Press Enter to try again.");
  });

  it("explains a failure to start the login", async () => {
    vi.mocked(api.startCliLogin).mockRejectedValue(new Error("offline"));
    const { lastFrame, stdin } = render(<Login onLoggedIn={vi.fn()} />);
    await press(stdin, ENTER);
    await waitForText(lastFrame, "Couldn't log in: offline");
  });

  it("tries again with enter after a failure", async () => {
    vi.mocked(api.startCliLogin).mockRejectedValueOnce(new Error("offline"));
    const { lastFrame, stdin } = render(<Login onLoggedIn={vi.fn()} />);
    await press(stdin, ENTER);
    await waitForText(lastFrame, "Couldn't log in: offline");
    await press(stdin, ENTER);
    await waitForText(lastFrame, "Your code: ABCD-1234");
  });
});
