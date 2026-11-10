#!/usr/bin/env bash
# AI Privacy Guard — macOS / Linux installer
# Creates venv and installs dependencies (CPU torch). Hook registration: see README.md.
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="$PROJECT_DIR/venv"

echo
echo "=== AI Privacy Guard - Setup ==="
echo "Project: $PROJECT_DIR"
echo

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] python3 not found. Install Python 3.10+ and retry."; exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "[WARN] Node.js not found. The backup hook and event log need Node.js 18+."
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "[1/2] Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
else
  echo "[1/2] Virtual environment already exists, skipping."
fi

echo "[2/2] Installing dependencies (CPU torch, transformers)..."
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$PROJECT_DIR/requirements.txt"

echo
echo "=== Setup complete ==="
echo
echo "Next steps:"
echo "  1. In hook commands use $VENV_DIR/bin/python (not venv/Scripts/python.exe):"
echo "     edit .claude/settings.json in this repo or ~/.claude/settings.json (see README, Hook registration)."
echo "  2. First prompt downloads the Bielik-Guard model (~500 MB) from HuggingFace."
echo "  3. Demo without the model: cd demo && python separacja.py --in przed --out po"
