# R90 Canonical Method — v2

**Version:** 2.0
**Date:** 2026-02-17
**Status:** Consolidated from Nick Littlehales' book + Product Vision — Awaiting Nick validation
**Source:** "L'art de mieux dormir" (Nick Littlehales), Product Vision Document, R90_LOGIC_MAP_v0.1

---

## 1. Foundation Concepts

### 1.1 The R90 Approach

R90 = "Récupération en 90 minutes" (Recovery in 90 minutes).
90 minutes is the clinically established duration for one complete sleep cycle through all phases (NREM 1 → NREM 2 → NREM 3/4 → REM → brief wake).

**Source:** Book, ch. 3 — "quatre-vingt-dix minutes correspondent à la durée indispensable à une personne dans des conditions cliniques pour accomplir les différentes phases de sommeil constituant un cycle."

### 1.2 Anchor Time (Heure de réveil constante)

The fixed, non-negotiable wake-up time. All cycle calculations work BACKWARD from this point. Must be maintained 7 days/week including weekends.

**Selection criteria (from book):**
- Look at the past 2-3 months of professional and personal life
- Choose the earliest time you regularly need to be out of bed
- Should precede work/obligations by at least 90 minutes (post-sleep routine)
- Consider chronotype (PMers shouldn't choose too early, but must stay close to sunrise)
- Once set, do NOT change — even on weekends

**Status:** CONFIRMED (core R90 principle)

### 1.3 Sleep Cycles (not hours)

| Concept | Value | Source | Status |
|---|---|---|---|
| Cycle duration | 90 minutes | Book ch. 3 | CONFIRMED |
| Ideal night | 5 cycles (7h30) | Book ch. 3 — "pour une personne standard" | CONFIRMED for default |
| Acceptable range | 4 cycles (6h) to 6 cycles (9h) | Book ch. 3 — "Commencez par cinq cycles... Si c'est trop long, réduisez à quatre. Trop peu? Montez à six." | CONFIRMED |
| Minimum viable night | 3 cycles (4h30) | Book ch. 3 — "vous pouvez alors vous coucher à 3h, pour avoir juste trois cycles, même si là, vous poussez un peu" | CONFIRMED |
| Absolute floor | Not explicitly stated in book | Inferred: 2 cycles is lowest mentioned implicitly (Jess example: Saturday = 2 cycles) | TODO_NICK |

### 1.4 Weekly Thinking (Cycles per week, not hours per night)

| Concept | Value | Source | Status |
|---|---|---|---|
| Ideal weekly target | 35 cycles (5 × 7) | Book ch. 3 | CONFIRMED |
| Acceptable minimum | 28–30 cycles | Book ch. 3 — "vingt-huit (six heures par nuit) à trente restent tout à fait acceptables" | CONFIRMED |
| Danger threshold | < 28 cycles | Book ch. 3 — "Si vous dormez moins que prévu, vous risquez de tirer trop sur la corde" | CONFIRMED |
| Consecutive short-night limit | Max 3 short nights in a row | Book ch. 3 — "Nous essayons toujours d'éviter trois nuits consécutives de moins de cinq cycles" | CONFIRMED |
| Ideal nights per week | ≥ 4 full-cycle nights | Book ch. 3 — "Essayez de respecter votre durée idéale de sommeil au moins quatre fois par semaine" | CONFIRMED |

### 1.5 Chronotype

Three types: AMer (alouette/lark), PMer (chouette/owl), Neither (intermédiaire).
Genetically determined. Affects anchor time selection and energy patterns, but NOT cycle calculation logic.

**Status:** CONFIRMED

## 2. Daily Structure

### 2.1 Bedtime Calculation

**Rule:** Bedtime = Anchor Time − (target_cycles × 90 minutes)

Bedtimes are on 90-minute intervals counting backward from anchor. If the ideal bedtime is missed, the user shifts to the next 90-minute boundary (dropping one cycle).

**Example (anchor = 06:30):**
- 5 cycles → 23:00
- 4 cycles → 00:30
- 3 cycles → 02:00

**Source:** Book ch. 3 — "Faites juste un compte à rebours en cycles de quatre-vingt-dix minutes"

**Status:** CONFIRMED

### 2.2 Pre-Sleep Routine (Routine de pré-sommeil)

**Duration:** 90 minutes before bedtime.

**Content (from book ch. 4):**
- Disconnect from electronic devices
- Dim lights (amber/yellow, not blue)
- Mental decompression: review the day, clear anxieties
- Temperature transition (warm shower → cooler room)
- Light nutrition if needed (last snack at start of routine)
- Breathing: nose breathing, relaxation

**CRITICAL CLARIFICATION:** The book describes ONE 90-minute pre-sleep routine. Our v0.1 implementation split this into "30-min pre-sleep" + "90-min down-period" = 120 minutes total. This does not match the book. The correct model is:

| Model | Pre-sleep start | Bedtime | Total wind-down |
|---|---|---|---|
| **Book (correct)** | Bedtime − 90 min | Anchor − (cycles × 90) | 90 min |
| **v0.1 code (incorrect)** | Bedtime − 120 min | Anchor − (cycles × 90) | 120 min |

**Status:** CONFIRMED (book is canonical). Code needs correction.

### 2.3 Post-Sleep Routine (Routine de post-sommeil)

**Duration:** 90 minutes after anchor time.

**Content (from book ch. 4):**
- Wake at anchor time (alarm initially, eventually natural)
- Hydrate
- Exposure to daylight (critical for circadian reset)
- Light breakfast
- Bathroom routine
- Light exercise if possible
- Gradual mental activation (no immediate phone/email)

**Status:** CONFIRMED. Not yet implemented in code (future feature).

### 2.4 Down-Period Protocol (Post-Event Only)

**Trigger:** After a late evening event (match, dinner, social event) that ends past the ideal pre-sleep start.

**Mechanism:** Adrenaline clearance takes ~90 minutes. Do NOT try to force sleep before clearance completes. Instead, accept delayed first cycle and count backward to find the next available cycle boundary.

**Source:** Product Vision Document — "Adrenaline takes 90 minutes to clear. I've activated the Down-Period protocol."

**CRITICAL CLARIFICATION:** This is NOT a nightly routine. It is a protocol triggered specifically by late events. The nightly wind-down is the Pre-Sleep Routine (§2.2).

**Status:** CONFIRMED as concept. TODO_NICK: Does event type (physical vs. mental) affect clearance time?

## 3. Controlled Recovery Periods (CRP)

### 3.1 Midday CRP Window

| Attribute | Value | Source | Status |
|---|---|---|---|
| Timing | 13:00–15:00 | Book ch. 5 — "entre 13h et 15h" | CONFIRMED |
| Duration options | 30 min OR 90 min | Book ch. 5 — "soit un cycle complet de quatre-vingt-dix minutes, soit une période de récupération contrôlée de trente minutes" | CONFIRMED |
| Purpose | Compensate reduced night cycles, works with circadian dip | Book ch. 5 | CONFIRMED |
| Cycle accounting | Counts toward weekly total (30 min or 90 min both count) | Book ch. 5 — "celui accompli ici — peu importe qu'il dure trente ou quatre-vingt-dix minutes — compte dans le total de ladite semaine" | CONFIRMED |

### 3.2 Early Evening CRP Window

| Attribute | Value | Source | Status |
|---|---|---|---|
| Timing | 17:00–19:00 | Book ch. 5 — "capitaliser sur un créneau de début de soirée aux alentours de 17h-19h" | CONFIRMED |
| Duration | 30 min ONLY | Book ch. 5 — "un cycle de quatre-vingt-dix minutes risquerait d'interférer avec notre sommeil nocturne ensuite" | CONFIRMED |
| When to use | When midday CRP was missed | Book ch. 5 — "pour ceux qui passent à côté du créneau de la mi-journée" | CONFIRMED |

### 3.3 CRP Cycle Accounting

**Book confirmation:** "peu importe qu'il dure trente ou quatre-vingt-dix minutes — compte dans le total de ladite semaine"

This means: both 30-min and 90-min CRP count as **one recovery event** toward the weekly total. The book does NOT specify fractional cycle counting (0.5 vs 1.0). It simply says it "counts."

**Status:** CONFIRMED that CRP counts. TODO_NICK: For our weekly counter, does 30-min CRP = 1 cycle or 0.5?

## 4. Readiness Zone

Product Vision concept (not from book). Three zones, never numeric.

| Zone | Criteria (proposed) | R-Lo Message Style | Status |
|---|---|---|---|
| Green | Recent nights averaging ≥ ideal cycles, no flags | "Full reserves. Push if you want." | TODO_NICK: Confirm threshold |
| Yellow | Recent nights below ideal but above minimum | "Steady state. CRP recommended." | TODO_NICK: Confirm threshold |
| Orange | Recovery priority — recent nights significantly below target | "Your body's asking for rest." | TODO_NICK: Confirm threshold |

**Guardrail:** Zone is NEVER displayed as a number. Only color + R-Lo contextual message.

**Status:** TODO_NICK (all thresholds)

## 5. Calendar Conflict Resolution

**Core principle:** Anchor time is NEVER moved. Bedtime shifts in 90-minute increments.

When a calendar event conflicts with the pre-sleep routine:
1. R-Lo identifies the conflict
2. R-Lo offers TWO options (never demands)
3. User chooses

**Example (from Product Vision):**
> "Your dinner reservation at 9 PM pushes into pre-sleep territory. Two options:
> A) Shortened 45-min pre-sleep + 23:00 cycle
> B) Full pre-sleep + 00:30 cycle
> What works better tonight?"

