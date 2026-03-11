# R90 Rule Engine Specification

**Version:** 1.0
**Date:** 2026-03-11
**Status:** Engineering-ready — authorised for implementation
**Depends on:** `R90_CANONICAL_SYSTEM.md` (frozen), `R90_DATA_MODEL.md` (v1.0)
**Authored from:** `R90_DECISION_ENGINE.md`, `R90_DECISION_RULES.md`, `R90_USER_STATES.md`, `R90_RECOMMENDATION_ENGINE.md`

**Reading guide:**
- IF / THEN / ELSE blocks = executable logic
- `monospace` = field names from the data model
- [RULE-ID] = traceable rule identifier
- Priority 1 = highest; Priority 5 = lowest

---

## 1. ENGINE PURPOSE

### What the Rule Engine Does

The R90 rule engine is a stateless, deterministic evaluation layer that runs on demand after each user data event. It:

1. Reads the current state of the user's data (profile, logs, weekly balance)
2. Evaluates all state detection conditions and classifies the user's active recovery situation
3. Applies a rule set to the active states to determine which actions are warranted
4. Generates a ranked, timed, and deduplicated set of recommendations
5. Returns those recommendations to the delivery layer

The engine does not store state — it always re-evaluates from raw data. Every recommendation is derived from the current data snapshot.

### What the Engine Does NOT Do

- It does not prescribe medications or clinical interventions
- It does not override the user's biological chronotype
- It does not guarantee specific sleep outcomes — it targets process adherence
- It does not interpret tracker data as a primary input
- It does not produce output if `arp_committed = false` (the ARP gate applies to all output)
- It does not escalate to clinical pathways beyond a surface-level flag and instruction to seek professional support

### Core Design Constraint

> "We're not measuring sleep as an outcome. We're building a process."

All outputs must reinforce process adherence, not outcome anxiety. Any recommendation that risks generating sleep anxiety is suppressed or reframed.

### Engine Inputs

| Input Category | Entity | Required for Engine to Run |
|---------------|--------|---------------------------|
| User identity | `User` | Yes |
| Persistent profile | `UserProfile` | Yes — `arp_committed` must be true |
| Computed schedule | `ARPConfig` | Yes — computed from `arp_time` |
| Latest sleep record | `SleepLog` (last 7 days) | Yes |
| Daytime recovery record | `DailyLog` (last 7 days) | Yes |
| Weekly balance | `WeeklyCycleBalance` (current week) | Yes |
| Environment | `EnvironmentContext` | Partial — if missing, environment rules are skipped |
| Active events | `EventContext` | Partial — if missing, event modifiers are skipped |

### Engine Outputs

1. **Active UserState list** — ordered by priority
2. **Recommendation list** — typed, timed, toned
3. **Computed flags** — boolean risk indicators for the UI layer
4. **ARPConfig** — refreshed if `arp_time` changed

---

## 2. INPUT LAYER

### 2.1 Input Contract

The engine receives a single JSON-like context object. All engine logic operates on this object. No database reads occur during rule evaluation — all required data must be resolved before the engine runs.

```
EngineContext {
  user:           User
  profile:        UserProfile
  arp_config:     ARPConfig
  sleep_logs:     SleepLog[7]       // last 7 days; may have nulls for missing days
  daily_logs:     DailyLog[7]       // last 7 days; may have nulls for missing days
  weekly_balance: WeeklyCycleBalance
  environment:    EnvironmentContext | null
  events:         EventContext[]    // active events; may be empty
  today:          date
  current_time:   time
}
```

### 2.2 Pre-Engine Validation

Before running the state detection layer, validate the context:

```
[VALIDATE-01]
IF profile.arp_committed = false
  THEN return: { states: [US-12, US-04], recommendations: [REC-01, REC-20] }
  STOP — do not evaluate any other rules

[VALIDATE-02]
IF arp_config is null OR arp_config.generated_at < profile.updated_at
  THEN recompute arp_config from profile.arp_time
  THEN continue

[VALIDATE-03]
IF sleep_logs is empty (no logs at all — new user)
  THEN return: { states: [US-12], recommendations: [REC-20, REC-01, REC-04, REC-06] }
  STOP — onboarding flow only
```

### 2.3 Input Normalisation

```
// Coerce missing daily log fields to safe defaults
daily_log.crp_taken           ?? false
daily_log.mrm_count           ?? 0
daily_log.morning_light_achieved ?? null   // null = unknown; not treated as 'false'
daily_log.evening_light_managed  ?? null

// Coerce missing sleep log fields
sleep_log.cycles_completed    ?? cycles_from_formula(sleep_log)
sleep_log.onset_latency_minutes ?? null    // null = unknown
sleep_log.night_wakings        ?? null

// cycles_from_formula:
//   floor((wake_time − actual_sleep_onset) / 90)
//   returns null if either time is missing
```

---

## 3. STATE DETECTION LOGIC

States are evaluated in dependency order — some states gate or modify others. The engine assigns a `priority` (1 = highest urgency) to each active state.

### 3.1 State Evaluation Order

```
Pass 1 — Gate states (evaluated first; may stop further evaluation)
  US-12  Framework Gap
  US-04  ARP Instability

Pass 2 — Anxiety states (override recommendation tone if active)
  US-07  Sleep Anxiety Loop
  US-09  Ortho-Insomnia

Pass 3 — Structural deficit states
  US-03  Significant Cycle Deficit
  US-02  Mild Cycle Deficit

Pass 4 — Environmental and behavioural states
  US-08  Electronic Insomnia
  US-10  Stimulant Compensation
  US-11  Environmental Friction
  US-05  Chronotype Conflict

Pass 5 — Event and context states
  US-06  Post-Disruption Recovery
  US-15  Pre-Event High Arousal
  US-16  Illness / Injury Recovery
  US-17  Shift Work / Multishift

Pass 6 — Maintenance
  US-01  Aligned

Pass 7 (V2 only)
  US-13  Sleep Noise Exposure
  US-14  In-Betweener Fog
```

---

### STATE: US-12 — Framework Gap

**Priority:** 2 (HIGH)
**MVP:** Yes

```
[STATE-US12]
REQUIRED fields: profile.arp_committed, profile.arp_time

IF profile.arp_committed = false
  THEN activate(US-12)
  THEN SET gate_all_other_states = true
  RETURN  // no other states evaluated while US-12 is active from arp_committed=false

ELSE IF (
  mean(daily_logs[last_7].mrm_count) < 2
  AND sum(daily_logs[last_7].crp_taken) < 2
  AND profile.onboarding_completed = false
)
  THEN activate(US-12)

// US-12 from CRP/MRM gap does not gate other states
```

---

### STATE: US-04 — ARP Instability

**Priority:** 2 (HIGH)
**MVP:** Yes

```
[STATE-US04]
REQUIRED fields: sleep_logs[].wake_time, profile.arp_time
OPTIONAL fields: sleep_logs[].arp_maintained

wake_times_7d = [log.wake_time for log in sleep_logs where log.wake_time != null]

IF len(wake_times_7d) < 3
  // Insufficient data — skip detection; cannot determine instability
  SKIP

ELSE
  wake_variance = max(wake_times_7d) − min(wake_times_7d) in minutes

  IF wake_variance > 30
    THEN activate(US-04)

// Note: US-04 from wake_variance does not gate other states (unlike arp_committed=false)
// It signals instability but the schedule still runs from the committed arp_time
```

---

### STATE: US-07 — Sleep Anxiety Loop

**Priority:** 1 (CRITICAL — overrides recommendation tone globally)
**MVP:** Yes

```
[STATE-US07]
REQUIRED fields: sleep_logs[].onset_latency_minutes OR user_reported_anxiety flag
OPTIONAL fields: sleep_logs[].night_wakings

consecutive_high_latency = count(
  log for log in sleep_logs[last_5]
  where log.onset_latency_minutes != null
  AND log.onset_latency_minutes > 30
)

IF consecutive_high_latency >= 3
  THEN activate(US-07)

// OR: user explicitly reports sleep worry
IF user_reported_anxiety = true  // from explicit UI input or conversation signal
  THEN activate(US-07)

// When US-07 is active:
//   SUPPRESS all outcome metrics from UI (sleep quality scores, % labels)
//   SET tone_override = "process_focus"  // all messages shift to process framing
//   DO NOT add new tracking features or products
```

