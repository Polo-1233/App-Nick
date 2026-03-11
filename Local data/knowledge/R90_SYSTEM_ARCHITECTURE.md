# R90 System Architecture
**Nick Brain — Knowledge Extraction Pipeline**
Last updated: 2026-03-11
Status: Audit after Batch 3 (8 sources processed)

---

## 1. DATA FLOW

The pipeline moves raw source material through five sequential stages: ingestion, extraction, summary, principle distillation, and knowledge integration.

```
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1 — RAW SOURCE                                           │
│  Data Brut/                                                     │
│  ├── PB transcript  Audio Sessions/KSRI N.../Lesson N.mp3       │
│  ├── IP Docs/R90 Methodology articles/0N_*.docx                 │
│  ├── IP Docs/R90 Playbook/PB Illustrator graphics/*.png         │
│  └── Workshop Coaching Decks/*.pptx                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ tools/process_source.sh <file>
                         │ (auto-detects type, routes to tool)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2 — EXTRACTION                                           │
│                                                                 │
│  Audio/Video  → tools/transcribe_audio.sh                       │
│                 mlx_whisper --model whisper-large-v3-turbo      │
│                                                                 │
│  Image        → tools/ocr_image.sh                             │
│                 tesseract                                       │
│                                                                 │
│  Document     → tools/extract_doc.sh                           │
│                 pandoc --to plain --wrap=none                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3 — TRANSCRIPT FILE                                      │
│  transcripts/                                                   │
│  ├── Lesson_1.txt           ← AUD-001 (mlx_whisper output)      │
│  ├── Lesson_2.txt           ← AUD-002                           │
│  ├── Lesson_3.txt           ← AUD-003                           │
│  ├── Lesson_4.txt           ← AUD-004                           │
│  ├── 01_sleep_and_performance_final.txt  ← DOC-001 (pandoc)    │
│  ├── 02_sleep_in_cycles_final.txt        ← DOC-002              │
│  ├── 03_sleep_recovery_final.txt         ← DOC-003              │
│  └── Circadian_Rhythm_Infograph.txt      ← IMG-001 (tesseract)  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Manual read + analysis by AI
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 4 — PER-SOURCE SUMMARY                                   │
│  summaries/                                                     │
│  ├── audio/                                                     │
│  │   ├── AUD-001_KSRI1_circadian_rhythm.md                      │
│  │   ├── AUD-002_KSRI2_chronotype.md                            │
│  │   ├── AUD-003_KSRI3_recovery_cycles.md                       │
│  │   └── AUD-004_KSRI4_recovery_rhythm.md                       │
│  ├── docs/                                                      │
│  │   ├── DOC-001_sleep_and_performance.md                       │
│  │   ├── DOC-002_sleep_in_cycles.md                             │
│  │   └── DOC-003_sleep_recovery.md                              │
│  └── images/                                                    │
│      └── IMG-001_circadian_rhythm_infograph.md                  │
│                                                                 │
│  Each summary contains: metadata, main ideas, principles,       │
│  behavioural patterns, decision rules, terminology,             │
│  open questions, cross-references.                              │
└────────────────────────┬────────────────────────────────────────┘
                         │ Selective integration — no duplication
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 5 — KNOWLEDGE INTEGRATION                                │
│  knowledge/                                                     │
│  ├── R90_CORE_PRINCIPLES.md       ← P-series entries           │
│  ├── R90_DECISION_RULES.md        ← DR-series entries          │
│  ├── R90_BEHAVIOURAL_PATTERNS.md  ← BP-series entries          │
│  ├── R90_OPEN_QUESTIONS.md        ← OQ-series entries          │
│  ├── R90_SOURCE_INDEX.md          ← master source registry     │
│  └── R90_SYSTEM_ARCHITECTURE.md  ← this file                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key design choice:** Stage 4 (summary) acts as a buffer between raw transcripts and knowledge files. The summary holds *all* extracted content from one source; the knowledge files receive only what is genuinely new and sufficiently certain. This prevents knowledge file bloat and forces a deliberate integration decision for each principle.

---

## 2. CURRENT FILE STRUCTURE

### `Data Brut/` — Original Source Material
Read-only. Never modified. Contains all raw files as received.
Subfolders: `PB transcript  Audio Sessions/`, `IP Docs/`, `Workshop Coaching Decks/`.

### `sources/` — Processing Staging Area
Currently empty. Intended as a copy/symlink area for files before processing.
In practice, files have been processed directly from `Data Brut/` — the staging area has not been needed yet.

### `tools/` — Processing Scripts
All executable bash scripts.

| Script | Purpose | Dependency |
|--------|---------|------------|
| `process_source.sh` | Master dispatcher — detects type by extension, routes to correct tool | all below |
| `transcribe_audio.sh` | Audio/video → .txt via mlx_whisper | mlx_whisper CLI |
| `ocr_image.sh` | Image → .txt via Tesseract | tesseract |
| `extract_doc.sh` | Document → .txt via Pandoc | pandoc, pdftotext |

### `transcripts/` — Raw Extracted Text
One `.txt` file per source. Output of the extraction tools. No interpretation — raw text only.
Naming convention: sanitised source filename (`Lesson_1.txt`, `01_sleep_and_performance_final.txt`).
Filenames are safe (spaces → underscores, special chars stripped). Overwrite protection: timestamp suffix added if file already exists.

### `summaries/` — Per-Source Analysis
Structured Markdown documents. One per processed source.
Three subdirectories: `audio/`, `docs/`, `images/`.

Each summary file contains:
1. Source metadata (path, type, date, confidence)
2. Main ideas
3. R90 principles extracted (with certainty labels)
4. Behavioural patterns extracted
5. Decision rules extracted
6. Terminology identified or confirmed
7. Open questions (new or updated)
8. Cross-references to related sources

**Role:** The summary is the primary analysis artifact. It is the source of truth for what was found in one source. Knowledge files are populated FROM summaries, not the other way around.

### `knowledge/` — Integrated Knowledge Base

#### `R90_SOURCE_INDEX.md`
The master registry. Every processed source has a block with:
- Source ID (DOC-NNN, AUD-NNN, IMG-NNN)
- File path
- Status (PROCESSED / PROCESSING / PENDING / SKIPPED)
- Transcript path
- Summary path
- Key themes
- Confidence level
- Notes and resolved questions

Pending sources listed as a table at the bottom with priority ratings.

#### `R90_CORE_PRINCIPLES.md`
Principles about how sleep and recovery work — what is true about biology, the R90 model, and human behaviour. Organised by KSRI theme. Uses P-NNN identifiers. Each entry has certainty label and source reference.

#### `R90_DECISION_RULES.md`
Actionable rules — how Nick's methodology translates into specific decisions. Derived from principles but expressed as imperatives. Uses DR-NNN identifiers. Organised by decision domain.

#### `R90_BEHAVIOURAL_PATTERNS.md`
Patterns Nick observes in clients (problematic and desirable). These are diagnostic — used to identify what a client is doing wrong and what R90 builds instead. Uses BP-NNN identifiers.

#### `R90_OPEN_QUESTIONS.md`
Active tracking of knowledge gaps. Each OQ has a status (OPEN / PARTIAL / CLOSED) and an expected source. Used to direct processing order and validate what has been resolved. Uses OQ-NNN identifiers.

#### `R90_SYSTEM_ARCHITECTURE.md`
This file. Documents how the pipeline works.

---

## 3. PRINCIPLE EXTRACTION LOGIC

### What qualifies as a principle

A principle is extracted when a source contains a statement that:
1. **Asserts something true about biology, sleep, or human behaviour** that underpins the R90 system
2. **Is not merely descriptive** of Nick's personal story or a single anecdote
3. **Has generalisable application** — it would apply to any client, not just the example given
4. **Is distinct** from existing principles (not a paraphrase of something already captured)

Decision rules and behavioural patterns are separated out deliberately:
- If it is an observation about how things work → **Principle**
- If it is an instruction about what to do → **Decision Rule**
- If it is a pattern of client behaviour → **Behavioural Pattern**

### Certainty label assignment

| Label | Criteria |
|-------|---------|
| **CONFIRMED** | Nick states it explicitly, in his own words, unambiguously. Direct quotation available. Or confirmed by multiple independent sources. |
| **STRONG INFERENCE** | Strongly implied by the source, but not stated as a direct claim. Reasonable conclusion from the evidence, but not a direct quotation. One source only. |
| **HYPOTHESIS** | Plausible interpretation, but the source does not clearly support it. Needs validation. Used sparingly — usually upgraded or dropped after next relevant source. |
| **NEEDS VALIDATION** | Previously inferred as HYPOTHESIS or STRONG INFERENCE; a new source partially addressed it but did not resolve it cleanly. |

**Promotion rules:**
- HYPOTHESIS → CONFIRMED: requires explicit statement in a subsequent source
- STRONG INFERENCE → CONFIRMED: requires at least one other source saying the same thing, or one explicit statement
- CONFIRMED sources are never downgraded (source is kept as reference)

**Example from this pipeline:**
- P-010 started as HYPOTHESIS (IMG-001 only). Upgraded to CONFIRMED when AUD-001 explicitly stated "everyday routine that's more about you as a human with a brain in harmony with that process."

### Deduplication approach

Before writing a new principle, the working process is:
1. Scan the existing P-series in the knowledge file for the same concept
2. If the same idea is already captured with the same or higher certainty → do not add; instead, optionally add the new source as a secondary reference to the existing entry
3. If the same idea exists at lower certainty → upgrade the existing entry rather than creating a new one
4. If it is genuinely new → assign the next available P-NNN number and write it

**Current weakness:** This is entirely manual. There is no automated check. Deduplication depends on the processing agent's memory of what is already in the file. Across many batches, drift and duplication become increasingly likely (see Section 6).

### Updating existing principles

Existing principles are updated when:
- A new source clarifies or corrects the statement (e.g. ARP corrected from "Anchor Recovery Point" to "Anchor Reset Point")
- A new source upgrades the certainty level
- A new source adds a meaningful secondary reference

Updates are made in-place with the source reference appended (e.g. `[CONFIRMED — AUD-001, IMG-001]`).

---

## 4. OPEN QUESTION MANAGEMENT

### How OQs are created

An OQ is created when:
- A source references a concept without defining it (e.g. "four phases" in DOC-003)
- A source uses a term that doesn't match what was previously inferred (e.g. ARP)
- A source raises a question that subsequent sources should answer
- A gap is identified between what has been extracted and what the system needs

OQs are assigned sequential OQ-NNN numbers. They are written into the summary file first, then migrated to `R90_OPEN_QUESTIONS.md`.

### How OQs are tracked

Each OQ has:
- A number (OQ-NNN)
- A question statement
- Current evidence / partial resolution notes
- Status: OPEN / PARTIAL / CLOSED
- Expected source(s) that will resolve it

The routing table at the bottom of `R90_OPEN_QUESTIONS.md` maps each open question to the most likely source that will answer it, to guide future batch order.

### How OQs are closed

An OQ is closed when a processed source explicitly answers the question. The entry is struck through (using markdown ~~strikethrough~~), the resolution is noted, and status is set to CLOSED. The routing table entry is updated to "CLOSED."

### Examples from Batches 1–3

| OQ | Raised by | Resolved by | How |
|----|-----------|-------------|-----|
| OQ-001 | DOC-001 ("right quality" undefined) | DOC-002 | Cycle completion = quality definition |
| OQ-009 | Filename inference ("ARP 06.30") | DOC-003 | Explicit parenthetical: "(ARP Anchor Reset Point)" — also corrected the prior wrong inference |
| OQ-010 | Filename inference ("+ CRP") | AUD-003 | Nick defines CRP explicitly as 20–30 min rest, midday or 4–7pm |
| OQ-011 | Acronym "KSRI" unsourced | AUD-001 | Nick defines it in first sentence: "It's a key sleep recovery indicator" |
| OQ-006 | IMG-001 shows one universal clock | AUD-002 | PMers have ~1–2h phase delay on all circadian windows |
| OQ-017 | AUD-001 mentions "point of wake" | DOC-002 | Full sequence given: bladder → daylight → hydration → food → mental → exercise → bowels |

**Active examples:**
- OQ-005: Does ARP map to the body temperature nadir (~06:00)? — Not yet confirmed, despite 4 audio lessons processed
- OQ-024: What are the "four phases" of the day? — Mentioned in DOC-003, not defined
- OQ-003: Does Nick rank the 3 health pillars in a strict order? — "1st Health Pillar" phrasing remains ambiguous

---

## 5. SOURCE TRACEABILITY

### How each rule links to its source

Every entry in every knowledge file includes an inline citation in the format:
```
[CERTAINTY — SOURCE-ID]
```
Example: `[CONFIRMED — DOC-002]` or `[STRONG INFERENCE — IMG-001]`

The SOURCE-ID maps directly to an entry in `R90_SOURCE_INDEX.md`, which provides:
- Exact file path in `Data Brut/`
- Transcript file path in `transcripts/`
- Full summary in `summaries/`

### Traceability chain (full example)

**P-041** `[CONFIRMED — DOC-003]` — ARP = Anchor Reset Point

| Level | Location | Content |
|-------|---------|---------|
| Source ID | `R90_SOURCE_INDEX.md → ### DOC-003` | File: `Data Brut/IP Docs/R90 Methodology articles /03_sleep_recovery_final.docx` |
| Raw text | `transcripts/03_sleep_recovery_final.txt` | Line 29: `"Define your most consistent wake-up, start to your day time (ARP Anchor Reset Point)"` |
| Analysis | `summaries/docs/DOC-003_sleep_recovery.md → P-041` | Extraction note + correction of prior inference |
| Integration | `knowledge/R90_CORE_PRINCIPLES.md → P-041` | Final statement with certainty and source |

