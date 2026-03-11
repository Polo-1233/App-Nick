# R90 App Implementation Specification

**Version:** 1.0
**Date:** 2026-03-11
**Status:** Engineering-ready — authorised for implementation planning
**Depends on:** `R90_CANONICAL_SYSTEM.md` (frozen), `R90_DATA_MODEL.md` (v1.0), `R90_RULE_ENGINE_SPEC.md` (v1.0)
**Purpose:** Define how the R90 knowledge system is implemented in a real mobile application. Covers architecture, user flows, screen specifications, backend responsibilities, data flows, API design, and build order.

**Reading guide:**
- Product team: Sections 1, 3, 4, 8
- Engineering team: Sections 2, 5, 6, 7, 10
- Both: Sections 9 (risks), and the Final Report

---

## 1. IMPLEMENTATION GOAL

### What the First App Version Must Do

The first version of the R90 app must implement the complete R90 structural recovery framework for an individual user on a standard daily schedule. Specifically, it must:

1. **Onboard a user onto the R90 framework** — collect ARP, chronotype, and target cycle count; generate the full 16-cycle day plan; establish MRM rhythm.
2. **Give the user a daily operational view** — home screen showing today's plan, sleep onset target, and weekly cycle balance at a glance.
3. **Log sleep outcomes** — capture nocturnal cycle count after each night; update the weekly balance.
4. **Schedule and track CRPs** — recommend, remind, and credit Controlled Reset Periods when the weekly balance requires them.
5. **Deliver MRM reminders** — notify at each 90-minute waking cycle boundary throughout Phases 1–3.
6. **Detect user states and surface recommendations** — run the rule engine after each log event; surface the highest-priority recommendation without overwhelming the user.
7. **Guide Phase 3 wind-down** — activate the pre-sleep protocol at the Phase 3 boundary each evening.
8. **Guide post-ARP wake-up routine** — sequence the 7-step post-sleep routine each morning.
9. **Produce weekly cycle summary** — end-of-week review of cycle total, ARP consistency, and next-week framing.
10. **Apply anxiety-safe copy** — never display quality scores, fear-based statistics, or outcome comparisons; always use process language.

### Implementation Scope

| Domain | In Scope (MVP) |
|--------|---------------|
| ARP setup and maintenance | Yes |
| 16-cycle day plan generation | Yes |
| Nocturnal sleep logging (cycles) | Yes |
| CRP scheduling and credit | Yes |
| MRM reminders (notification-based) | Yes |
| Phase 3 wind-down protocol | Yes |
| Wake-up routine (post-ARP sequence) | Yes |
| Weekly cycle accounting (35-cycle target) | Yes |
| State detection (US-01 to US-14) | Yes |
| Recommendation generation (REC-01 to REC-25) | Yes (REC-19 limited — see V2) |
| Chronotype profile (AMer / PMer / In-betweener) | Yes (self-report; no formal diagnostic) |
| Environment audit (bedroom questionnaire) | Yes |
| Daily check-in (cycles + disruption signal) | Yes |
| Post-disruption recovery plan | Yes |
| Weekly recovery insights | Yes |
| Coaching copy — Nick's vocabulary and voice | Yes |

### Explicitly Out of Scope for MVP

| Feature | Reason Deferred |
|---------|-----------------|
| Shift work / multishift (US-17) | Requires two-ARP model; significant scheduling complexity; V2 |
| Pre-event high arousal protocol (US-15) | V2 feature; needs event logging layer |
| Illness / injury recovery mode (US-16) | V2 feature; needs illness flag + target suspension logic |
| Sleep restriction protocol (REC-19) | Requires coach review; not auto-triggered; V2 with manual unlock |
| Travel / jet lag protocol (REC-26) | Incomplete knowledge — DOC-004 not fully processed |
| Wearable / tracker data integration | Primary input must remain self-report; tracker creates US-09 risk; V2 with safeguards |
| Formal R90 chronotype diagnostic | No validated profiling instrument available; self-report only for MVP |
| Partner / family scheduling | No source material; V2 |
| Social features, sharing, leaderboards | Not part of R90 methodology; never |
| Sleep quality scores | Explicitly excluded — anxiety risk (R90_COACHING_OUTPUTS.md) |
| Deep sleep / REM percentage display | Same exclusion — tracker metric as headline is ruled out |

---

## 2. SYSTEM ARCHITECTURE

The R90 app is organised into five layers. Each layer has a single responsibility. No layer should bleed its concerns into another.

```
┌───────────────────────────────────────────────┐
│              MOBILE APP LAYER                 │
│  Screens, notifications, local state cache    │
├───────────────────────────────────────────────┤
│             BACKEND / API LAYER               │
│  Auth, data persistence, endpoint routing     │
├───────────────────────────────────────────────┤
│            RULE ENGINE LAYER                  │
│  Stateless evaluation; state detection;       │
│  recommendation generation                    │
├───────────────────────────────────────────────┤
│           DATA STORAGE LAYER                  │
│  User profiles, logs, weekly balance,         │
│  recommendation cooldowns                     │
├───────────────────────────────────────────────┤
│           COACHING / COPY LAYER               │
│  Recommendation text, notification copy,      │
│  screen copy — Nick's voice and vocabulary    │
└───────────────────────────────────────────────┘
```

### Mobile App Layer

**Responsibility:** Display, interaction, and local UX logic.

- Renders all screens and navigates between them.
- Manages local cache of the `home_screen_payload` and `day_plan_payload` to allow offline viewing.
- Sends all user input events (sleep log submission, CRP confirmation, check-in answers) to the backend API.
- Schedules local push notifications for MRM boundaries, Phase 3 start, CRP reminders, and wake-up activation — using times computed by the engine and stored in `ARPConfig`.
- Does not run business logic. Does not compute cycle counts, state evaluations, or recommendations.
- Surfaces the outputs of the engine — it does not make recovery decisions.

**Key responsibility distinction:** The app layer knows *what to show*; the engine layer decides *what is true*.

### Backend / API Layer

**Responsibility:** Authentication, data routing, and orchestration.

- Manages user accounts, sessions, and auth tokens.
- Receives user input events and routes them to the appropriate service (write to storage, trigger engine evaluation, return response payload).
- Calls the rule engine after every data-writing event (sleep log submitted, CRP logged, check-in submitted, profile updated).
- Returns structured payloads for each screen. The mobile app never reads raw entity data — it receives pre-assembled screen payloads.
- Manages recommendation cooldown state (per-user, per-recommendation-type timestamp log).

### Rule Engine Layer

**Responsibility:** Stateless, deterministic R90 evaluation.

- Takes an `EngineContext` object as input (see Section 5 for full specification).
- Runs pre-engine validation gates (VALIDATE-01, VALIDATE-02, VALIDATE-03).
- Runs 7-pass state detection logic to identify all active user states.
- Applies the MVP rule set (43 rules) to generate ranked recommendations.
- Applies conflict resolution (US-07 anxiety override, US-04 ARP block, US-12 framework gate).
- Applies cooldown suppression (per recommendation type).
- Returns a deduplicated, ranked recommendation list of ≤ 5 items (REC-01 and REC-20 exempt from cap).
- **Does not persist anything.** The engine reads, evaluates, and returns. All writes are the backend's responsibility.
- Can be deployed as a standalone service or embedded function. Must be callable synchronously after every data event.

### Data Storage Layer

**Responsibility:** Persist all user data reliably.

Stores the following entities (from `R90_DATA_MODEL.md`):