**Missing data fallback:**
```
IF onset_latency_minutes consistently null AND no user_reported_anxiety
  THEN US-07 cannot be detected
  NOTE: include onset_latency as a soft-required input in onboarding
```

---

### STATE: US-09 — Ortho-Insomnia

**Priority:** 2 (HIGH)
**MVP:** Yes

```
[STATE-US09]
REQUIRED fields: profile.tracker_in_use, user_reported_tracker_anxiety

IF profile.tracker_in_use = true
  AND user_reported_tracker_anxiety = true
  THEN activate(US-09)

// Cannot auto-detect from log data alone — requires explicit user report
// Trigger question in UI: "Do you ever feel anxious about what your tracker shows?"
```

---

### STATE: US-03 — Significant Cycle Deficit

**Priority:** 2 (HIGH)
**MVP:** Yes

```
[STATE-US03]
REQUIRED fields: weekly_balance.cycle_deficit, weekly_balance.day_number,
                 sleep_logs[].cycles_completed

IF weekly_balance.cycle_deficit > 7
  AND weekly_balance.day_number >= 5
  THEN activate(US-03)

// OR: 3+ consecutive nights below 4 cycles
consecutive_low_nights = count(
  log for log in sleep_logs[last_3]
  where log.cycles_completed != null
  AND log.cycles_completed < 4
)
IF consecutive_low_nights >= 3
  THEN activate(US-03)

// US-03 supersedes US-02 — do not activate both simultaneously
```

---

### STATE: US-02 — Mild Cycle Deficit

**Priority:** 3 (MEDIUM)
**MVP:** Yes

```
[STATE-US02]
REQUIRED fields: weekly_balance.weekly_cycle_total, weekly_balance.day_number

IF active(US-03)
  SKIP  // US-03 takes precedence

IF weekly_balance.weekly_cycle_total BETWEEN 28 AND 34
  AND weekly_balance.day_number <= 5
  THEN activate(US-02)
```

---

### STATE: US-08 — Electronic Insomnia

**Priority:** 2 (HIGH)
**MVP:** Yes

```
[STATE-US08]
REQUIRED fields: sleep_logs[].actual_sleep_onset, arp_config.sleep_onset_5cycle
OPTIONAL fields: environment.evening_light_environment, user_reported_screen_use

target_onset = arp_config.sleep_onset_5cycle  // e.g. 23:00 for ARP 06:30

chronic_late_onset = count(
  log for log in sleep_logs[last_5]
  where log.actual_sleep_onset != null
  AND log.actual_sleep_onset > (target_onset + 45min)
)

IF chronic_late_onset >= 3
  THEN activate(US-08)

// Strengthen signal if environment data available:
IF environment.evening_light_environment = "bright_blue"
  THEN increase confidence in US-08 activation

// Direct user report:
IF user_reported_screen_use_in_phase_3 = true
  THEN activate(US-08)
```

---

### STATE: US-05 — Chronotype Conflict (Social Jet Lag)

**Priority:** 3 (MEDIUM)
**MVP:** Yes

```
[STATE-US05]
REQUIRED fields: profile.chronotype, profile.arp_time

IF profile.chronotype = "PMer"
  AND arp_time_as_minutes(profile.arp_time) < arp_time_as_minutes("07:00")
  THEN activate(US-05)

// Note: US-05 is a persistent structural state — it does not resolve unless
// the ARP changes or the chronotype self-assessment is updated.
// It should be surfaced once clearly, then maintained as a background flag
// without re-alarming on every session.
```

---

### STATE: US-10 — Stimulant Compensation

**Priority:** 3 (MEDIUM)
**MVP:** Yes (if caffeine data available; degrades gracefully without it)

```
[STATE-US10]
REQUIRED fields: daily_logs[].caffeine_doses OR daily_logs[].caffeine_after_cutoff
OPTIONAL fields: profile.caffeine_use

caffeine_after_cutoff_count = count(
  log for log in daily_logs[last_7]
  where log.caffeine_after_cutoff = true
)

IF caffeine_after_cutoff_count >= 3
  THEN activate(US-10)

// OR: profile-level signal (no daily log data)
IF profile.caffeine_use = "high"
  THEN activate(US-10) WITH confidence = "low"  // flag but don't alarm

// Missing data fallback:
IF all daily_logs[].caffeine_after_cutoff = null
  THEN US-10 cannot be detected from log data
  // Still detectable from profile.caffeine_use = "high"
```

---

### STATE: US-11 — Environmental Friction

**Priority:** 3 (MEDIUM)
**MVP:** Yes (requires environment context)

```
[STATE-US11]
REQUIRED fields: environment (EnvironmentContext)

IF environment = null
  SKIP  // no environment data collected yet

IF environment.environment_friction_score >= 2
  THEN activate(US-11)

// Friction score computation (from data model):
score = 0
score += 1 if bedroom_temperature IN ("hot", "variable")
score += 1 if evening_light_environment = "bright_blue"
score += 1 if tv_in_bedroom = true
score += 1 if work_items_in_bedroom = true
score += 1 if (blackout_provision = true AND dws_device = false)

IF score >= 2: activate(US-11)
```

---

### STATE: US-06 — Post-Disruption Recovery

**Priority:** 3 (MEDIUM)
**MVP:** Yes (requires event context)

```
[STATE-US06]
REQUIRED fields: events[] with event.active = true
OPTIONAL fields: weekly_balance.cycle_deficit

active_disruption_events = [e for e in events where e.active = true
  AND e.event_type IN ("travel", "social_disruption", "shift_change")]

IF len(active_disruption_events) > 0
  AND weekly_balance.cycle_deficit <= 14  // bounded, not runaway deficit
  AND NOT active(US-03)  // not already a significant structural deficit
  THEN activate(US-06)

// US-06 is distinct from US-03: it has a known bounded cause.
// Tone: reassurance rather than structural audit.
```

---

### STATE: US-15 — Pre-Event High Arousal

**Priority:** 3 (MEDIUM)
**MVP:** Yes

```
[STATE-US15]
REQUIRED fields: events[]

pre_events = [e for e in events
  where e.event_type = "pre_event"
  AND e.start_date <= today + 2 days
  AND e.active = true]

IF len(pre_events) > 0
  THEN activate(US-15)
```

---

### STATE: US-16 — Illness / Injury Recovery

**Priority:** 2 (HIGH)
**MVP:** Yes

```
[STATE-US16]
REQUIRED fields: events[]

illness_events = [e for e in events
  where e.event_type IN ("illness", "injury")
  AND e.active = true]

IF len(illness_events) > 0
  THEN activate(US-16)
  THEN apply_illness_modifiers():
    // Override cycle floor to allow polyphasic CRPs
    effective_crp_window = "any phase"  // not restricted to Phase 2
    effective_cycle_target = 6          // push toward max nocturnal
    mrm_target_override = 3             // reduce MRM burden
```

---

### STATE: US-01 — Aligned

**Priority:** 5 (MAINTENANCE)
**MVP:** Yes

```
[STATE-US01]
// Aligned is only active when no higher-priority state is active

IF NOT active(any state with priority <= 3)
  AND weekly_balance.weekly_cycle_total >= 33
  AND weekly_balance.arp_stable = true
  AND mean(daily_logs[last_7].mrm_count) >= 4
  THEN activate(US-01)
```

---

### STATE: US-17 — Shift Work (V2)

**Priority:** 3 (MEDIUM)
**V2 only**

```
[STATE-US17] // V2
IF profile.multishift_enabled = true
  THEN activate(US-17)
  THEN load_shift_arp():
    IF profile.active_shift = "day":   use profile.shift_arp_day
    IF profile.active_shift = "night": use profile.shift_arp_night
  THEN recompute arp_config from active_arp
  // All cycle, CRP, MRM rules then run on the shift-specific arp_config
```

---

## 4. RULE EVALUATION LAYER

Rules are evaluated after state detection. Each rule maps to one or more active states and produces an action. Rules are written in executable IF / THEN / ELSE form.

### 4.1 Core Scheduling Rules

---

**[RULE-ARP-01] — ARP Gate**

```
IF profile.arp_committed = false
  THEN block_schedule_generation = true
  THEN output: REC-01 (ARP Commitment)
  THEN output: REC-20 (Framework Reset)
  RETURN  // no further rules evaluated

ELSE IF wake_variance_7d > 30 min AND profile.arp_committed = true
  THEN output: REC-01 (ARP Recommitment prompt)
  THEN activate(US-04)
  THEN continue  // other rules still run
```

