#!/usr/bin/env bash
# Alternative packager (macOS/Linux). Run from the project root: bash scripts/make-zip.sh
set -e
cd "$(dirname "$0")/.."
zip -r prompt-vault.zip . -x "node_modules/*" "dist/*" ".git/*" "prompt-vault.zip"
echo "Created prompt-vault.zip"
