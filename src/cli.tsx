import React from "react";
import { render } from "ink";
import { App } from "./App.js";
import { baseUrl, clearLogin } from "./config.js";

const HELP = `Play Clozemaster in your terminal.

Usage
  clozemaster          play (logs you in first if needed)
  clozemaster login    log in with your browser
  clozemaster logout   forget your login on this machine

Environment
  CLOZEMASTER_TOKEN    use this auth token instead of logging in
  CLOZEMASTER_COOKIE   use a browser session cookie instead of logging in
  CLOZEMASTER_URL      server to play against (default https://www.clozemaster.com)`;

const command = process.argv[2];

if (command === "help" || command === "--help" || command === "-h") {
  console.log(HELP);
} else if (command === "logout") {
  clearLogin();
  console.log(`Logged out of ${baseUrl}.`);
} else if (command === undefined || command === "login") {
  render(<App forceLogin={command === "login"} />);
} else {
  console.error(`Unknown command: ${command}\n\n${HELP}`);
  process.exitCode = 1;
}