---

**[RULE-ONSET-01] — Sleep Onset Scheduling**

```
// Runs every session when ARP is committed
target_onset = arp_config.sleep_onset_5cycle  // default = ARP − 7.5h

IF profile.cycle_target = 6: target_onset = arp_config.sleep_onset_6cycle
IF profile.cycle_target = 4: target_onset = arp_config.sleep_onset_4cycle
IF profile.cycle_target = 3: target_onset = arp_config.sleep_onset_3cycle

output:
  primary_onset   = target_onset
  fallback_onset  = target_onset + 90min   // "miss the bus? catch the next one"
  floor_onset     = arp_config.sleep_onset_4cycle  // always display floor option

COACHING: "If you miss [primary_onset], wait until [fallback_onset]. Do not force sleep mid-cycle."
```

---

**[RULE-ONSET-02] — Missed Sleep Onset**

```
IF abs(sleep_log.actual_sleep_onset − arp_config.sleep_onset_5cycle) > 30 min
  AND sleep_log.actual_sleep_onset > arp_config.sleep_onset_5cycle  // late, not early

  THEN cycles_tonight = floor(
    (sleep_log.wake_time − sleep_log.actual_sleep_onset) / 90
  )

  IF cycles_tonight < 4
    THEN trigger RULE-CYCLES-01 (CRP compensation)
```

---

**[RULE-ONSET-03] — Failed Sleep Onset (15-Minute Rule)**

```
IF sleep_log.onset_latency_minutes > 15
  AND NOT active(US-07)  // don't double-fire; US-07 handles the anxiety state

  THEN output: REC-15 (15-Minute Rule Activation)
  COACHING: "If sleep doesn't come within 15 minutes: get up.
             Dim/amber light only. No screens. No tasks.
             Wait for the next 90-minute boundary, then try again."

IF sleep_log.onset_latency_minutes > 30  // severe
  AND consecutive_high_latency >= 2
  THEN evaluate(STATE-US07)
```

---

**[RULE-CYCLES-01] — Short Night CRP Trigger**

```
IF sleep_logs[yesterday].cycles_completed < 4
  THEN crp_recommended_today = true
  THEN crp_time = earliest_available_phase_2_slot()
       // = MAX(current_time, arp_config.crp_window_open)

  output: REC-03 (CRP Scheduling)
  action_payload:
    crp_start:    crp_time
    crp_duration: 30
    crp_window:   [arp_config.crp_window_open, arp_config.crp_window_close]
    cycle_credit: 1

ELSE IF sleep_logs[yesterday].cycles_completed = null
  // Missing data fallback: assume 5 cycles (no CRP triggered from missing data)
  SKIP
```

---

**[RULE-CYCLES-02] — Weekly Deficit Escalation**

```
IF weekly_balance.cycle_deficit > 7 AND weekly_balance.day_number >= 5
  THEN activate(US-03)
  THEN output: REC-03 (CRP for remaining days)
  THEN output: REC-14 (Weekly Balance Review)
  THEN audit_structural_causes():
    IF NOT arp_stable: output REC-01
    IF mean(mrm_count) < 3: output REC-04

IF weekly_balance.cycle_deficit > 14
  THEN output: REC-19 (Sleep Restriction — with caution; see suppression rules)
```

---

**[RULE-CYCLES-03] — CRP Validity Check**

```
// Run when a CRP is logged
IF daily_log.crp_duration_minutes >= 20
  THEN daily_log.crp_cycle_credited = true
  THEN weekly_balance.total_crp_cycles += 1

ELSE IF daily_log.crp_duration_minutes BETWEEN 1 AND 19
  THEN daily_log.crp_cycle_credited = false
  // Treat as an extended MRM instead
  COACHING: "A rest of less than 20 minutes doesn't count as a full recovery cycle,
             but it still counts as a valuable Micro Reset Moment. Aim for 30 next time."

IF daily_log.crp_start_time NOT IN [crp_window_open, crp_window_close]
  THEN daily_log.crp_in_window = false
  // CRP still credited (cycle credit is not location-dependent)
  // But note: CRP outside Phase 2 is sub-optimal
  COACHING: "Your CRP fell outside the ideal 12:00–18:30 window.
             It still counts, but mid-afternoon timing is most effective."
```

---

### 4.2 ARP and Chronotype Rules

---

**[RULE-ARP-02] — Social Jet Lag Detection**

```
IF profile.chronotype = "PMer"
  AND arp_time_as_minutes(profile.arp_time) < arp_time_as_minutes("07:00")

  THEN activate(US-05)
  THEN output: REC-21 (Social Jet Lag Acknowledgement)

  // Evaluate negotiability
  IF profile.occupation_schedule IN ("flexible", "freelance", null)
    THEN ALSO output: REC-12 (Chronotype Schedule Adjustment)
    COACHING: "Your biology prefers waking after 07:00.
               If your schedule is flexible, consider shifting your ARP.
               If not, we'll work within this."

  IF profile.occupation_schedule IN ("standard", "early_starts")
    THEN suppress ARP-shift suggestion
    COACHING: "Your body clock and schedule are misaligned.
               We can't change the biology, but we can manage within it."
```

---

**[RULE-ARP-03] — Post-Disruption ARP Hold**

```
// Runs whenever an active EventContext is present
IF any(events.active = true)
  THEN arp_change_permitted = false

IF user attempts to change arp_time while disruption event is active
  THEN block_arp_change = true
  COACHING: "Hold your wake time during disruptions.
             Recovery is managed through CRP — not by shifting your anchor."
```

---

**[RULE-CHRONO-01] — AMer Late Exercise Risk**

```
// V2: requires daily_log.exercise_start_time
IF profile.chronotype = "AMer"
  AND daily_log.exercise_start_time > phase_3_start  // after ~18:30 for ARP 06:30

  THEN output flag: late_exercise_risk = true
  COACHING: "Late exercise delays your natural sleep onset.
             Your melatonin starts around 21:00. Exercising after 19:00
             pushes against this. Aim for Phase 1 or Phase 2 instead."
```

---

**[RULE-CHRONO-02] — PMer Task Scheduling**

```
IF profile.chronotype = "PMer"
  THEN peak_cognitive_window = [ARP + 12h, ARP + 18h]  // Phase 3 / late afternoon
  THEN output: coaching_note:
    "Your peak cognitive window is in the afternoon and evening.
     Protect this time for high-stakes decisions and demanding work.
     Mornings are better for routine and maintenance tasks."
```

---

### 4.3 Environment Rules

---

**[RULE-ENV-01] — Environment Audit Gate**

```
// Do not recommend products until framework is in place
IF NOT profile.arp_committed OR mean(daily_logs[last_7].mrm_count) < 2
  THEN suppress all product recommendations
  THEN suppress REC-10 (temperature), REC-11 (audit)
  // Framework first: ARP → MRM → CRP → environment → products
```

---

**[RULE-ENV-02] — Blackout Without DWS Risk**

```
IF environment.blackout_provision = true
  AND environment.dws_device = false

  THEN output flag: blackout_without_dws = true
  COACHING: "Blackout blinds remove your natural light cue at wake time.
             Without a Dawn Wake Simulator, you're removing your serotonin trigger.
             Pair blackout blinds with a DWS or light therapy device."
```

---

**[RULE-ENV-03] — Temperature Protocol**

```
IF environment.bedroom_temperature IN ("hot", "variable")
  AND active(US-11)

  THEN output: REC-10 (Bedroom Temperature Correction)
  COACHING: "Your bedroom needs to be a couple of degrees cooler than your body.
             The temperature differential triggers sleep onset.
             A hot room is one of the most common and most fixable sleep barriers."
```

---

**[RULE-ENV-04] — Phase 3 Light Protocol**

```
// Triggered at the Phase 3 boundary (ARP + 12h)
IF current_time >= arp_config.phase_3_start
  AND (environment.evening_light_environment = "bright_blue"
       OR active(US-08))

  THEN output: REC-08 (Phase 3 Wind-Down Protocol)
  THEN output: REC-09 (Evening Light Correction)
```

---

### 4.4 Recovery Intervention Rules

---

**[RULE-INTV-01] — Intervention Hierarchy Gate**

