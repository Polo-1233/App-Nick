# R90 Decision Engine

Operational decision logic for a sleep coaching application built on the R90 methodology.
Derived exclusively from validated knowledge in the R90 knowledge base.
No concept in this file may exceed what the processed sources confirm.

**Knowledge base version:** Batches 1–5 complete (sources DOC-001–003, DOC-006, AUD-001–008, IMG-001, PPT-001)
**Last updated:** 2026-03-11
**Author note:** Each decision references its source rule(s) by identifier. Identifiers map to `R90_DECISION_RULES.md` (DR-NNN), `R90_CORE_PRINCIPLES.md` (P-NNN), and `R90_BEHAVIOURAL_PATTERNS.md` (BP-NNN).

---

## Section 1 — Engine Purpose

### What This Engine Does

This engine translates the R90 methodology into a sequence of structured decisions that a coaching application can execute on behalf of a user. Given a set of user inputs, the engine produces:

1. A validated **ARP** (Anchor Reset Point — fixed wake time)
2. A **daily cycle plan** — sleep onset time, cycle count, CRP window, MRM schedule
3. **Contextual rules** applied to the user's chronotype and environment
4. **Risk flags** when behavioural patterns indicate compounding problems
5. **Intervention recommendations** ranked by the R90 intervention hierarchy

### What This Engine Does Not Do

- It does not prescribe specific supplements, medications, or medical interventions
- It does not override the user's biological chronotype — it works with it
- It does not guarantee specific hours of sleep — it targets complete 90-minute cycles
- It does not evaluate sleep quality based on tracker data alone (see Section 7, Risk: Ortho-Insomnia)
- It cannot make personalised cycle calculations for unusual schedules (shift work, multi-timezone travel) without additional source ingestion — see Section 8

### Design Constraint

The engine operates within the R90 framework's own epistemology:
> "We're not measuring sleep as an outcome. We're building a process." — P-034

All outputs must reinforce process adherence, not outcome anxiety.

---

## Section 2 — User Input Variables

### REQUIRED Inputs
*(Engine cannot produce a valid schedule without these)*

| Variable | Format | Purpose | Rule Reference |
|----------|--------|---------|----------------|
| `target_wake_time` | HH:MM (24h) | Candidate ARP — fixed daily wake time | DR-018, DR-023 |
| `chronotype` | `AMer` / `PMer` / `In-betweener` | All circadian windows shift per type | DR-015, P-017 |
| `typical_night_cycles` | Integer 3–6 | Baseline nocturnal cycle count to compare against 35/week target | P-036, DR-019 |
| `schedule_consistency` | `consistent` / `variable` | Determines whether ARP is already fixed or needs to be fixed | DR-018, BP-004 |

### OPTIONAL Inputs
*(Improve output precision when provided)*

| Variable | Format | Purpose | Rule Reference |
|----------|--------|---------|----------------|
| `sleep_partner` | `yes` / `no` | Triggers individual duvet recommendation and position coaching | DR-033 |
| `bedroom_temperature` | `hot` / `cool` / `variable` | Activates temperature correction rules | DR-029, BP-023 |
| `evening_light_environment` | `bright` / `amber` / `mixed` | Activates melatonin window rules | DR-028, BP-024 |
| `tracker_in_use` | `yes` / `no` | Activates ortho-insomnia risk monitoring | DR-044, BP-030 |
| `morning_light_access` | `outdoor` / `indoor` / `DWS` | Determines lux attainment method | DR-038, P-060 |
| `crp_available` | `yes` / `no` | Whether the user has midday schedule space for a CRP | DR-021, P-037 |
| `known_sleep_issue` | free text / tag | Maps to risk pattern detection (Section 7) | BP-013, BP-017, etc. |

### CONTEXTUAL Inputs
*(Computed or inferred during ongoing use; not collected upfront)*

| Variable | Derived From | Purpose |
|----------|-------------|---------|
| `weekly_cycle_balance` | Running tally of completed cycles (nocturnal + CRP) | Determines whether weekly target of 35 is on track — P-036 |
| `previous_night_cycles` | Last night's reported count | Triggers CRP recommendation for next-day compensation — DR-021 |
| `sleep_onset_latency` | User self-report (≤15 min / >15 min) | Activates 15-minute rule — DR-037 |
| `mid_night_wakings` | User self-report | Activates 2–3am rule — DR-042 |
| `stress_or_cognitive_load` | User self-report | Activates pre-sleep download rule — DR-030 |

---

## Section 3 — Core Decision Rules

Rules are written in IF / THEN / BECAUSE format.
Each rule is grounded in one or more validated knowledge-base entries.

---