**Status:** CONFIRMED

## 6. Rules Registry (Consolidated)

### Category: Cycle Calculation
| ID | Rule | Status |
|---|---|---|
| R001 | Bedtime = Anchor − (cycles × 90 min) | CONFIRMED |
| R002 | Default cycles/night = 5 | CONFIRMED (book: "pour une personne standard") |
| R003 | Minimum viable night = 3 cycles | CONFIRMED (book: "juste trois cycles, même si là, vous poussez") |
| R004 | Missed bedtime → drop to next 90-min boundary | CONFIRMED |
| R005 | Absolute floor = 2 cycles | TODO_NICK (inferred from Jess example) |
| R006 | All cycles count toward weekly total regardless of which night | CONFIRMED |

### Category: Pre-Sleep
| ID | Rule | Status |
|---|---|---|
| R010 | Pre-sleep routine = 90 min before bedtime | CONFIRMED (book ch. 4) |
| R011 | ~~Pre-sleep starts 30 min before down-period~~ DEPRECATED — merged into R010 | DEPRECATED |
| R012 | During pre-sleep: no screens, dim lights, decompress | CONFIRMED |
| R013 | Post-event adrenaline clearance = ~90 min | CONFIRMED (Product Vision) |
| R014 | Post-event protocol: accept delayed start, don't force sleep | CONFIRMED |