```
// Before any product recommendation is generated:
IF NOT (mrm_established = true AND crp_established = true)
  THEN suppress all product recommendations
  THEN suppress recommendations: REC-10, REC-11 (partially), REC-26
  // MRM and CRP must be established before product layer

mrm_established = (profile.onboarding_completed AND mean(daily_logs[last_7].mrm_count) >= 3)
crp_established = (sum(daily_logs[last_7].crp_taken) >= 2)
```

---

**[RULE-CRP-01] — CRP Scheduling (Core)**

```
// Previously defined as RULE-CYCLES-01. Full form:
IF sleep_logs[yesterday].cycles_completed < 4
  OR (weekly_balance.cycle_deficit >= 3 AND weekly_balance.day_number <= 5)

  THEN recommended_crp = {
    start:    MAX(current_time, arp_config.crp_window_open),
    duration: 30,
    credit:   1
  }
  output: REC-03

ELSE IF active(US-16)  // illness mode
  THEN recommended_crp = {
    start:    any available time (not restricted to Phase 2),
    duration: 30,
    credit:   1
  }
  output: REC-24 (includes CRP guidance)
```

---

**[RULE-CRP-02] — CRP Stigma Response**

```
// Fires if user dismisses REC-03 two or more times
IF REC-03.dismissed_count >= 2
  THEN output: REC-13 (Cycle Count Reframe) WITH stigma_context = true
  COACHING: "A Controlled Reset Period is not a nap — it's a professional recovery tool.
             Elite athletes, surgeons, and high-performance executives use this.
             Mental disengagement for 30 minutes adds a full cycle to your week."
```

---

**[RULE-MRM-01] — MRM Reminders**

```
// Fires at each waking cycle boundary during Phases 1–3
FOR each cycle_time IN arp_config.mrm_times:
  IF current_time == cycle_time  // trigger point
    AND daily_log.mrm_count < 7  // cap at 7 (don't fire if already done)
    AND NOT (cycle_time IN crp_time_blocks)  // don't fire if CRP is scheduled here

    THEN output: REC-05 (MRM Reminder)
    action_payload:
      mrm_duration: "3–5 minutes"
      mrm_guidance: "Vacant mindspace. No screens. Eyes closed or window gaze."
```

---

**[RULE-SR-01] — Sleep Restriction Protocol**

```
// Conservative — only fires when other interventions have failed
IF active(US-03) WITH persistence >= 14 days
  AND NOT (improved_from_CRP_or_MRM)  // checked as: no improvement trend in cycles over 14 days
  AND NOT active(US-07)  // never fire sleep restriction when anxiety is active

  THEN output: REC-19 (Sleep Restriction Protocol)
  action_payload:
    delay_onset_by: 90 min  // shift onset one cycle later
    arp_held:       true
    duration_days:  7        // re-evaluate after one week
  COACHING: "We're going to tighten your sleep window to strengthen your sleep drive.
             Your wake time stays exactly the same. We're shifting when you go to bed later.
             This consolidates your cycles and deepens them."

SUPPRESSION: Never fire REC-19 if active(US-07)
SUPPRESSION: Never fire REC-19 in first 14 days of using the app
```

---

**[RULE-WAKE-01] — 2–3am Waking Protocol**

```
IF sleep_log.night_waking_2_to_4am = true
  THEN output: REC-16 (2–3am Waking Protocol)
  COACHING: "Waking at 2–3am is natural — it's a transition between sleep cycles.
             This is a heritage of our pre-electric-light polyphasic biology.
             Do not panic. Do not calculate how much sleep remains.
             Get up quietly. Dim light, no screens.
             Wait for the next 90-minute boundary. Return to bed."
```

---

**[RULE-RISK-001] — Sleep Anxiety Loop Response**

```
IF active(US-07)
  // Override all metric displays
  THEN suppress: sleep quality score display
  THEN suppress: cycle count comparison to target
  THEN suppress: REC-19 (sleep restriction)
  THEN suppress: any tracker integration recommendations
  THEN output: REC-13 (Cycle Count Reframe)
  THEN output: REC-15 (15-Minute Rule)
  THEN output: REC-08 (Phase 3 Wind-Down)

  // Persistent anxiety escalation
  IF US-07.active_days > 14
    THEN output: coaching_note:
      "If sleep worry persists for more than a couple of weeks
       despite following the process, speaking with a GP or sleep specialist
       may help. The R90 structure is not a substitute for professional support
       for clinical anxiety or insomnia."
```

---

**[RULE-RISK-002] — Ortho-Insomnia Response**

```
IF active(US-09)
  THEN suppress nightly tracker score display  // show weekly averages only
  THEN output: REC-18 (Tracker Usage Calibration)

  IF REC-18 delivered AND US-09 still active after 7 days
    THEN escalate: recommend defined tracker-free period (14 days)
    COACHING: "The measurement tool is now disrupting what it's meant to measure.
               Try 2 weeks without the tracker. Judge your recovery by how you feel
               and how your process adherence is going."
```

---

**[RULE-RISK-003] — Stimulant Response**

```
IF active(US-10)
  THEN check_upstream_cause():
    IF active(US-03): primary_cause = "insufficient cycles"
    ELSE IF active(US-05): primary_cause = "social jet lag"
    ELSE: primary_cause = "unknown structural gap"

  THEN output: REC-17 (Caffeine Timing Correction)
  action_payload:
    cutoff_time: "14:00"  // no caffeine after 14:00 regardless of chronotype
  COACHING: "The stimulants are masking a structural recovery gap, not solving it.
             Fix the gap first — the reliance reduces naturally when you're better recovered.
             For now: nothing caffeinated after 14:00."

  THEN output: REC-03 or REC-25 based on cycle deficit status
```

---

### 4.5 Travel Protocol Rules

---

**[RULE-TRAVEL-01] — Travel Direction and Protocol**

```
IF active event with event_type = "travel"
  AND event.timezone_offset_hours != 0

  travel_direction = (timezone_offset_hours > 0) ? "eastward" : "westward"

  IF travel_direction = "westward":  // body clock says morning, local time says night
    THEN output: coaching_note:
      "Body clock says it's morning, local time says night.
       Avoid sleeping on the plane.
       On arrival: dim all lights, no alcohol, no heavy meals.
       A warm bath or quiet music can stimulate melatonin artificially.
       3 cycles tonight is enough. You'll recover tomorrow."

  IF travel_direction = "eastward":  // body clock says night, local time says morning
    THEN output: coaching_note:
      "Body clock says it's night, local time says morning.
       Sleep on the plane. Book a window seat. Eye mask and earplugs.
       Ask not to be woken. After arrival: maximise daylight.
       Use CRPs as recovery pockets. Commit to destination ARP from tonight."

  // Override cycle floor
  event.cycle_floor_override = 3
  COACHING: "3 cycles on your first night in a new timezone is fine. Commit to your ARP."
```

---

**[RULE-TRAVEL-02] — Post-Travel ARP Hold**

```
IF event.event_type = "travel" AND event.active = true
  THEN arp_held_at_destination = arp_config.arp_time  // committed in destination timezone
  THEN do_not_revert_to_home_arp_until event.end_date
```

---

## 5. RECOMMENDATION GENERATION

### 5.1 Generation Pipeline

```
recommendations = []

FOR state IN sorted_active_states (by priority):
  eligible = REC_MAP[state.state_id]
  FOR rec_type IN eligible:
    IF NOT recently_delivered(rec_type, cooldown_hours[rec_type])
      AND condition_met(rec_type, context)
      AND NOT suppressed(rec_type, context)
      THEN recommendations.append(
        build_recommendation(rec_type, state, context)
      )

recommendations = deduplicate(recommendations)   // same type, different triggers
recommendations = sort_by_priority(recommendations)
recommendations = cap_at(5)  // max 5 active recommendations at any time
```

### 5.2 Recommendation Conditions and Timing

---

**REC-01 — ARP Commitment**

```
trigger:    arp_committed = false OR (US-04 active AND wake_variance > 30min)
timing:     immediate — shown at every session until resolved
priority:   CRITICAL (1)
cooldown:   none
suppress:   never
message:    "Before we can build your recovery plan, we need one fixed number:
             your wake time. Everything — when to sleep, when to rest — follows from it."
```

---

**REC-02 — Sleep Onset Scheduling**

```
trigger:    arp_committed = true (always active — core display)
timing:     every morning session
priority:   HIGH (2)
cooldown:   12h (daily)
suppress:   if US-07 active, show only the target time — suppress the "N cycles" framing
message:    "Tonight: sleep by [onset_5cycle] for 5 complete cycles. Miss it?
             The next window is [onset_5cycle + 90min]."
```