### 3.1 — Anchor Reset Point (ARP)

**RULE-ARP-01**
- **IF** the user's wake time varies by more than 30 minutes across days
- **THEN** require the user to commit to a single fixed `target_wake_time` before generating any schedule
- **BECAUSE** a variable wake time destabilises the entire 16-cycle structure. The ARP is the master anchor — all scheduling flows from it. Without a fixed ARP, every downstream rule produces unreliable output. *(DR-023, DR-018)*

**RULE-ARP-02**
- **IF** the user is a PMer and their committed ARP is before 07:00
- **THEN** flag this as a Social Jet Lag risk (see Section 7, Risk: SJL-01) and proceed with the schedule as given, noting that chronotype misalignment is present
- **BECAUSE** a PMer's natural serotonin shift is 1–2 hours later than an AMer's. An ARP before 07:00 for a PMer constitutes schedule-imposed misalignment, not a biological preference. The engine does not override the ARP, but must surface the cost. *(DR-017, P-017, BP-029)*

**RULE-ARP-03**
- **IF** the user experiences a disrupted night (travel, social event, illness)
- **THEN** maintain the ARP unchanged the following morning. Do not allow sleep-in compensation.
- **BECAUSE** shifting the ARP breaks the circadian anchor and creates compounding misalignment. Short-night recovery is managed with CRP on the following day, not by shifting the ARP. *(DR-043, DR-018)*

---

### 3.2 — Sleep Onset Scheduling

**RULE-ONSET-01**
- **IF** the user's ARP is set
- **THEN** calculate sleep onset by counting backwards from ARP in 90-minute increments, targeting the number of cycles specified by `typical_night_cycles`
  - Example: ARP 06:30, target 5 cycles → sleep onset = 06:30 − (5 × 90 min) = 23:00
- **BECAUSE** the R90 technique schedules sleep by counting backwards from the fixed wake time, not forwards from a desired bedtime. Waking at the end of a cycle (light stage) is the primary quality mechanism. *(DR-011, P-027)*

**RULE-ONSET-02**
- **IF** the user misses their target sleep onset window by more than 30 minutes
- **THEN** advise them to wait for the next 90-minute cycle boundary before attempting sleep
- **BECAUSE** attempting sleep mid-cycle degrades completion probability and increases onset anxiety. "It's a bit like missing a bus — just catch the next one." *(DR-036)*

**RULE-ONSET-03**
- **IF** the user reports that sleep did not come within 15 minutes of lying down
- **THEN** instruct them to: (1) get up, (2) enter a chillout mode — dim/amber light, no screens, no demanding tasks, (3) wait for the next 90-minute cycle boundary, (4) try again
- **BECAUSE** lying awake in bed reinforces the anxiety loop. The 15-minute rule breaks the bed-equals-wakefulness association before it consolidates. *(DR-037, BP-013)*

---

### 3.3 — Cycle Count and Weekly Accounting

**RULE-CYCLES-01**
- **IF** the user completed fewer than 4 nocturnal cycles last night
- **THEN** recommend scheduling a CRP in Phase 2 (cycles 6–8, midday to early evening) the following day
- **BECAUSE** a short night is not a failure — it is an input to the weekly balance. CRP adds one cycle and removes bedtime pressure. A 4.5h night (3 cycles) with a CRP (1 cycle) = 4 cycles total, which contributes normally to the 35/week target. *(DR-021, P-037, DR-020)*

**RULE-CYCLES-02**
- **IF** the running `weekly_cycle_balance` falls below 28 cycles by end of day 5 (i.e., more than 7 cycles behind the 35-cycle target)
- **THEN** flag the deficit and recommend additional CRPs for days 6–7, while maintaining the ARP
- **BECAUSE** the R90 system manages recovery at the weekly level. Short-term deficits are recoverable within the week without shifting the ARP. Beyond 7 cycles' deficit, intervention is required to prevent systemic impairment. *(DR-020, P-036)*

**RULE-CYCLES-03**
- **IF** the user asks "how many hours of sleep do I need?"
- **THEN** reframe: the question is "how many complete 90-minute cycles?". Default target: 5 cycles (7.5h equivalent). Acceptable minimum for a single night without CRP compensation: 3 cycles (4.5h). Weekly target: 35 cycles total.
- **BECAUSE** hour-based sleep targets are the most common and counterproductive sleep belief in Nick's methodology. They create nightly anxiety and ignore cycle quality. *(BP-017, DR-019, P-028)*

---

### 3.4 — Post-Sleep Routine

