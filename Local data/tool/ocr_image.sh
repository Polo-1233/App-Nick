#!/usr/bin/env bash
# ocr_image.sh
# Extracts text from an image file using Tesseract OCR.
# Usage: ./tools/ocr_image.sh <image_file>
# Output: saves extracted text to transcripts/<basename>.txt and prints the path.

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────
die() { echo "ERROR: $*" >&2; exit 1; }

# ── check dependency ─────────────────────────────────────────────────────────
command -v tesseract >/dev/null 2>&1 || die "tesseract not found. Install with: brew install tesseract"

# ── args ─────────────────────────────────────────────────────────────────────
[[ $# -lt 1 ]] && die "Usage: $0 <image_file>"
INPUT="$1"
[[ -f "$INPUT" ]] || die "File not found: $INPUT"

# ── paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(dirname "$SCRIPT_DIR")"
TRANSCRIPTS_DIR="$WORKSPACE/transcripts"
mkdir -p "$TRANSCRIPTS_DIR"

# Sanitize output filename
BASENAME="$(basename "$INPUT")"
STEM="${BASENAME%.*}"
SAFE_STEM="$(echo "$STEM" | tr ' /' '__' | tr -cd '[:alnum:]_.-')"
OUTPUT_BASE="$TRANSCRIPTS_DIR/${SAFE_STEM}"

# ── guard: do not silently overwrite ─────────────────────────────────────────
if [[ -f "${OUTPUT_BASE}.txt" ]]; then
    TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
    OUTPUT_BASE="$TRANSCRIPTS_DIR/${SAFE_STEM}_${TIMESTAMP}"
    echo "Notice: output file already existed — saving as $(basename "${OUTPUT_BASE}.txt")" >&2
fi

# ── OCR ───────────────────────────────────────────────────────────────────────
echo "Running OCR on: $INPUT" >&2

# tesseract writes to <output_base>.txt automatically (do not add .txt to arg)
tesseract "$INPUT" "$OUTPUT_BASE" >&2

[[ -f "${OUTPUT_BASE}.txt" ]] || die "Tesseract produced no output"

echo "${OUTPUT_BASE}.txt"
