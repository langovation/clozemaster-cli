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
| `clozemaster mcp` | Run an MCP server so AI apps can add sentences to your collections |

While playing: `1`-`4` picks an answer, `→` gives one hint per sentence, `tab` switches answer mode, `p` replays the audio, `e` explains the sentence, `s` opens settings and `esc` goes back to the menu. In flashcards, `space` reveals, then `1` again, `2` good or `k` known. Press `c` on the menu for Quick Capture and `f` to email feedback to support@clozemaster.com.

## Use with Claude and other AI apps (MCP)

`clozemaster mcp` lets an AI app write sentences straight into your own Clozemaster collections. Ask it something like "add 10 sentences about cooking to my German collection" and it writes the sentences, translations and clozes for you.

### How it works

It's a local MCP server that talks over stdio. Your AI app starts it in the background whenever it needs it, so you never run it yourself. It uses the login saved by `clozemaster`, so run `clozemaster` and log in once first.

Tools:

| Tool | What it does |
| --- | --- |
| `list_language_pairings` | The languages you're learning, with the ids the other tools need |
| `list_collections` | Your own collections in a language |
| `create_collection` | Make a new, empty collection |
| `list_sentences` | Page through a collection's sentences |
| `add_sentences` | Add sentences to a collection (needs Clozemaster Pro) |
| `update_sentence` | Change a sentence's text and translation |
| `delete_sentence` | Delete a sentence |

A typical session: the AI lists your language pairings, picks or creates a collection, then adds sentences to it. It only touches collections you own, and it doesn't play rounds.

### Claude Code

```sh
claude mcp add clozemaster -- clozemaster mcp
```

### Claude Desktop

Claude Desktop doesn't see your shell's `PATH`, so give it the full path to the binary. `which clozemaster` prints it; the installer puts it at `~/.local/bin/clozemaster`.

Add this to `claude_desktop_config.json`, at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "clozemaster": { "command": "/Users/you/.local/bin/clozemaster", "args": ["mcp"] }
  }
}
```

The CLI only ships for macOS and Linux for now, so there's no Windows binary to point at yet.

### Other MCP apps

Any app that runs local stdio MCP servers works. Give it the command `clozemaster` (or its full path) with the argument `mcp`.

Cursor (`~/.cursor/mcp.json`) and Gemini CLI (`~/.gemini/settings.json`) use the same shape as Claude Desktop:

```json
{
  "mcpServers": {
    "clozemaster": { "command": "clozemaster", "args": ["mcp"] }
  }
}
```

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "clozemaster": { "type": "stdio", "command": "clozemaster", "args": ["mcp"] }
  }
}
```

Codex CLI (`~/.codex/config.toml`):

```toml
[mcp_servers.clozemaster]
command = "clozemaster"
args = ["mcp"]
```

### ChatGPT

Not yet. ChatGPT only connects to remote MCP servers over HTTPS, not to commands on your computer. It needs a hosted Clozemaster MCP server, which doesn't exist yet.

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