**RULE-POST-01**
- **IF** the user's ARP is reached (wake time)
- **THEN** prompt them to execute the post-sleep sequence in order — without rushing:
  1. Bladder
  2. Daylight exposure (target: 10,000 Lux — outdoor preferred; DWS or light therapy device as alternative)
  3. Hydration
  4. Food
  5. Mental challenge
  6. Exercise
  7. Bowels
- **BECAUSE** the post-sleep period is more impactful than the pre-sleep routine. It activates serotonin, resets the circadian clock, and determines melatonin onset ~12 hours later. The sequence and the pace both matter. *(DR-012, DR-013, DR-038, DR-027)*

**RULE-POST-02**
- **IF** the user cannot access outdoor light in the first 90-minute post-ARP block
- **THEN** recommend a 10,000 Lux light therapy device as the primary substitute
- **BECAUSE** 10,000 Lux is the target threshold for the morning serotonin/cortisol spike. The device produces equivalent biological signal to outdoor exposure. *(DR-038, P-060)*

---

### 3.5 — Pre-Sleep Routine

**RULE-PRE-01**
- **IF** the user is in Phase 3 (evening, approaching sleep onset)
- **THEN** recommend the following as the pre-sleep window progresses:
  - Shift room lighting to amber, yellow, or red spectrum (eliminate blue/white sources) — DR-028
  - Maintain bedroom temperature slightly cooler than body temperature — DR-029
  - Do not begin new cognitively demanding work — DR-030
  - Allow unresolved thoughts to be written down or mentally resolved ("download the day") — DR-030
- **BECAUSE** the pre-sleep environment prepares the biological conditions for sleep onset. Temperature differential between body and room triggers the onset signal. Melatonin production is suppressed by blue light in this window. *(DR-028, DR-029, DR-030, BP-024)*

**RULE-PRE-02**
- **IF** the user's bedroom shows one or more of: TV present, work items present, harsh overhead lighting, no blackout provision
- **THEN** apply the mental strip rule: identify each item that serves stimulation rather than recovery; recommend addressing the highest-impact items first before purchasing any new sleep products
- **BECAUSE** a stimulating environment undermines every structural rule above it. No product or technique compensates for a bedroom that prevents the brain from associating the space with recovery. *(DR-041, BP-032, DR-026)*

---

## Section 4 — Cycle Management Logic

### 4.1 — The 16-Cycle Day Map

The full 24-hour day contains exactly 16 × 90-minute cycles. The engine allocates them across four phases:

| Phase | Circadian Anchor | Cycles | Primary Use |
|-------|-----------------|--------|-------------|
| Phase 1 | ARP → Midday | 1–4 | Activation, high-demand activity, 4 × MRMs |
| Phase 2 | Midday → Early Eve | 5–8 | Continued activity, CRP window (cycles 6–8), 4 × MRMs |
| Phase 3 | Early Eve → Sleep onset | 8–12 | Wind-down, pre-sleep preparation, 3–4 × MRMs |
| Phase 4 | Nocturnal | 12–16 | Sleep — 3 to 6 complete cycles |

*Source: DR-024, P-050, P-053*

### 4.2 — Phase 4 Sleep Window Calculation

Given `target_wake_time` (ARP) and `target_cycles` (typically 5):

```
sleep_onset = ARP − (target_cycles × 90 minutes)
```

Valid cycle counts and their equivalent onset times for an ARP of 06:30:

| Target Cycles | Sleep Onset | Equivalent Hours |
|--------------|-------------|-----------------|
| 6 cycles | 21:30 | 9.0h |
| 5 cycles | 23:00 | 7.5h ← standard target |
| 4 cycles | 00:30 | 6.0h |
| 3 cycles | 02:00 | 4.5h ← short night; CRP required |

### 4.3 — CRP Placement Rules

CRP must fall within Phase 2 (cycles 6–8):

```
crp_earliest = ARP + (5 × 90 min)   [cycle 6 start = midday for ARP 06:30]
crp_latest   = ARP + (8 × 90 min)   [cycle 8 end = early evening]
crp_duration = 30 minutes
```

For ARP 06:30: CRP window = 12:00 → 18:00. Recommended: as close to midday as schedule allows.

CRP does not require sleep. Mental disengagement (vacant mindspace) is sufficient and counts as one recovery cycle. *(P-055, DR-021, DR-005)*

### 4.4 — MRM Placement Rules

- Target: 7 MRMs per active day
- Placement: one per waking cycle (Phases 1–3)
- Duration: 3–5 minutes
- Requirement: vacant mindspace — no screens, no active cognitive processing
- Even at minimum (one MRM, 3 minutes), measurable improvement in sleep onset and deep sleep access is documented

MRMs are not optional and not aspirational — they are the baseline polyphasic rhythm applied to waking hours. *(DR-025, DR-022, P-042)*

