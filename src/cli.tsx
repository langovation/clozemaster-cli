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
  clozemaster mcp      run an MCP server on stdio so Claude can write sentences into your collections

Environment
  CLOZEMASTER_TOKEN    use this auth token instead of logging in
  CLOZEMASTER_COOKIE   use a browser session cookie instead of logging in
  CLOZEMASTER_URL      server to play against (default https://www.clozemaster.com)`;

const ENTER_ALTERNATE_SCREEN = "\x1b[?1049h\x1b[H";
const LEAVE_ALTERNATE_SCREEN = "\x1b[?1049l";
const LOGIN_VARIABLES = ["CLOZEMASTER_TOKEN", "CLOZEMASTER_COOKIE"];

const command = process.argv[2];

switch (command) {
  case undefined:
  case "login":
    runFullScreen(<App forceLogin={command === "login"} />);
    break;
  case "help":
  case "--help":
  case "-h":
    console.log(HELP);
    break;
  case "logout":
    logOut();
    break;
  case "mcp":
    startMcpServer();
    break;
  default:
    console.error(`Unknown command: ${command}\n\n${HELP}`);
    process.exitCode = 1;
}

// Like Claude Code: take over the whole terminal and hand it back untouched on exit.
async function runFullScreen(app: React.ReactElement) {
  process.stdout.write(ENTER_ALTERNATE_SCREEN);
  process.on("exit", () => process.stdout.write(LEAVE_ALTERNATE_SCREEN));
  await render(app).waitUntilExit();
}

function logOut() {
  clearLogin();
  console.log(`Logged out of ${baseUrl}.`);
  const setLoginVariables = LOGIN_VARIABLES.filter((name) => process.env[name]);
  if (setLoginVariables.length) console.log(`${setLoginVariables.join(" and ")} still logs you in until you unset it.`);
}