### Current granularity limitations

Traceability is currently at **source level** (which file), not at **line or timestamp level**. For audio sources, the transcript contains timestamp markers (e.g. `[06:02.700 --> 06:09.500]`) but these are not propagated into summary or knowledge files. For documents, line numbers in the transcript exist but are not cited in principles.

**What is missing:**
- No direct transcript line reference in summary entries
- No timestamp reference in audio-derived principles
- No section heading reference in document-derived principles

---

## 6. CURRENT LIMITATIONS

### L-001 — OCR reliability on infographics
Tesseract performs well on clean scanned text but poorly on circular/radial infographic layouts. IMG-001 (Circadian Rhythm Infograph) yielded ~60% readable content. Time markers were legible; labels around the dial were fragmented or garbled. All IMG-001-derived principles are STRONG INFERENCE at best.

**Risk:** Time values extracted from IMG-001 (P-009) are approximations. If the actual values differ from the OCR output, downstream rules built on them (DR-003, DR-004, DR-005) are wrong.

### L-002 — Principle numbering has gaps
The P-series numbering is non-sequential: principles were added in the order sources were processed, not in a logical knowledge order. Current sequence jumps: P-001–017 (KSRI/Foundational), then P-018–026 (R90 Technique), then P-027–030 (Chronotype), then P-034–040 (Cycles), then P-041–046 (Terminology), then P-047–052 (Routines).