---

**REC-03 — CRP Scheduling**

```
trigger:    cycles_last_night < 4
            OR weekly_cycle_deficit >= 3 (by day 3)
            OR US-06 (post-disruption) active
timing:     morning after a short night; deliver at 09:30 (C3) for same-day CRP
priority:   HIGH (2)
cooldown:   24h
suppress:   if crp_already_taken_today = true
action:     schedule CRP in Phase 2 window; add to day plan
message:    "Last night was shorter than your target. A 30-minute rest between
             [crp_window_open] and [crp_window_close] today adds a full cycle to your week."
```

---

**REC-04 — MRM Introduction**

```
trigger:    onboarding_step <= 3 (first week)
            OR mrm_established = false
timing:     onboarding gate — delivered before any other scheduling recommendation
priority:   HIGH (2)
cooldown:   none during onboarding; 72h thereafter
suppress:   once mrm_established = true for 7+ days
message:    "Every 90 minutes, your recovery system includes a 3-5 minute Micro Reset Moment.
             No screens. No inputs. Vacant mindspace. It's not optional — it's the floor."
```

---

**REC-05 — MRM Daily Reminders**

```
trigger:    mrm_established = true (always active in waking hours)
timing:     at each cycle boundary in arp_config.mrm_times
priority:   MEDIUM (3)
cooldown:   90min (one per cycle boundary)
suppress:   if CRP is scheduled within 15min of trigger time
            if daily_log.mrm_count >= 7 (target met)
message:    "Reset moment. 3–5 minutes. Nothing required."
```

---

**REC-06 — Post-Sleep Routine Reinforcement**

```
trigger:    ARP time reached (morning trigger)
            AND (onboarding incomplete OR post_sleep_routine_established = false)
timing:     immediate at ARP (push notification at wake time)
priority:   HIGH (2)
cooldown:   24h
suppress:   once routine_established = true for 14+ consecutive days
message:    Sequenced prompt: bladder → light → hydrate → food → challenge → exercise → bowels
```

---

**REC-07 — Morning Light Activation**

```
trigger:    ARP time reached (daily)
            OR US-08, US-11 active
timing:     push notification at ARP
priority:   HIGH (2)
cooldown:   24h
suppress:   if morning_light_achieved = true already logged
message variants:
  outdoor available: "Step outside. Even 10 minutes of morning light resets your clock."
  DWS device:        "Your dawn simulator should have triggered. Supplement with outdoor."
  indoor only:       "Sit by your largest window. 10,000 Lux is the target."
```

---

**REC-08 — Phase 3 Wind-Down Protocol**

```
trigger:    current_time >= arp_config.phase_3_start
            AND (US-08 active OR onset_latency chronic)
timing:     notification at Phase 3 boundary
priority:   HIGH (2)
cooldown:   24h
suppress:   if US-07 active (do not add protocols — reduces anxiety)
message:    "Phase 3 has started. Shift lights to warm. No new demanding work.
             Let the day settle. Your biology is already beginning its preparation for sleep."
```

---

**REC-09 — Evening Light Correction**

```
trigger:    US-08 OR US-11 active
            AND environment.evening_light_environment = "bright_blue"
timing:     at Phase 3 boundary (same as REC-08; may be batched)
priority:   HIGH (2)
cooldown:   48h
suppress:   if evening_light_managed = true (user has already corrected)
            if framework not yet established (RULE-INTV-01 gate)
message:    "Blue and white light — even dim — suppresses melatonin.
             Switch to amber, yellow, or red spectrum as you move through your evening."
```

---

**REC-10 — Bedroom Temperature Correction**

```
trigger:    US-11 active AND bedroom_temperature IN ("hot", "variable")
timing:     environment audit session or next morning
priority:   MEDIUM (3)
cooldown:   72h
suppress:   if framework not established (RULE-INTV-01 gate)
message:    "Your bedroom needs to be cooler than your body. The temperature gap
             is a biological trigger for sleep onset. A hot room blocks it."
```

---

**REC-11 — Environment Audit**

```
trigger:    US-11 active (friction_score >= 2) OR onboarding step 5
timing:     after framework established (ARP + MRM + CRP baseline in place)
priority:   MEDIUM (3)
cooldown:   7 days
suppress:   RULE-INTV-01 gate
message:    "Let's review your sleeping space. Imagine the room completely empty —
             only bring back what serves your recovery. Start with: temperature, light, function."
```

---

**REC-12 — Chronotype Schedule Adjustment**

```
trigger:    US-05 active AND occupation_schedule allows flexibility
            OR chronotype_confidence = "calibrated" after 4+ weeks (V2)
timing:     after first week of data collection
priority:   MEDIUM (3)
cooldown:   7 days
suppress:   if occupation_schedule = "fixed" (no point suggesting change)
message:    "Your natural peak is in the afternoon. If there's any flexibility in
             your schedule, consider shifting your ARP by 30–60 minutes later."
```

---

**REC-13 — Cycle Count Reframe**

```
trigger:    US-07 active OR US-12 active OR REC-03 dismissed twice
timing:     when anxiety signals are detected; or on-demand
priority:   MEDIUM (3)
cooldown:   72h
suppress:   never suppress (this is an education rec, not a task rec)
message:    "4.5 hours of 3 complete cycles is better recovery than 5 hours
             with an interrupted 4th. Cycles, not hours. One short night doesn't
             break your week — it's an input your system manages."
```

---

**REC-14 — Weekly Balance Review**

```
trigger:    end of week (Sunday) OR US-02 OR US-03 active
timing:     Sunday evening; or mid-week if deficit detected
priority:   MEDIUM (3)
cooldown:   72h (not daily)
suppress:   if US-07 active (suppress metric display — show only process adherence)
message:    "This week: [N] cycles completed of 35 target. [Coaching on gap or maintenance.]"
```

---

**REC-15 — 15-Minute Rule Activation**

```
trigger:    onset_latency > 15 min (any single night) OR US-07 active
timing:     morning after a high-latency night (before next sleep attempt)
priority:   HIGH (2)
cooldown:   48h
suppress:   never while US-07 is active
message:    "If sleep doesn't come within 15 minutes: get up.
             Amber light only. No screens. No tasks.
             Wait for the next 90-minute boundary. Try again then."
```

---

**REC-16 — 2–3am Waking Protocol**

```
trigger:    sleep_log.night_waking_2_to_4am = true
timing:     morning after the night of waking; also can be surfaced during night via push
priority:   HIGH (2)
cooldown:   48h
suppress:   never; this is normalisation, not an alarm
message:    "Waking at 2–3am is natural — it's a polyphasic transition point from our
             pre-electric-light biology. Don't calculate remaining sleep. Don't panic.
             Quiet, dim, no screens. Wait for the next cycle boundary."
```

---

**REC-17 — Caffeine Timing Correction**

```
trigger:    US-10 active OR caffeine_after_cutoff_count >= 3 last 7 days
timing:     morning (habit context); or when evening caffeine is logged
priority:   MEDIUM (3)
cooldown:   48h
suppress:   if structural cause (US-03) is already being addressed (batch with structural rec)
action:     set caffeine_cutoff_time = 14:00 if not already set
message:    "Nothing caffeinated after 14:00. This isn't about cutting caffeine —
             it's about stopping it from competing with your melatonin window tonight."
```

---

**REC-18 — Tracker Usage Calibration**

```
trigger:    US-09 active (tracker_in_use AND tracker_anxiety reported)
timing:     when US-09 first activates
priority:   HIGH (2)
cooldown:   7 days
suppress:   never while US-09 is active
message:    "Your tracker is a guide, not a verdict. Check weekly averages,
             not nightly scores. How you feel and how your process looks
             are better indicators than any algorithm."
escalation: if still active after 7 days → recommend 14-day tracker-free period
```

---

**REC-19 — Sleep Restriction Protocol**

```
trigger:    US-03 persistent (>= 14 days) AND CRP not resolving deficit
timing:     after 14-day review shows no improvement
priority:   LOW (4)
cooldown:   14 days
suppress:   if active(US-07) — HARD SUPPRESSION, never combine with anxiety state
            if app usage < 14 days (too early to trigger)
action:     delay sleep onset by 90 min; hold ARP; re-evaluate in 7 days
message:    "We're consolidating your sleep by tightening your window.
             Same wake time. Slightly later bedtime. Your sleep drive gets stronger."
```

