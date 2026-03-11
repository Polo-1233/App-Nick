# R90 Canonical System Reference

**Version:** 1.0 — Knowledge Freeze
**Date:** 2026-03-11
**Status:** FROZEN — do not edit without a formal knowledge review
**Purpose:** Single authoritative reference of the R90 system as currently understood. Readable by product, engineering, and AI implementation teams. This document synthesises and supersedes the narrative overview in R90_SYSTEM_OVERVIEW.md for implementation planning purposes.

**Sources:** All processed sources as of Batch 2 completion (42 sources reviewed). Full source index: `R90_SOURCE_INDEX.md`. Detailed principles: `R90_CORE_PRINCIPLES.md` (P-001–P-171). Decision rules: `R90_DECISION_RULES.md` (DR-001–DR-079).

---

## 1. SYSTEM SCOPE

### What This System Covers

The R90 knowledge base, as frozen today, fully covers:

- **The 90-minute cycle framework** — the foundational unit, 16 cycles per 24-hour day, 4 sleep stages, cycle completeness vs duration
- **ARP (Anchor Reset Point)** — definition, setting method, rationale, multishift variants
- **Four-phase day structure** — phase boundaries, cycle positions per phase, circadian alignment
- **CRP (Controlled Reset Period)** — three duration tiers, placement rules, NSDR as CRP variant
- **MRM (Micro Reset Moment)** — specification, cadence, light-exposure pairing
- **Weekly cycle accounting** — 35-cycle target, 28-cycle floor, compensation logic
- **Chronotype model** — AMer, PMer, In-betweener; identification method; schedule implications
- **Circadian biology** — light as the master lever, lux hierarchy, melatonin/serotonin mechanism, dual-driver model (circadian + homeostatic)
- **Sleep stage distribution** — deep sleep in first 2 cycles, REM in later cycles, REM compensation
- **Environment protocols** — light (morning/evening), temperature, familiarisation, blackout + DWS pairing, bedroom design
- **Physical setup** — sleeping position, mattress check, individual duvets, air quality
- **Behavioural patterns** — 43 identified patterns (problematic and desirable)
- **User states** — 17 classified recovery situations with triggers, signals, and response logic
- **Recommendation engine** — 26 defined recommendations with trigger conditions and engine logic
- **Post-sleep and pre-sleep routines** — full sequences, rationale, ordering
- **Disruption responses** — 15-minute rule, 2–3am waking, missed cycle boundary, failed onset
- **Sleep restriction protocol** — conditions of use, mechanism
- **Pre-event arousal protocol** — framework for high-stakes nights
- **Illness and injury recovery mode** — polyphasic intensification, CRP-led recovery
- **Travel and jet lag protocols** — pre-adaptation, arrival rules, 3-cycle travel floor
- **Shift work (multishift)** — two-ARP model (day and night), cycle placement, CRP during overnight shift
- **NSDR as a CRP format** — formally positioned as "the new CRP"
- **Coaching and mindset framework** — anxiety management, process focus, waking-hours framing, key reframes

### What This System Does Not Yet Fully Cover

- **Product selection specifics** — mattress type and weight, pillow specs, DWS product recommendations are not systematically covered beyond principles
- **Clinical sleep disorders** — apnea, clinical insomnia, parasomnias are acknowledged but no detailed protocol has been extracted
- **Formal chronotype diagnostic** — no scored instrument exists by design; only guided self-reflection questions
- **Exact circadian peak times** — IMG-001 provides approximations; Nick deliberately does not prescribe precise times; confirmed times remain OCR-approximate
- **Chronotype conflict resolution** — couple and workplace conflict protocols are acknowledged narratively but no decision rules are extracted
- **Nose breathing / Buteyko training protocol** — mentioned, not detailed
- **Gut health and eating pace protocol** — mentioned as a performance tactic, no detailed rules extracted

### What Is Mature Enough for Implementation Right Now

Everything in the core scheduling engine, user state detection, recommendation layer, and behavioural pattern detection is confirmed and implementation-ready. The system is sufficient to build a full-featured sleep coaching application with only minor gaps that require conservative defaults rather than blocking new work.

---

## 2. CORE PHILOSOPHY

### The Central Premise

R90 is not a sleep hygiene protocol. It is a complete restructuring of the 24-hour day around human biology. Sleep quality is not determined by what happens in bed — it is the output of how the preceding 16 waking cycles were managed.

> "It does not focus on what happens when you are asleep, but on everything you do when awake." — DOC-006

> "It's not about what happens when you are asleep — it's so much more about how you manage your waking hours." — DOC-012 (P-167)

### Process Over Outcome

The primary behavioural shift R90 requires: measure and manage the process (cycles completed, routines executed, MRMs taken), not the outcome (how many hours, how you feel, what the tracker says). Outcome focus is itself the primary cause of sleep anxiety, which is the primary sleep disruptor.

> "Worrying about sleep is the key sleep disruptor." — DOC-012 (P-166)

The app must always reinforce process adherence. It must never generate anxiety about sleep outcomes.

### Cycles Over Hours

The fundamental unit of the R90 system is the 90-minute cycle, not the hour. Eight hours is a cultural construct. Five complete 90-minute cycles (7.5h equivalent) is the R90 target. A 4.5h night of three complete cycles is better than a 5h night that interrupts a fourth cycle mid-stage. Completeness at the cycle level matters more than total duration.

### Recovery as a Managed System

Sleep is not passive. Recovery is an active, designed, daily system — analogous to training or nutrition, not a side effect of being tired. The R90 system manages recovery across all 16 cycles of the 24-hour day, distributing it through nocturnal sleep, CRPs, and MRMs.

The weekly period, not the single night, is the accounting unit. A three-cycle night is an input to be corrected, not a failure to be anxious about.

### The SleepING Reframe

Nick deliberately uses "sleepING" (not "sleep") to position recovery as an active daily behaviour — just as hydrating, eating, and exercising are. This mindset shift is the first coaching intervention. (P-056)

### Personal Best (PB)

The target state. The recoverable, consistent optimal performance level for each individual. R90 exists to make PB achievable more regularly. PB is not a ceiling — it is a repeatable floor. (P-003)

### Health Pillar Model

