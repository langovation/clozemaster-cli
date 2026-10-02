# Clozemaster CLI

Play [Clozemaster](https://www.clozemaster.com) in your terminal: multiple choice or text input, with pixel art.

## Install

Needs Node 20 or newer.

```sh
npx clozemaster
```

Or install it globally and run `clozemaster`:

```sh
npm install -g clozemaster
```

The first run opens your browser to log in. Your login is saved in `~/.config/clozemaster/logins.json`.

## Commands

| Command | What it does |
| --- | --- |
| `clozemaster` | Play (logs you in first if needed) |
| `clozemaster login` | Log in again with your browser |
| `clozemaster logout` | Forget your login on this machine |

While playing: `1`-`4` picks an answer, `tab` switches between multiple choice and text input, `esc` goes back to the menu.

## Development

```sh
npm install
npm run dev          # run from source
npm test
npm run build        # bundles to dist/cli.js
npm link             # puts `clozemaster` on your PATH
```

Environment variables:

- `CLOZEMASTER_URL`: server to play against, e.g. `http://localhost:3000` (default `https://www.clozemaster.com`)
- `CLOZEMASTER_TOKEN`: use this API auth token instead of logging in
- `CLOZEMASTER_COOKIE`: use a browser session cookie (`_clozemaster_session=...`) instead of logging in
