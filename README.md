# Clozemaster CLI

Play [Clozemaster](https://www.clozemaster.com) in your terminal: multiple choice, text input, listening or flashcards, with pixel art.

## Before launch

The install line below doesn't work yet. Still to do:

1. Make this repo public. GitHub blocks release downloads from private repos (#2).
2. Publish release `v0.1.0` with the files from `npm run build:binary -- --all`: `clozemaster-darwin-arm64`, `clozemaster-darwin-x64`, `clozemaster-linux-x64`, `clozemaster-linux-arm64` and `SHA256SUMS`.
3. Run the install line on Linux x64, Linux ARM and an Intel Mac.

Remove this section once all three are done.

## Install

Like `claude`, one line installs a `clozemaster` command on macOS or Linux:

```sh
curl -fsSL https://www.clozemaster.com/install-cli.sh | sh
```

Then type `clozemaster` to play.

## Run from source

Needs Node 20 or newer.

```sh
git clone https://github.com/langovation/clozemaster-cli.git
cd clozemaster-cli
npm install
npm run dev
```

## Release a new version

1. Bump `version` in `package.json`.
2. `npm run build:binary -- --all` builds an executable for each platform into `bin/`.
3. Attach all four to a new GitHub release. `install.sh` always downloads from the latest release.
4. In the web repo, set `public/cli-version.txt` to the new version. Every CLI reads that file on launch and, if it's older, tells the user to rerun the install line.

The copy of `install.sh` served at clozemaster.com lives in the web repo at `public/install-cli.sh`.

**Temporary:** browser login isn't live yet. For now, log in on clozemaster.com, copy your `_clozemaster_session` cookie from the browser's dev tools, and run:

```sh
CLOZEMASTER_COOKIE="_clozemaster_session=<your cookie>" npm run dev
# or
CLOZEMASTER_COOKIE="_clozemaster_session=<your cookie>" clozemaster
```

Keep that cookie private; it's your login.

## Commands

| Command | What it does |
| --- | --- |
| `clozemaster` | Play (logs you in first if needed) |
| `clozemaster login` | Log in again with your browser |
| `clozemaster logout` | Forget your login on this machine |

| `clozemaster mcp` | Run an MCP server on stdio for Claude |

While playing: `1`-`4` picks an answer, `→` gives one hint per sentence, `tab` switches answer mode, `p` replays the audio, `e` explains the sentence, `s` opens settings and `esc` goes back to the menu. In flashcards, `space` reveals, then `1` again, `2` good or `k` known. Press `c` on the menu for Quick Capture and `f` to email feedback to support@clozemaster.com.

## Use with Claude (MCP)

`clozemaster mcp` lets Claude Code or Claude Desktop manage your collections and Quick Capture words: list and create collections, add, edit and delete Quick Capture entries, and import them into a collection. It doesn't play rounds.

Log in first by running `clozemaster` once; the MCP server uses that saved login.

Claude Code:

```sh
claude mcp add clozemaster -- clozemaster mcp
```

Claude Desktop, in `claude_desktop_config.json` (use the full path from `which clozemaster` if Claude can't find it):

```json
{
  "mcpServers": {
    "clozemaster": { "command": "clozemaster", "args": ["mcp"] }
  }
}
```

## Development

```sh
npm install
npm run dev          # run from source
npm test
npm run build        # bundles to dist/cli.js
npm link             # after a build, puts `clozemaster` on your PATH
npm run install:local  # builds the executable and installs it to ~/.local/bin
```

Environment variables:

- `CLOZEMASTER_URL`: server to play against, e.g. `http://localhost:3000` (default `https://www.clozemaster.com`)
- `CLOZEMASTER_TOKEN`: use this API auth token instead of logging in
- `CLOZEMASTER_COOKIE`: use a browser session cookie (`_clozemaster_session=...`) instead of logging in
