# Clozemaster CLI

One `clozemaster` command does two things:

- **CLI**: play [Clozemaster](https://www.clozemaster.com) in your terminal, with multiple choice, text input, listening or flashcards, and pixel art.
- **MCP server**: let Claude and other AI apps write sentences into your own Clozemaster collections.

Both use the same install and the same login.

## Install

One line installs a `clozemaster` command on macOS or Linux:

```sh
curl -fsSL https://www.clozemaster.com/install-cli.sh | sh
```

The installer downloads the executable for your platform from the latest [GitHub release](https://github.com/langovation/clozemaster-cli/releases/latest) and checks it against the release's `SHA256SUMS`. That catches a corrupted or truncated download; it isn't a signature, so it doesn't prove who built the file.

## CLI: play in your terminal

Type `clozemaster` to play. The first time, it asks you to log in with your browser.

### Commands

| Command | What it does |
| --- | --- |
| `clozemaster` | Play (logs you in first if needed) |
| `clozemaster login` | Log in again with your browser |
| `clozemaster logout` | Forget your login on this machine |
| `clozemaster --version` | Print the version (also `-v` or `version`) |

### Keys

While playing: `1`-`4` picks an answer, `→` gives one hint per sentence, `tab` switches answer mode, `p` replays the audio, `h` replays it at half speed, `e` explains the sentence, `s` opens settings and `esc` goes back to the menu. In flashcards, `space` reveals, then `1` again, `2` good or `k` known. Press `c` on the menu for Quick Capture and `f` to email feedback to support@clozemaster.com.

## MCP: let AI apps manage your collections

`clozemaster mcp` lets an AI app write sentences straight into your own Clozemaster collections. Ask it something like "add 10 sentences about cooking to my German collection" and it writes the sentences, translations and clozes for you.

### How it works

It's a local MCP server that talks over stdio. Your AI app starts it in the background whenever it needs it, so you never run it yourself. It uses the login saved by `clozemaster`. If you haven't logged in yet, the first request opens your browser to log in, and the AI can carry on once you approve it.

### Tools

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

### Add it to Claude Code

```sh
claude mcp add -s user clozemaster -- clozemaster mcp
```

`-s user` makes it available in every project, not just the folder you run it in.

### Add it to Claude Desktop

Claude Desktop doesn't see your shell's `PATH`, so give it the full path to the binary. `which clozemaster` prints it; the installer puts it at `~/.local/bin/clozemaster`.

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "clozemaster": { "command": "/Users/you/.local/bin/clozemaster", "args": ["mcp"] }
  }
}
```

### Add it to other AI apps

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

## Uninstall

```sh
clozemaster logout
claude mcp remove clozemaster   # only if you added it to Claude Code
rm ~/.local/bin/clozemaster
rm -rf ~/.config/clozemaster ~/.cache/clozemaster
```

If `~/.local/bin` wasn't already on your `PATH`, the installer added a line like `export PATH="/Users/you/.local/bin:$PATH"` to your shell profile: `~/.zshrc` for zsh, `~/.bash_profile` for bash on macOS, `~/.bashrc` for bash on Linux, or `~/.profile` for other shells. Delete that line if nothing else needs it.

## Development

Needs Node 20 or newer.

```sh
git clone https://github.com/langovation/clozemaster-cli.git
cd clozemaster-cli
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

### Release a new version

```sh
npm run release -- 0.2.0
```

From a clean, pushed `main`, the script:

1. Bumps `version` in `package.json`, commits it, tags `v0.2.0` and pushes both.
2. Waits for the release workflow (`.github/workflows/release.yml`), which runs the tests, builds an executable for each platform and publishes them with `SHA256SUMS` as the latest GitHub release. `install.sh` always downloads from the latest release.
3. Checks the release has all five files.
4. Opens a web repo PR setting `lib/cli/cli-version.txt` to the new version. Every CLI reads that file on launch and, if it's older, tells the user to rerun the install line, so merge it last. The script looks for the web repo next to this one; set `CLOZEMASTER_WEB_REPO` if it's elsewhere.

The copy of `install.sh` served at clozemaster.com lives in the web repo at `lib/cli/install-cli.sh`.
