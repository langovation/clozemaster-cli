import React from "react";
import { render } from "ink";
import { App } from "./App.js";
import { baseUrl, clearLogin } from "./config.js";
import { startMcpServer } from "./mcp.js";

const HELP = `Play Clozemaster in your terminal.

Usage
  clozemaster          play (logs you in first if needed)
  clozemaster login    log in with your browser
  clozemaster logout   forget your login on this machine
  clozemaster mcp      run an MCP server on stdio so Claude can manage your collections and Quick Capture

Environment
  CLOZEMASTER_TOKEN    use this auth token instead of logging in
  CLOZEMASTER_COOKIE   use a browser session cookie instead of logging in
  CLOZEMASTER_URL      server to play against (default https://www.clozemaster.com)`;

const ENTER_ALTERNATE_SCREEN = "\x1b[?1049h\x1b[H";
const LEAVE_ALTERNATE_SCREEN = "\x1b[?1049l";

// Like Claude Code: take over the whole terminal and hand it back untouched on exit.
async function runFullScreen(app: React.ReactElement) {
  process.stdout.write(ENTER_ALTERNATE_SCREEN);
  process.on("exit", () => process.stdout.write(LEAVE_ALTERNATE_SCREEN));
  await render(app).waitUntilExit();
}

const command = process.argv[2];

if (command === "help" || command === "--help" || command === "-h") {
  console.log(HELP);
} else if (command === "logout") {
  clearLogin();
  console.log(`Logged out of ${baseUrl}.`);
  const loginVariables = ["CLOZEMASTER_TOKEN", "CLOZEMASTER_COOKIE"].filter((name) => process.env[name]);
  if (loginVariables.length) console.log(`${loginVariables.join(" and ")} still logs you in until you unset it.`);
} else if (command === "mcp") {
  startMcpServer();
} else if (command === undefined || command === "login") {
  runFullScreen(<App forceLogin={command === "login"} />);
} else {
  console.error(`Unknown command: ${command}\n\n${HELP}`);
  process.exitCode = 1;
}
