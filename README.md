# Clozemaster CLI

Play [Clozemaster](https://www.clozemaster.com) in your terminal: multiple choice or text input, with pixel art.

## Run it

Needs Node 20 or newer.

```sh
git clone https://github.com/langovation/clozemaster-cli.git
cd clozemaster-cli
npm install
npm run dev
```

To get a `clozemaster` command on your PATH:

```sh
npm run build
npm link
```

**Temporary:** browser login isn't live yet. For now, log in on clozemaster.com, copy your `_clozemaster_session` cookie from the browser's dev tools, and run:

```sh
CLOZEMASTER_COOKIE="_clozemaster_session=<your cookie>" npm run dev
```

Keep that cookie private; it's your login.

## Commands

| Command | What it does |
| --- | --- |
| `clozemaster` | Play (logs you in first if needed) |
| `clozemaster login` | Log in again with your browser |
| `clozemaster logout` | Forget your login on this machine |

While playing: `1`-`4` picks an answer, `→` gives a hint in text input, `tab` switches answer mode, `esc` goes back to the menu. Press `f` on the menus to email feedback to support@clozemaster.com.

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