Three parallel health pillars: sleep/recovery, nutrition, exercise. They are interdependent — sleep is the foundation that makes the other two effective. Nick uses "1st Health Pillar" as rhetorical emphasis (sleep comes first in the coaching conversation), not as a strict scientific hierarchy. A four-variant of the model (sleepING, hydratING, eatING, exercisING) is used in some contexts. (OQ-003 CLOSED)

---

## 3. BIOLOGICAL MODEL

### Circadian Rhythm

A 24-hour biological cycle driven by light, temperature, and the pineal gland. The circadian rhythm governs when the body sleeps, when it is alert, when physical performance peaks, and when hormones (melatonin, serotonin, cortisol) are produced. It is the master scheduling clock of the human organism.

**The two drivers of sleep** (dual-driver model — P-149):
1. **Circadian urge** — the biological clock telling the body *when* to sleep
2. **Homeostatic sleep pressure** — the accumulating need to sleep that builds from the moment of waking; the longer you are awake, the greater the pressure

In normal conditions, both peak at night and are aligned. They can decouple — which is why shift workers cannot sleep during daylight even after 24+ hours awake, and why late-night "second winds" occur. The ARP fixes the circadian anchor; CRPs and MRMs partially discharge homeostatic pressure during the day.

**Key light/hormone cycle (AMer baseline — OCR-approximate; PMer = shift +1–2 hours):**

| Time | Biological event |
|------|-----------------|
| ~06:00 | Lowest body temperature; serotonin begins; melatonin stops |
| ~08:30 | Sharpest blood pressure rise |
| ~10:00 | Highest alertness |
| ~12:00 | Fastest reaction time |
| ~14:30 | Best coordination |
| ~17:00–18:00 | Peak physical performance (strength, cardiovascular) |
| ~21:00 | Melatonin secretion begins |
| ~02:00 | Melatonin peak / deepest sleep |

⚠️ *These times are from OCR of a circular infographic (~60% accuracy). Treat as approximate. Nick deliberately does not prescribe exact times — he directs clients to research circadian biology themselves.*

**Modern disruptors of the circadian clock:**
1. Electric light (~1700s) — extended wakefulness beyond biological limits
2. 24/7 technology — eliminated natural micro-recovery moments
3. Daylight saving time — artificial seasonal clock shift

### Chronotypes

Chronotype is genetic and innate. It cannot be changed — only worked with or suppressed. It is determined by the speed of the melatonin-to-serotonin pineal shift at sunrise.

| | **AMer (Morning / Lark)** | **PMer (Evening / Owl)** | **In-betweener** |
|--|--|--|--|
| Population | ~30% | ~70% | Subset of PMers |
| Natural wake | 5–7am | 8–9am or later | Blurred |
| Peak cognitive | Morning (Phase 1–2) | Late afternoon/evening (Phase 3) | Inconsistent |
| Phase delay | None | ~1–2 hours behind AMer | Masked |
| Shift/travel | Low resilience | Higher resilience | Variable |
| Root cause | — | — | Lifestyle, occupation, stimulant use |

**In-betweener:** Not a formal third chronotype. Most self-identified in-betweeners are lifestyle-suppressed PMers operating under AMer schedule constraints. Nick describes them as "wired and tired all the time — like a dolphin." No scored diagnostic instrument exists; classification is by guided self-reflection. (OQ-021 CLOSED)

**Identification method:** Five coached self-reflection questions:
1. Morning person or evening person?
2. Given freedom, when would you naturally wake?
3. When are you most alert for physical activity?
4. When are you mentally sharpest?
5. Is your current schedule aligned with these preferences?

### 90-Minute Sleep Cycles

The fundamental unit. Each cycle contains four stages:

| Stage | Type | Function |
|-------|------|---------|
| 1 | NREM — Light | Transition; easily disturbed |
| 2 | NREM — Deeper | Heart rate and body temp drop |
| 3 | NREM — Deep (SWS) | Physical repair: growth hormone, glycogen, protein synthesis |
| 4 | REM | Memory consolidation, creativity, emotional processing |

Only 20–25% of any cycle is accessible as deep or REM sleep. Everything in the preceding 16 hours — food, fluid, light, stress — determines how far down the "staircase" the person travels. (P-048)

**Sleep stage distribution across the night** (P-168–170):
- **First 2 cycles:** Deep sleep (NREM Stage 3) dominates — the most physiologically restorative window
- **Later cycles:** REM progressively dominates
- **Deep sleep window for ARP 06:30:** Cycles starting 23:00–02:00; after 02:00, deep sleep proportion decreases significantly
- **REM compensation:** When sleep-deprived, the brain automatically enters REM earlier in the cycle sequence and for longer — the body self-regulates toward the most-deficient stage

### Polyphasic Heritage

Monophasic sleep (one single block) is a post-industrial construct. Humans have **three natural sleep periods available per day** — condensed into one by modern convention. R90 deliberately reinstates a polyphasic pattern through nocturnal sleep + CRP + optional morning rest. (P-160)

### Four-Phase Day Structure

The 24-hour day is divided into four phases, each exactly 4 cycles (6 hours) from the ARP:

| Phase | Cycles | For ARP 06:30 | Primary purpose |
|-------|--------|---------------|----------------|
| Phase 1 (P1) | C1–C4 | 06:30–12:00 | Activation, peak performance |
| Phase 2 (P2) | C5–C8 | 12:30–18:00 | CRP window (C6/7/8), sustained activity |
| Phase 3 (P3) | C9–C12 | 18:30–00:00 | Wind-down, pre-sleep preparation |
| Phase 4 (P4) | C13–C16 | 00:30–06:00 | Nocturnal sleep (3–6 cycles) |

Phase 4 is the default nocturnal sleep position. The R90 framework is **phase-agnostic** — shift work and illness protocols can place sleep cycles in Phase 1, 2, or 3. The cycle rules remain identical regardless of phase position. (P-165)

---

## 4. RECOVERY ARCHITECTURE

### ARP — Anchor Reset Point

The single most important scheduling decision. The ARP is the fixed, consistent wake time. All 16 daily cycles, all sleep onset times, all CRP windows, and all phase boundaries are calculated from the ARP.

