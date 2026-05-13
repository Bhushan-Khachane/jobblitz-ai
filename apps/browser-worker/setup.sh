#!/bin/bash
set -e

echo "Setting up gstack browser worker..."

# Detect if running inside Docker
if [ -f "/.dockerenv" ] || [ "$DOCKER_CONTAINER" = "true" ]; then
  GSTACK_DIR="/opt/gstack"
  BROWSE="/opt/gstack/browse/dist/browse"
else
  # Local dev path
  GSTACK_DIR="$HOME/.claude/skills/gstack"
  BROWSE="$HOME/.claude/skills/gstack/browse/dist/browse"
fi

# Install bun if not present
if ! command -v bun >/dev/null 2>&1; then
  echo "Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Clone gstack if not present
if [ ! -d "$GSTACK_DIR" ]; then
  echo "Cloning gstack..."
  git clone https://github.com/garrytan/gstack.git "$GSTACK_DIR"
fi

# Build browse binary
cd "$GSTACK_DIR"
./setup

# Verify binary
if [ -x "$BROWSE" ]; then
  echo "✅ gstack browse binary ready at $BROWSE"
else
  echo "❌ Build failed. Check $GSTACK_DIR/setup output."
  exit 1
fi

echo "✅ gstack browser worker setup complete."