### 4.5 — Weekly Cycle Accounting Logic

```
weekly_target = 35 cycles
daily_standard = 5 nocturnal cycles
crp_value = 1 cycle per CRP taken

weekly_balance = sum(nocturnal_cycles[day 1..7]) + sum(crp_cycles[day 1..7])
deficit = 35 − weekly_balance
```

- If `deficit` ≤ 7 at end of week: recoverable within normal operation (CRP on remaining days)
- If `deficit` > 7 by day 5: recommend additional CRP coverage + assess structural cause
- ARP is never changed as a deficit-recovery mechanism *(DR-043)*

---

## Section 5 — Chronotype Adaptation

### 5.1 — Chronotype Identification

The engine uses the user's self-reported chronotype. Formal diagnostic tool not yet available (OQ-013 open). Self-assessment markers:

| Signal | AMer | PMer | In-Betweener |
|--------|------|------|-------------|
| Natural wake time | 05:00–07:00 | 08:00–09:00+ | Variable |
| Peak alertness | Morning | Late afternoon/evening | Hard to identify |
| Energy fade | Evening | Not before 22:00+ | Stimulant-dependent |
| Caffeine reliance | Low-moderate | High | Very high |
| Population estimate | ~30% | ~70% | Growing subset |

*Source: AUD-002, DR-015, P-017, P-018*

### 5.2 — Scheduling Adjustments Per Chronotype

**AMer schedule (baseline — maps to IMG-001 infograph):**
- ARP: 05:00–07:00
- Peak cognitive window: Morning (Phases 1–2, cycles 1–5)
- Physical performance peak: Late afternoon (~17:00–18:00)
- Melatonin onset: ~21:00
- Sleep onset: ~22:30–23:00 (5 cycles back from ARP)

**PMer schedule (phase delay: +1–2 hours on all windows):**
- ARP: 07:00–09:00 (biological preference; social schedule may impose earlier)
- Peak cognitive window: Late afternoon–evening
- Physical performance peak: ~18:30–20:00
- Melatonin onset: ~22:30–23:00
- Sleep onset: ~00:30–01:00 (5 cycles back from phase-delayed ARP)

**In-betweener:**
- No fixed offset applicable — stimulant camouflage has blurred natural signals
- Start with AMer baseline; monitor reported peak performance windows; adjust gradually
- Flag stimulant dependency for BP-014 awareness (see Section 7)

*(DR-015, DR-016, DR-017, P-018, P-019, BP-014)*

### 5.3 — Chronotype-Specific Risk Rules

**RULE-CHRONO-01**
- **IF** chronotype = AMer AND user reports late exercise (after 19:00)
- **THEN** flag as melatonin-window intrusion risk; recommend shifting exercise to Phase 2
- **BECAUSE** late exercise for AMers whose melatonin onset is ~21:00 disrupts the pre-sleep temperature and hormonal cascade. *(DR-016, BP-015)*

**RULE-CHRONO-02**
- **IF** chronotype = PMer AND ARP is before 07:00 (forced by work/social schedule)
- **THEN** activate Social Jet Lag risk flag; inform user of cumulative impairment; do not attempt to shift chronotype — work with the mismatch explicitly
- **BECAUSE** PMer chronotype is genetic and cannot be eliminated. The only valid strategies are schedule alignment or acknowledged misalignment management. Stimulant compensation is explicitly identified as a compounding behaviour. *(DR-017, BP-014, BP-029)*

**RULE-CHRONO-03**
- **IF** chronotype = PMer AND important decisions or high-stakes cognitive tasks are scheduled before 10:00
- **THEN** flag the schedule mismatch; recommend protecting the afternoon window for these tasks instead
- **BECAUSE** peak cognitive performance for a PMer occurs in the late afternoon/evening. Scheduling critical work in the morning produces systematically lower output. *(DR-015, P-019)*

---

## Section 6 — Recovery Interventions

### 6.1 — Intervention Hierarchy

The R90 system applies interventions in layers, from lightest to most structural. The engine must never jump to a deeper layer without checking whether lighter layers are in place.

| Priority | Intervention | Duration | Frequency | Replaces |
|----------|-------------|----------|-----------|---------|
| 1 | MRM (Micro Reset Moment) | 3–5 min | 7/day — every waking cycle | Nothing; foundational |
| 2 | CRP (Controlled Reset Period) | 30 min | Phase 2, when needed | Does not replace MRMs |
| 3 | Nocturnal cycles (Phase 4) | 5 × 90 min | Nightly | Target; managed at week level |
| 4 | Sleep restriction (reset) | Variable | Therapeutic — structured period only | Used when cycles are fragmented |