---

**REC-20 — Framework Reset**

```
trigger:    US-12 active OR arp_committed = false
timing:     immediate — shown at session start
priority:   CRITICAL (1)
cooldown:   none
suppress:   never; this is the onboarding entry point
action:     route to onboarding flow: ARP → cycles → MRM → CRP → environment
```

---

**REC-21 — Social Jet Lag Acknowledgement**

```
trigger:    US-05 active (first activation only; then background flag)
timing:     on first US-05 detection
priority:   MEDIUM (3)
cooldown:   14 days (re-surface if still active and user hasn't actioned)
suppress:   after first acknowledgement + no ARP flexibility
message:    "Your internal clock and your schedule are out of sync — this is Social Jet Lag.
             70% of people live this way. We can't change your biology, but we can
             work with it. Protect your afternoon window for what matters most."
```

---

**REC-22 — Post-Disruption Rebalancing**

```
trigger:    US-06 active (disruption event + bounded deficit)
timing:     morning after disruption identified
priority:   MEDIUM (3)
cooldown:   48h
suppress:   if US-03 active (structural deficit takes priority)
message:    "Your system handled a disruption. ARP held — that's the key.
             Schedule a CRP today to rebalance. Typical recovery: 2–3 days."
```

---

**REC-23 — Pre-Event Arousal Protocol**

```
trigger:    US-15 active (pre_event within 48h)
timing:     evening before the event (at Phase 3 boundary)
priority:   MEDIUM (3)
cooldown:   per-event
suppress:   never
message:    "You may sleep less tonight — that's expected. Don't try to force it.
             Even 3 complete cycles is enough to perform well tomorrow.
             Follow the process: Phase 3 wind-down, no clock watching, ARP holds."
```

---

**REC-24 — Illness Recovery Mode**

```
trigger:    US-16 active
timing:     immediate on event activation
priority:   HIGH (2)
cooldown:   per-event
suppress:   never during illness
message:    "Recovery mode: maximise rest. CRPs can happen at any time today —
             not just this afternoon. Your cycle target is 6 tonight if you can get it.
             The framework absorbs this — don't aim for perfection, aim for rest."
```

---

**REC-25 — Controlled Recovery Day**

```
trigger:    US-02 OR US-03 active
            AND weekly_balance.day_number >= 3  // mid-week, enough time to compensate
timing:     morning of the recovery day
priority:   MEDIUM (3)
cooldown:   72h
message:    "Today is a recovery day. Protect the Phase 2 window for a full CRP.
             Reduce demands on yourself this afternoon. The week is recoverable."
```

---

**REC-26 — Travel Environment Setup**

```
trigger:    US-06 active WITH event_type = "travel"
            OR event.start_date within 48h
timing:     day of travel, pre-departure
priority:   LOW (4)
cooldown:   per-event
suppress:   if framework not established
message:    "Travelling tonight. Pack your familiarisation anchors: [scent, comfort items].
             Keep your ARP in the destination timezone from tonight.
             Blackout and cool = your two priorities for the hotel room."
```

---

## 6. CONFLICT RESOLUTION

When multiple states are active simultaneously, the engine applies conflict resolution rules to determine priority order, message tone, and suppression.

### 6.1 Priority Hierarchy

```
Priority 1 (Critical — overrides everything):
  US-07 Sleep Anxiety Loop
  → TONE_OVERRIDE = "process_focus"
  → SUPPRESS all outcome metrics
  → SUPPRESS REC-19 (sleep restriction)
  → SUPPRESS any new tracker or product recommendations

Priority 2 (High — structural or acute):
  US-04 ARP Instability         → BLOCK schedule generation
  US-12 Framework Gap           → BLOCK schedule generation
  US-03 Significant Cycle Deficit
  US-08 Electronic Insomnia
  US-09 Ortho-Insomnia
  US-16 Illness / Injury

Priority 3 (Medium):
  US-02 Mild Cycle Deficit
  US-05 Chronotype Conflict
  US-06 Post-Disruption Recovery
  US-10 Stimulant Compensation
  US-11 Environmental Friction
  US-15 Pre-Event High Arousal

Priority 4 (Low):
  US-13 Sleep Noise Exposure (V2)
  US-14 In-Betweener Fog (V2)
  US-17 Shift Work (V2)

Priority 5 (Maintenance):
  US-01 Aligned
```

### 6.2 Named Conflict Scenarios

---

**Conflict: US-07 (Anxiety) + US-03 (Deficit)**

```
CONDITION: Both US-07 and US-03 are active.
RESOLUTION:
  US-07 tone override applies to ALL recommendations.
  US-03's structural audit continues, but:
    - Suppress cycle count comparisons ("you need X more cycles")
    - Replace with: "Let's focus on today's process"
    - REC-03 (CRP) fires — but framed as routine, not as compensation
    - REC-19 (sleep restriction) is hard-suppressed
  Lead recommendation: REC-15 (15-min rule) + REC-13 (reframe) + REC-03 (CRP)
```

---

**Conflict: US-16 (Illness) + US-03 (Deficit)**

```
CONDITION: Both illness and significant deficit active.
RESOLUTION:
  US-16 takes priority on intervention rules:
    - cycle_floor_override = 3 (travel/acute context)
    - crp_any_phase = true
    - deficit_flag suppressed during illness
  US-03 structural rules suspended for event duration.
  On event end: resume normal state detection; US-03 re-evaluates from current data.
```

---

**Conflict: US-15 (Pre-Event) + US-03 (Deficit)**

```
CONDITION: High-stakes event tomorrow AND significant cycle deficit.
RESOLUTION:
  US-15 arousal framing takes precedence for tonight's messaging.
  US-03 CRP recommendation is maintained but framed as pre-event prep, not deficit correction.
  "A CRP this afternoon will sharpen you for tomorrow — independent of last week's total."
  cycle_floor_override = 3 for tonight only.
```

---

**Conflict: US-05 (Chronotype / Social Jet Lag) + US-02 (Mild Deficit)**

```
CONDITION: PMer on early ARP with mild cycle deficit.
RESOLUTION:
  Root cause acknowledged: Social Jet Lag is the structural driver of the deficit.
  US-02 CRP recommendation fires as normal.
  US-05 coaching is batched: "Your chronotype mismatch makes this week harder.
  The CRP is your main lever. Protect the afternoon window."
  Do not suggest ARP change if occupation_schedule is fixed.
```

---

**Conflict: US-06 (Post-Disruption) + US-02 (Mild Deficit)**

```
CONDITION: Disruption event active AND mild cycle deficit present.
RESOLUTION:
  US-06 takes tone priority (reassurance over audit).
  US-02 CRP fires with US-06 framing:
  "Your system handled [the travel/event]. Here's how to rebalance this week."
  Do not activate US-03 logic unless deficit > 7 cycles by day 5.
```

---

**Conflict: US-09 (Ortho-Insomnia) + US-11 (Environmental Friction)**

```
CONDITION: Tracker anxiety AND environment problems both active.
RESOLUTION:
  US-09 takes priority — deal with anxiety before environment audit.
  Suppress REC-11 (environment audit) until US-09 is resolved or in remission.
  Rationale: adding an audit task to an anxious user increases cognitive load and can worsen the loop.
```

---

**Conflict: Multiple high-priority states (3 or more simultaneously)**

```
RULE: Maximum 2 active recommendations delivered per session.
      (Exception: REC-01 and REC-20 are always shown regardless of cap.)

SELECTION:
  1. Take the highest-priority active state's primary recommendation
  2. Take the second-highest priority state's primary recommendation
  3. Cap all other recommendations as "queued for next session"

This prevents recommendation overwhelm — one of the most common causes of app abandonment.
```

---

## 7. WEEKLY ACCOUNTING LOGIC

### 7.1 Core Accounting Formulas

```
// Cycle totals
total_nocturnal = sum(sleep_logs[day_1..day_7].cycles_completed)
total_crp       = sum(daily_logs[day_1..day_7].crp_cycle_credited)
weekly_total    = total_nocturnal + total_crp

// Deficit and targets
weekly_target   = 35
weekly_floor    = 28
cycle_deficit   = weekly_target − weekly_total

// Pace calculation
day_number           = number of completed days in current week (1–7)
expected_by_today    = day_number × 5  // 5 cycles per day = on-pace
pace_deficit         = expected_by_today − weekly_total
projected_end_total  = weekly_total + (remaining_days × 5)
  where remaining_days = 7 − day_number

// Status flags
on_track          = (projected_end_total >= weekly_floor)
deficit_risk_flag = (cycle_deficit > 7 AND day_number >= 5)
```