**Canonical rules:**
- Fixed 7 days a week — no weekend variation, no post-travel adjustment
- Set on the hour or half-hour only (e.g. 06:00, 06:30, 07:00)
- Determined by the **earliest consistent obligatory wake time** in the week
- Standard coaching range: 05:00 / 05:30 / 06:00 / 06:30 / 07:00 / 07:30 / 08:00 / 08:30
- **06:30** is the most common coaching anchor. **07:00** is a common worked example
- Trial period: commit for 7 days before evaluating adjustment
- ARP must be committed before the engine generates any other output — it is an onboarding gate

**Cycle formula:** `Cn = ARP + (n−1) × 90 minutes`

**For ARP 06:30 — full 16-cycle wheel:**
C1=06:30 · C2=08:00 · C3=09:30 · C4=11:00 · C5=12:30 · C6=14:00 · C7=15:30 · C8=17:00 · C9=18:30 · C10=20:00 · C11=21:30 · C12=23:00 · C13=00:30 · C14=02:00 · C15=03:30 · C16=05:00

**Multishift ARP model:**
- Day shift: ARP 1 = 06:00
- Night shift: ARP 2 = 18:00
- Exactly 12 hours apart. Each generates its own complete 16-cycle wheel. The coaching system assigns whichever ARP matches the active shift pattern.

### Sleep Cycle Planning

Count backwards from ARP in 90-minute increments to determine sleep onset times.

**For ARP 06:30:**

| Cycles | Duration | Onset time | Status |
|--------|----------|-----------|--------|
| 6 | 9.0h | 21:30 (C11) | Extended / early |
| **5** | **7.5h** | **23:00 (C12)** | **Target (ideal)** |
| 4 | 6.0h | 00:30 (C13) | Acceptable floor |
| 3 | 4.5h | 02:00 (C14) | Emergency / travel only |
| 2 | 3.0h | 03:30 (C15) | Elite athlete acute context only |

**Pre-sleep onset selection window:** C11–C13 (standard). C12 = preferred 5-cycle start. C13 = 4-cycle floor. C14–C15 are emergency options below the standard minimum — labelled as Sleep Time only in the Elite Athlete case study context. (P-152, P-171)

**Missed cycle boundary rule:** "Like missing a bus — catch the next one." If you arrive home too late to hit the target onset, wait for the next cycle boundary. Missing a cycle boundary and forcing sleep mid-cycle produces worse recovery than sleeping one fewer complete cycle at the correct boundary. (DR-036)

**15-minute rule:** If sleep does not onset within 15 minutes of lying down, get up, stay in chillout mode (no screens, no stimulation), and wait for the next 90-minute cycle boundary. Never lie anxious in bed. (DR-037, P-067)

### CRP — Controlled Reset Period

A deliberate rest/mindspace period counted as a recovery cycle toward the weekly target. It does not require sleep — mental disengagement is sufficient.

**Specification:**

| Parameter | Value |
|-----------|-------|
| Duration (standard) | 30 minutes |
| Duration (extended) | 90 minutes — full recovery cycle (high deficit, afternoon window) |
| Duration (minimum) | 20 minutes |
| Timing | Phase 2, cycles 6/7/8 (midday to early evening) |
| Cycle count | Counts as 1 cycle toward 35/week target |
| Sleep required? | No — mental disengagement sufficient |

**CRP variants:**
- **NSDR (Non-Sleep Deep Rest)** — formally positioned as "the new CRP." Guided breathing technique that maintains alertness. Suited for those who cannot or prefer not to sleep during CRP. Counts toward weekly recovery targets. (P-155)
- **Standard CRP** — 30 minutes with potential for light sleep
- **Extended CRP** — 90 minutes when previous night produced < 3 cycles

**CRP purpose:** Adds cycles to a short week; removes bedtime anxiety; bridges chronotype misalignment; provides a recovery mechanism for shift workers, new parents, and high-travel schedules.

### MRM — Micro Reset Moment

The lightest recovery layer. A brief mental disengagement break at every 90-minute waking cycle boundary.

**Specification:**

| Parameter | Value |
|-----------|-------|
| Duration | 3–5 minutes |
| Frequency | 7 per active day (one per waking cycle, Phases 1–3) |
| Sleep required? | No — vacant mindspace |
| Light pairing | Each MRM is an optimal timing for daylight exposure renewal |
| Effect | Measurably improves sleep onset, sleep maintenance, and deep sleep access even at minimum |

**MRM activities:** Look out a window; step outside briefly; refill water; change direction; passive nature contact. The key is mental disengagement — not a task switch.

### Weekly Cycle Accounting

The week is the primary accounting unit. The target is **35 complete cycles per week**.

| Target | Cycles | Formula |
|--------|--------|---------|
| Optimal week | 35 | 5 nocturnal/night × 7 nights |
| Floor week | 28 | 4 nocturnal/night × 7 nights (+ 5 CRPs + 35 MRMs) |
| Full optimised allocation | 8.5h | 5 cycles (7.5h) + 1 CRP (0.5h) + MRMs (≈0.5h) |
| Floor allocation | 7h | 4 cycles (6h) + 1 CRP (0.5h) + MRMs (≈0.5h) |

Weekly accounting is the mechanism by which R90 eliminates nightly anxiety. A 3-cycle night is not a failure — it is an input corrected by CRP and the following nights. Below 28 cycles/week: CRP is the primary compensation tool. ARP is never shifted as a compensation response.

**"No-worries" weekly floor:** 28 nocturnal cycles + 5 CRPs + 35 MRMs. (OQ-023 CLOSED — DOC-007)

### Recovery Day Logic

When cycle deficit is significant, a "Controlled Recovery Day" is prescribed:
- 90-minute CRP in the afternoon window (Phase 2)
- Maintain ARP — do not sleep in
- Protect Phase 3 wind-down
- Avoid scheduling cognitively demanding tasks

### Illness and Injury Mode

During illness or injury, the body's recovery demand increases. The R90 response:
- Maximise nocturnal cycle count (target 5–6 cycles)
- Use CRP opportunistically throughout the day (not limited to Phase 2)
- Treat the illness period as high-priority recovery allocation
- Resume standard structure as soon as health permits
- New parent variant: sync schedule with infant's polyphasic rhythm; use CRPs opportunistically; do not attempt rigid framework compliance until child's sleep consolidates. (P-140)

### Pre-Event High Arousal Protocol

