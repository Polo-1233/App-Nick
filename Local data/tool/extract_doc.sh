#!/usr/bin/env bash
# extract_doc.sh
# Extracts plain text from a document (PDF, DOCX, PPTX, EPUB, etc.) using Pandoc.
# Usage: ./tools/extract_doc.sh <document_file>
# Output: saves plain text to transcripts/<basename>.txt and prints the path.

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────
die() { echo "ERROR: $*" >&2; exit 1; }

# ── check dependency ─────────────────────────────────────────────────────────
command -v pandoc >/dev/null 2>&1 || die "pandoc not found. Install with: brew install pandoc"

# ── args ─────────────────────────────────────────────────────────────────────
[[ $# -lt 1 ]] && die "Usage: $0 <document_file>"
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
OUTPUT="$TRANSCRIPTS_DIR/${SAFE_STEM}.txt"

# ── guard: do not silently overwrite ─────────────────────────────────────────
if [[ -f "$OUTPUT" ]]; then
    TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
    OUTPUT="$TRANSCRIPTS_DIR/${SAFE_STEM}_${TIMESTAMP}.txt"
    echo "Notice: output file already existed — saving as $(basename "$OUTPUT")" >&2
fi

# ── extraction ────────────────────────────────────────────────────────────────
echo "Extracting text from: $INPUT" >&2
EXT="${BASENAME##*.}"
EXT_LOWER="$(echo "$EXT" | tr '[:upper:]' '[:lower:]')"

# Choose pandoc input format based on extension
case "$EXT_LOWER" in
    pdf)
        # Pandoc can read PDF natively (via pdftotext internally) since v2.17
        pandoc --from pdf --to plain --wrap=none -o "$OUTPUT" "$INPUT" 2>&1 >&2 \
        || { echo "Notice: pandoc PDF read failed, trying pdftotext fallback" >&2
             command -v pdftotext >/dev/null 2>&1 || die "pdftotext not found. Install with: brew install poppler"
             pdftotext -layout "$INPUT" "$OUTPUT"; }
        ;;
    docx|odt|rtf|doc)
        pandoc --to plain --wrap=none -o "$OUTPUT" "$INPUT" >&2
        ;;
    pptx|odp)
        pandoc --to plain --wrap=none -o "$OUTPUT" "$INPUT" >&2
        ;;
    epub|html|htm|md|rst|tex|txt)
        pandoc --to plain --wrap=none -o "$OUTPUT" "$INPUT" >&2
        ;;
    *)
        # Let pandoc guess
        echo "Warning: unknown extension '$EXT', letting pandoc detect format." >&2
        pandoc --to plain --wrap=none -o "$OUTPUT" "$INPUT" >&2
        ;;
esac

[[ -f "$OUTPUT" ]] || die "No output produced for $INPUT"

echo "$OUTPUT"
