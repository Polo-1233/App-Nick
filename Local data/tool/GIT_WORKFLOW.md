# Git Workflow — Nick Brain

Lightweight version control for the knowledge extraction pipeline.

---

## What to commit

Three categories of files:

| Category | Files | When to commit |
|----------|-------|----------------|
| **Pipeline tools** | `tools/*.sh`, `CLAUDE.md`, `CURRENT.md` | After any script change or fix |
| **Knowledge files** | `knowledge/*.md` | After each processing batch or structural improvement step |
| **Summaries** | `summaries/**/*.md` | After each source is fully processed |

**Do not commit:**
- `transcripts/` — generated artefacts, reproducible from sources
- `Data Brut/` — raw source files (likely too large; treat as input-only)
- `summaries/` intermediate working notes mid-batch (commit only when complete)

---

## Commit message pattern

```
[scope] action: description

Optional detail line.
```

### Scope tokens

| Token | Meaning |
|-------|---------|
| `pipeline` | Changes to tools/, process scripts, CLAUDE.md |
| `batch-N` | A completed processing batch (N = batch number) |
| `knowledge` | Structural changes to knowledge files only (no new sources) |
| `source` | Single source added (use when committing one source in isolation) |
| `fix` | Correction to existing extracted content |

### Examples

```
pipeline: fix bash 3.2 lowercase syntax in process_source.sh

batch-3: process AUD-003, DOC-003, AUD-004 — KSRI 3, 4, sleep recovery doc

knowledge: add R90_TERMINOLOGY.md and source traceability improvements

fix: correct ARP definition from "Anchor Recovery Point" to "Anchor Reset Point"

source: process AUD-005 KSRI 5 Environment
```

---

## When to commit

1. **After each completed batch** — when all summaries and knowledge integrations for that batch are done.
2. **After structural improvements** — when audit-driven changes (terminology, traceability, etc.) are complete.
3. **After any pipeline fix** — immediately, so the fix is preserved.
4. **Before starting a new batch** — ensures a clean checkpoint if something goes wrong mid-batch.

---

## Initialising the repo

```bash
cd /Users/thomas/projects/nick_brain

git init
git add CLAUDE.md CURRENT.md GIT_WORKFLOW.md
git add tools/
git add knowledge/
git add summaries/
git commit -m "knowledge: initial commit — pipeline and 8-source knowledge base (Batches 1–3 + structural improvements)"
```

Then add a `.gitignore`:

```
Data Brut/
transcripts/
*.mp3
*.wav
*.pptx
*.docx
*.png
*.pdf
```

Transcripts are excluded because they are generated artefacts — any transcript can be regenerated from the source file using the pipeline tools. This keeps the repo lean.

---

## Recommended cadence

- **Small, focused commits** — one batch or one improvement per commit.
- **No mega-commits** — do not bundle pipeline fixes with content additions.
- **Tag milestones** — after each KSRI set is complete, consider a tag: `git tag ksri-1-4-complete`

---

*Last updated: 2026-03-11*