For nights before high-stakes events (competition, important meeting, travel departure):
- Do not try to force extra sleep — this increases arousal
- Accept that fewer cycles may occur; trust weekly accounting
- Maintain ARP exactly
- Prioritise Phase 3 wind-down (light, temperature, download)
- Even 3 cycles before a high-performance event is sufficient with correct pre-phase preparation

### Sleep Restriction Protocol

For persistent severe onset latency (anxiety-driven over-allocation of time in bed):
- Deliberately choose a later cycle entry time (e.g. shift 23:00 onset to 00:30 or 02:00) to consolidate sleep
- Compensate with daytime CRPs
- Not about reducing hours — about increasing cycle depth at the correct circadian timing
- Prescribed only when structural causes have been addressed and anxiety-driven extended time in bed is the remaining barrier. (P-141, DR-045)

### Travel and Jet Lag Protocols

**Pre-departure:** Pre-adapt toward destination time zone in the weeks before travel using progressive schedule shifts + light management. Bright blue light in destination's morning; absolute darkness at night.

**Post-arrival rule:** Immediately commit to destination-aligned sleep time from night one. No gradual drift. (P-145)

**Late-arrival (body clock says morning, local says night):**
1. Avoid sleeping on the plane
2. Dim all lights immediately on arrival
3. No alcohol, no heavy meals
4. Warm bath, music — stimulate melatonin artificially
5. Completely dark, cool hotel room
6. 3 cycles is sufficient for the first night

**Early-arrival (body clock says night, local says morning):**
1. Sleep on the plane (earplugs, eye mask, window seat, do not wake)
2. Maximise natural daylight throughout arrival day
3. Use CRPs as daytime rest pockets

**Travel floor:** 3 nocturnal cycles is explicitly sufficient for a jet lag arrival night — an exception to the standard 4-cycle floor. (P-148)

### Shift Work — Multishift Framework

**Two-ARP model:**
- **ARP 1 (Day shift) = 06:00** — 5 sleep cycles from C5=00:00 to C9=06:00; CRP at C16=16:30
- **ARP 2 (Night shift) = 18:00** — 5 sleep cycles from C12=10:30 to C16=18:00 (daytime sleep); CRP at C7=03:00 (midpoint of overnight shift)

The framework rules are identical — only the anchor rotates. Sleep cycles are placed phase-agnostically: day-shift sleep is in Phase 1 (conventional); night-shift daytime sleep is in Phase 1/2/3.

**AMer/PMer adaptability:** AMers are significantly less resilient to shift work and time zone travel. PMers are comparatively more adaptable — they may be better suited to night shift or multi-timezone roles. (P-138)

### Environmental Architecture

**Light management:**

| Context | Target lux | Action |
|---------|-----------|--------|
| ARP / Cycle 1 morning | 10,000 | DWS device or outdoor exposure |
| Waking cycles (C2–C10) | 1,000 | Per cycle; MRM paired with daylight |
| Phase 3 (pre-sleep evening) | ~500 | Shift to amber/red; avoid blue/white |
| Melatonin threshold | 500 | At or below = melatonin production begins |
| Outdoor (clear day) | 60,000–100,000+ | Reference maximum |
| Indoor typical | 200–500 | Below melatonin threshold — default deficit |

**Seasonal targets:**
- Standard day: 12h daylight / 4h amber / 8h dark
- Apr–Sep: 16h daylight / 2h amber / 6h dark
- Oct–Mar: 8h daylight / 8h amber / 8h dark — SAD risk window; light therapy is indicated

**Blackout + DWS are a paired intervention.** Neither works optimally alone. Blackout removes the natural serotonin trigger at ARP; the DWS replaces it. Using blackout without a morning light cue undermines ARP alignment. (P-157, DR-039)

**Temperature protocol:**
- Evening: body slightly warmer than the room; cool bedroom triggers sleep onset
- Morning: cool environment → warm, combined with light
- Avoid hot rooms and heavy blankets — they prevent the temperature differential that initiates sleep onset

**Physical setup:**
- Sleeping position: non-dominant side, foetal position (right-handers on left side; left-handers on right)
- Mattress check: lying on side in foetal position — gap between hip/shoulder and mattress should be ≤ 6cm (≤ two flat hands)
- Morphotype determines surface requirements: ectomorph = softer, mesomorph = medium, endomorph = firmer
- Couples: individual duvets for different temperature preferences; zip-link system or separate toppers for different morphotypes
- Linen: fresh linen = familiarisation trigger; target as frequently as practically possible
- Air: hypoallergenic bedding; frequent washing; room airing

**Familiarisation:**
The brain will not descend to deep sleep stages in an environment it does not recognise as safe. Personal sensory anchors (sound profile, smell, visual cues, comfort objects) must travel with the person. Unfamiliar environments reduce recovery by up to 40%. (P-071, P-072)

**Post-sleep routine — exact sequence:**
bladder → daylight (10,000 lux) → hydrate → fuel up → mental challenge → exercise → bowels

This sequence is unhurried and in order. Post-sleep routine has greater impact on recovery quality than the pre-sleep routine. (P-047)

**Pre-sleep routine — core requirements:**
- Shift to amber/red/dim light (~500 lux)
- Allow room to cool
- Download/declutter — resolve unfinished thoughts, close open loops
- Tech down — reduce stimulating device use
- Personalisation is permitted *around* these conditions — yoga, meditation, scents are additions, not replacements

---

## 5. USER STATES

User states are recovery situations, not diagnostic labels. A user can occupy multiple states simultaneously. The engine surfaces the highest-priority active state.

### Full State Inventory

