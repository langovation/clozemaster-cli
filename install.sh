#!/bin/sh
set -e

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
url="https://github.com/langovation/clozemaster-cli/releases/latest/download/clozemaster-$os-$arch"

echo "Installing Clozemaster CLI..."
mkdir -p "$install_dir"
curl -fsSL "$url" -o "$install_dir/clozemaster.tmp"
chmod +x "$install_dir/clozemaster.tmp"
mv "$install_dir/clozemaster.tmp" "$install_dir/clozemaster"

case ":$PATH:" in
  *":$install_dir:"*) ;;
  *)
    case "$(basename "${SHELL:-sh}")" in
      zsh) profile="$HOME/.zshrc" ;;
      bash) profile="$HOME/.bashrc" ;;
      *) profile="$HOME/.profile" ;;
    esac
    echo "export PATH=\"$install_dir:\$PATH\"" >> "$profile"
    echo "Added $install_dir to your PATH in $profile. Open a new terminal to use it."
    ;;
esac

echo "Done! Type clozemaster to start playing."