*Source: DR-026, P-043, DR-025, DR-021*

**RULE-INTV-01 (Hierarchy Rule)**
- **IF** a user reports poor nocturnal sleep quality and has not yet established MRM and CRP practice
- **THEN** begin with MRM and CRP before addressing bedroom products, apps, trackers, or supplements
- **BECAUSE** isolated product interventions without the structural framework are "at best ineffective and at worst counterproductive." The framework must come first. *(DR-026, BP-021)*

### 6.2 — MRM Protocol

What counts as a valid MRM:
- Duration: 3–5 minutes
- Content: vacant mindspace — no active processing, no screens, no inputs
- Form: any of — eyes closed/rest, brief walk with no audio, looking out a window, gentle breathing
- Timing: at the 90-minute boundary of each waking cycle (Phases 1–3)

What does **not** count as an MRM:
- Screen scrolling
- Passive media consumption
- Caffeinated break without disengagement
- A meeting break used for emails

*(P-042, DR-025, DR-022)*

### 6.3 — CRP Protocol

Valid CRP conditions:
- Duration: 30 minutes (within a 90-minute cycle container)
- Timing: Phase 2 only — cycles 6–8 (midday to early evening); for ARP 06:30 this means 12:00–18:00
- Sleep not required — lying down with eyes closed and mental disengagement is sufficient
- Location: any comfortable reclining or lying-down position; familiarisation cues recommended where possible
- Activities that support CRP without requiring sleep: guided relaxation, quiet mindfulness, gentle music, darkness or eye mask, breathing exercises

CRP always counts as one cycle toward the weekly 35-cycle target.

**RULE-CRP-01**
- **IF** `previous_night_cycles` < 4 AND `crp_available` = yes
- **THEN** schedule a CRP for the following day's Phase 2 (midday preferred)
- **BECAUSE** CRP adds one cycle and removes the bedtime pressure that follows a short night. Without the CRP, the accumulated pressure triggers earlier bedtime attempts, onset anxiety, and compounding disruption. *(DR-021, BP-019)*

**RULE-CRP-02**
- **IF** the user is resistant to CRP due to stigma ("napping is weakness")
- **THEN** introduce the term "Controlled Reset Period" explicitly; frame it as a performance tool, not a recovery crutch; cite professional athlete use
- **BECAUSE** CRP stigma (BP-018) is identified as a primary barrier to using a legitimate recovery tool. The reframe from "nap" to "CRP" is a deliberate coaching technique. *(BP-018, DR-021)*

### 6.4 — Sleep Restriction (Therapeutic)

Activate only for persistent sleep fragmentation (not for short nights or normal variation):

**RULE-SR-01**
- **IF** the user reports consistently fragmented nocturnal sleep across 5+ consecutive nights AND normal cycle-counting and CRP have not resolved the pattern
- **THEN** recommend sleep restriction protocol: delay sleep onset by one cycle (90 minutes) for a defined period; compensate with CRP; do not shift the ARP
- **BECAUSE** sleep restriction strengthens the circadian sleep drive by consolidating cycles and increasing the biological pressure for deeper sleep. It does not work if the ARP shifts concurrently. *(DR-045)*

### 6.5 — 2–3am Waking Protocol

**RULE-WAKE-01**
- **IF** the user reports waking at 2–3am and being unable to return to sleep
- **THEN** instruct them to: (1) not panic or calculate remaining hours, (2) get up quietly, (3) stay in dim/amber light with no screens, (4) wait for the next 90-minute boundary, (5) return to bed
- **BECAUSE** 2–3am corresponds to the polyphasic transition between early and late sleep cycles — a natural heritage of pre-electric-light sleep patterns. Panic raises serotonin, preventing re-entry. Catastrophising this wakefulness is the mechanism that converts a normal event into a genuine disruption. *(DR-042, BP-031)*

---

## Section 7 — Risk Detection

The engine monitors for the following risk patterns. When detected, intervention recommendations shift from scheduling to pattern-breaking.

### RISK-001 — Sleep Anxiety Loop (BP-013)

**Trigger:** User reports lying awake worrying about sleep quality or duration on multiple consecutive nights.

**Signal:** Onset latency > 30 minutes consistently; user self-reports anxiety about sleep.

**Engine Response:**
1. Redirect focus from outcome (quality/duration) to process (schedule adherence, MRMs, CRP) — DR-014
2. Remove nightly sleep quality as a tracked metric temporarily
3. Apply 15-minute rule immediately — DR-037
4. Do not recommend a tracker if not already in use