| ID | Name | Severity | Core Action |
|----|------|----------|-------------|
| US-01 | Aligned | None | Maintenance, celebration, depth-building |
| US-02 | Mild Cycle Deficit | Low | CRP scheduling, weekly rebalancing |
| US-03 | Significant Cycle Deficit | Medium | Structural audit, CRP escalation, ARP review |
| US-04 | ARP Instability | Medium | Anchor reset — blocks full schedule generation |
| US-05 | Chronotype Conflict | Medium | Schedule realignment, social jet lag coaching |
| US-06 | Post-Disruption Recovery | Low–Medium | Managed rebalancing, travel/event protocol |
| US-07 | Sleep Anxiety Loop | High | Process refocus, remove outcome metrics |
| US-08 | Electronic Insomnia | Medium | Phase 3 light correction, tech protocol |
| US-09 | Ortho-Insomnia | High | Tracker management, data-detox |
| US-10 | Stimulant Compensation | Medium–High | Structural audit, caffeine timing |
| US-11 | Environmental Friction | Medium | Light, temperature, noise, bedroom audit |
| US-12 | Framework Gap | Medium | Full onboarding / R90 framework reset |
| US-13 | Sleep Noise Exposure | Medium | Information detox, process anchoring |
| US-14 | In-Betweener Fog | Low–Medium | Chronotype calibration |
| US-15 | Pre-Event High Arousal | Low–Medium | Arousal management, acceptance framing |
| US-16 | Illness / Injury Recovery | Medium | Polyphasic recovery mode, CRP intensification |
| US-17 | Shift Work / Multishift | Medium–High | ARP recalculation, shift-specific CRP placement |

### Core MVP States

The following states cover the vast majority of everyday users and should be prioritised for MVP implementation:

- **US-01** (Aligned) — maintenance mode baseline
- **US-02** (Mild Cycle Deficit) — most common state; triggers CRP
- **US-03** (Significant Cycle Deficit) — escalation of US-02
- **US-04** (ARP Instability) — onboarding gate; must resolve first
- **US-07** (Sleep Anxiety Loop) — high prevalence, high urgency
- **US-08** (Electronic Insomnia) — high prevalence in digital-first users
- **US-11** (Environmental Friction) — common first-touch discovery
- **US-12** (Framework Gap) — all new users start here

The following are important but can be deferred to V2:
- US-05, US-09, US-10, US-13, US-14, US-15, US-16, US-17

### Key Co-occurrence Pattern

US-05 (Chronotype Conflict) commonly co-occurs with US-07 (Anxiety) + US-12 (Framework Gap). When Chronotype Conflict is detected, audit for the other two simultaneously.

---

## 6. RECOMMENDATION LAYER

The recommendation engine produces 26 defined recommendations. Each is linked to one or more user states and a set of validated decision rules.

**Design principle:** Always target the structural root cause, not the surface symptom. The intervention hierarchy is: **MRM → CRP → nocturnal cycles → sleep restriction**. Never skip levels.

### Recommendation Categories

**Category 1 — Foundation (CRITICAL)**
| ID | Name | When Triggered |
|----|------|---------------|
| REC-01 | ARP Commitment | No ARP set, or ARP variance > 30min |
| REC-20 | Framework Reset | No R90 framework in place (US-12) |

These are gate-level. No other recommendation is generated until ARP is committed.

**Category 2 — Scheduling (HIGH)**
| ID | Name | When Triggered |
|----|------|---------------|
| REC-02 | Sleep Onset Scheduling | ARP committed; user needs bedtime |
| REC-03 | CRP Scheduling | Cycle deficit; day after short night |
| REC-04 | MRM Introduction | New user; structural gap |
| REC-05 | MRM Daily Reminders | Active for all states |

**Category 3 — Environment and Light (HIGH)**
| ID | Name | When Triggered |
|----|------|---------------|
| REC-07 | Morning Light Activation | Framework gap; environment friction |
| REC-08 | Phase 3 Wind-Down Protocol | Electronic insomnia; sleep anxiety |
| REC-09 | Evening Light Correction | Electronic insomnia; environment friction |
| REC-10 | Bedroom Temperature Correction | Environment friction |
| REC-11 | Environment Audit | Environment friction; framework gap |

**Category 4 — Anxiety and Mindset (HIGH)**
| ID | Name | When Triggered |
|----|------|---------------|
| REC-13 | Cycle Count Reframe | Sleep anxiety; framework gap |
| REC-15 | 15-Minute Rule Activation | Sleep anxiety loop |
| REC-16 | 2–3am Waking Protocol | Sleep anxiety (nocturnal waking) |
| REC-18 | Tracker Usage Calibration | Ortho-insomnia |

**Category 5 — Tracking and Review (MEDIUM)**
| ID | Name | When Triggered |
|----|------|---------------|
| REC-06 | Post-Sleep Routine Reinforcement | Framework gap; ARP instability |
| REC-12 | Chronotype Schedule Adjustment | Chronotype conflict; in-betweener fog |
| REC-14 | Weekly Balance Review | Mild or significant deficit |
| REC-17 | Caffeine Timing Correction | Stimulant compensation |
| REC-21 | Social Jet Lag Acknowledgement | Chronotype conflict |
| REC-22 | Post-Disruption Rebalancing | Post-disruption recovery |

**Category 6 — Specialist / Advanced (LOW–MEDIUM)**
| ID | Name | When Triggered |
|----|------|---------------|
| REC-19 | Sleep Restriction Protocol | Persistent significant deficit |
| REC-23 | Pre-Event Arousal Protocol | Pre-event high arousal |
| REC-24 | Illness Recovery Mode | Illness/injury |
| REC-25 | Controlled Recovery Day | Mild or significant deficit |
| REC-26 | Travel Environment Setup | Post-disruption (travel) |

### Engine Capabilities Summary

The recommendation engine today can:
- Generate a personalised ARP and full 16-cycle schedule
- Identify chronotype and apply appropriate scheduling adjustments
- Calculate CRP placement by phase and cycle position
- Schedule 7 daily MRM reminders at cycle boundaries
- Track weekly cycle balance and trigger escalation responses
- Detect 8 core user state conditions and respond with appropriate recommendations
- Apply disruption protocols (late arrival, missed onset, 2–3am waking, short night)
- Generate post-sleep and pre-sleep routine guidance
- Apply environment audit recommendations
- Apply anxiety-management and process-focus reframes
- Handle shift work with two-ARP model

---

## 7. BEHAVIOURAL MODEL

Nick uses behaviour pattern identification as the diagnostic layer — assessing which problematic patterns are active to select the right intervention path.

### Patterns That Sabotage Recovery