Numbers P-031, P-032, P-033 are missing (not assigned). Similarly for DR and BP series.

**Risk:** As the series grows, gaps become confusing and collision risk increases.

### L-003 — Deduplication is entirely manual
There is no automated check for concept duplication. As the corpus grows beyond 20 sources, the likelihood of near-duplicate principles being added increases. Currently manageable (8 sources, ~49 principles); will become a real problem at 50+ principles from diverse sources saying similar things differently.

**Example already visible:** P-039 (every 90 min micro-break) and DR-009 (restore micro-recovery moments) and P-042 (MRM) are conceptually overlapping. They are technically distinct (principle vs. rule vs. named term) but a future agent might re-extract the same concept again.

### L-004 — STRONG INFERENCE promotion risk
Some STRONG INFERENCE principles (P-007, P-008, P-009, DR-003, DR-004, DR-005) are derived from a single low-confidence source (IMG-001 OCR). If subsequent sources do not confirm them, they may remain at STRONG INFERENCE indefinitely — but be treated as established knowledge by future processing agents.

**Risk:** A future AI using these principles as inputs could treat STRONG INFERENCE as CONFIRMED and build further inferences on top of a shaky foundation.

### L-005 — Context loss between sessions
The only persistent context between sessions is:
- `memory/MEMORY.md` (workspace-level summary)
- The knowledge files themselves

