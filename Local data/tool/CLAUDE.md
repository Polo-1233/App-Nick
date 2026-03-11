# CLAUDE.md — Nick Brain Workspace

This workspace processes raw sources from Nick Littlehales (R90 sleep/recovery methodology)
and builds a structured knowledge base.

---

## Workspace Layout

```
nick_brain/
├── sources/
│   ├── audio/       ← raw audio recordings (interviews, sessions, podcasts)
│   ├── video/       ← raw video files
│   ├── images/      ← scanned pages, slides, photos of documents
│   └── docs/        ← PDFs, Word docs, presentations, ebooks
├── transcripts/     ← generated plain-text output from all tools
├── knowledge/       ← curated R90 knowledge files (built from transcripts)
├── tools/           ← processing scripts (see below)
└── Data Brut/       ← original unprocessed source material (do not modify)
```

---

## Available Tools

All tools live in `tools/` and are executable bash scripts.

### `tools/process_source.sh` — master dispatcher (use this first)

```bash
./tools/process_source.sh <file>
```

Auto-detects the file type and routes to the correct tool. Prints the transcript path.

**Supported extensions:**
- Audio: `mp3 wav m4a flac ogg aac opus wma aiff aif`
- Video: `mp4 mov mkv avi webm m4v wmv flv mpeg mpg`
- Images: `jpg jpeg png tiff tif bmp gif webp heic heif`
- Documents: `pdf docx doc odt rtf pptx odp epub html md rst tex txt csv`

---

### `tools/transcribe_audio.sh` — audio/video → text

```bash
./tools/transcribe_audio.sh sources/audio/my_recording.m4a
```

Uses `mlx_whisper` (whisper-large-v3-turbo, Apple Silicon optimised).
Works on both audio and video files. Output goes to `transcripts/`.

---

### `tools/ocr_image.sh` — image → text

```bash
./tools/ocr_image.sh sources/images/scan.png
```

Uses `tesseract` OCR. Handles JPG, PNG, TIFF, HEIC, etc. Output goes to `transcripts/`.

---

### `tools/extract_doc.sh` — document → text

```bash
./tools/extract_doc.sh sources/docs/report.pdf
```

Uses `pandoc` to extract plain text from PDF, DOCX, PPTX, EPUB, and many other formats.
Falls back to `pdftotext` (poppler) for PDFs that pandoc cannot parse.
Output goes to `transcripts/`.

---

## Processing Workflow

```
1. DETECT   Identify the source type (audio / video / image / document)
2. RUN      ./tools/process_source.sh <file>   ← always start here
3. READ     Open the generated .txt file in transcripts/
4. EXTRACT  Identify R90 knowledge: principles, protocols, definitions, quotes
5. UPDATE   Add structured entries to the relevant file in knowledge/
```

### Knowledge extraction guidelines

When reading a transcript, look for:
- **Principles** — core R90 concepts (sleep cycles, circadian rhythm, recovery indicators)
- **Protocols** — specific routines Nick recommends (pre-sleep, post-sleep, naps)
- **Definitions** — R90-specific terminology
- **Quotes** — direct, attributable statements from Nick
- **Contradictions / nuance** — where Nick refines or challenges common advice

Write findings to the appropriate `knowledge/` file, e.g.:
- `knowledge/principles.md`
- `knowledge/protocols.md`
- `knowledge/terminology.md`
- `knowledge/quotes.md`

---

## Dependencies

| Tool | Purpose | Install |
|------|---------|---------|
| `mlx_whisper` | Audio transcription | `pip install mlx-whisper` |
| `tesseract` | Image OCR | `brew install tesseract` |
| `pandoc` | Document extraction | `brew install pandoc` |
| `pdftotext` | PDF fallback | `brew install poppler` |

All confirmed installed as of 2026-03-11.
