#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PATCHES_DIR="$ROOT_DIR/patches"

echo "==> Updating Git submodules..."
git -C "$ROOT_DIR" submodule update --init --recursive

if [ -d "$PATCHES_DIR" ]; then
    for patchfile in "$PATCHES_DIR"/*.patch; do
        if [ -f "$patchfile" ]; then
            echo "==> Applying patch: $(basename "$patchfile")"
            git -C "$ROOT_DIR" apply "$patchfile" || echo "Warning: Failed to apply $patchfile (already applied or conflicts)"
        fi
    done
fi

echo "==> Submodules updated successfully."