| Pattern | ID | Description |
|---------|-----|-----------|
| Sleep anxiety loop | BP-013 | Worrying about sleep → worse sleep → more worry. The primary disruptor. |
| Normalised underperformance | BP-001 | Chronic sleep deprivation without recognising the deficit; degradation becomes the new baseline. |
| Eight-hour fixation | BP-017 | Nightly anxiety about "getting 8 hours"; ignores cycle completeness and weekly accounting. |
| Ortho-insomnia | BP-030 | Tracker-data-induced anxiety; the measurement tool becomes the sleep disruptor. |
| Electronic insomnia | BP-020 | Screen/social-media use extending into the melatonin window; distinct modern pathology. |
| Stimulant escalation | BP-022 | Progressive caffeine and supplement reliance to compensate for structural poor recovery. |
| Chronotype suppression | BP-014 | PMers camouflaging their biology with stimulants to meet AMer schedule demands. |
| CRP stigma | BP-018 | "Napping = weakness" belief; prevents use of a legitimate, professional recovery tool. |
| Intervention scatter | BP-021 | Isolated products (mattress, tracker, app, supplement) without a structural framework. |
| Day-long neglect, last-minute fix | BP-025 | Expecting 30 minutes of pre-sleep routine to undo 16 hours of poor conditions. |
| Sleep Noise spiral | BP-028 | Algorithm-driven anxiety from searching for sleep solutions online; amplifies the problem. |
| 2–3am panic | BP-031 | Treating natural polyphasic wakefulness as a crisis; compounds it into clinical insomnia. |
| Overstimulated bedroom | BP-032 | TV, work items, devices, harsh lighting; bedroom loses its recovery association. |
| Rushed post-sleep | BP-012 | Immediate activity after waking — no daylight, no hydration; skips the circadian reset. |
| Sleep as binary | BP-011 | "I slept / I didn't sleep" — misses stages, cycles, and timing. |
| Sleep as weakness | BP-002 | Cultural belief that sleeping less is productive. |
| Misaligned exercise | BP-015 | Training when socially convenient rather than at chronotype peak. |

### Patterns That Reinforce Recovery

| Pattern | Description |
|---------|-------------|
| Process focus | Measuring cycles and routines, not hours and outcomes |
| Polyphasic default | Treating CRP and MRM as standard professional recovery tools |
| Structured daily intervention | Intentional behaviours distributed across all 16 cycles |
| Working with biology | Scheduling performance in natural peak windows; protecting recovery windows |
| Circadian awareness | Understanding and aligning to the biological clock |

### The Intervention Scatter Warning

Any single intervention applied **without the structural R90 framework** is at best ineffective and at worst counterproductive. This is the most common mistake Nick observes. The question to ask for any intervention: **Why? What? For how long?** A tracker, app, supplement, or mattress without the framework underperforms. (P-044, P-070, DR-026)

---

## 8. APP-READY FEATURES

### Ready Now — Implement Immediately

| Feature | Status | Notes |
|---------|--------|-------|
| ARP setup and commitment flow | ✅ Ready | Full logic confirmed; gate-level requirement |
| 16-cycle daily schedule generation | ✅ Ready | Formula: Cn = ARP + (n−1) × 90min |
| Phase boundary display (P1–P4) | ✅ Ready | Each phase = 4 cycles from ARP |
| Sleep onset time calculator | ✅ Ready | Count back from ARP: 3/4/5/6-cycle options |
| Pre-sleep onset window display | ✅ Ready | C11–C13 highlighted; C12 = preferred |
| CRP scheduling (Phase 2, C6/7/8) | ✅ Ready | 30-min standard, 20-min floor, 90-min extended |
| MRM reminders (7/day at cycle boundaries) | ✅ Ready | Formula: ARP + (n × 90min) for n = 2..10 |
| Weekly cycle balance tracker | ✅ Ready | Target 35; floor 28; CRP compensates |
| Chronotype identification flow | ✅ Ready | 5-question self-assessment; AMer/PMer/In-betweener |
| User state detection and routing | ✅ Ready | All 17 states defined with triggers and signals |
| Recommendation engine (REC-01 to REC-26) | ✅ Ready | All 26 recommendations defined with logic |
| Post-sleep routine guide | ✅ Ready | 7-step sequence confirmed |
| Pre-sleep routine guide | ✅ Ready | Core requirements confirmed |
| Disruption response protocols | ✅ Ready | Missed onset, 15-min rule, 2–3am waking, late arrival |
| Behavioural pattern detection | ✅ Ready | 43 patterns identified with app response logic |
| Lux display / light guidance | ✅ Ready | Full hierarchy confirmed (200 → 10,000 lux) |
| Morning light activation prompt | ✅ Ready | 10,000 lux at C1; seasonal targets |
| Evening light correction (Phase 3) | ✅ Ready | ≤500 lux amber/red from C9 onward |
| Onboarding profile collection | ✅ Ready | Inputs: ARP, chronotype, cycle target, schedule, environment |
| Shift work dual-ARP mode | ✅ Ready | ARP1=06:00 day / ARP2=18:00 night |
| Travel disruption mode | ✅ Ready | Jet lag protocols confirmed; 3-cycle travel floor |

### Partial — Implement with Conservative Defaults

| Feature | Status | Gap | Default |
|---------|--------|-----|---------|
| Circadian peak window display | ⚠️ Partial | Exact times are OCR-approximate (±30min); Nick does not prescribe them | Display AMer baseline from IMG-001; add PMer +1–2h shift; flag as approximate |
| In-betweener routing | ⚠️ Partial | No formal diagnostic; lifestyle vs true chronotype hard to distinguish | Default to "possible PMer on AMer schedule"; apply PMer rules with coaching note |
| Morphotype-based mattress guidance | ⚠️ Partial | Classification confirmed; product specs not in corpus | Surface classification and gap test only; defer product recommendation |
| Tracker calibration feature | ⚠️ Partial | Risk pattern confirmed (ortho-insomnia); exact calibration protocol not extracted | Surface risk flag + "use as guide only" framing |
| Nose breathing / Buteyko training | ⚠️ Partial | Stance confirmed (prefer training over taping); protocol not in corpus | Surface stance only; no protocol detail |
| NSDR delivery (guided audio) | ⚠️ Partial | NSDR confirmed as CRP format; no specific NSDR content in corpus | Describe NSDR; link externally; do not generate own guided content |
| Chronotype conflict resolution | ⚠️ Partial | Problem named; no formal decision rules extracted | Surface chronotype data for both parties; apply standard PMer adjustment; flag as area for coaching |

