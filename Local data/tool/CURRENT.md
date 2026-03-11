# CURRENT.md — Nick Brain Project Status

Last updated: 2026-03-11

---

## Source Processing Pipeline — Status: READY

The local source-processing pipeline is fully set up and ready to use.

### What's built

| Component | Status | Notes |
|-----------|--------|-------|
| `sources/` directory tree | ✅ Created | audio / video / images / docs |
| `transcripts/` directory | ✅ Created | output from all tools |
| `knowledge/` directory | ✅ Created | ready for R90 knowledge files |
| `tools/transcribe_audio.sh` | ✅ Ready | mlx_whisper (large-v3-turbo) |
| `tools/ocr_image.sh` | ✅ Ready | tesseract |
| `tools/extract_doc.sh` | ✅ Ready | pandoc (+ pdftotext fallback) |
| `tools/process_source.sh` | ✅ Ready | master dispatcher |
| `CLAUDE.md` | ✅ Written | full workflow documentation |

### Dependencies installed

- `mlx_whisper 0.4.3` — installed 2026-03-11 via `pip install mlx-whisper`
- `tesseract` — available via Homebrew
- `pandoc` — available via Homebrew

### Raw sources available (Data Brut/)

| File / Folder | Type |
|---------------|------|
| `Art de mieux dormir, L_ - Nick Littlehales.txt` | Text (already plain) |
| `IP Docs/` | Documents (PDFs / DOCX likely) |
| `PB transcript  Audio Sessions/` | Audio transcripts or raw audio |
| `Workshop Coaching Decks/` | Presentations (PPTX / PDF likely) |

### Next steps

1. Move or symlink raw files from `Data Brut/` into the correct `sources/` subfolder
2. Run `./tools/process_source.sh <file>` on each source
3. Review generated `transcripts/*.txt`
4. Extract R90 knowledge into `knowledge/` files
5. Iterate

---

## Notes

- Do **not** modify files in `Data Brut/` — treat as read-only originals
- The first audio transcription will download the whisper model weights (~1.5 GB) from HuggingFace