**Risk escalation:** If pattern persists > 2 weeks, flag for professional support. The engine's structural tools address the compounding loop; they do not treat underlying anxiety disorders.

---

### RISK-002 — Ortho-Insomnia (BP-030)

**Trigger:** User reports using a sleep tracker AND increasing anxiety about tracker data AND worsening sleep over the same period.

**Signal:** Tracker data is described as "concerning," "bad," or "not enough deep sleep"; user checks tracker first thing after waking.

**Engine Response:**
1. Apply DR-044: treat tracker data as a guide, not a verdict
2. Recommend using tracker contextually — check weekly averages, not nightly scores
3. If anxiety persists with tracker in use: recommend suspending tracker use for a defined period (e.g., 2 weeks) and relying on process adherence alone
4. Flag BP-030 pattern explicitly to user — naming the mechanism breaks the loop faster than behavioural rules alone

---

### RISK-003 — Stimulant Escalation (BP-022)

**Trigger:** User reports increasing reliance on caffeine, energy drinks, or stimulant supplements to maintain daytime function; stimulant use extends past 15:00.

**Signal:** Cannot function without stimulant by mid-morning; withdrawal symptoms on rest days; stimulant timing creeping later.

**Engine Response:**
1. Flag as compensatory camouflage — masking structural recovery deficit (BP-014, BP-022)
2. Do not address stimulant use in isolation — identify the upstream structural gap (insufficient cycles, no CRP, no MRMs, wrong chronotype schedule)
3. Prioritise fixing the structural deficit; stimulant reduction will follow naturally as recovery improves
4. Note: if chronotype = PMer and ARP is forced early, stimulant use is a predictable consequence of Social Jet Lag — flag RISK-004 concurrently

---

### RISK-004 — Social Jet Lag (BP-029)

**Trigger:** User is a PMer with an ARP before 07:00 imposed by occupational or social demands; user normalises this as "just how it is."

**Signal:** Chronotype = PMer; ARP ≤ 06:30; stimulant reliance; report of never feeling "properly awake" before 10:00.

**Engine Response:**
1. Name the condition explicitly: Social Jet Lag — DR-017, BP-029
2. Work within the imposed schedule; do not attempt to shift the ARP without the user's agency
3. Protect the peak cognitive window (afternoon) for high-demand tasks — DR-015
4. Ensure CRP falls in Phase 2; morning MRMs become more critical as partial compensation
5. If schedule is negotiable: advocate for a later ARP aligned to chronotype

---

### RISK-005 — Electronic Insomnia (BP-020)

**Trigger:** User reports screens (gaming, social media, streaming) extending into Phase 3 / melatonin window (approximately 21:00 for AMers, 22:30 for PMers).

**Signal:** Sleep onset consistently delayed beyond target; user reports being "wired" at bedtime; screen use is the last activity before lying down.

**Engine Response:**
1. Apply DR-028: shift to amber/red light in Phase 3; no blue/white screens
2. Implement DR-030: no new cognitively stimulating activity in Phase 3
3. Frame as Electronic Insomnia — BP-020 — distinct from voluntary lateness; a specific modern pathology
4. Recommend a Phase 3 transition protocol: structured wind-down routine (journaling, reading physical book, gentle stretching, dim light environment) starting 90 minutes before sleep onset

---

### RISK-006 — Sleep Noise Loop (BP-028)

**Trigger:** User reports searching online for sleep solutions when under sleep pressure; reports feeling more anxious about sleep after reading about it.

**Signal:** User has tried multiple independent interventions (apps, supplements, trackers, mattresses, pillows) in sequence without structural framework — BP-021.

**Engine Response:**
1. Name Device Dipping explicitly — BP-028 — as a self-reinforcing loop
2. Redirect completely to structural framework adherence; no new product or app recommendations until ARP + MRM + CRP baseline is established
3. Apply DR-026: "Do not apply sleep interventions in isolation." The framework comes before the product.
4. Reduce information inputs: the more the user researches sleep, the worse the loop becomes

---

### RISK-007 — 8-Hour Fixation (BP-017)

**Trigger:** User expresses distress about not achieving "8 hours" on a given night; reports checking clock during the night; adjusts bedtime earlier to accumulate more hours.

**Signal:** User language centres on hours, not cycles; nightly anxiety about total duration.

**Engine Response:**
1. Replace the metric entirely: 90-minute cycles × weekly target (35), not nightly hours
2. Demonstrate equivalence: 4.5h (3 cycles, complete) > 5h (incomplete 4th cycle)
3. Redirect to weekly balance: a short night is an input, not a failure
4. Apply BP-017 reframe in coaching language

---

## Section 8 — Unknown Areas

