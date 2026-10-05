import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import packageJson from "../package.json" with { type: "json" };
import { startFakeServer } from "./fakeServer.js";
import { settle, stripAnsi, waitForText } from "./helpers.js";

const UPDATE_COMMAND = "curl -fsSL https://www.clozemaster.com/install-cli.sh | sh";

describe("update notice", () => {
  beforeEach(() => vi.stubEnv("CLOZEMASTER_TOKEN", "1:test"));

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("tells the user how to update when the site has a newer version", async () => {
    startFakeServer({ latestCliVersion: "99.0.0" });
    const app = render(<App />);

    await waitForText(app.lastFrame, "99.0.0");

    expect(stripAnsi(app.lastFrame() ?? "")).toContain(UPDATE_COMMAND);
  });

  it("stays quiet when this is already the latest version", async () => {
    startFakeServer({ latestCliVersion: packageJson.version });
    const app = render(<App />);
    await settle();

    expect(stripAnsi(app.lastFrame() ?? "")).not.toContain(UPDATE_COMMAND);
  });
});
