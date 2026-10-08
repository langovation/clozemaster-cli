# Clozemaster CLI

Play [Clozemaster](https://www.clozemaster.com) in your terminal: multiple choice, text input, listening or flashcards, with pixel art.

## Install

Like `claude`, one line installs a `clozemaster` command on macOS or Linux:

```sh
curl -fsSL https://www.clozemaster.com/install-cli.sh | sh
```

Then type `clozemaster` to play.

The installer downloads the executable for your platform from the latest [GitHub release](https://github.com/langovation/clozemaster-cli/releases/latest) and checks it against the release's `SHA256SUMS`. That catches a corrupted or truncated download; it isn't a signature, so it doesn't prove who built the file.

### Uninstall

```sh
clozemaster logout
claude mcp remove clozemaster   # only if you added it to Claude Code
rm ~/.local/bin/clozemaster
rm -rf ~/.config/clozemaster ~/.cache/clozemaster
```

If `~/.local/bin` wasn't already on your `PATH`, the installer added a line like `export PATH="/Users/you/.local/bin:$PATH"` to your shell profile: `~/.zshrc` for zsh, `~/.bash_profile` for bash on macOS, `~/.bashrc` for bash on Linux, or `~/.profile` for other shells. Delete that line if nothing else needs it.

## Run from source

Needs Node 20 or newer.

```sh
git clone https://github.com/langovation/clozemaster-cli.git
cd clozemaster-cli
npm install
npm run dev
```

## Release a new version

1. Bump `version` in `package.json` and commit it.
2. Tag the commit and push the tag: `git tag v0.2.0 && git push origin v0.2.0`. The release workflow (`.github/workflows/release.yml`) runs the tests, builds an executable for each platform with `npm run build:binary -- --all`, and publishes them with `SHA256SUMS` as the latest GitHub release. `install.sh` always downloads from the latest release.
3. Once the release has its assets, set `lib/cli/cli-version.txt` in the web repo to the new version. Every CLI reads that file on launch and, if it's older, tells the user to rerun the install line, so it goes last.

The copy of `install.sh` served at clozemaster.com lives in the web repo at `lib/cli/install-cli.sh`.

## Commands

| Command | What it does |
| --- | --- |
| `clozemaster` | Play (logs you in first if needed) |
| `clozemaster login` | Log in again with your browser |
| `clozemaster logout` | Forget your login on this machine |
| `clozemaster mcp` | Run an MCP server so AI apps can add sentences to your collections |
| `clozemaster --version` | Print the version (also `-v` or `version`) |

While playing: `1`-`4` picks an answer, `→` gives one hint per sentence, `tab` switches answer mode, `p` replays the audio, `h` replays it at half speed, `e` explains the sentence, `s` opens settings and `esc` goes back to the menu. In flashcards, `space` reveals, then `1` again, `2` good or `k` known. Press `c` on the menu for Quick Capture and `f` to email feedback to support@clozemaster.com.

## Use with Claude and other AI apps (MCP)

`clozemaster mcp` lets an AI app write sentences straight into your own Clozemaster collections. Ask it something like "add 10 sentences about cooking to my German collection" and it writes the sentences, translations and clozes for you.

### How it works

It's a local MCP server that talks over stdio. Your AI app starts it in the background whenever it needs it, so you never run it yourself. It uses the login saved by `clozemaster`. If you haven't logged in yet, the first request opens your browser to log in, and the AI can carry on once you approve it.

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