### Blocked — Do Not Implement Without Further Source Material

| Feature | Blocker |
|---------|---------|
| Formal intake questionnaire / scored profiling instrument | No scored instrument exists in the R90 system by design. Profiling is narrative/conversational — the app cannot replicate it as a scored form. |
| Clinical sleep disorder protocols (apnea, clinical insomnia) | Not in scope of processed sources. Do not attempt. Escalate to clinical professional. |
| Specific product selection (mattress brand/type, DWS model, pillow spec) | Nick's product partners and specific recommendations are not in the corpus. Surface principles only. |
| Formal diagnosis of sleep disorders | Out of scope. The R90 system is not a diagnostic tool. |

---

## 9. TERMINOLOGY CANON

These terms must remain stable across implementation. All variant forms are listed so the engineering layer can normalise incoming text.

### Primary Terms

| Canonical Term | Full Form | Variants to Normalise | Notes |
|---------------|-----------|----------------------|-------|
| **R90 Technique** | R90 Technique | R90 method, R90 system | Capitalised. "The R90 Technique" is the formal product name. |
| **ARP** | Anchor Reset Point | Anchor Rise Point, Anchor Recovery Point | "Anchor Rise Point" is an earlier informal variant (DOC-009). Canonical = Anchor Reset Point. |
| **CRP** | Controlled Reset Period | Controlled Recovery Period, Cycle Reset Period | "Controlled Recovery Period" = earlier form (DOC-003, AUD-003). "Cycle Reset Period" = editorial variant (PDF-001). Canonical = Controlled Reset Period. |
| **MRM** | Micro Reset Moment | Micro Recovery Moment | "Micro Recovery Moment" = earlier form (DOC-003). Canonical = Micro Reset Moment. |
| **KSPI** | Key Sleeping Performance Indicators | KSRI (Key Sleep Recovery Indicators), KPI | KSRI = audio-lesson term. KSPI = current official client-facing term. Both are authentic — normalise to KSPI in product. |
| **PB** | Personal Best | — | Borrowed from athletics. The recoverable, consistent optimal performance state. |
| **SWR** | Sleep-Wake Routine | — | Structural framework concept. The client-facing tool is the "16-cycle daily plan" or "R90 Playbook." |
| **NSDR** | Non-Sleep Deep Rest | — | Formally positioned as "the new CRP" within R90. |
| **AMer** | AM Chronotype | Morning person, Lark, Lion, Bear | Use AMer throughout the product. Do not use "lark" or animal labels. |
| **PMer** | PM Chronotype | Evening person, Owl, Wolf | Use PMer throughout the product. Do not use "owl" or "wolf." |
| **SWS** | Slow Wave Sleep | Deep sleep, NREM Stage 3 | Interchangeable in product-facing copy. |
| **DWS** | Dawn Wake Simulator | Sunrise alarm, light therapy alarm, SAD lamp | Specific device category. Not interchangeable with general "light therapy." |
| **Phase 1 / P1** | Morning Phase (ARP → Midday) | — | Always mapped to C1–C4 (4 cycles, 6 hours) from ARP. |
| **Phase 2 / P2** | Midday Phase (Midday → Early Eve) | — | Always mapped to C5–C8. CRP window. |
| **Phase 3 / P3** | Evening Phase (Early Eve → Sleep) | — | Always mapped to C9–C12. Wind-down zone. |
| **Phase 4 / P4** | Nocturnal Phase (Overnight sleep) | — | Always mapped to C13–C16. Default sleep position. |
| **Social Jet Lag** | Social Jet Lag | — | Nick's term for chronotype mismatch imposed by societal/occupational scheduling. |
| **Electronic Insomnia** | Electronic Insomnia | — | Nick's term for screen-driven disruption of melatonin window. Distinct from ordinary insomnia. |
| **Ortho-insomnia** | Ortho-insomnia | Tracker anxiety | Tracker-data-induced anxiety. From "orthosomnia" in literature — Nick uses "ortho-insomnia." |
| **SleepING** | SleepING (with capital ING) | Sleeping | The deliberate capitalisation is Nick's stylistic reframe. Use in coaching language; do not apply to clinical or clinical-adjacent copy. |
| **In-betweener** | In-betweener Chronotype | Intermediate, Mixed | Lifestyle-driven pattern, not a formal third chronotype. Hyphenated. |
| **Staircase** | Sleep Cycle Staircase | — | Nick's metaphor. Top = light sleep, bottom = deep/REM. Use in explanatory copy. |

### Canonical Numbering

| Namespace | Range | File |
|-----------|-------|------|
| P- | P-001 to P-171 | R90_CORE_PRINCIPLES.md |
| DR- | DR-001 to DR-079 | R90_DECISION_RULES.md |
| BP- | BP-001 to BP-043 | R90_BEHAVIOURAL_PATTERNS.md |
| US- | US-01 to US-17 | R90_USER_STATES.md |
| REC- | REC-01 to REC-26 | R90_RECOMMENDATION_ENGINE.md |

---

## 10. REMAINING GAPS

Only gaps that matter for implementation are listed here. Minor terminology or research questions are omitted.

### Gap 1 — Exact Circadian Peak Times (OQ-004)
**Impact:** Medium. Affects how precisely circadian windows can be displayed.
**Status:** OCR-approximate from IMG-001 (~60% accuracy). Nick deliberately does not prescribe exact times in processed text.
**Implementation guidance:** Use the IMG-001 approximations as the displayed baseline. Add AMer/PMer toggle (+1–2h shift for PMers). Flag as approximate in the UI ("Your approximate peak windows"). Do not block implementation.

### Gap 2 — ARP / Body Temperature Nadir Mapping (OQ-005)
**Impact:** Low. Affects the scientific justification for 06:30 as the common default ARP.
**Status:** Open. The mapping is implied (body temp nadir ≈ 06:00 → ARP ≈ 06:30) but not explicitly confirmed.
**Implementation guidance:** Use 06:30 as the common coaching anchor (PPT-002 confirmed). Justification is adequate without the nadir mapping. Do not block implementation.