### 7.2 Weekly Status Classification

```
IF weekly_total >= 33 AND no active high-priority states:
  → US-01 Aligned (maintenance mode)

IF weekly_total BETWEEN 28 AND 34 AND day_number <= 5:
  → US-02 Mild Cycle Deficit (CRP recommended)

IF cycle_deficit > 7 AND day_number >= 5:
  → US-03 Significant Cycle Deficit (escalated response)

IF weekly_total < 28 by end of day 7:
  → US-03 Significant Cycle Deficit (floor breached)
```

### 7.3 MRM Accounting

```
weekly_mrm_total  = sum(daily_logs[day_1..day_7].mrm_count)
mrm_target        = 42   // 6 active days × 7 per day (one rest day assumed)
mrm_floor         = 35   // 5 per day × 7 days

// MRM tracking is informational — does not trigger states directly
// Low MRM count is a contributing signal for US-12 (framework gap) detection
// and US-03 structural audit (are MRMs in place before escalating?)
```

### 7.4 CRP Accounting

```
crp_count_week    = count(daily_logs[day_1..day_7] where crp_taken = true)
crp_target        = 7   // one per day (ideal)
crp_floor         = 5   // "no-worries" floor (from canonical system)

// CRP cycle credit rules:
crp_duration >= 90 min: credit = 1  (extended CRP / full recovery cycle)
crp_duration >= 30 min: credit = 1  (standard CRP)
crp_duration >= 20 min: credit = 1  (minimum viable CRP)
crp_duration  < 20 min: credit = 0  (counts as an MRM instead)
crp_duration = null:    credit = 0  (no log = no credit)
```

### 7.5 Week Boundary Rules

```
// Week definition for MVP: rolling 7-day window from the user's ARP commitment date
// Example: committed Monday → week = Mon–Sun; committed Wednesday → week = Wed–Tue

// End-of-week computation: runs on the final day (day 7)
final_weekly_summary = {
  total_cycles:       weekly_total,
  target:             35,
  floor:              28,
  above_target:       weekly_total >= 35,
  above_floor:        weekly_total >= 28,
  floor_breached:     weekly_total < 28,
  crp_count:          crp_count_week,
  mrm_total:          weekly_mrm_total,
  arp_stable:         (max_wake_variance <= 15min),
}
```

---

## 8. MISSING DATA HANDLING

The engine must degrade gracefully when data is absent. The core principle: **missing data never produces anxiety-inducing output** — it produces conservative defaults or skips the relevant rule.

### 8.1 Missing Sleep Log

```
IF sleep_log for yesterday = null (no log submitted)
  THEN cycles_yesterday = null
  THEN DO NOT trigger RULE-CYCLES-01 (CRP from short night)
  // Reason: absence of log ≠ short night. Missing data is not evidence of a problem.
  THEN output: gentle prompt "Log last night to keep your week on track."
  // Do not alarm; do not assume a bad night

IF >= 3 consecutive days have null sleep logs
  THEN suppress weekly balance display
  THEN output: "We need more data to track your week. Log a couple of nights to get going."
```

### 8.2 Missing Chronotype

```
IF profile.chronotype = "Unknown" (not set during onboarding)
  THEN apply AMer baseline scheduling (more conservative; less problematic)
  THEN suppress: RULE-ARP-02 (social jet lag) — cannot fire without chronotype
  THEN suppress: RULE-CHRONO-01 (late exercise risk)
  THEN output: prompt to complete chronotype self-assessment
  COACHING: "Tell us whether you're a morning or evening person — it changes your plan."

IF profile.chronotype = "In-betweener"
  THEN apply AMer baseline as default
  THEN note: chronotype will be calibrated from 4+ weeks of logged data (V2)
```

### 8.3 Missing CRP Log

```
IF daily_log.crp_taken = null (not logged)
  THEN crp_cycle_credited = 0
  THEN weekly_total does not include a CRP for that day
  // Conservative default: no credit for unlogged CRPs

IF daily_log.crp_taken = false (explicitly not taken)
  THEN crp_cycle_credited = 0
  THEN trigger RULE-CYCLES-01 check: should a CRP be recommended?

// Missing ≠ not taken. The engine distinguishes:
//   null = not logged (no action — prompt to log)
//   false = explicitly skipped (evaluate if CRP needed)
```

### 8.4 Missing Onset Latency

```
IF sleep_log.onset_latency_minutes = null
  THEN onset_latency_flag = null  // unknown, not false
  THEN cannot detect US-07 from latency signal alone
  THEN rely on user_reported_anxiety for US-07 detection
  THEN output: "How long did it take to fall asleep? [<5 / 5-15 / 15-30 / 30+]"
  // Simple 4-bucket input is sufficient; exact minutes not required
```

### 8.5 Missing Environment Context

```
IF environment = null
  THEN suppress: US-11 state detection
  THEN suppress: REC-09, REC-10, REC-11 (environment recommendations)
  THEN output: onboarding prompt to complete environment profile
  // Do not guess environment conditions from log data
```

### 8.6 Missing Caffeine Data

```
IF daily_logs[].caffeine_after_cutoff all = null
  AND profile.caffeine_use = null
  THEN cannot detect US-10 from log data
  THEN US-10 only detectable from explicit user self-report
  // No caffeine recommendations generated without data
  // Prompt during onboarding: "How much caffeine do you usually drink?"
```

### 8.7 Missing Wake Time

```
IF sleep_log.wake_time = null
  THEN arp_maintained = null  // unknown
  THEN cannot compute wake_variance for US-04
  THEN DO NOT include day in ARP stability calculation

IF sleep_log.actual_sleep_onset = null
  THEN cycles_from_formula = null
  THEN cycles_completed falls back to user self-report only
  THEN if self-report also null: cycles_yesterday = null (see 8.1)
```

### 8.8 Missing Event Context

```
IF events = empty (no events logged)
  THEN skip all event-based rule evaluations
  THEN cycle_floor_override = null (use standard floor)
  THEN US-06, US-15, US-16 cannot be auto-detected
  // These states require explicit user logging of a disruption event
```

---

## 9. MVP RULE SET

The following is the minimum rule set required to produce a functional first release. All rules below must be implemented before launch. Rules not listed here can be deferred to V2.

### 9.1 MVP Rules

| Rule ID | Name | Blocking if absent |
|---------|------|--------------------|
| VALIDATE-01 | ARP gate | Yes — core gate |
| VALIDATE-02 | ARPConfig freshness | Yes — all calculations depend on it |
| VALIDATE-03 | New user onboarding gate | Yes |
| RULE-ARP-01 | ARP commitment gate and instability | Yes |
| RULE-ONSET-01 | Sleep onset scheduling | Yes — core output |
| RULE-ONSET-02 | Missed onset handler | Yes |
| RULE-ONSET-03 | 15-minute rule | Yes (US-07 pathway) |
| RULE-CYCLES-01 | Short night CRP trigger | Yes — core weekly accounting |
| RULE-CYCLES-02 | Weekly deficit escalation | Yes |
| RULE-CYCLES-03 | CRP validity and credit | Yes |
| RULE-ARP-02 | Social jet lag detection (PMer) | No — important but not blocking |
| RULE-ARP-03 | Post-disruption ARP hold | Yes |
| RULE-INTV-01 | Intervention hierarchy gate | Yes — prevents product recommendations before framework |
| RULE-CRP-01 | CRP scheduling (full form) | Yes |
| RULE-CRP-02 | CRP stigma response | No |
| RULE-MRM-01 | MRM reminders | Yes — daily polyphasic rhythm |
| RULE-ENV-02 | Blackout without DWS flag | No |
| RULE-ENV-03 | Temperature protocol | No — requires environment data |
| RULE-ENV-04 | Phase 3 light protocol | Yes (US-08 pathway) |
| RULE-RISK-001 | Sleep anxiety response | Yes — highest priority state |
| RULE-RISK-002 | Ortho-insomnia response | Yes |
| RULE-RISK-003 | Stimulant response | No |
| RULE-WAKE-01 | 2–3am waking protocol | Yes |
| Missing data handlers (8.1–8.8) | All | Yes — graceful degradation required |

