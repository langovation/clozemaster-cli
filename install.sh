#!/bin/sh
set -e

# Everything runs from main, called on the last line, so a download cut off midway runs nothing.
main() {
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) echo "Clozemaster CLI supports macOS and Linux." >&2; exit 1 ;;
  esac

  case "$(uname -m)" in
    arm64 | aarch64) arch=arm64 ;;
    x86_64 | amd64) arch=x64 ;;
    *) echo "Unsupported processor: $(uname -m)" >&2; exit 1 ;;
  esac

  # Rosetta reports x86_64 on Apple chips; the native build is faster.
  if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" = 1 ]; then
    arch=arm64
  fi

  install_dir="$HOME/.local/bin"
  file="clozemaster-$os-$arch"
  release_url="https://github.com/langovation/clozemaster-cli/releases/latest/download"

  echo "Installing Clozemaster CLI..."
  mkdir -p "$install_dir"
  download "$release_url/$file" "$install_dir/clozemaster.tmp"
  download "$release_url/SHA256SUMS" "$install_dir/clozemaster.sha256sums"
  verify_checksum "$file" "$install_dir/clozemaster.tmp" "$install_dir/clozemaster.sha256sums"
  rm "$install_dir/clozemaster.sha256sums"
  chmod +x "$install_dir/clozemaster.tmp"
  mv "$install_dir/clozemaster.tmp" "$install_dir/clozemaster"

  case ":$PATH:" in
    *":$install_dir:"*) ;;
    *) add_to_path "$install_dir" "$os" ;;
  esac

  echo "Done! Type clozemaster to start playing."
}

download() {
  curl --proto '=https' --tlsv1.2 -fsSL --retry 3 "$1" -o "$2" || { echo "Download failed: $1" >&2; exit 1; }
}

verify_checksum() {
  expected=$(grep " $1\$" "$3" | cut -d " " -f 1)
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$2" | cut -d " " -f 1)
  else
    actual=$(shasum -a 256 "$2" | cut -d " " -f 1)
  fi
  if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
    rm -f "$2" "$3"
    echo "Checksum check failed for $1. Please try again." >&2
    exit 1
  fi
}

add_to_path() {
  case "$(basename "${SHELL:-sh}")" in
    zsh) profile="$HOME/.zshrc" ;;
    # Terminal apps on macOS start bash as a login shell, which reads .bash_profile, not .bashrc.
    bash) if [ "$2" = darwin ]; then profile="$HOME/.bash_profile"; else profile="$HOME/.bashrc"; fi ;;
    *) profile="$HOME/.profile" ;;
  esac
  path_line="export PATH=\"$1:\$PATH\""
  if ! grep -qsF "$path_line" "$profile"; then
    echo "$path_line" >> "$profile"
  fi
  echo "Added $1 to your PATH in $profile. Open a new terminal to use it."
}

main "$@"
