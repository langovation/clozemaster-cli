#!/bin/sh
# Usage: npm run release -- 0.2.0
set -eu

version="${1:-}"
tag="v$version"
web_repo="${CLOZEMASTER_WEB_REPO:-$(cd "$(dirname "$0")/../.." && pwd)/web}"

fail() {
  echo "$1" >&2
  exit 1
}

check_ready() {
  echo "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || fail "Usage: npm run release -- <version>, e.g. 0.2.0"
  [ "$(git branch --show-current)" = "main" ] || fail "Release from main."
  [ -z "$(git status --porcelain)" ] || fail "Commit or stash your changes first."
  git fetch -q origin
  [ "$(git rev-parse main)" = "$(git rev-parse origin/main)" ] || fail "main and origin/main differ. Push or pull first."
  git rev-parse -q --verify "refs/tags/$tag" >/dev/null && fail "$tag already exists."
  gh auth status >/dev/null 2>&1 || fail "Log in to GitHub first: gh auth login"
  [ -d "$web_repo/.git" ] || fail "Can't find the web repo at $web_repo. Set CLOZEMASTER_WEB_REPO."
}

bump_version() {
  [ "$(node -p "require('./package.json').version")" = "$version" ] && return
  npm version "$version" --no-git-tag-version >/dev/null
  git commit -qam "chore: release $tag"
}

tag_and_push() {
  bump_version
  git tag "$tag"
  git push -q origin main "$tag"
}

watch_release_workflow() {
  echo "Waiting for the release workflow to start…"
  run_id=""
  while [ -z "$run_id" ]; do
    sleep 5
    run_id=$(gh run list --workflow release.yml --branch "$tag" --limit 1 --json databaseId --jq '.[0].databaseId // empty')
  done
  gh run watch "$run_id" --exit-status || fail "The release workflow failed: gh run view $run_id --log-failed"
}

check_release_assets() {
  asset_count=$(gh release view "$tag" --json assets --jq '.assets | length')
  [ "$asset_count" = "5" ] || fail "$tag has $asset_count files, expected 4 binaries and SHA256SUMS."
}

# Last, so no CLI is told to update before the binaries exist.
open_web_version_pr() {
  branch="release-cli-$tag"
  worktree="$(mktemp -d)/web"
  git -C "$web_repo" fetch -q origin
  if [ "$(git -C "$web_repo" show origin/master:lib/cli/cli-version.txt)" = "$version" ]; then
    echo "The web repo already announces $version."
    return
  fi
  git -C "$web_repo" worktree add -q -b "$branch" "$worktree" origin/master
  echo "$version" > "$worktree/lib/cli/cli-version.txt"
  git -C "$worktree" commit -qam "chore: tell CLIs that $tag is out"
  git -C "$worktree" push -q -u origin "$branch"
  (cd "$worktree" && gh pr create --title "chore: tell CLIs that $tag is out" --body "Sets \`lib/cli/cli-version.txt\` to $version, now that the $tag release has its binaries. Installed CLIs will tell users to update once this deploys.")
  git -C "$web_repo" worktree remove "$worktree"
}

check_ready
tag_and_push
watch_release_workflow
check_release_assets
open_web_version_pr
echo "Released $tag. Merge the web PR above to tell installed CLIs to update."