### 9.2 MVP State Detection

| State | MVP Required | Notes |
|-------|-------------|-------|
| US-01 Aligned | Yes | Defines the positive baseline |
| US-02 Mild Deficit | Yes | Most common state |
| US-03 Significant Deficit | Yes | Escalation from US-02 |
| US-04 ARP Instability | Yes | Gate state |
| US-05 Chronotype Conflict | Yes | Persistent structural flag |
| US-06 Post-Disruption | Yes | Requires event context logging |
| US-07 Sleep Anxiety Loop | Yes | Highest priority |
| US-08 Electronic Insomnia | Yes | High prevalence |
| US-09 Ortho-Insomnia | Yes | Tracker users |
| US-10 Stimulant Compensation | Partial | Requires caffeine logging |
| US-11 Environmental Friction | Yes | Requires environment profile |
| US-12 Framework Gap | Yes | Onboarding state |
| US-13 Sleep Noise | No | V2 |
| US-14 In-Betweener Fog | No | V2 |
| US-15 Pre-Event | Yes | Requires event context |
| US-16 Illness / Injury | Yes | Requires event context |
| US-17 Shift Work | No | V2 |

### 9.3 MVP Recommendations

| Rec | MVP | Delivery Channel |
|-----|-----|-----------------|
| REC-01 ARP Commitment | Yes | Onboarding gate, every session |
| REC-02 Sleep Onset | Yes | Morning, daily |
| REC-03 CRP Scheduling | Yes | Morning after short night |
| REC-04 MRM Introduction | Yes | Onboarding |
| REC-05 MRM Reminders | Yes | Cycle boundaries |
| REC-06 Post-Sleep Routine | Yes | ARP trigger |
| REC-07 Morning Light | Yes | ARP trigger |
| REC-08 Phase 3 Wind-Down | Yes | Phase 3 boundary |
| REC-09 Evening Light | Yes | Phase 3 / US-08 |
| REC-10 Temperature | Partial | Requires environment data |
| REC-11 Environment Audit | Partial | Requires environment data |
| REC-12 Chronotype Adjustment | Partial | Only if flexible schedule |
| REC-13 Cycle Reframe | Yes | US-07 / US-12 |
| REC-14 Weekly Review | Yes | End of week |
| REC-15 15-Min Rule | Yes | US-07 / latency signal |
| REC-16 2–3am Protocol | Yes | Night waking signal |
| REC-17 Caffeine Timing | Partial | Requires caffeine data |
| REC-18 Tracker Calibration | Yes | US-09 |
| REC-19 Sleep Restriction | No | V2 — too advanced for MVP |
| REC-20 Framework Reset | Yes | Onboarding gate |
| REC-21 Social Jet Lag | Yes | US-05 |
| REC-22 Post-Disruption | Yes | US-06 |
| REC-23 Pre-Event Arousal | Yes | US-15 |
| REC-24 Illness Mode | Yes | US-16 |
| REC-25 Recovery Day | Yes | US-02/03 mid-week |
| REC-26 Travel Setup | Partial | US-06 travel variant |

---

## 10. V2 RULE SET

The following rules are deferred because they either require additional data, additional features, or are too edge-case for the first release.

### 10.1 V2 Rules

| Rule | Why Deferred |
|------|-------------|
| RULE-CHRONO-01 (Late exercise risk) | Requires `exercise_start_time` in daily log — not collected in MVP |
| RULE-CHRONO-02 / 03 (PMer task scheduling) | Requires occupation schedule data and calendar integration |
| RULE-SR-01 (Sleep restriction) | High stakes; requires 14-day monitoring window; use sparingly |
| RULE-ENV-01 detailed product recommendations | Requires established framework + product partner integration |
| RULE-INTV-02 (Nose breathing / Buteyko stance) | Stance confirmed; no protocol; defer content creation |
| RULE-TRAVEL-01/02 full logic | Requires timezone detection and event context (can be partial in MVP) |
| Shift work rules (RULE-ARP dual-ARP) | US-17 deferred; requires dual-ARP mode in data model |
| Chronotype calibration from data | Requires 4+ weeks of logged data; `chronotype_confidence` tracking |

### 10.2 V2 States

| State | Why Deferred |
|-------|-------------|
| US-13 Sleep Noise Exposure | Requires user content consumption signals; hard to auto-detect |
| US-14 In-Betweener Fog | Requires 4+ weeks of data to distinguish from PMer |
| US-17 Shift Work / Multishift | Dual-ARP mode adds complexity; deferred to V2 |

### 10.3 V2 Recommendations

| Rec | What Unlocks It |
|-----|----------------|
| REC-12 full (chronotype refinement after 4 weeks) | `chronotype_confidence` = "calibrated" after data accumulation |
| REC-19 Sleep Restriction | 14-day monitoring; clinical caution; US-07 hard suppression logic |
| REC-26 full travel setup | EventContext with full travel data; timezone detection |

---

## Engine Specification Report

### 1. Number of Rules Formalised

| Category | Count |
|----------|-------|
| Validation rules (pre-engine gates) | 3 |
| ARP and onset scheduling rules | 5 (RULE-ARP-01/02/03, RULE-ONSET-01/02/03) |
| Cycle accounting rules | 3 (RULE-CYCLES-01/02/03) |
| Chronotype rules | 3 (RULE-CHRONO-01/02/03) |
| Environment rules | 4 (RULE-ENV-01/02/03/04) |
| Intervention hierarchy | 1 (RULE-INTV-01) |
| CRP rules | 2 (RULE-CRP-01/02) |
| MRM rule | 1 (RULE-MRM-01) |
| Sleep restriction | 1 (RULE-SR-01) |
| Waking protocols | 1 (RULE-WAKE-01) |
| Risk pattern rules | 3 (RULE-RISK-001/002/003) |
| Travel rules | 2 (RULE-TRAVEL-01/02) |
| Missing data handlers | 8 |
| Conflict resolution rules | 6 named scenarios |
| **Total** | **~43 rules** |

### 2. MVP-Critical States Covered

All 14 MVP states are fully specified:
US-01, US-02, US-03, US-04, US-05, US-06, US-07, US-08, US-09, US-10 (partial), US-11, US-12, US-15, US-16

US-13, US-14, US-17 are deferred to V2.

### 3. MVP-Critical Recommendations Covered

All 26 recommendations have specified trigger conditions, timing, priority, and coaching message. Of these:
- **19 are fully ready for MVP** (REC-01 through REC-18, REC-20 through REC-26 minus REC-19)
- **4 are partial** (REC-10, REC-11, REC-12, REC-26 — depend on optional data)
- **1 is V2** (REC-19 — sleep restriction; too advanced and high-risk for first release)

### 4. Logic Still Too Ambiguous for Implementation

| Item | Issue | Recommended Resolution |
|------|-------|------------------------|
| **Onset latency detection** | US-07 (highest priority state) requires `onset_latency_minutes` but this field is marked optional. Without it, the most important state can only be detected via explicit user report. | Treat onset latency as soft-required. In the onboarding flow, ask "how long does it take to fall asleep?" as a 4-bucket selection (< 5min / 5–15 / 15–30 / 30+). This provides enough signal without demanding exact minutes. |
| **"MRM established" threshold** | RULE-INTV-01 gates product recommendations on `mrm_established = true`, but the threshold (mean ≥ 3/day for 7 days) is an engineering decision not explicitly confirmed in source material. | Implement as defined above. Treat as a product decision with a conservative default. |
| **Week boundary definition** | The canonical system uses a 7-day rolling week but does not specify start day. Rolling from ARP commitment vs Monday–Sunday is a product choice. | Define rolling from ARP commitment date for MVP consistency. Add calendar-week option as a V2 setting. |
| **Recommendation cap at 5** | The cap of 5 active recommendations per session is an engineering constraint not in the source material. It prevents overwhelm but needs validation with user research. | Use 5 as MVP default; allow tuning after user testing. Priority 1 recommendations (REC-01, REC-20) are exempt from the cap. |
| **Consecutive nights threshold for US-03** | The "3+ consecutive nights at < 4 cycles" trigger is inferred from the weekly accounting logic, not an explicit Nick statement. | Use as defined; flag as an engineering inference in the codebase. Validate after 4 weeks of usage data. |
