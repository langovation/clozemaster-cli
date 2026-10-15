#!/bin/sh
# Usage: sh scripts/check-self-update.sh <version>, after npm run build:binary has built <version> into bin/.
# Checks an old build of this code updates itself to bin/'s executable for this machine, served from a local server.
set -eu

version="$1"
target="$(node -p 'process.platform + "-" + process.arch')"
port=8765
server="http://127.0.0.1:$port"
work="$(mktemp -d)"
binary="$work/home/.local/bin/clozemaster"

fail() {
  echo "$1" >&2
  exit 1
}

publish_release_locally() {
  mkdir -p "$work/site/v$version"
  cp "bin/clozemaster-$target" bin/SHA256SUMS "$work/site/v$version/"
  echo "$version" > "$work/site/cli-version.txt"
  python3 -m http.server "$port" --bind 127.0.0.1 --directory "$work/site" >/dev/null 2>&1 &
  server_pid=$!
  trap 'kill $server_pid' EXIT
}

install_old_build() {
  cp package.json package-lock.json "$work/"
  npm version 0.0.1 --no-git-tag-version >/dev/null
  npm run build:binary >/dev/null
  cp "$work/package.json" "$work/package-lock.json" .
  mkdir -p "$(dirname "$binary")"
  mv "bin/clozemaster-$target" "$binary"
  cp "$work/site/v$version/clozemaster-$target" "$work/site/v$version/SHA256SUMS" bin/
}

# Keeps the mcp server running until it has replaced itself, or a minute passes.
run_mcp_until_updated() {
  (
    for _ in $(seq 60); do
      [ "$("$binary" --version)" = "$version" ] && break
      sleep 1
    done
  ) | HOME="$work/home" XDG_CONFIG_HOME="" CLOZEMASTER_URL="$server" CLOZEMASTER_RELEASES_URL="$server" "$binary" mcp
}

check_installed_release() {
  [ "$("$binary" --version)" = "$version" ] || fail "Still on $("$binary" --version) after a minute, expected $version."
  expected=$(grep " clozemaster-$target\$" bin/SHA256SUMS | cut -d " " -f 1)
  actual=$(shasum -a 256 "$binary" | cut -d " " -f 1)
  [ "$expected" = "$actual" ] || fail "The installed executable doesn't match the release's checksum."
  [ "$(ls -A "$(dirname "$binary")")" = "clozemaster" ] || fail "Left files behind: $(ls -A "$(dirname "$binary")")"
  sleep 1 | HOME="$work/home" "$binary" mcp 2>&1 | grep -q "running on stdio" || fail "The updated mcp server doesn't start."
}

publish_release_locally
install_old_build
run_mcp_until_updated
check_installed_release
echo "$target updated itself from 0.0.1 to $version."