The following decisions cannot be reliably made by the engine in its current state. Each maps to an open question in `R90_OPEN_QUESTIONS.md`.

### 8.1 — Formal Client Profiling

**Gap:** The engine currently relies on self-reported chronotype. No validated diagnostic instrument has been ingested.
**Impact:** Chronotype misclassification is possible, particularly for In-betweeners.
**Resolution requires:** PPT-002 (`Elite R90-T 7.0 Playbook Coaching Template.pptx`) — likely contains the R90 profiling tool. *(OQ-013)*

### 8.2 — Minimum Viable Nocturnal Cycles

**Gap:** The engine recommends CRP when `previous_night_cycles` < 4, but the true minimum before physiological impairment is unconfirmed.
**Impact:** May be too conservative (recommend CRP when 4 cycles is actually sufficient) or too liberal.
**Resolution requires:** DOC-007 (`28-08 PB clean content.docx`) or PPT-002. *(OQ-023)*

### 8.3 — Shift Work and Multi-Timezone Schedules

**Gap:** Processed sources assume a stable ARP and a broadly consistent social schedule. Nick's framework for long-haul travel and shift work has not been fully ingested.
**Impact:** Cannot reliably generate schedules for users with rotating shifts or frequent multi-timezone travel.
**Resolution requires:** DOC-004 (`05_sleep_travel_final.docx`) — travel specifically flagged. *(not yet tracked as OQ; recommend adding)*

### 8.4 — Partner and Family Scheduling

**Gap:** Lesson 9 (AUD-009) explicitly covers partners, children, and lifestyle adaptation. Not yet processed.
**Impact:** Cannot produce household-level recommendations; individual recommendations only.
**Resolution requires:** AUD-009 (`Session 9/Lesson 9.mp3`) — HIGH priority pending. *(OQ pending)*

### 8.5 — Health Pillar Prioritisation

**Gap:** Nick positions sleep as the "1st Health Pillar" but the engine cannot currently model explicit interactions between sleep, exercise, and nutrition scheduling.
**Impact:** Cannot adjudicate between conflicting schedule demands (e.g., early training vs. ARP).
**Resolution requires:** DOC-007, PPT-002 for formal pillar ranking. *(OQ-003)*

### 8.6 — Exact Circadian Time Windows

**Gap:** IMG-001 circadian clock times are OCR-approximate. The engine uses them as ballpark estimates.
**Impact:** Melatonin onset (~21:00), training peak (~17:00–18:00), and deep sleep window (10pm–2am) carry moderate rather than high certainty.
**Resolution requires:** Cross-reference with DOC-007 or a new primary clinical source.*(OQ-004)*

### 8.7 — KSPI 7 "Your R90 in Play"

**Gap:** No audio lesson has been identified that covers KSPI 7 (Redefining Behaviour). The engine has no operational rules for the integration phase of coaching.
**Impact:** Cannot model the full coaching arc from onboarding through sustained behaviour change.
**Resolution requires:** PPT-002 or an unprocessed AUD source covering KSPI 7. *(OQ pending)*

---

## Section 9 — Future Engine Architecture

This section describes the intended reasoning model for a production implementation. It is architecture-only — no code, no frameworks, no implementation prescriptions.

### 9.1 — Reasoning Model: Weekly Cycle Planner

The engine's primary reasoning unit is the **week**, not the night. The core loop:

```
[Start of week]
→ User confirms ARP (unchanged from previous week unless intentionally revised)
→ Engine generates standard 7-day cycle plan:
   - Phase 4 sleep onset per day (ARP − target cycles × 90 min)
   - Phase 2 CRP slot per day (optional; marked available or unavailable)
   - Phase 1–3 MRM prompts (7 per active day)
→ Daily: user reports previous night's actual cycles
→ Engine adjusts weekly balance; recommends CRP if deficit threshold crossed
→ Engine monitors for risk pattern triggers (Section 7)
→ Engine flags any anomalies (social schedule, travel, disruption)
→ [End of week]
→ Engine presents weekly cycle total vs. 35-cycle target
→ User and engine calibrate inputs for following week
```

### 9.2 — Personalisation Loop

Over time, the engine should accumulate:

1. **Chronotype confirmation data** — actual wake-time patterns and self-reported peak windows, compared against declared chronotype. Refine chronotype classification after 4 weeks.
2. **CRP effectiveness signal** — does the user's next-night cycle count improve after a CRP day? Adjust CRP recommendations accordingly.
3. **MRM adherence vs. sleep onset** — correlation between MRM completion and onset latency. Strengthen MRM prompts for users where the correlation is measurable.
4. **Risk pattern recurrence** — flag if a risk pattern (e.g., RISK-002 Ortho-Insomnia) reappears after apparent resolution.