| Entity | Storage Role |
|--------|-------------|
| `User` | Identity and auth |
| `UserProfile` | Sleep preferences, committed ARP, chronotype, MRM/CRP flags |
| `ARPConfig` | Computed 16-cycle schedule — pre-generated and stored after any ARP change |
| `SleepLog` | One record per night: cycles_completed, onset_actual, mid_night_waking, notes |
| `DailyLog` | One record per day: crp_taken, crp_duration, mrm_count, disruption_event |
| `WeeklyCycleBalance` | Rolling 7-day: nocturnal total, CRP total, deficit, on_track flag |
| `EnvironmentContext` | Bedroom profile: temperature, light, blackout, DWS, TV, partner |
| `EventContext` | Disruption events logged by user |
| `RecommendationCooldowns` | Per user, per recommendation ID: last_triggered timestamp |
| `ActiveRecommendations` | Current session recommendation set (max 5, refreshed after each engine run) |

All writes are append-based for logs (SleepLog, DailyLog). Profile entities (UserProfile, ARPConfig, EnvironmentContext) are update-in-place.

### Coaching / Copy Layer

**Responsibility:** All user-facing language.

- Provides the text content for every screen element, notification, and recommendation card.
- Is a static content layer — strings with template variables (e.g., `{arp_time}`, `{cycles_completed}`, `{weekly_total}`).
- Must conform to the five voice principles defined in `R90_COACHING_OUTPUTS.md`: directive, process-over-outcome, calm authority, Nick's vocabulary, specificity over generality.
- Copy is not generated dynamically by an LLM — it is templated, authored, and audited in advance.
- Variable substitution (e.g., filling in the user's actual ARP time, cycle count, CRP slot) happens at the backend before the payload is sent to the app.

**Copy governance rule:** Before any copy string goes into production, it must pass the global constraints from `R90_COACHING_OUTPUTS.md`: no fear statistics, no quality scores, no good/bad binary, no population comparisons, no exclamation marks in recovery contexts, no emoji except functional ones, no word "nap".

---

## 3. MVP USER FLOW

The primary end-to-end flow for a new user from first open to first full day of using the system.

```
[1] INSTALL & LAUNCH
        │
        ▼
[2] ONBOARDING
    ├─ Collect ARP (commit time — "What time will you wake every day?")
    ├─ Collect chronotype (AMer / PMer / In-betweener / Unsure)
    ├─ Collect target_night_cycles (default: 5)
    ├─ Collect crp_availability ("Do you have a 30-min midday window?")
    ├─ Collect schedule_consistency ("Is your wake time consistent?")
    └─ Optional: known_sleep_issue, tracker_in_use
        │
        ▼
[3] ARP SETUP & CONFIRMATION
    ├─ generate_arp_config(arp_time) → 16 cycle times, phase boundaries, MRM times
    ├─ calculate sleep_onset = ARP − (target_cycles × 90 min)
    ├─ Display: "ARP set: 06:30. Sleep at 23:00 → 5 cycles."
    └─ Introduce MRM concept (REC-04 education card)
        │
        ▼
[4] FIRST DAY PLAN GENERATED
    ├─ Phase 1–4 timeline displayed with MRM slots
    ├─ Tonight's sleep onset shown
    └─ CRP slot shown if crp_availability = true
        │
        ▼
[5] FIRST NIGHT
    └─ Wind-down notification fires at Phase 3 boundary
        (sleep_onset − 90 min = approximately 21:30 for 06:30 ARP)
        │
        ▼
[6] FIRST SLEEP LOG (morning after ARP)
    ├─ "How many cycles did you complete last night?" [1–6+]
    ├─ "Did sleep come easily?" [Yes / No / > 15 min]
    ├─ Optional: "Any disruptions?" [None / Woke / Travel / Other]
    └─ submit_sleep_log() → write to SleepLog
        │
        ▼
[7] STATE DETECTION (triggered automatically)
    ├─ evaluate_user_state(engine_context)
    ├─ Input: profile + first sleep log + weekly balance (day 1)
    └─ Output: active_states[] — e.g., [US-12 (Framework Gap), US-01]
        │
        ▼
[8] RECOMMENDATION GENERATION
    ├─ generate_recommendations(active_states, context)
    ├─ Applies MVP rule set + conflict resolution + cooldowns
    └─ Output: active_recommendations[] — e.g., [REC-04 MRM, REC-02 Onset Scheduling]
        │
        ▼
[9] HOME SCREEN RENDERED
    ├─ ARP confirmation
    ├─ Tonight's sleep onset
    ├─ Weekly balance (Day 1: N / 35)
    ├─ Phase indicator (current phase based on time of day)
    └─ Primary recommendation card (highest-priority active rec)
        │
        ▼
[10] ONGOING DAILY LOOP
    ├─ MRM notifications fire at each 90-min cycle boundary
    ├─ CRP reminder fires if scheduled
    ├─ Phase 3 notification fires each evening
    ├─ Wake-up routine fires at ARP each morning
    ├─ Daily check-in captured (cycles + any disruption)
    └─ Engine re-evaluates after each log event
```

---

## 4. SCREEN-BY-SCREEN IMPLEMENTATION

### Screen 1 — Onboarding

**Purpose**
Establish the R90 structural baseline. Collect the minimum required inputs to generate a valid schedule. Block the user from the full app until ARP is committed.

**Inputs Required**
- `target_wake_time` — REQUIRED; the user's ARP commitment
- `chronotype` — REQUIRED; AMer / PMer / In-betweener / Unsure
- `target_night_cycles` — optional; default 5
- `crp_availability` — optional; does the user have a midday window?
- `schedule_consistency` — REQUIRED; used to detect US-04 at day 1
- `known_sleep_issue` — optional; initial risk state pre-screen
- `tracker_in_use` — optional; flags US-09 monitoring

**Outputs Shown**
- ARP confirmation: "ARP set: [06:30]. Your 16-cycle day starts here."
- Calculated sleep onset: "Sleep at [23:00] → 5 cycles."
- MRM introduction card (REC-04)
- Cycle count reframe card (REC-13): cycles replace hours from day 1

**Rule Engine Dependency**
- VALIDATE-01: if ARP not committed, block all other engine output
- generate_arp_config() is called immediately after ARP commitment
- Initial US-12 state is assumed for all new users

**Recommendation Dependency**
- REC-01 (ARP Commitment) — blocking gate; shown until ARP is set
- REC-20 (Framework Reset) — for returning users with lost ARP
- REC-04 (MRM Introduction) — surfaced on final onboarding screen
- REC-13 (Cycle Count Reframe) — shown once during onboarding

**Status:** MVP

---

### Screen 2 — Home Screen

**Purpose**
Daily coaching briefing at a glance. One screen that answers: "What do I need to know and do today?" Not a dashboard — a coaching output.

**Inputs Required** (read from engine output)
- Committed ARP
- Tonight's calculated sleep onset
- Weekly cycle balance (running total)
- Active user states (from last engine run)
- Highest-priority active recommendation

**Outputs Shown**
1. ARP confirmation — "Your day starts at [06:30]"
2. Tonight's sleep onset — "Sleep at [23:00] → 5 cycles"
3. Weekly cycle balance — "[22] / 35 this week"
4. Phase indicator — "Phase 2 — Cycle 6" (current position in the 16-cycle day)
5. Primary recommendation card — one card only, highest priority

**State-Adaptive Display**

| Active State | Primary Home Screen Message |
|-------------|---------------------------|
| US-01 (Aligned) | Weekly balance confirmation + today's plan |
| US-02 (Mild Deficit) | "CRP today at [13:00] — adds 1 cycle to your balance" |
| US-03 (Significant Deficit) | "7 cycles short. Let's look at the plan." |
| US-04 (ARP Instability) | "Your ARP needs to be fixed — tap to commit." |
| US-07 (Sleep Anxiety) | Process message only — NO cycle count comparison, NO quality metrics |
| US-09 (Ortho-Insomnia) | Tracker data suppressed entirely; process metrics only |
| US-06 (Post-Disruption) | "Recovery plan active: [N] CRPs this week. ARP held." |

**Rule Engine Dependency**
- get_home_screen_payload() assembles all required fields after engine run
- US-07 tone_override: if active, strip outcome metrics from display

**Recommendation Dependency**
- REC-02 (Sleep Onset) — shown nightly in tonight's target
- REC-03 (CRP) — shown as primary card when cycle deficit triggers it
- REC-14 (Weekly Balance) — shown Sunday / end of 7-day window

**Status:** MVP

---

### Screen 3 — Sleep Log

**Purpose**
Capture last night's nocturnal cycle count. Feed the weekly balance. Replace hours-based tracking from day one.

**Inputs Required**
- `cycles_completed` — REQUIRED; "How many cycles did you complete?" [1 / 2 / 3 / 4 / 5 / 6+]
- `sleep_onset_difficulty` — optional; "Did sleep come easily?" [Yes / No / >15 min]
- `disruption_event` — optional; "Any disruptions?" [None / Woke during night / Travel / Illness / Other]
- `notes` — optional; free text

**What the Log Does NOT Ask**
- "How was your sleep quality?" — anxiety-inducing; excluded
- "Rate your sleep 1–10" — classic anxiety trigger; excluded
- "What was your deep sleep %?" — do not surface tracker metrics as primary

**Outputs Shown (post-submission)**
- Updated weekly balance: "Night logged: [N] cycles. Weekly total: [X] / 35."
- If cycles < 4: CRP recommendation card for today (REC-03)
- If onset_difficulty > 15 min: 15-minute rule card (REC-15) — if flagged 3+ consecutive days
- If disruption = woke_during_night: 2–3am protocol card (REC-16) — if flagged 2+ occasions

**Rule Engine Dependency**
- submit_sleep_log() → triggers engine re-evaluation
- RULE-CYCLES-01: if cycles_yesterday < 4 → crp_recommended_today = true
- Missing log principle: if log = null, engine does NOT trigger CRP (absence ≠ bad night)

**Recommendation Dependency**
- REC-03 (CRP Scheduling) — primary post-log recommendation when cycles < 4
- REC-15 (15-Minute Rule) — triggered when onset difficulty reported 3+ consecutive nights
- REC-16 (2–3am Protocol) — triggered when mid-night waking at ~02:00–03:00 reported 2+ times

**Status:** MVP

---

### Screen 4 — Day Plan

**Purpose**
Show the user their full 16-cycle day with phase boundaries, MRM slots, CRP block (if scheduled), Phase 3 boundary, and tonight's sleep onset. The operational view of the R90 system.

**Inputs Required** (read from ARPConfig + DailyLog)
- Committed ARP (all timings derived from this)
- Chronotype (for phase boundary shifting)
- CRP scheduled flag + time (if applicable)
- Tonight's target sleep onset

**Outputs Shown**
```
Phase 1 — ARP to Midday (Cycles 1–4)
  06:30  ARP — Post-sleep routine begins
  08:00  MRM #1 — 3 minutes
  09:30  MRM #2 — 3 minutes
  11:00  MRM #3 — 3 minutes

Phase 2 — Midday to Early Evening (Cycles 5–8)
  12:30  MRM #4 — 3 minutes
  13:00  CRP [if scheduled] — 30 minutes
  14:30  MRM #5 [or post-CRP boundary]
  16:00  MRM #6 — 3 minutes

Phase 3 — Evening Preparation (Cycles 8–12)
  17:30  MRM #7 — 3 minutes
  21:00  Phase 3 begins — wind-down
  21:30  Light shift notification
  23:00  Sleep onset target

Phase 4 — Nocturnal (Cycles 12–16)
  23:00 → 06:30  5 nocturnal cycles
```

**Chronotype Adaptation**
- PMer: all boundary times shift +60–90 min; peak cognitive window marked in Phase 2 (approximately 14:00–18:00)
- In-betweener: displayed as AMer baseline for first 2–4 weeks; refined as usage data accumulates
- Phase 3 boundary is always a hard visual marker regardless of chronotype

**Rule Engine Dependency**
- get_day_plan_payload() — reads ARPConfig.cycle_times[] for all time positions
- CRP slot only shown if crp_scheduled = true from engine output

**Recommendation Dependency**
- REC-05 (MRM Reminders) — notifications fire from this plan
- REC-03 (CRP) — slot rendered if scheduled by engine
- REC-08 (Phase 3 Wind-Down) — notification fires at Phase 3 boundary
- REC-02 (Sleep Onset) — displayed at Phase 4 entry point

**Status:** MVP

---

### Screen 5 — CRP Tracker

**Purpose**
Schedule, remind, time, and credit Controlled Reset Periods. Manage the CRP as a formal recovery cycle in the weekly tally. Remove the "nap" label entirely.

**Inputs Required**
- Phase 2 availability (from UserProfile)
- CRP recommended flag (from engine)
- User-confirmed CRP time (within Phase 2 window: approximately Cycle 5–8)

**Outputs Shown**
- CRP scheduled time: "CRP at 13:00 — 30 minutes"
- Active timer during CRP
- Guidance copy during CRP: "Lie down. Eyes closed. You don't need to sleep — just disconnect."
- Post-CRP confirmation: "CRP complete. +1 cycle. Weekly balance: [N]/35."
- Week view: "[N] nocturnal cycles + [M] CRP cycles = [N+M] / 35"

**CRP Credit Logic** (from Rule Engine Spec)
- Duration ≥ 20 min → +1 cycle credit
- Duration 1–19 min → 0 credit (counts as MRM equivalent; log it but do not credit)
- Not taken → 0 credit; offer reschedule for next Phase 2 slot

**Rule Engine Dependency**
- RULE-CRP-01: CRP triggers when previous_night_cycles < 4 AND crp_available = true
- CRP window: ARPConfig.crp_window_open (ARP + 7.5h) to ARPConfig.crp_window_close (ARP + 12h)
- CRP cooldown: 24h between CRP recommendations

**Recommendation Dependency**
- REC-03 (CRP Scheduling) — drives this screen
- REC-13 (Cycle Count Reframe) — if user declines CRP due to stigma, surface reframe

**Status:** MVP

---

### Screen 6 — MRM Reminders

**Purpose**
Deliver brief, non-intrusive notifications at each 90-minute waking cycle boundary. Maintain the micro-recovery rhythm that underpins the polyphasic architecture.

**Inputs Required** (configured from ARPConfig)
- `mrm_times[]` — array of notification times derived from ARP + (n × 90 min) for n = 2..8
- User can snooze by one cycle; cannot permanently dismiss

**Outputs Shown** (notification only — no dedicated screen)
- Notification copy: "Micro Reset. 3 minutes. Nothing required."
- Optional in-app prompt if tapped: examples of valid MRM activities

**User Control**
- Snooze: defers by one cycle (90 min) — one snooze allowed per MRM
- Log MRM: "taken" or "missed" — feeds adherence tracking in Recovery Insights
- Do NOT implement a streak counter — creates anxiety if missed

**Rule Engine Dependency**
- MRM times computed in ARPConfig.mrm_times[] — used directly for notification scheduling
- MRM fires every 90-min boundary, Cycles 2–8; CRP slot replaces (not adds to) the MRM at that position

**Recommendation Dependency**
- REC-04 (MRM Introduction) — education content shown on first MRM notification
- REC-05 (MRM Daily Reminders) — ongoing notification content

**Status:** MVP

---

### Screen 7 — Wake-Up Routine

**Purpose**
Activate the post-sleep sequence immediately after the user's ARP. Guide the 7-step routine in the first 90-minute block.

**Inputs Required**
- ARP (timing trigger)
- `morning_light_access` (outdoor / DWS / indoor-only — from EnvironmentContext)
- `dws_installed` (for paired blackout + DWS rule)

**Outputs Shown**
Progressive checklist — each step reveals the next. No time pressure.

```
→ Bladder
→ Light — 10,000 Lux (outside / device / window seat)
→ Hydrate
→ Eat
→ Mental challenge
→ Move
→ Done
```

**Light Step Intelligence**
```
IF morning_light_access = outdoor    → "Step outside. 10 minutes minimum."
IF morning_light_access = DWS        → "DWS has started. Supplement with outdoor time."
IF morning_light_access = indoor     → "Light therapy device, 20–30 min. Window seat if no device."
```

**Rule Engine Dependency**
- Triggered at ARP time — backend sends the payload; app renders the sequence
- Not engine-evaluated on each step; the sequence is fixed (derived from RULE-POST-01)

**Recommendation Dependency**
- REC-06 (Post-Sleep Routine Reinforcement) — drives this screen
- REC-07 (Morning Light Activation) — Step 2 intelligence

**Status:** MVP

---

### Screen 8 — Wind-Down (Phase 3)

**Purpose**
Activate the Phase 3 transition protocol approximately 90–120 minutes before sleep onset. Guide light, temperature, and mental preparation. This is not a last-minute bedtime routine.

**Inputs Required**
- `target_sleep_onset` (to calculate Phase 3 start: sleep_onset − 90 min)
- `evening_light_environment` (from EnvironmentContext — for personalised light prompt)
- `bedroom_temperature` (from EnvironmentContext — for personalised temperature prompt)

**Outputs Shown** (time-sequenced notifications, expanding to screen on tap)

| Time Before Sleep | Prompt |
|------------------|--------|
| Sleep − 90 min | "Phase 3. Wind-down starts now. Shift your lights." |
| Sleep − 75 min | "No new demanding work after this point. Write down what's unresolved." |
| Sleep − 60 min | "Bedroom: cooler than your body. Adjust if needed." |
| Sleep − 45 min | Activities suggestion: physical book / light stretching / quiet music |
| Sleep − 15 min | "Your sleep window is [23:00]. Lie down when it arrives." |
| Sleep onset | "Sleep window now. Lie down." |

**What This Screen Does NOT Do**
- Does not play guided sleep meditations as primary content
- Does not show tomorrow's schedule at Phase 3 time
- Does not display performance data or weekly metrics at this hour

**Rule Engine Dependency**
- Phase 3 boundary computed from ARPConfig: Phase 3 start = ARP + (8 × 90 min) = ARP + 12h (approximately)
- Actual trigger = target_sleep_onset − 90 min (more precise)

**Recommendation Dependency**
- REC-08 (Phase 3 Wind-Down) — primary driver
- REC-09 (Evening Light Correction) — personalised if evening_light_environment = bright_blue
- REC-10 (Temperature Correction) — surfaced if bedroom_temperature = hot

**Status:** MVP

---

### Screen 9 — Recovery Insights

**Purpose**
Weekly summary and trend view. The reflective layer — one review per week, not a nightly dashboard.

**Inputs Required** (from WeeklyCycleBalance + aggregated logs)
- `weekly_cycle_total` (nocturnal + CRP)
- `cycle_deficit` (35 − total)
- `arp_consistency` (days held vs shifted — binary per day)
- `crp_cycles_this_week`
- `active_states_this_week` (from daily check-in + log data)

**Outputs Shown**
1. Weekly cycle total: "[33] / 35 cycles this week"
2. Breakdown by day: bar chart — each bar = nocturnal cycles + CRP cycles
3. CRP cycles taken: "[2] CRPs this week = +2 cycles"
4. ARP consistency: "[7] / 7 days held" (binary — no partial credit)
5. State summary: which states were flagged this week (process framing — no clinical labels)
6. Next week framing: ARP confirmed + CRP plan if deficit

**What This Screen Does NOT Show**
- Sleep quality scores
- Deep sleep percentages
- Nightly tracker metrics as headlines
- Population comparisons ("most people sleep…")
- Shame language about short nights

**Copy (by weekly total):**
- 33–35+: "Strong week. The plan is working — maintain it."
- 28–32: "Solid week. [N] short nights — CRP kept you balanced. Watch the [day] pattern."
- < 28: "Tough week. [N] cycles short. Let's identify the driver and protect CRP slots next week."

**Rule Engine Dependency**
- calculate_weekly_balance() runs on day 7 of the rolling window
- deficit_risk_flag triggers if cycle_deficit > 7 AND day_number ≥ 5

**Recommendation Dependency**
- REC-14 (Weekly Balance Review) — drives this screen each Sunday / day 7
- REC-22 (Post-Disruption Rebalancing) — if disruption week identified
- REC-12 (Chronotype Schedule Adjustment) — surfaced after 4+ weeks of data

**Status:** MVP

---

### Screen 10 — Daily Check-In

**Purpose**
Capture the minimum daily signal needed for state detection. Frictionless — maximum 3 questions. Feeds weekly balance and risk monitoring.

**Inputs Required**
- `cycles_completed_last_night` — REQUIRED; [1 / 2 / 3 / 4 / 5 / 6+]
- `sleep_onset_latency_flag` — optional; "Did sleep come easily?" [Yes / No / >15 min]
- `disruption_event` — optional; [None / Woke during night / Travel / Illness / Other]

**Weekly add-ons (once per week, not daily)**
- `stimulant_use_trend` — [Same / More / Less] — US-10 monitoring
- `tracker_use_pattern` — [Weekly / Nightly / Not using] — US-09 monitoring

**What the Check-In Does NOT Ask**
- "How do you feel?" — too subjective; anxiety-prone
- "Rate your sleep quality 1–10" — classic anxiety trigger
- Multiple questions every single day — friction kills retention

**Outputs Shown (post-submission)**
- Cycle confirmation: "Logged: [4] cycles. Weekly balance: [22] / 35."
- Primary recommendation card if state triggered
- If onset_difficulty flagged 3+ days → US-07 flag → redirect to REC-15 (15-min rule)

**State Detection Shortcuts (fast path)**
```
IF cycles_last_night < 4
  → RULE-CYCLES-01: crp_today = true → surface REC-03

IF onset_latency_flag > 15min, 3+ consecutive days
  → Activate US-07 → surface REC-15, apply tone_override

IF disruption = woke_during_night, 2+ occasions
  → Surface REC-16 (2–3am protocol)
```

**Rule Engine Dependency**
- submit_daily_log() triggers engine re-evaluation
- This screen is the primary daily engine trigger

**Recommendation Dependency**
- REC-03 (CRP) — most common daily check-in output
- REC-15 (15-Minute Rule) — when onset difficulty pattern detected
- REC-16 (2–3am Protocol) — when mid-night waking pattern detected

**Status:** MVP

---

## 5. BACKEND / ENGINE RESPONSIBILITIES

### What the Rule Engine Computes

The engine is stateless. It computes everything fresh from the `EngineContext` input. It does not read from the database directly — it receives a fully assembled context object.

```
EngineContext {
  user_profile:       UserProfile
  arp_config:         ARPConfig
  sleep_logs:         SleepLog[]   // last 7–14 days
  daily_logs:         DailyLog[]   // last 7 days
  weekly_balance:     WeeklyCycleBalance
  event_context:      EventContext | null
  environment_context: EnvironmentContext | null
  recommendation_cooldowns: Map<rec_id, last_triggered_timestamp>
  current_time:       ISO timestamp
  day_number:         int  // days since ARP commitment
}
```

**What the engine computes:**

| Computation | Rule |
|------------|------|
| Active user states (US-01..US-14) | 7-pass state detection |
| CRP recommendation + time | RULE-CYCLES-01 |
| Cycle deficit flag | RULE-CYCLES-02 |
| Weekly balance on-track flag | deficit = 35 − (Σnocturnal + Σcrp) |
| Sleep onset options (tonight) | sleep_onset = ARP − (N × 90 min) |
| US-07 tone_override flag | RULE-ONSET-03 pattern: 3+ onset difficulty days |
| Recommendation priority ranking | Priority 1–5 + anxiety suppression |
| Cooldown suppression | Per-recommendation timestamps |
| Conflict resolution | US-07 + US-03 simultaneous handling |
| Ranked recommendation list (≤ 5) | Deduplicated, capped, anxiety-safe |

### What the Backend Stores and Pre-Computes

**ARPConfig generation (one-time, triggered after ARP change):**
```
generate_arp_config(arp_time):
  for n in 1..16:
    cycle_times[n] = ARP + (n − 1) × 90 min
  phase_1_start = cycle_times[1]    // ARP
  phase_2_start = cycle_times[5]    // ARP + 6h
  phase_3_start = cycle_times[9]    // ARP + 12h
  phase_4_start = cycle_times[13]   // ARP + 18h
  crp_window_open  = ARP + 7.5h     // C6
  crp_window_close = ARP + 12h      // C9
  sleep_onset_5cycle = ARP − 7.5h
  sleep_onset_4cycle = ARP − 6h
  mrm_times = cycle_times[2..8]
```
`ARPConfig` is written to storage immediately and used by both the engine and the app layer.

**Weekly accounting (computed daily, stored in WeeklyCycleBalance):**
```
On each new day (midnight or at ARP):
  total_nocturnal = sum(sleep_logs[1..7].cycles_completed)
  total_crp       = sum(daily_logs[1..7].crp_cycle_credited)
  weekly_total    = total_nocturnal + total_crp
  cycle_deficit   = 35 − weekly_total
  remaining_days  = 7 − day_number (within rolling window)
  projected_total = weekly_total + (remaining_days × 5)
  on_track        = projected_total >= 28
  deficit_risk    = (cycle_deficit > 7) AND (day_number >= 5)
```

### What Is Handled in the UI Layer

The mobile app handles:
- Notification scheduling from pre-computed `mrm_times[]` array (stored in ARPConfig)
- Rendering state-adaptive home screen elements from `home_screen_payload` response
- Local cache of last-rendered `day_plan_payload` for offline display
- CRP countdown timer (local; duration sent to backend on completion)
- Progressive checklist rendering for wake-up routine (sequence is fixed; no engine dependency per step)
- All copy substitution happens at backend before payload delivery — app only renders strings

---

## 6. DATA WRITE / READ FLOWS

### When a User Logs a Night (Sleep Log Submission)

```
1. User submits: cycles_completed, onset_latency_flag, disruption_event (optional)
2. WRITE:  SleepLog { date, cycles_completed, sleep_onset_actual, mid_night_waking, disruption_event }
3. COMPUTE: crp_cycle_credited = (crp_duration >= 20 ? 1 : 0)
4. UPDATE:  WeeklyCycleBalance.total_nocturnal += cycles_completed
5. COMPUTE: cycle_deficit = 35 − (total_nocturnal + total_crp)
6. UPDATE:  WeeklyCycleBalance with new totals
7. TRIGGER: evaluate_user_state(engine_context)
8. TRIGGER: generate_recommendations(active_states, context)
9. UPDATE:  ActiveRecommendations[] (max 5)
10. RETURN: updated home_screen_payload with recommendation card
```

**Missing log rule:** If a user does not submit a log, `cycles_completed` = null. The engine treats null ≠ 0. No CRP recommendation is fired for a missing log. Absence of a log does not constitute evidence of a problem.

### What Gets Recomputed Daily (Daily Recalculation)

Triggered at ARP time each morning (or first app open after ARP if offline):

```
1. Advance day_number by 1
2. Recompute WeeklyCycleBalance rolling totals
3. Recalculate sleep_onset targets for tonight (in case CRP or deficit has changed)
4. Re-evaluate user states if 7+ days have elapsed in current window
5. Refresh notification schedule from ARPConfig.mrm_times[]
6. Push updated day_plan_payload to app cache
```

Weekly reset (rolling 7-day window, on day 7):
```
1. Archive current WeeklyCycleBalance as historical record
2. Start new 7-day window (day_number = 1)
3. Generate weekly review payload (Recovery Insights screen)
4. Re-evaluate CRP plan for new week based on prior week deficit trend
```

### What Gets Read to Render the Home Screen

`get_home_screen_payload()` reads:

```
FROM UserProfile:       arp, chronotype, target_cycles, mrm_established, crp_available
FROM ARPConfig:         tonight_sleep_onset, current_phase, current_cycle_position
FROM WeeklyCycleBalance: weekly_total, cycle_deficit, on_track, day_number
FROM SleepLog (yesterday): cycles_completed (for CRP trigger check)
FROM ActiveRecommendations: top-ranked recommendation (for primary card)
FROM UserProfile:       active_states[] (cached from last engine run)
```

Returns `HomeScreenPayload`:
```json
{
  "arp": "06:30",
  "tonight_sleep_onset": "23:00",
  "tonight_target_cycles": 5,
  "weekly_total": 22,
  "weekly_target": 35,
  "current_phase": 2,
  "current_cycle": 6,
  "primary_recommendation": { "id": "REC-03", "message": "CRP at 13:00..." },
  "tone_override_active": false,
  "show_cycle_metrics": true
}
```

If `tone_override_active = true` (US-07 active):
- `weekly_total` is suppressed from display
- `show_cycle_metrics = false`
- `primary_recommendation` is restricted to process-only messages (REC-13, REC-15, REC-08)

### What Updates the Weekly Cycle Balance

| Event | Balance Update |
|-------|---------------|
| Sleep log submitted | `total_nocturnal += cycles_completed` |
| CRP completed (≥ 20 min) | `total_crp += 1` |
| CRP completed (< 20 min) | No change (MRM equivalent) |
| CRP not taken | No change; reschedule offered |
| Log not submitted | No change (null ≠ 0) |
| Illness mode active (V2) | Normal accounting suspended |
| Weekly window reset (day 7) | Archive + reset totals to 0 |

---

## 7. MVP API / FUNCTIONAL INTERFACES

The following functions define the core engine operations. They may be implemented as REST endpoints, RPC calls, or internal service methods depending on the backend architecture. Each is triggered by a specific user event.

---

### `create_user_profile`

**Purpose:** Initialise a new user record and set onboarding defaults.

**Input:**
```
{
  user_id:              string (auth-provided)
  target_wake_time:     "HH:MM"
  chronotype:           "AMer" | "PMer" | "In-betweener" | "Unsure"
  target_night_cycles:  int (default: 5)
  crp_available:        bool (default: false)
  schedule_consistency: "consistent" | "inconsistent"
  known_sleep_issue:    string | null
  tracker_in_use:       bool (default: false)
}
```

**Output:**
```
{
  user_profile_id:   string
  arp:               "HH:MM"
  onboarding_complete: bool
  initial_state:     ["US-12"]   // all new users start in Framework Gap
}
```

**Side effects:** Triggers `generate_arp_config()` immediately after profile creation.

---

### `generate_arp_config`

**Purpose:** Compute and store the full 16-cycle schedule from a committed ARP time. Called whenever ARP is set or changed.

**Input:**
```
{
  user_id:   string
  arp_time:  "HH:MM"
}
```

**Output:**
```
{
  arp:                  "06:30"
  cycle_times:          ["06:30", "08:00", "09:30", ...] // 16 entries
  phase_boundaries:     { phase_1: "06:30", phase_2: "12:30", phase_3: "18:30", phase_4: "00:30" }
  crp_window_open:      "14:00"
  crp_window_close:     "18:30"
  sleep_onset_5cycle:   "23:00"
  sleep_onset_4cycle:   "00:30"
  mrm_times:            ["08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "17:00"]
}
```

**Side effects:** Stored in ARPConfig; notification schedule updated in app layer.

---

### `submit_sleep_log`

**Purpose:** Log the previous night's sleep outcome. Trigger state detection and recommendation update.

**Input:**
```
{
  user_id:              string
  date:                 "YYYY-MM-DD"  // date of night (not morning)
  cycles_completed:     int (1–6; null if unknown)
  sleep_onset_actual:   "HH:MM" | null
  mid_night_waking:     bool
  mid_night_waking_time: "HH:MM" | null
  onset_latency_flag:   "easy" | "difficult" | "over_15_min" | null
  disruption_event:     "none" | "woke" | "travel" | "illness" | "other" | null
  notes:                string | null
}
```

**Output:**
```
{
  log_id:               string
  cycles_credited:      int
  weekly_total_updated: int
  cycle_deficit:        int
  engine_triggered:     bool
  active_recommendations: Recommendation[]
}
```

**Side effects:** Writes SleepLog, updates WeeklyCycleBalance, triggers `evaluate_user_state()`, updates ActiveRecommendations.

---

### `submit_daily_log`

**Purpose:** Log CRP completion, MRM count, and any events. Update weekly balance and trigger state re-evaluation.

**Input:**
```
{
  user_id:           string
  date:              "YYYY-MM-DD"
  crp_taken:         bool
  crp_duration_min:  int | null
  mrm_count:         int (0–7)
  disruption_event:  "none" | "travel" | "illness" | "pre_event" | "other" | null
}
```

**Output:**
```
{
  log_id:              string
  crp_cycle_credited:  int (0 or 1)
  weekly_total_updated: int
  active_recommendations: Recommendation[]
}
```

**Side effects:** Writes DailyLog, updates WeeklyCycleBalance.crp_total if crp_duration ≥ 20 min, triggers state re-evaluation.

---

### `evaluate_user_state`

**Purpose:** Run the full rule engine state detection pass. Returns the current set of active user states.

**Input:**
```
{
  engine_context: EngineContext  // fully assembled by backend before call
}
```

**Output:**
```
{
  active_states: [
    { id: "US-02", name: "Mild Cycle Deficit", priority: 3 },
    { id: "US-07", name: "Sleep Anxiety Loop", priority: 1 }
  ],
  tone_override_active: bool,   // true if US-07 active
  gate_blocked:         bool,   // true if VALIDATE-01 fires (no ARP)
  gate_reason:          "no_arp" | "new_user_no_data" | "illness_mode" | null
}
```

**Note:** This function is called internally by the backend after every log submission. It is not called directly by the mobile app.

---

### `generate_recommendations`

**Purpose:** Run the recommendation generation pass. Returns a ranked, deduplicated, cooldown-filtered recommendation list.

**Input:**
```
{
  active_states:           UserState[]
  engine_context:          EngineContext
  recommendation_cooldowns: Map<rec_id, timestamp>
  tone_override_active:    bool
}
```

**Output:**
```
{
  recommendations: [
    {
      id:       "REC-03",
      priority: "HIGH",
      title:    "CRP today at 13:00",
      message:  "Last night: 3 cycles. Today's plan includes a CRP at 13:00...",
      crp_time: "13:00"   // structured data for UI rendering
    },
    ...
  ],
  total_count:      int (1–5; REC-01 and REC-20 not capped),
  suppressed_recs:  ["REC-19"],   // suppressed by anxiety override or cooldown
}
```

---

### `get_home_screen_payload`

**Purpose:** Assemble all data required to render the home screen in a single call. The app never reads raw entities.

**Input:**
```
{
  user_id:      string
  current_time: ISO timestamp
}
```

**Output:** `HomeScreenPayload` (see Section 6 for full schema)

**Called by:** App on every launch and foreground return. May be cached for up to 30 minutes.

---

### `get_day_plan_payload`

**Purpose:** Assemble the full 16-cycle day plan with all MRM/CRP slots and phase markers.

**Input:**
```
{
  user_id: string
  date:    "YYYY-MM-DD"
}
```

**Output:**
```
{
  date:       "2026-03-11",
  arp:        "06:30",
  phases: [
    {
      phase_number: 1,
      label: "Phase 1 — ARP to Midday",
      cycles: [
        { n: 1, time: "06:30", type: "ARP", label: "Post-sleep routine" },
        { n: 2, time: "08:00", type: "MRM", label: "Micro Reset — 3 min" },
        ...
      ]
    },
    ...
  ],
  crp_scheduled: { scheduled: true, time: "13:00", duration_min: 30 },
  sleep_onset:   { recommended: "23:00", fallback: "00:30", cycles: 5 }
}
```

**Called by:** App on each day view load. Cached locally for offline display.

---

## 8. IMPLEMENTATION PRIORITY

### Phase A — Must-Have MVP

These items must exist for the first user to complete their first full day. No launch without them.

| Item | Type | Depends On |
|------|------|-----------|
| User auth + account creation | Backend | — |
| `create_user_profile` | Backend | Auth |
| `generate_arp_config` | Engine | Profile |
| Onboarding flow (F-01) | App | ARP config |
| `get_day_plan_payload` | Backend | ARP config |
| Day Plan screen (F-03) | App | Day plan API |
| `submit_sleep_log` | Backend | Profile |
| Sleep Log screen (F-04) | App | Sleep log API |
| `evaluate_user_state` (core MVP states) | Engine | Sleep log |
| `generate_recommendations` (REC-01–05, 13) | Engine | States |
| `get_home_screen_payload` | Backend | States + recs |
| Home Screen (F-02) | App | Home payload |
| MRM notification scheduling | App | ARP config |
| MRM reminder content (F-06) | App | Notifications |
| Weekly cycle balance calculation | Backend | Sleep logs |
| Daily Check-In (F-12) | App + Backend | Sleep log |
| Coaching copy layer — all Phase A screens | Copy | — |

### Phase B — Strong MVP Enhancements

These items significantly improve the product but can launch after Phase A is stable.

| Item | Type | Notes |
|------|------|-------|
| Wake-Up Routine screen (F-08) | App | REC-06, REC-07 |
| Wind-Down / Phase 3 screen (F-07) | App | REC-08, REC-09 |
| CRP Tracker screen (F-05) | App | Full CRP flow with timer |
| US-07 tone override (anxiety suppression) | Engine | High-priority safety |
| US-09 tracker suppression | Engine | Safety for tracker users |
| Environment Audit screen (F-11) | App | REC-11 |
| Chronotype Profile screen (F-10) | App | REC-12, REC-21 |
| Recovery Insights screen (F-09) | App | Weekly balance view |
| Post-Disruption Protocol (F-13) | App + Backend | REC-22 |
| Full 14 user states active in engine | Engine | US-08 to US-14 |
| Recommendation cooldown logic | Backend | All recs |
| `submit_daily_log` with CRP credit | Backend | WeeklyCycleBalance |
| Weekly balance review (REC-14) | Engine + App | Day 7 trigger |
| 2–3am protocol (REC-16) | Engine + Copy | Mid-night waking |
| 15-minute rule (REC-15) | Engine + Copy | Onset anxiety |

### Phase C — V2 Features

| Item | Notes |
|------|-------|
| US-15 Pre-Event High Arousal | Event logging layer required |
| US-16 Illness / Injury Recovery Mode | Target suspension logic |
| US-17 Shift Work / Multishift | Two-ARP model; significant complexity |
| Sleep Restriction Protocol (REC-19) | Manual unlock only; coach review required |
| Wearable / tracker integration | Background signal only; safeguards required |
| Travel / jet lag protocol (REC-26) | Knowledge gap: DOC-004 not fully processed |
| Partner / family scheduling | No source material |
| Formal chronotype diagnostic | Requires PPT-002 processing |
| Chronotype confidence refinement | Needs 4+ weeks of data + source |
| KSPI integration layer | 7th KSPI — no source processed |
| Historical trend analytics | Needs minimum 4 weeks of data |

---

## 9. RISKS AND EDGE CASES

### Risk 1 — Missing Sleep Logs (Most Common)

**Risk:** Users skip the sleep log. The engine has no cycle data. Without a guard, this could falsely trigger CRP recommendations or deficit states.

**Mitigation:** Enforce the "null ≠ 0" principle throughout. `cycles_completed = null` is treated as unknown, not as zero. VALIDATE-02 fires if day_number ≤ 7 and no logs exist — engine returns conservative defaults only (REC-04, REC-02), never deficit alerts.

**Implementation note:** Missing logs for 3+ consecutive days should prompt a gentle re-engagement message ("Your plan is ready when you are — log last night's cycles to keep your balance accurate") — never an alarm.

---

### Risk 2 — Self-Reported Cycle Count Accuracy

**Risk:** Users report cycles inaccurately. They may report 5 cycles when they actually slept 3.5 cycles (incomplete final cycle). Over time, this inflates the weekly balance and masks deficit states.

**Mitigation:**
1. Onboarding education on what a "complete cycle" means (REC-13 cycle reframe).
2. Provide clear reference: "A complete cycle = falling asleep through to the next 90-minute boundary. If you woke before it was complete, don't count it."
3. Accept self-report as the primary signal — do not attempt algorithmic correction without tracker data.
4. If tracker integration is enabled (V2), use tracker data to surface discrepancies privately (not as a correction, but as a prompt to review).

---

### Risk 3 — Anxiety-Triggering Copy

**Risk:** Any piece of app copy that references outcomes, scores, statistics, or comparisons could trigger or worsen US-07 (Sleep Anxiety Loop).

**Mitigation:**
1. All copy passes the 8 global constraints from `R90_COACHING_OUTPUTS.md` before shipping.
2. US-07 tone_override is a backend flag — when active, it strips outcome metrics from `home_screen_payload`. The app never makes this decision.
3. Maintain an explicit copy review gate before each release: check all notification text, all recommendation cards, all empty-state messages.
4. Special attention to: first-launch copy (before any data exists), post-short-night copy (no "you only slept X cycles" framing), and weekly review copy for < 28 cycle weeks.

---

### Risk 4 — Chronotype Ambiguity (In-Betweener)

**Risk:** A user who selects "In-betweener" or "Unsure" gets an ARP and schedule that may be significantly misaligned with their biology. An unmasked PMer running on an AMer schedule without acknowledgement of Social Jet Lag will see poor adherence and may churn.

**Mitigation:**
1. For "In-betweener" or "Unsure": start with AMer baseline (as specified in US-14 protocol).
2. Surface a calibration prompt after 2 weeks: "After two weeks, do you feel consistently sharper in the morning or the afternoon?"
3. After 4 weeks of data: if check-in data shows persistent morning difficulty + strong afternoon performance → surface REC-21 (Social Jet Lag) as a hypothesis.
4. Never force a chronotype reclassification — surface it as a question, not a correction.

---

### Risk 5 — Shift Work Scope Creep

**Risk:** Shift workers will attempt to use the MVP. The standard 16-cycle plan from a single ARP does not work for rotating shift patterns. If a night-shift worker sets their ARP as 06:00 (the standard), the CRP and wind-down times will be completely wrong for their life.

**Mitigation:**
1. Add a "shift work?" question in onboarding.
2. If yes: display a clear message: "Shift work support is coming in Version 2. For now, we recommend using your most consistent wake time as your ARP. Your plan will not be fully optimised for shift patterns yet."
3. Do not attempt to approximate a two-ARP model in V1. A partial implementation is worse than a clear scope boundary.
4. Log the signal (user flagged as shift worker) so the V2 onboarding can branch correctly.

---

### Risk 6 — Wrong Self-Reported Chronotype

**Risk:** Users self-identify as AMer when they are masked PMers (driven by job schedule or stimulant use). This is the most common chronotype error. Stimulants mask the signal.

**Mitigation:**
1. Add a qualifying prompt during onboarding: "On a day where you have no alarm and no stimulants — what time do you naturally wake up?"
2. If answer > 08:30: flag likely PMer; surface explanation before confirming chronotype.
3. Accept user's final choice without override, but create a revisit point at 4 weeks.
4. For stimulant users (US-10): note that chronotype classification should be revisited once structural adherence improves.

---

### Risk 7 — CRP Stigma Leading to Abandonment

**Risk:** Users who have never taken a CRP feel resistant to the concept. If the app first surfaces CRP as a recommendation after a short night, without prior education, the word "rest" or the concept of lying down in the day may feel uncomfortable or impractical.

**Mitigation:**
1. Introduce CRP during onboarding (not just when deficit occurs) — framed as a normal part of the plan, not a remedial intervention.
2. Use Nick's exact framing: "Every elite athlete using this programme has a CRP. This is not a nap."
3. If the user declines a CRP, do not re-recommend immediately. Surface REC-13 (cycle reframe) first.
4. Provide a stigma reframe card once — not every time the user declines.

---

### Risk 8 — Day 1 Frustration (No Data, No State)

**Risk:** On day 1, the engine has no logs to evaluate. VALIDATE-02 fires: new user, no log data. The app cannot generate meaningful state-based recommendations. If the home screen is empty or generic, the user disengages immediately.

**Mitigation:**
1. On day 1 (and for first 7 days before sufficient data): default to US-12 (Framework Gap) — this is correct for all new users.
2. Surface a Day 1 plan immediately from ARP config alone — the day plan does not require historical logs.
3. Primary Day 1 recommendation: MRM introduction (REC-04). Secondary: sleep onset timing (REC-02). Both are derivable from ARP alone.
4. Log a "virtual" week 1 with zero cycles — the engine knows it is early and suppresses deficit warnings in the first 7 days (VALIDATE-02).

---

### Risk 9 — Notification Fatigue (MRM + Wind-Down + Check-In)

**Risk:** At full cadence, the app sends 7 MRM notifications + 1 Phase 3 notification + 1 check-in prompt per day = up to 9 daily notifications. This volume risks disengagement and notification permission loss.

**Mitigation:**
1. Phase the notification introduction: MRMs should be introduced gradually (start with 3/day in week 1, full cadence by week 3).
2. Allow MRM notifications to be snoozed (one cycle) but not permanently dismissed — surface the "why it matters" message if the user attempts to turn them off.
3. Phase 3 and wake-up notifications are separate toggles from MRM reminders.
4. Daily check-in: send as a single notification at a user-preferred time, not triggered by a cycle boundary.

---

## 10. FINAL MVP BUILD ORDER

The recommended engineering sequence from first commit to launch-ready build. Each milestone produces a working, testable subset of the system.

---

### Milestone 1 — Data Layer Foundation

*Goal: Everything that can be stored and retrieved.*

1. Database schema: User, UserProfile, ARPConfig, SleepLog, DailyLog, WeeklyCycleBalance
2. `create_user_profile` — write and read user profile
3. `generate_arp_config` — compute and store 16-cycle schedule from ARP
4. Basic auth (email/password or OAuth)

**Test gate:** Create a user with ARP 06:30; verify ARPConfig stores all 16 cycle times correctly; verify sleep_onset_5cycle = 23:00.

---

### Milestone 2 — Core Engine (Stateless)

*Goal: The rule engine runs correctly on test data.*

5. `evaluate_user_state` — implement US-01, US-02, US-03, US-04, US-12 (the 5 most common MVP states)
6. `generate_recommendations` — implement REC-01, REC-02, REC-03, REC-04, REC-13 (covering the core use case)
7. Weekly cycle balance calculation (no weekly history yet; running tally only)
8. Pre-engine validation gates (VALIDATE-01, VALIDATE-02)

**Test gate:** Submit 3 consecutive sleep logs with cycles = 3; verify US-02 fires; verify REC-03 (CRP) is returned; verify CRP time falls within crp_window_open and crp_window_close.

---

### Milestone 3 — API Layer

*Goal: All MVP functions callable via API.*

9. `submit_sleep_log` — write log + trigger engine + return updated recommendations
10. `submit_daily_log` — write daily log + CRP credit logic
11. `get_home_screen_payload` — assemble and return full home screen data
12. `get_day_plan_payload` — return full 16-cycle day plan

**Test gate:** Full round-trip: create user → submit sleep log → receive home screen payload with CRP recommendation at correct time → submit CRP log → verify weekly balance updates.

---

### Milestone 4 — Mobile App Core

*Goal: A user can complete the minimum viable day.*

13. Onboarding screen (F-01) — ARP input + chronotype + MRM introduction
14. Home Screen (F-02) — ARP, sleep onset, weekly balance, primary rec card
15. Day Plan screen (F-03) — full 16-cycle view with phase labels
16. Sleep Log screen (F-04) — cycle count input + submission
17. Daily Check-In (F-12) — cycles + onset flag + disruption
18. Local notification scheduling from `ARPConfig.mrm_times[]`

**Test gate:** End-to-end: install → onboard → view day plan → receive 3 MRM notifications → log sleep → see updated home screen with recommendation.

---

### Milestone 5 — Recovery Architecture (CRP + MRM)

*Goal: The full polyphasic recovery system is usable.*

19. CRP Tracker screen (F-05) — schedule, timer, confirmation, cycle credit
20. MRM reminder in-app content (F-06) — notification tap opens activity suggestions
21. US-07 tone_override implementation — strip outcome metrics when anxiety state active
22. Recommendation cooldown logic (24h for CRP, 48h for 15-min rule)
23. REC-15 (15-minute rule) and REC-16 (2–3am protocol) — state detection and output

**Test gate:** Trigger US-07 (flag onset difficulty 3 days in a row); verify home screen suppresses cycle count comparison; verify only process-frame recommendations surface.

---

### Milestone 6 — Routines and Environment

*Goal: The daily rhythm is fully guided — morning through sleep.*

24. Wake-Up Routine screen (F-08) — 7-step sequence with light intelligence
25. Wind-Down / Phase 3 screen (F-07) — time-sequenced notifications and protocol
26. Environment Audit screen (F-11) — questionnaire → prioritised output
27. US-08 (Electronic Insomnia), US-09 (Ortho-Insomnia), US-10 (Stimulant Compensation) — state detection
28. REC-07 (Morning Light), REC-08 (Wind-Down), REC-09 (Evening Light), REC-10 (Temperature)

**Test gate:** User with evening_light_environment = bright_blue receives REC-09 in Phase 3 notification. Blackout = true AND dws = false triggers DWS pairing recommendation.

---

### Milestone 7 — Insights, Weekly Review, Chronotype

*Goal: The long-term view is usable.*

29. Recovery Insights screen (F-09) — weekly cycle total, ARP consistency, state summary
30. Weekly balance review trigger (day 7 → REC-14)
31. Chronotype Profile screen (F-10) — AMer/PMer explanation + peak window
32. US-05 (Chronotype Conflict) + REC-21 (Social Jet Lag Acknowledgement)
33. Post-Disruption Protocol (F-13) — bounded recovery plan

**Test gate:** At end of week 1 (day 7), verify Recovery Insights shows correct weekly total, ARP consistency count, and weekly review copy in the correct framing tier (33–35+ vs 28–32 vs < 28).

---

### Milestone 8 — Full State Coverage + Launch Polish

*Goal: All 14 MVP states covered; all 25 MVP recommendations covered; launch-quality copy.*

34. Remaining state implementations: US-06, US-11, US-13, US-14
35. Remaining recommendation implementations: REC-05, REC-06, REC-11, REC-12, REC-17, REC-18, REC-20, REC-22, REC-23, REC-24, REC-25
36. Coaching copy audit: every notification, card, and empty state checked against the 8 global copy constraints
37. US-07 safety audit: verify tone_override fires in every state combination
38. Missing data handling: verify null log paths for all 8 null scenarios
39. Shift work scope boundary: add onboarding flag + "coming in V2" message
40. Performance: verify `get_home_screen_payload` responds within 500ms
41. Offline mode: day plan and last home screen payload cached locally

**Test gate:** Full QA pass on 5 representative user journeys: (1) Aligned new user, (2) PMer with deficit, (3) Sleep anxiety loop user, (4) User with disruption event, (5) In-betweener fog user.

---

## FINAL REPORT

### 1. Core MVP Architecture

The R90 MVP is a **stateless-engine, stateful-data** mobile application. The rule engine re-evaluates from raw data on every log event and returns a deterministic recommendation set. The app is a thin display layer — it renders payloads assembled by the backend and fires notifications scheduled from ARPConfig. Five layers (App → Backend → Engine → Storage → Copy) each have single responsibilities and do not bleed concerns into each other.

The most critical architectural constraint: **the engine must run after every data event** (sleep log, daily log, check-in, profile change). Recommendations must always reflect the latest state. Stale recommendation state is a safety risk in the US-07 context.

### 2. Minimum Screens / Features Needed for Launch

8 screens are required for launch:

| Screen | Why Required |
|--------|-------------|
| Onboarding (F-01) | Without ARP, nothing runs |
| Home Screen (F-02) | Daily orientation and primary recommendation surface |
| Day Plan (F-03) | Operational view; MRM scheduling |
| Sleep Log (F-04) | Primary data input; drives weekly balance |
| Daily Check-In (F-12) | State detection input; drives recommendation cycle |
| CRP Tracker (F-05) | Core recovery mechanism; weekly balance critical path |
| MRM Reminders (F-06) | Foundation of polyphasic architecture (notifications) |
| Wake-Up Routine (F-08) | Morning activation; the most important 90 minutes |

Wind-Down (F-07) and Recovery Insights (F-09) are Phase B but should follow within the first update cycle.

### 3. Minimum Backend Functions Needed

7 functions are required for the MVP core:

1. `create_user_profile` — user initialisation + ARP commitment
2. `generate_arp_config` — 16-cycle schedule computation
3. `submit_sleep_log` — primary data event; triggers engine
4. `submit_daily_log` — CRP credit; secondary data event
5. `evaluate_user_state` — engine state detection
6. `generate_recommendations` — engine recommendation output
7. `get_home_screen_payload` — assembled home screen data
8. `get_day_plan_payload` — assembled day plan data

(Functions 5 and 6 are internal engine calls triggered by 3 and 4; functions 7 and 8 are read endpoints called by the app.)

### 4. Recommended First Implementation Milestone

**Milestone 1 + 2 combined: Data Layer + Core Engine — running on test data before any UI is built.**

The correct first implementation is not a screen — it is a passing test for the following scenario:

> Create a user with ARP 06:30. Submit three consecutive sleep logs with cycles = 3. Verify that:
> - ARPConfig stores all 16 cycle times correctly
> - WeeklyCycleBalance.cycle_deficit = 6 after 3 nights
> - evaluate_user_state returns [US-02]
> - generate_recommendations returns REC-03 with crp_time between 13:00 and 18:30
> - The recommendation is suppressed if submitted again within 24h (cooldown)

This test validates the entire intelligence layer before any UI decisions are made. Building the engine first ensures the app is never designed around incorrect logic. All screen designs follow from verified engine outputs.

---

*Sources: `R90_CANONICAL_SYSTEM.md`, `R90_DATA_MODEL.md`, `R90_RULE_ENGINE_SPEC.md`, `R90_USER_STATES.md`, `R90_RECOMMENDATION_ENGINE.md`, `R90_APP_FEATURE_MAPPING.md`, `R90_COACHING_OUTPUTS.md`*
