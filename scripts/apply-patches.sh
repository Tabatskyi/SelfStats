#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Updating Git submodules..."
git -C "$ROOT_DIR" submodule update --init --recursive

if [ -d "$ROOT_DIR/patches" ]; then
    for patchfile in "$ROOT_DIR/patches"/*.patch; do
        if [ -f "$patchfile" ]; then
            echo "==> Applying patch: $(basename "$patchfile")"
            git -C "$ROOT_DIR" apply "$patchfile" 2>/dev/null || echo "Patch $(basename "$patchfile") already applied or clean."
        fi
    done
fi

echo "==> Submodules updated successfully."