The chain of reasoning that led to a particular principle — why it was classified at a given certainty level, what alternatives were considered — is not persisted. Only the conclusion is stored. A new session starting from these files would not know, for example, why P-009 is STRONG INFERENCE rather than CONFIRMED, unless they re-read the IMG-001 summary.

### L-006 — No semantic clustering or cross-linking
Knowledge entries are stored in flat, chronologically-appended sections. There is no semantic graph, no topic index, no way to quickly find "all rules relating to temperature" or "all principles that affect chronotype." Navigation is linear (reading top to bottom) or manual (Ctrl+F).

**Risk:** As the knowledge base grows, finding relevant principles before writing new ones becomes harder. Deduplication and synthesis become more expensive.

### L-007 — Source ordering in knowledge files is arbitrary
Principles were added to the knowledge files in batch-processing order, not in conceptual order. The KSRI System section (P-011–017) appears after the R90 Technique section (P-018–026) because AUD-001 was processed after DOC-002 in one batch. This makes the file harder to read as a coherent document.

### L-008 — OQ routing table has structural inconsistencies
The routing table at the bottom of `R90_OPEN_QUESTIONS.md` has mixed content formats — some rows contain the expected `| OQ-NNN | Source |` format, others have three-column entries, some reference closed questions. It has accumulated without a consistent maintenance pass.

