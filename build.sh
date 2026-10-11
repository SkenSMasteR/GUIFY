#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js not found."
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "[ERROR] Rust/cargo not found."
  exit 1
fi

if ! command -v spicetify >/dev/null 2>&1; then
  echo "[WARN] spicetify CLI not found in PATH. The app will still build."
  echo
fi

echo "[1/2] Installing dependencies..."
if ! npm install; then
  echo "[ERROR] npm install failed."
  exit 1
fi

echo
echo "[2/2] Building GUIFY (release bundle)..."
if ! npm run tauri build; then
  echo
  echo "[ERROR] Build failed."
  exit 1
fi

echo
echo "Done! Installers are in src-tauri/target/release/bundle/ (deb, rpm, AppImage)"