### Category: CRP
| ID | Rule | Status |
|---|---|---|
| R020 | Midday CRP window = 13:00–15:00 | CONFIRMED (book ch. 5) |
| R021 | CRP can be 30 min or 90 min | CONFIRMED |
| R022 | CRP recommended when previous night < ideal cycles | CONFIRMED |
| R023 | CRP counts toward weekly total | CONFIRMED (book: "compte dans le total"). Fractional value: TODO_NICK |
| R024 | Evening CRP window = 17:00–19:00, 30 min only | CONFIRMED (book ch. 5) |
| R025 | Evening CRP must be 30 min only (90 min interferes with night sleep) | CONFIRMED (book ch. 5) |

### Category: Calendar
| ID | Rule | Status |
|---|---|---|
| R030 | Event overlaps pre-sleep → offer 2 options | CONFIRMED |
| R031 | Anchor time NEVER moves for calendar events | CONFIRMED |
| R032 | Event ends past bedtime → recalculate to next cycle boundary | CONFIRMED |
| R033 | R-Lo presents options, never demands | CONFIRMED |

### Category: Weekly Recovery
| ID | Rule | Status |
|---|---|---|
| R040 | Weekly target = 35 cycles | CONFIRMED |
| R041 | Acceptable range = 28–30 cycles | CONFIRMED (book ch. 3) |
| R042 | Danger zone: < 28 cycles | CONFIRMED (book: "vous risquez de tirer trop sur la corde") |
| R043 | Max 3 consecutive short nights | CONFIRMED (book ch. 3) |
| R044 | ≥ 4 ideal nights per week | CONFIRMED (book ch. 3) |
| R045 | "One bad night doesn't define your week" — never alarm on single deficit | CONFIRMED |
| R046 | Recovery framing: "You're at X/35. Two good nights and you're back on track." | CONFIRMED |

### Category: Readiness
| ID | Rule | Status |
|---|---|---|
| R050 | Green zone: recent nights avg ≥ 4.5 cycles | TODO_NICK |
| R051 | Yellow zone: recent nights avg 3–4.5 cycles | TODO_NICK |
| R052 | Orange zone: recent nights avg < 3 cycles | TODO_NICK |
| R053 | Zone NEVER shown as a number | CONFIRMED |

### Category: R-Lo
| ID | Rule | Status |
|---|---|---|
| R060 | Morning message: last night cycles + weekly progress + zone | CONFIRMED |
| R061 | Midday message: CRP reminder if applicable | CONFIRMED |
| R062 | Evening message: pre-sleep routine prompt | CONFIRMED |
| R063 | Post-event message: down-period protocol guidance | CONFIRMED |
| R064 | Tone: calm, pragmatic, never anxious | CONFIRMED |
| R065 | Forbidden words: score, grade, rating, poor, bad, fail | CONFIRMED |

## 7. Open Questions for Nick (Prioritized)

### High Priority (blocks implementation)
| # | Question | Context |
|---|---|---|
| Q01 | Pre-sleep model: the book says 90 min. Our v0.1 had 30+90=120 min. Which is correct for the app? | Rules R010/R011 |
| Q02 | Absolute floor for cycles: is 2 acceptable, or should we never go below 3? | Rule R005 |
| Q03 | CRP cycle accounting: for weekly counter, 30-min CRP = 1 cycle or 0.5? | Rule R023 |
| Q04 | Post-event protocol: does event TYPE matter (physical vs. mental) for clearance time? | Rule R013 |

### Medium Priority (affects accuracy)
| # | Question | Context |
|---|---|---|
| Q05 | Readiness zone thresholds: are avg-based thresholds correct? Should we factor consecutive nights? | Rules R050-R052 |
| Q06 | Should the app enforce the "max 3 consecutive short nights" rule more explicitly? | Rule R043 |
| Q07 | Night shift workers: any modifications beyond flexible anchor? | Edge case |
| Q08 | Partial cycles: if user wakes mid-cycle, how do we count it? | Edge case |

### Low Priority (can defer)
| # | Question | Context |
|---|---|---|
| Q09 | Recovery Room Audit: MVP or Phase 2? | Scope |
| Q10 | Travel Mode: priority for MVP? | Scope |
| Q11 | Chronotype: does it affect ideal cycle count (4 vs 5)? | Rule R002 |