### L-009 — No validation of audio transcription accuracy
mlx_whisper (large-v3-turbo) performs extremely well on clear speech, but:
- AUD-004's transcript ended with repeated "We'll see." — artifact of post-recording mic noise that was not caught in real-time
- Proper nouns specific to Nick's framework (R90, KSRI, SWR, ARP, CRP, MRM) could be transcribed phonetically incorrectly
- No human review step exists to catch these

### L-010 — No versioning
Knowledge files are edited in-place with no git history (the workspace is not a git repository). A bad edit cannot be rolled back. A principle incorrectly upgraded or deleted is gone unless the summary file still holds it.

---

## 7. IMPROVEMENTS

### I-001 — Add transcript-level citations (High priority)
When writing summary entries, include the transcript line number (for documents) or timestamp range (for audio). Format:

```
[CONFIRMED — DOC-003, line 29]
[CONFIRMED — AUD-001, 06:02–06:09]
```

This makes every principle directly verifiable without re-reading the full transcript.

### I-002 — Normalise the numbering scheme (Medium priority)
Stop assigning P/DR/BP numbers sequentially by processing order. Instead, assign by knowledge domain:

```
P-001–099: Foundational biology / KSRI principles
P-100–199: R90 technique mechanics
P-200–299: Chronotype
P-300–399: Environment
P-400–499: Behaviour / mindset
```

This allows any future agent to search a known range for relevant principles and reduces collision risk.

### I-003 — Add a TERMINOLOGY file (High priority)
Currently, terminology is confirmed inside `R90_CORE_PRINCIPLES.md` and inside each summary file. A dedicated `knowledge/R90_TERMINOLOGY.md` would give a single canonical reference for all named concepts:

```
| Term | Full Form | Definition | First confirmed | Source |
|------|-----------|-----------|-----------------|--------|
| ARP  | Anchor Reset Point | Fixed daily wake-up anchor | DOC-003, line 29 | ... |
| CRP  | Controlled Recovery Period | 20–30 min deliberate rest | AUD-003 | ... |
```

This prevents the ARP error (inferred wrong name for 3 batches before correction) and makes terminology available to the app without parsing prose.

### I-004 — Introduce a PRINCIPLE REVIEW cycle (High priority)
After every 3 batches, run a review pass:
1. Read all STRONG INFERENCE entries
2. Check whether a processed source has implicitly confirmed them (even without explicit statement)
3. Promote or demote accordingly
4. Check for near-duplicate principles that should be merged

This prevents inference drift and keeps the knowledge base clean.

### I-005 — Add a CROSS-REFERENCE MAP (Medium priority)
Create `knowledge/R90_CROSS_REFERENCE.md` — a simple table mapping each principle to related principles, decision rules, and behavioural patterns:

```
P-021 (count backwards in cycles) → DR-011, DR-019, BP-017
P-050 (bedroom temperature) → DR-029, BP-023
```

This enables a future AI (or human) to pull a coherent cluster of knowledge for a specific topic without reading all four files.

### I-006 — Initialise git for the workspace (High priority)
`git init` + initial commit. Then commit after each batch. This provides:
- Full rollback capability
- A history of what changed in each batch
- Protection against accidental overwrites

Trivial to implement, high value.

### I-007 — Create a CONFIDENCE AUDIT trail (Medium priority)
Add a `PROMOTED` field to each principle that tracks certainty upgrades:

```
**P-010** [CONFIRMED — AUD-001, IMG-001]
- Originally: HYPOTHESIS (IMG-001)
- Promoted to CONFIRMED after AUD-001 (explicit statement at 05:55–06:10)
```

This makes the reasoning history visible and allows future agents to understand WHY a principle is at its current certainty level.

### I-008 — Improve OCR pipeline for infographics (Medium priority)
For circular or complex infographic layouts:
1. Pre-process the image (convert to greyscale, increase contrast, crop individual label regions)
2. Run OCR on individual text regions rather than the full image
3. Cross-reference against a known vocabulary (R90 terminology) to correct phonetic errors

