#!/usr/bin/env bash
# transcribe_audio.sh
# Transcribes an audio (or video) file using mlx_whisper.
# Usage: ./tools/transcribe_audio.sh <audio_file>
# Output: saves transcript to transcripts/<basename>.txt and prints the path.

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────
die() { echo "ERROR: $*" >&2; exit 1; }

# ── args ─────────────────────────────────────────────────────────────────────
[[ $# -lt 1 ]] && die "Usage: $0 <audio_file>"
INPUT="$1"
[[ -f "$INPUT" ]] || die "File not found: $INPUT"

# ── paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(dirname "$SCRIPT_DIR")"
TRANSCRIPTS_DIR="$WORKSPACE/transcripts"
mkdir -p "$TRANSCRIPTS_DIR"

# Sanitize output filename: keep stem, replace spaces/special chars with _
BASENAME="$(basename "$INPUT")"
STEM="${BASENAME%.*}"
SAFE_STEM="$(echo "$STEM" | tr ' /' '__' | tr -cd '[:alnum:]_.-')"
OUTPUT="$TRANSCRIPTS_DIR/${SAFE_STEM}.txt"

# ── guard: do not silently overwrite ─────────────────────────────────────────
if [[ -f "$OUTPUT" ]]; then
    TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
    OUTPUT="$TRANSCRIPTS_DIR/${SAFE_STEM}_${TIMESTAMP}.txt"
    echo "Notice: output file already existed — saving as $(basename "$OUTPUT")" >&2
fi

# ── transcription ─────────────────────────────────────────────────────────────
echo "Transcribing: $INPUT" >&2

# mlx_whisper outputs a JSON/text result; we use --output-format txt
# The -o flag sets the output directory; mlx_whisper names the file after the input stem.
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mlx_whisper \
    --model mlx-community/whisper-large-v3-turbo \
    --output-format txt \
    --output-dir "$TMP_DIR" \
    "$INPUT" >&2

# mlx_whisper places <stem>.txt inside $TMP_DIR
TMP_FILE="$TMP_DIR/${STEM}.txt"

# Fallback: find any .txt produced if the name was altered
if [[ ! -f "$TMP_FILE" ]]; then
    TMP_FILE="$(find "$TMP_DIR" -name '*.txt' | head -1)"
fi
[[ -f "$TMP_FILE" ]] || die "mlx_whisper produced no .txt output in $TMP_DIR"

# Move to final destination
mv "$TMP_FILE" "$OUTPUT"

echo "$OUTPUT"
