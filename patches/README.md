# Git Submodule Patches

This directory contains `.patch` files and utility scripts to customize or patch submodules while keeping upstream tracking clean and independent.

## Structure

- Place any `.patch` files in this directory.
- Run `./scripts/apply-patches.sh` (or `make patch`) to apply all patches across submodules.

## Usage Example

To create a patch after making local tweaks to a submodule:

```bash
cd src/submodules/awesome-github-stats
git diff > ../../../patches/awesome-github-stats.patch
```

To apply existing patches:

```bash
./scripts/apply-patches.sh
```