Alternatively: manually type out the key data from the infograph and store it as a structured JSON file rather than relying on OCR.

### I-009 — Build a KNOWLEDGE SUMMARY for app use (Future)
Once the corpus is substantially processed, generate a single `R90_KNOWLEDGE_SUMMARY.md` that flattens all CONFIRMED principles, decision rules, and terminology into a concise, AI-queryable format. This becomes the primary input for any application built on top of this knowledge base. It should be regenerated (not incrementally updated) and versioned.

### I-010 — Semantic deduplication pass before large batches (Future)
Before processing a large batch (5+ sources), run a deduplication pass over existing principles:
1. Group principles by semantic similarity (manual or automated)
2. Identify and merge near-duplicates
3. Renumber the cleaned set before adding new principles

This prevents the compounding problem where 50 sources produce 300 principles with 60 near-duplicates buried in the list.

---

## 8. CURRENT STATE SUMMARY

### Sources processed

| ID | File | Type | Confidence | Batch |
|----|------|------|-----------|-------|
| DOC-001 | `01_sleep and performance_final.docx` | document | HIGH | 1 |
| IMG-001 | `Circadian Rhythm Infograph.png` | image | MEDIUM | 1 |
| AUD-001 | `KSRI 1 Lesson 1.mp3` | audio | HIGH | 1 |
| DOC-002 | `02_sleep in cycles_final.docx` | document | HIGH | 2 |
| AUD-002 | `KSRI 2 Lesson 2.mp3` | audio | HIGH | 2 |
| AUD-003 | `KSRI 3 Lesson 3.mp3` | audio | HIGH | 2 |
| DOC-003 | `03_sleep_recovery_final.docx` | document | HIGH | 3 |
| AUD-004 | `KSRI 4 Lesson 4.mp3` | audio | HIGH | 3 |

**Total: 8 sources processed** (7 HIGH confidence, 1 MEDIUM)

### Knowledge extracted

| File | Entries | Confirmed | Strong Inference | Hypothesis |
|------|---------|-----------|-----------------|-----------|
| R90_CORE_PRINCIPLES.md | 49 | 44 | 4 | 1 |
| R90_DECISION_RULES.md | 30 | 27 | 3 | 0 |
| R90_BEHAVIOURAL_PATTERNS.md | 24 | 22 | 2 | 0 |
| **Total** | **103** | **93** | **9** | **1** |

### Open questions

| Status | Count |
|--------|-------|
| CLOSED | 6 (OQ-001, 006, 009, 010, 011, 017) |
| PARTIALLY RESOLVED | 2 (OQ-002, 004) |
| OPEN | 14 (OQ-003, 005, 007, 008, 012, 013, 016, 018–026) |

### R90 system coverage

| KSRI | Topic | Status |
|------|-------|--------|
| KSRI 1 | Circadian Rhythm | COVERED (AUD-001 + IMG-001) |
| KSRI 2 | Chronotype | COVERED (AUD-002) |
| KSRI 3 | Recovery Cycles | COVERED (AUD-003 + DOC-002) |
| KSRI 4 | Recovery Rhythm | COVERED (AUD-004 + DOC-003) |
| KSRI 5 | Environment | NOT YET PROCESSED |
| KSRI 6 | Product Interventions | NOT YET PROCESSED |
| KSRI 7 | Redefining Behaviour | NOT YET PROCESSED |
| — | R90 Playbook (full) | NOT YET PROCESSED |
| — | Workshop/Coaching Decks | NOT YET PROCESSED |
| — | Sessions 8–10 | NOT YET PROCESSED |

**Coverage of the 7 KSRIs: 4/7 (57%)**
**Coverage of the full corpus: ~8/21 sources (~38%)**

### Known gaps in current knowledge

1. **Environment specifics (KSRI 5):** Room setup, bedding, light sources, technology placement — all referenced but not yet detailed
2. **Product interventions (KSRI 6):** What Nick specifically recommends or avoids in terms of equipment
3. **Behaviour reframing (KSRI 7):** The complete framework for habit change — likely the most actionable KSRI for coaching
4. **Four phases of the day** (OQ-024): Referenced in DOC-003 but undefined
5. **Playbook content:** The full R90 Playbook (PDF + DOCX) likely contains the most complete operational system — not yet processed
6. **Client profiling tool** (OQ-013): Implied to exist; not yet seen
7. **The 7 Sleep KPIs** (OQ-012): Referenced in a graphic filename; not yet processed
