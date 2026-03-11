#!/usr/bin/env bash
# process_source.sh
# Master dispatcher: detects file type by extension and runs the right tool.
# Usage: ./tools/process_source.sh <source_file>
# Output: prints path of generated transcript and a clear processing summary.

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────
die()  { echo "ERROR: $*" >&2; exit 1; }
info() { echo "  $*" >&2; }

# ── args ─────────────────────────────────────────────────────────────────────
[[ $# -lt 1 ]] && die "Usage: $0 <source_file>"
INPUT="$1"
[[ -f "$INPUT" ]] || die "File not found: $INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── detect type ───────────────────────────────────────────────────────────────
BASENAME="$(basename "$INPUT")"
EXT="${BASENAME##*.}"
EXT_LOWER="$(echo "$EXT" | tr '[:upper:]' '[:lower:]')"

echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  Nick Brain — Source Processor" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
info "File    : $BASENAME"
info "Type    : .$EXT_LOWER"

case "$EXT_LOWER" in

    # ── audio ──────────────────────────────────────────────────────────────
    mp3|wav|m4a|flac|ogg|aac|opus|wma|aiff|aif)
        info "Category: Audio → transcribe_audio.sh"
        echo "" >&2
        RESULT="$("$SCRIPT_DIR/transcribe_audio.sh" "$INPUT")"
        CATEGORY="audio"
        ;;

    # ── video (extract audio track for transcription) ─────────────────────
    mp4|mov|mkv|avi|webm|m4v|wmv|flv|mpeg|mpg)
        info "Category: Video → transcribe_audio.sh (audio track)"
        echo "" >&2
        # mlx_whisper handles video files directly (ffmpeg under the hood)
        RESULT="$("$SCRIPT_DIR/transcribe_audio.sh" "$INPUT")"
        CATEGORY="video"
        ;;

    # ── images ────────────────────────────────────────────────────────────
    jpg|jpeg|png|tiff|tif|bmp|gif|webp|heic|heif)
        info "Category: Image → ocr_image.sh"
        echo "" >&2
        RESULT="$("$SCRIPT_DIR/ocr_image.sh" "$INPUT")"
        CATEGORY="image"
        ;;

    # ── documents ─────────────────────────────────────────────────────────
    pdf|docx|doc|odt|rtf|pptx|odp|epub|html|htm|md|rst|tex|txt|csv)
        info "Category: Document → extract_doc.sh"
        echo "" >&2
        RESULT="$("$SCRIPT_DIR/extract_doc.sh" "$INPUT")"
        CATEGORY="document"
        ;;

    *)
        die "Unsupported file extension: .$EXT_LOWER — add it to process_source.sh if needed."
        ;;
esac

# ── summary ──────────────────────────────────────────────────────────────────
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  Done." >&2
info "Category  : $CATEGORY"
info "Input     : $INPUT"
info "Transcript: $RESULT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2

# Print the transcript path to stdout (so it can be captured by callers)
echo "$RESULT"
