import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "ink";
import { App } from "../src/App.js";
import { clearLogin } from "../src/config.js";
import { startMcpServer } from "../src/mcp.js";

vi.mock("ink", () => ({ render: vi.fn(() => ({ waitUntilExit: async () => undefined })) }));
vi.mock("../src/App.js", () => ({ App: vi.fn() }));
vi.mock("../src/mcp.js", () => ({ startMcpServer: vi.fn() }));
vi.mock("../src/config.js", () => ({ baseUrl: "https://www.clozemaster.com", clearLogin: vi.fn() }));

const ENTER_ALTERNATE_SCREEN = "\x1b[?1049h\x1b[H";

async function runCli(...args: string[]) {
  vi.resetModules();
  process.argv = ["node", "clozemaster", ...args];
  await import("../src/cli.js");
}

describe("cli", () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process, "on").mockImplementation(() => process);
    vi.stubEnv("CLOZEMASTER_TOKEN", "");
    vi.stubEnv("CLOZEMASTER_COOKIE", "");
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("plays full screen with no command", async () => {
    await runCli();
    expect(process.stdout.write).toHaveBeenCalledWith(ENTER_ALTERNATE_SCREEN);
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ type: App, props: { forceLogin: false } }));
  });

  it("restores the terminal on exit", async () => {
    await runCli();
    expect(process.on).toHaveBeenCalledWith("exit", expect.any(Function));
  });

  it("forces a fresh login with login", async () => {
    await runCli("login");
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ props: { forceLogin: true } }));
  });

  it.each(["help", "--help", "-h"])("prints the usage for %s", async (command) => {
    await runCli(command);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Usage\n  clozemaster          play"));
    expect(render).not.toHaveBeenCalled();
  });

  it("logs out", async () => {
    await runCli("logout");
    expect(clearLogin).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("Logged out of https://www.clozemaster.com.");
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it("warns that a login in the environment still logs you in after logout", async () => {
    vi.stubEnv("CLOZEMASTER_TOKEN", "1:abc");
    vi.stubEnv("CLOZEMASTER_COOKIE", "session=abc");
    await runCli("logout");
    expect(console.log).toHaveBeenLastCalledWith("CLOZEMASTER_TOKEN and CLOZEMASTER_COOKIE still logs you in until you unset it.");
  });

  it("runs the MCP server", async () => {
    await runCli("mcp");
    expect(startMcpServer).toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it("rejects an unknown command with the usage and a failing exit code", async () => {
    await runCli("dance");
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/^Unknown command: dance\n\nPlay Clozemaster in your terminal\./));
    expect(process.exitCode).toBe(1);
  });
});
