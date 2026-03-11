# R90 Batch Ingestion Queue

Generated: 2026-03-11
Purpose: Track sequential batch processing runs. Each source is marked with STATUS after processing.

**Statuses:**
- `PENDING` — not yet processed
- `PROCESSED` — knowledge delta found and integrated
- `NO_DELTA` — processed, no new knowledge (confirms existing or out of scope)
- `DUPLICATE` — content identical or subset of already-processed source

---

## Batch 1 — 2026-03-11

| # | ID | File | Path | Priority | STATUS |
|---|----|----|------|----------|--------|
| 1 | DOC-004 | `05_sleep_travel_final.docx` | `Data Brut/IP Docs/R90 Methodology articles/` | high | PROCESSED |
| 2 | DOC-009 | `R90_Playbook_Structure.docx` | `Data Brut/IP Docs/` | high | PROCESSED |
| 3 | DOC-010 | `Sleep Noise Blog Jan 2025.docx` | `Data Brut/IP Docs/R90 Methodology articles/` | high | PROCESSED |
| 4 | DOC-014 | `04_sleep_hacks_athletes_final.docx` | `Data Brut/IP Docs/R90 Methodology articles/R90-T Shorts/` | high | PROCESSED |
| 5 | IMG-002 | `R90-T 7 sleep KPIs.png` | `Data Brut/IP Docs/R90 Playbook/PB Illustrator graphics/` | high | PROCESSED |
| 6 | IMG-003 | `Profiler Pencil..png` | `Data Brut/IP Docs/R90 Playbook/PB Illustrator graphics/` | high | NO_DELTA |
| 7 | IMG-010 | `7 day forecast 06.30 ARP Infograph .png` | `Data Brut/IP Docs/R90 Playbook/PB Illustrator graphics/R90 Infographs/Everyday Infographs/` | high | PROCESSED |
| 8 | PPT-003 | `Cody Ruberto 1-2-1 Elite Coaching Deck .pptx` | `Data Brut/Workshop Coaching Decks/Coaching Case study decks/` | medium | PROCESSED |
| 9 | DOC-005 | `06_sleep_nextgen_final.docx` | `Data Brut/IP Docs/R90 Methodology articles/` | medium | PROCESSED |
| 10 | DOC-011 | `Whats in Play 2.0.docx` | `Data Brut/IP Docs/R90 Methodology articles/` | medium | PROCESSED |

---

## Batch 2 — 2026-03-11 (Targeted High-Delta Ingestion)

| # | ID | File | Path | Priority | STATUS |
|---|----|----|------|----------|--------|
| 1 | IMG-016 | `#1 Day Night Shift infograph.png` | `R90 Infographs/ Multishift Infographs/` | medium | PROCESSED |
| 2 | IMG-017 | `#2 Night Day Shift infograph .png` | `R90 Infographs/ Multishift Infographs/` | medium | PROCESSED |
| 3 | IMG-018 | `#1 Multishift R90 Playbook.png` | `R90 Infographs/ Multishift Infographs/` | medium | NO_DELTA |
| 4 | IMG-019 | `#2 Multishift R90 Playbook.png` | `R90 Infographs/ Multishift Infographs/` | medium | NO_DELTA |
| 5 | IMG-020 | `#3 Multishift R90 Playbook.png` | `R90 Infographs/ Multishift Infographs/` | medium | NO_DELTA |
| 6 | IMG-021 | `Sleeping Cycle Phases.png` | `R90 Infographs/ Multishift Infographs/` | medium | PROCESSED |
| 7 | DOC-012 | `Who needs sleep anyway.docx` | `Data Brut/IP Docs/R90 Methodology articles/` | medium | PROCESSED |
| 8 | DOC-013 | `Why What and When.docx` | `Data Brut/IP Docs/R90 Methodology articles/` | medium | PROCESSED |
| 9 | IMG-012 | `AMer ARP NWT.png` | `R90 Infographs/Setting an ARP/` | medium | NO_DELTA |
| 10 | IMG-013 | `PMer ARP NWT.png` | `R90 Infographs/Setting an ARP/` | medium | NO_DELTA |
| 11 | IMG-025 | `Lux Reading.png` | `PB Illustrator graphics/` | medium | NO_DELTA |
| 12 | IMG-026 | `Body Clock.png` | `PB Illustrator graphics/` | medium | NO_DELTA |
| 13 | IMG-015 | `Elite Athlete case study Infograph.png` | `R90 Infographs/Elite Athlete Infographs/` | medium | PROCESSED |

---

## Processing Log

| # | ID | Status | Key Deltas |
|---|-----|--------|-----------|
| 1 | DOC-004 | PROCESSED | P-143–148, DR-074–076: Travel protocols, lux levels, destination ARP rule |
| 2 | DOC-009 | PROCESSED | ARP "Anchor Rise Point" variant; Playbook structural overview |
| 3 | DOC-010 | PROCESSED | P-149: Homeostatic sleep pressure / dual-driver model |
| 4 | DOC-014 | PROCESSED | NSDR first mention (EMERGING); sleep hacks for athletes |
| 5 | IMG-002 | PROCESSED | OQ-012 CLOSED: 7 KPIs = PPT-002 coaching template KSPI list |
| 6 | IMG-003 | NO_DELTA | Pencil UI icon only — no content |
| 7 | IMG-010 | PROCESSED | P-150–152, DR-077: Exact 16-cycle times for 06:30 ARP, phase formula |
| 8 | PPT-003 | PROCESSED | P-153–154: Full lux hierarchy (500/1k/3k/10k/60-100k), AYO device, Cody profile |
| 9 | DOC-005 | PROCESSED | P-155–157: NSDR = "new CRP" (CONFIRMED), mouth taping stance, blackout+DWS |
| 10 | DOC-011 | PROCESSED | P-158–161: CRP 90/30/20 tiers, daylight at 90-min intervals, 3 natural sleep periods |
| 11 | IMG-016 | PROCESSED | P-162–163, DR-078–079: Two-ARP shift model, day shift schedule, ARP selection rule |
| 12 | IMG-017 | PROCESSED | P-164, DR-079: Night shift ARP 18:00, CRP at 03:00 (mid overnight) |
| 13 | IMG-021 | PROCESSED | P-165: Sleep stage distribution (deep in first 2 cycles, REM in later); phase-agnostic sleep |
| 14 | DOC-012 | PROCESSED | P-166–167: "Worrying about sleep" as key disruptor; waking hours frame; SleepKit variant |
| 15 | DOC-013 | PROCESSED | P-168–170: Deep sleep in first 2 cycles; REM compensation when deprived; deep sleep window 23:00–02:00 |
| 16 | IMG-012 | NO_DELTA | AMer ARP NWT diagram — no text labels; AMer/chronotype already in knowledge base |
| 17 | IMG-013 | NO_DELTA | PMer ARP NWT diagram — no text labels; PMer/chronotype already in knowledge base |
| 18 | IMG-025 | NO_DELTA | Lux Reading UI mockup (578 lux example) — confirms existing lux feature, no new values |
| 19 | IMG-026 | NO_DELTA | Body Clock conceptual icon (two silhouettes + clock) — pure illustration, no new data |
| 20 | IMG-015 | PROCESSED | P-171: Elite Athlete ST window extends to C14 (02:00, 3 cycles) and C15 (03:30, 2 cycles) as emergency floor options |