### Gap 3 — In-Betweener Diagnostic Precision (OQ-021 CLOSED, but implementation gap remains)
**Impact:** Medium. Affects how accurately the app identifies true in-betweeners vs suppressed PMers.
**Status:** No formal diagnostic instrument exists by design. The distinction between true in-betweener and lifestyle-suppressed PMer is made through coaching conversation, not a questionnaire.
**Implementation guidance:** Apply the 5 self-reflection questions. If inconclusive, default to PMer rules (the larger population). Add a "refine over time" note — chronotype calibration improves with 4+ weeks of data. (REC-12)

### Gap 4 — Chronotype Conflict Resolution Protocol (OQ-020)
**Impact:** Medium. Affects couples, family scheduling, and workplace conflict states.
**Status:** Narratively described in DOC-006 ("PMers can use CRP to bridge the early gym session"). No formal decision rules extracted.
**Implementation guidance:** Surface each partner's chronotype; flag the mismatch; apply each individual's standard rules. Do not attempt couple-specific scheduling. Flag as a future coaching feature.

### Gap 5 — Nose Breathing / Buteyko Protocol
**Impact:** Low. An environmental/physical intervention without a protocol.
**Status:** Nick's stance confirmed (prefer Buteyko training over mouth taping). No training protocol in corpus.
**Implementation guidance:** Surface the stance in the interventions layer (Phase 4 / breathing section). Do not provide a training protocol. Link to external sources.

### Gap 6 — Product Selection Specifics
**Impact:** Low for core app, medium for e-commerce or product integration layer.
**Status:** Categories confirmed (DWS, blackout blinds, individual duvets, mattress toppers). No brand, model, or specification detail.
**Implementation guidance:** Surface the category and principle. Do not recommend specific products. Note as a future partnership/content layer.

### Gap 7 — "Urgent Need" Concept (OQ-016)
**Impact:** Very low. A term used once informally.
**Status:** Used once in AUD-001. Likely refers to the biological sleep drive (homeostatic pressure) at a cycle boundary signal. Not elaborated.
**Implementation guidance:** Ignore for implementation. If needed, treat as equivalent to "cycle boundary signal" — the 90-minute rhythm creates natural recovery urges.

---

## 11. IMPLEMENTATION READINESS

### Ready Now

The following are confirmed, complete, and stable — implement without hesitation:

| Domain | Readiness |
|--------|----------|
| ARP setup, commitment, and cycle calculation | ✅ Fully confirmed |
| 16-cycle daily schedule generation | ✅ Fully confirmed |
| Phase structure (P1–P4, 4 cycles each) | ✅ Fully confirmed |
| Sleep onset scheduling (count back from ARP) | ✅ Fully confirmed |
| Pre-sleep onset window (C11–C13, C12 preferred) | ✅ Fully confirmed |
| CRP placement and duration tiers (20 / 30 / 90 min) | ✅ Fully confirmed |
| NSDR as CRP variant | ✅ Fully confirmed |
| MRM cadence (7/day, 3–5 min, cycle boundaries) | ✅ Fully confirmed |
| Weekly cycle accounting (35 target / 28 floor) | ✅ Fully confirmed |
| Chronotype classification (3 types, self-reflection) | ✅ Fully confirmed |
| All 17 user states with triggers and signals | ✅ Fully confirmed |
| All 26 recommendations with engine logic | ✅ Fully confirmed |
| 43 behavioural patterns (detection and response) | ✅ Fully confirmed |
| Lux hierarchy and light management rules | ✅ Fully confirmed |
| Temperature protocols (morning/evening) | ✅ Fully confirmed |
| Physical setup (position, mattress check, duvets) | ✅ Fully confirmed |
| Familiarisation principles | ✅ Fully confirmed |
| Post-sleep and pre-sleep routines | ✅ Fully confirmed |
| Disruption response rules (all common scenarios) | ✅ Fully confirmed |
| Sleep restriction protocol | ✅ Fully confirmed |
| Travel/jet lag protocols | ✅ Fully confirmed |
| Shift work / multishift dual-ARP model | ✅ Fully confirmed |
| Sleep stage distribution within the night | ✅ Fully confirmed |
| Deep sleep window (23:00–02:00 for ARP 06:30) | ✅ Fully confirmed |
| Illness/injury recovery mode | ✅ Fully confirmed |
| Pre-event arousal protocol | ✅ Fully confirmed |
| Coaching language and mindset reframes | ✅ Fully confirmed |
| Terminology canon (all variant forms resolved) | ✅ Fully confirmed |

### Needs Caution

The following are usable but require conservative defaults or user-visible caveats:

| Domain | Caution | Recommended Approach |
|--------|---------|---------------------|
| Exact circadian timing display | Times are OCR-approximate; Nick avoids prescribing them | Mark as approximate; enable user self-observation |
| In-betweener identification | No formal diagnostic; often a suppressed PMer | Apply PMer rules; offer chronotype refinement after 4+ weeks |
| Chronotype conflict in couples/workplaces | No formal protocol extracted | Surface each individual's data; flag mismatch; defer to coaching layer |
| Tracker data integration | Ortho-insomnia risk is real and confirmed | Frame tracker data as "guide only"; never use as a cycle count replacement |
| ARP and body temperature nadir | Mapping not confirmed | Use 06:30 as common anchor without citing the nadir |

### Not Stable Enough — Do Not Implement

| Domain | Reason |
|--------|--------|
| Scored intake questionnaire | Does not exist in R90 by design; profiling is narrative |
| Clinical sleep disorder protocols | Not in scope; escalate to clinician |
| Product selection by brand or model | Not in corpus; out of scope for app layer |
| Formal chronotype scoring instrument | Not used by Nick; do not create one that implies his authority |

---

### Is the System Ready to Move to Step 2 (R90_DATA_MODEL)?

**Yes — with one decision required.**

The core system is sufficiently defined to begin data model design. The following domains have enough depth to specify schemas, state machines, and recommendation logic:

- ARP and cycle calculation
- User profile (chronotype, schedule, environment inputs)
- Weekly cycle tracking
- User state classification
- Recommendation generation and sequencing
- Behavioural pattern detection

The one decision required before Step 2: **decide whether to model shift work (US-17) in the MVP data model or defer it to V2.** The logic is confirmed; the implementation adds complexity to the cycle calculation layer (dual-ARP). This is a product decision, not a knowledge gap.

Everything else is ready.