### 9.3 — Environment Assessment Layer

Before generating product recommendations, the engine should guide users through the mental strip exercise (DR-041) as a structured questionnaire:

1. Is there a TV in the bedroom? → Stimulation item.
2. Is there work equipment in the bedroom? → Stimulation item.
3. What is the primary light source in the 2 hours before sleep? → Classify as blue/white vs amber/warm.
4. Is there blackout provision? → If yes, is a DWS also installed? → Apply DR-039 (paired intervention rule).
5. Is the room temperature actively managed? → Apply DR-029.
6. What is the mattress surface? → Apply DR-032 (hands-width gap test).

Product recommendations are generated only after this questionnaire is complete and structural rules are already in place.

### 9.4 — Coaching Language Layer

The engine's output language must consistently apply the R90 reframes:

| Avoid | Use Instead | Rationale |
|-------|------------|-----------|
| "nap" | "CRP" / "Controlled Reset Period" | BP-018 — stigma removal |
| "8 hours" | "5 cycles" / "35 cycles this week" | BP-017 — metric replacement |
| "sleep quality score" | "cycle completion and process adherence" | DR-014, RISK-002 |
| "sleep" (noun/passive) | "sleepING" (active) | P-054 — mindset reframe |
| "I'm bad at sleeping" | "your process needs structure" | DR-014 — anxiety removal |
| "you need more sleep" | "your weekly balance is 4 cycles short — CRP tomorrow" | DR-020 — actionable framing |

### 9.5 — Source Ingestion Priority for Engine Expansion

To expand the engine's decision coverage, process pending sources in this order:

| Priority | Source | Engine Gap Filled |
|----------|--------|-------------------|
| 1 | PPT-002 (`Elite R90-T 7.0 Playbook Coaching Template.pptx`) | Profiling tool, KSPI 7, minimum viable cycles |
| 2 | DOC-007 (`28-08 PB clean content.docx`) | Health pillar ranking, ARP calibration, minimum cycles |
| 3 | AUD-009 (`Session 9/Lesson 9.mp3`) | Partner/family scheduling |
| 4 | DOC-004 (`05_sleep_travel_final.docx`) | Travel and timezone rules |
| 5 | AUD-010 (`Session 10/Lesson 10.mp3`) | Unknown — likely integration/closing |
| 6 | DOC-005 (`06_sleep_nextgen_final.docx`) | Unknown — next generation framing |

---

## Engine Summary

### Decision Rules Created

| Section | Rules | Coverage |
|---------|-------|---------|
| ARP Rules | 3 | Robust — fully confirmed by multiple sources |
| Sleep Onset Rules | 3 | Robust — core R90 technique |
| Cycle Accounting | 3 | Robust — 35/week target well-validated |
| Post-Sleep Routine | 2 | Robust — sequence confirmed by DOC-002, AUD-004 |
| Pre-Sleep Routine | 2 | Robust — light and temperature rules confirmed |
| CRP Protocol | 2 | Robust — duration and placement confirmed by PPT-001 |
| Sleep Restriction | 1 | Moderate — mechanism confirmed, activation thresholds inferred |
| 2–3am Protocol | 1 | Robust — explicitly confirmed by AUD-008 |
| Chronotype Rules | 3 | Robust for AMer/PMer; in-betweener requires PPT-002 |
| Intervention Hierarchy | 1 | Robust — framework-before-product rule well-confirmed |
| Risk Detection | 7 | Moderate — patterns confirmed; recurrence thresholds inferred |

**Total decision rules:** 28 operational rules + 7 risk detection patterns

### Robust Areas (High Confidence)
- ARP as master scheduling anchor
- 90-minute cycle counting backwards from wake time
- 35-cycle weekly target and CRP as compensatory mechanism
- Post-sleep routine sequence and lux target (10,000 Lux)
- Chronotype definition and phase-delay scheduling for AMer/PMer
- 15-minute rule for sleep onset failure
- 2–3am polyphasic wakefulness protocol
- Framework-before-product intervention hierarchy
- Risk pattern identification (Ortho-Insomnia, Electronic Insomnia, Sleep Noise, SJL)

### Areas Requiring Additional Source Ingestion
- Formal client profiling and chronotype diagnostic tool (PPT-002)
- Minimum viable cycles threshold before clinical concern (DOC-007)
- Shift work and travel scheduling protocols (DOC-004)
- Partner and family scheduling (AUD-009)
- KSPI 7 integration phase (PPT-002 or unidentified source)
- Explicit health pillar ranking and interaction rules (DOC-007)
