# R90 Engine Simulation Tests

**Version:** 1.0
**Date:** 2026-03-11
**Status:** Engineering-ready — run before building any UI
**Depends on:** `R90_RULE_ENGINE_SPEC.md` (v1.0), `R90_DATA_MODEL.md` (v1.0), `R90_BACKEND_API_CONTRACT.md` (v1.0)
**Audience:** Backend engineers and QA responsible for implementing the R90 rule engine

**How to read this document:**
- Each test has an `INPUT` block (the EngineContext fed to the engine) and an `EXPECTED OUTPUT` block
- `PASS` = engine returns exactly the expected states and recommendations
- `FAIL` = any deviation — wrong state, wrong rec, unexpected suppression, missing suppression
- Test IDs are prefixed: `SIM-` (scenario), `GATE-` (validation), `ACCT-` (accounting), `SAFE-` (anxiety safety)

---

## 1. TESTING GOAL

### What the Simulations Validate

These tests verify that the R90 rule engine:

1. **Detects the correct user state** for each recovery situation, using only the data present in the `EngineContext`
2. **Generates the correct recommendations** — right type, right timing, right priority
3. **Suppresses the right recommendations** under anxiety, cooldown, and framework-gate conditions
4. **Applies conflict resolution correctly** — particularly US-07 tone override vs US-03 deficit logic
5. **Handles missing data safely** — null logs produce conservative defaults, never false alarms
6. **Enforces the validation gates** — VALIDATE-01 (no ARP), VALIDATE-02 (stale config), VALIDATE-03 (no logs)
7. **Computes weekly accounting accurately** — 35-cycle target, 28-cycle floor, CRP credit, deficit risk flag

### What These Tests Are NOT

- They are not UI tests — the engine is tested in isolation
- They are not integration tests — the engine receives a pre-assembled `EngineContext`; database reads are not tested here
- They do not test copy rendering — recommendation `message` content is not verified in these tests, only the `rec_type` and key structured fields

### Definition of a Passing Test Suite

The engine is considered launch-ready when:
- All 8 MVP-critical tests (Section 7) pass without any deviation
- All 6 anxiety safety tests (Section 6) pass with zero false positives
- All 5 validation gate tests (Section 4) return exactly the specified gate responses
- All 8 weekly accounting tests (Section 5) produce correct balance calculations

---

## 2. CORE TEST SCENARIOS

The 10 primary scenarios cover the most common and highest-risk user situations. Each scenario runs the full engine pipeline: pre-validation → state detection → recommendation generation → conflict resolution → cooldown application.

---

### SIM-01 — Aligned User

**Scenario description:** User has maintained ARP, met the weekly cycle target, taken CRPs, and has no risk states active. Engine should recognise a well-functioning recovery structure.

**User Profile:**
```
user_id:          "sim-01"
arp_time:         "06:30"
arp_committed:    true
chronotype:       "AMer"
cycle_target:     5
crp_available:    true
tracker_in_use:   false
onboarding_completed: true
```

**ARPConfig (pre-computed from ARP 06:30):**
```
sleep_onset_5cycle: "23:00"
crp_window_open:    "14:00"
crp_window_close:   "18:30"
mrm_times:          ["08:00","09:30","11:00","12:30","14:00","15:30","17:00","18:30","20:00","21:30"]
```

**Sleep Logs (last 7 days):**
```
Day 1: cycles=5, wake_time="06:30", onset_latency_minutes=12
Day 2: cycles=5, wake_time="06:30", onset_latency_minutes=10
Day 3: cycles=5, wake_time="06:30", onset_latency_minutes=8
Day 4: cycles=5, wake_time="06:28", onset_latency_minutes=11
Day 5: cycles=5, wake_time="06:30", onset_latency_minutes=14
Day 6: cycles=5, wake_time="06:32", onset_latency_minutes=9
Day 7: cycles=5, wake_time="06:30", onset_latency_minutes=12
```

**Daily Logs (last 7 days):**
```
All days: crp_taken=false, mrm_count=5
```

**Weekly Balance:**
```
total_nocturnal_cycles: 35
total_crp_cycles:       0
weekly_cycle_total:     35
cycle_deficit:          0
day_number:             7
arp_variance_minutes:   4
arp_stable:             true
on_track:               true
deficit_risk_flag:      false
```

**Event Context:** `[]` (none)

**EXPECTED OUTPUT:**
```
active_states:          ["US-01"]
tone_override_active:   false
gate_blocked:           false

recommendations (ordered by priority):
  [0] rec_type: "REC-05"   // MRM Daily Reminders — ongoing maintenance
      priority: "MEDIUM"

MUST NOT contain: REC-03, REC-14, REC-07, REC-08, REC-19
```

**Pass Conditions:**
- US-01 is the only active state
- No deficit or structural recs fire
- No outcome suppression flags set

---

### SIM-02 — Mild Cycle Deficit with CRP Trigger

**Scenario description:** User completed 3 cycles last night. Week is on day 4 with a manageable deficit. Engine should detect US-02 and immediately recommend a CRP for today within the Phase 2 window.

**User Profile:**
```
user_id:       "sim-02"
arp_time:      "06:30"
arp_committed: true
chronotype:    "PMer"
cycle_target:  5
crp_available: true
onboarding_completed: true
```

**Sleep Logs:**
```
Day 1: cycles=5
Day 2: cycles=5
Day 3: cycles=5
Day 4 (yesterday): cycles=3, wake_time="06:30", onset_latency_minutes=14
Day 5–7: null (not yet)
```

**Daily Logs:**
```
Days 1–3: crp_taken=false, mrm_count=5
Day 4: crp_taken=false, mrm_count=4
```

**Weekly Balance:**
```
total_nocturnal_cycles: 18
total_crp_cycles:       0
weekly_cycle_total:     18
cycle_deficit:          17
day_number:             4
on_track:               true
deficit_risk_flag:      false  // day_number < 5; threshold not met yet
```

**Current time:** 09:15 (Phase 1 — CRP window not open yet)

**EXPECTED OUTPUT:**
```
active_states:          ["US-02"]
tone_override_active:   false

recommendations (ordered by priority):
  [0] rec_type: "REC-03"
      priority: "HIGH"
      deliver_at: [today at 14:00]  // crp_window_open
      expires_at: [today at 18:30]  // crp_window_close
      action_payload: { crp_start: "14:00", duration_min: 30 }

  [1] rec_type: "REC-02"
      priority: "HIGH"
      // Tonight's sleep onset target
```

**Pass Conditions:**
- US-02 active (not US-03 — deficit not > 7 on day 4)
- REC-03 fires with `deliver_at` = 14:00 (crp_window_open, since current_time 09:15 is before it)
- US-03 NOT active

**Edge case to verify:** If `current_time` = 15:00 (past crp_window_open), `crp_start` must be `MAX(15:00, 14:00) = 15:00`, not 14:00.

---

### SIM-03 — Significant Cycle Deficit

**Scenario description:** User has had 3 consecutive nights at 3 cycles, and it is day 6 of the week. Both triggers for US-03 are met: consecutive low nights AND deficit > 7 by day 5.

**User Profile:**
```
user_id:       "sim-03"
arp_time:      "06:30"
arp_committed: true
chronotype:    "AMer"
cycle_target:  5
crp_available: true
onboarding_completed: true
```

**Sleep Logs (last 7 days):**
```
Day 1: cycles=5
Day 2: cycles=5
Day 3: cycles=4
Day 4: cycles=3
Day 5: cycles=3
Day 6 (yesterday): cycles=3
Day 7: null (today; not yet logged)
```

**Daily Logs:**
```
Days 1–6: crp_taken=false, mrm_count=3 (low)
```

**Weekly Balance:**
```
total_nocturnal_cycles: 23
total_crp_cycles:       0
weekly_cycle_total:     23
cycle_deficit:          12
day_number:             6
on_track:               false
deficit_risk_flag:      true   // deficit (12) > 7 AND day_number (6) >= 5
```

**EXPECTED OUTPUT:**
```
active_states: ["US-03"]
// US-02 must NOT be active (US-03 supersedes)

recommendations:
  [0] rec_type: "REC-03"
      priority: "HIGH"
      // CRP for today

  [1] rec_type: "REC-14"
      priority: "MEDIUM"
      // Weekly Balance Review — deficit exposed

  [2] rec_type: "REC-04"
      priority: "HIGH"
      // MRM Introduction / reinforcement (low mrm_count detected: mean = 3 < threshold)

MUST NOT contain: REC-19  // sleep restriction not fired before 14 days
MUST NOT contain: US-02   // superseded
```

**Pass Conditions:**
- US-03 active, US-02 NOT active
- `deficit_risk_flag = true`
- REC-19 suppressed (insufficient app age; first 14 days suppression rule also applies)
- At most 3 recommendations returned (cap of 5, but structural reason limits here)

---

### SIM-04 — Sleep Anxiety Loop (US-07)

**Scenario description:** User has reported onset latency > 30 minutes on 3 of the last 5 nights. US-07 fires. All outcome metrics are suppressed, REC-19 is hard-suppressed, and the engine redirects to process-only recommendations.

**User Profile:**
```
user_id:          "sim-04"
arp_time:         "06:30"
arp_committed:    true
chronotype:       "AMer"
cycle_target:     5
onboarding_completed: true
```

**Sleep Logs (last 5 days):**
```
Day 1: cycles=4, onset_latency_minutes=35, night_waking_2_to_4am=true
Day 2: cycles=4, onset_latency_minutes=20
Day 3: cycles=3, onset_latency_minutes=42
Day 4: cycles=4, onset_latency_minutes=38
Day 5 (yesterday): cycles=4, onset_latency_minutes=15
```

Consecutive high latency (> 30 min) in last 5: days 1, 3, 4 → count = 3 → threshold met.

**Daily Logs:**
```
Days 1–5: crp_taken=false, mrm_count=4
```

**Weekly Balance:**
```
total_nocturnal_cycles: 19
cycle_deficit:          16
day_number:             5
deficit_risk_flag:      true  // deficit (16) > 7 AND day 5 >= 5
```

**EXPECTED OUTPUT:**
```
active_states: [
  { id: "US-07", priority: 1 },
  { id: "US-03", priority: 2 }
]

tone_override_active:       true
suppress_outcome_metrics:   true

// US-03 continues to run structurally, but tone is overridden by US-07

recommendations:
  [0] rec_type: "REC-15"    // 15-Minute Rule
      priority: "HIGH"

  [1] rec_type: "REC-16"    // 2–3am Waking Protocol (triggered by night_waking_2_to_4am on day 1)
      priority: "HIGH"

  [2] rec_type: "REC-13"    // Cycle Count Reframe
      priority: "MEDIUM"

  [3] rec_type: "REC-08"    // Phase 3 Wind-Down
      priority: "HIGH"

MUST NOT contain: REC-19   // hard suppression: never fire while US-07 active
MUST NOT contain: REC-14   // weekly balance review suppressed (outcome metric)
MUST NOT contain: REC-18   // tracker rec suppressed (tracker not in use AND anxiety override)

flags:
  show_cycle_count:    false
  show_weekly_balance: false
```

**Pass Conditions:**
- US-07 priority = 1, tone_override = true
- REC-19 is absent from recommendations AND in `suppressed_recommendations` list
- `show_weekly_balance = false` in the home screen flags
- US-03 detected (deficit is real) but its recommendations are process-framed, not outcome-framed
- Recommendation count ≤ 5

---

### SIM-05 — PMer with Constrained ARP (Social Jet Lag)

**Scenario description:** Confirmed PMer on an early ARP forced by their job. No other risk states. Engine should detect US-05 and surface Social Jet Lag education without suggesting the user change their ARP.

**User Profile:**
```
user_id:              "sim-05"
arp_time:             "06:00"    // earlier than PMer threshold of 07:00
arp_committed:        true
chronotype:           "PMer"
cycle_target:         5
occupation_schedule:  "standard"  // not flexible → suppress ARP-shift suggestion
onboarding_completed: true
```

**Sleep Logs (last 7 days):**
```
Days 1–7: cycles=5, onset_latency_minutes=15, wake_time="06:00"
```

**Weekly Balance:**
```
weekly_cycle_total: 35
cycle_deficit:      0
arp_stable:         true
```

**EXPECTED OUTPUT:**
```
active_states: ["US-05"]
// US-01 must NOT be active (US-05 is active; priority 3 > US-01's priority 5)

recommendations:
  [0] rec_type: "REC-21"    // Social Jet Lag Acknowledgement
      priority: "MEDIUM"
      // One-time education card; 30-day cooldown after delivery

  [1] rec_type: "REC-12"    // Chronotype Schedule Adjustment
      priority: "MEDIUM"
      // Protect peak window (afternoon); task timing guidance

MUST NOT contain:
  - ARP-shift suggestion (occupation_schedule = "standard" → suppress)
  - REC-19 (no deficit; not triggered)

flags:
  social_jet_lag_flag: true
  arp_shift_suggested: false
```

**Pass Conditions:**
- US-05 fires because `chronotype = PMer` AND `arp_time (06:00) < 07:00`
- ARP shift is NOT suggested (occupation_schedule = "standard")
- REC-21 cooldown is 30 days — after first delivery, does not re-fire until 30 days later
- US-01 NOT active (US-05 is present)

---

### SIM-06 — Pre-Event High Arousal (V2 boundary)

**Scenario description:** User logs a pre-event tonight before a high-stakes competition tomorrow. Onset latency is elevated due to anticipation. Engine should detect US-15 and suppress deficit framing.

**User Profile:**
```
user_id:       "sim-06"
arp_time:      "06:30"
arp_committed: true
chronotype:    "AMer"
cycle_target:  5
onboarding_completed: true
```

**Sleep Logs (last 7 days):**
```
Days 1–6: cycles=5
Day 7 (tonight): not yet logged
```

**Daily Logs:**
```
Days 1–6: crp_taken=true (1 CRP this week already), mrm_count=5
```

**Event Context:**
```
event_type:  "pre_event"
severity:    "significant"
start_date:  today
end_date:    tomorrow
active:      true
```

**Weekly Balance:**
```
total_nocturnal_cycles: 30
total_crp_cycles:       1
weekly_cycle_total:     31
cycle_deficit:          4
day_number:             6
on_track:               true
```

**EXPECTED OUTPUT:**
```
active_states: ["US-15"]

recommendations:
  [0] rec_type: "REC-23"    // Pre-Event Arousal Protocol
      priority: "HIGH"
      // Key: CRP this afternoon, calm evening, ARP held tomorrow

MUST NOT contain:
  - "go to bed earlier" recommendation
  - deficit warnings / deficit framing
  - REC-03 framed as "you had a short night" (the night hasn't happened yet)

action_payload (in REC-23):
  push_crp: true
  crp_time: [earliest available Phase 2 slot today]
  arp_hold_reminder: true
  suppress_deficit_framing: true
```

**Pass Conditions:**
- US-15 fires from active pre_event EventContext
- REC-23 is the primary recommendation
- No deficit language surfaces even though cycle deficit = 4
- ARP hold message included

**Note:** US-15 is listed as MVP in R90_RULE_ENGINE_SPEC.md (Pass 5). Verify implementation scope — deferred to V2 in the app spec. This test is in the V2 pack but is included here for completeness.

---

### SIM-07 — Illness Recovery Mode (V2 boundary)

**Scenario description:** User self-reports illness. An active illness EventContext is present. Engine should switch to polyphasic recovery mode, suspend normal weekly targets, and stop firing deficit alerts.

**User Profile:**
```
user_id:       "sim-07"
arp_time:      "06:30"
arp_committed: true
chronotype:    "AMer"
cycle_target:  5
onboarding_completed: true
```

**Sleep Logs (last 4 days):**
```
Day 1 (pre-illness): cycles=5
Day 2 (sick): cycles=3
Day 3 (sick): cycles=2
Day 4 (sick, yesterday): cycles=2
```

**Daily Logs:**
```
Day 2–4: crp_taken=true, crp_duration_minutes=45, mrm_count=3
```

**Event Context:**
```
event_type: "illness"
severity:   "moderate"
start_date: 3 days ago
end_date:   null  // ongoing
active:     true
```

**Weekly Balance:**
```
total_nocturnal_cycles: 12
total_crp_cycles:       3
weekly_cycle_total:     15
cycle_deficit:          20
day_number:             4
deficit_risk_flag:      false  // day_number < 5 (threshold not met)
```

**EXPECTED OUTPUT:**
```
active_states: ["US-16"]
// US-03 must NOT activate — illness mode overrides deficit triggering

recommendations:
  [0] rec_type: "REC-24"    // Illness Recovery Mode
      priority: "MEDIUM"
      // Polyphasic recovery guidance; extended CRP; environment

Engine modifiers while US-16 active:
  effective_crp_window: "any phase"  // not restricted to Phase 2
  effective_cycle_target: 6          // push toward max recovery
  suppress: cycle deficit warnings
  suppress: normal weekly targets display
  medical_disclaimer: true

MUST NOT contain: REC-03 with deficit framing
MUST NOT contain: deficit alert or on_track = false warning
```

**Pass Conditions:**
- US-16 fires from active illness EventContext
- Normal deficit rules are suspended
- CRP is not restricted to Phase 2 window
- Medical disclaimer flag is set

---

### SIM-08 — Shift Worker (V2 only)

**Scenario description:** User is a night-shift worker with `multishift_enabled = true`. Engine should use ARP2 (18:00) for cycle calculations, not the standard ARP.

**User Profile:**
```
user_id:          "sim-08"
arp_committed:    true
multishift_enabled: true
active_shift:     "night"
shift_arp_day:    "06:00"
shift_arp_night:  "18:00"
chronotype:       "PMer"
cycle_target:     5
```

**Sleep Logs:**
```
Yesterday: cycles=4, wake_time="18:00"
```

**EXPECTED OUTPUT:**
```
active_states: ["US-17"]

active_arp:  "18:00"  // not 06:00
arp_config used: generated from 18:00

cycle_times[1]: "18:00"
cycle_times[7]: "03:00"   // C7 = 18:00 + 9h = 03:00
crp_window:     night-shift specific CRP at C7 = 03:00

recommendations:
  [0] rec_type: "REC-03"  // CRP for tonight (cycles=4 yesterday)
      crp_time: "03:00"   // C7 from ARP2 18:00

MUST NOT use ARP 06:00 for any calculation
```

**Pass Conditions:**
- ARPConfig is regenerated from `shift_arp_night = 18:00`
- All cycle times, phase boundaries, and CRP window derive from 18:00, not 06:00
- US-17 is active

**Note:** V2 only. Include in V2 test pack.

---

### SIM-09 — Missing Data (Null Cycle Log)

**Scenario description:** User submitted a check-in but did not provide a cycle count (`cycles_completed = null`). Engine must NOT infer a bad night. No CRP should be triggered from a missing log.

**User Profile:**
```
user_id:       "sim-09"
arp_time:      "06:30"
arp_committed: true
chronotype:    "AMer"
cycle_target:  5
onboarding_completed: true
```

**Sleep Logs:**
```
Day 1: cycles=5
Day 2: cycles=5
Day 3: cycles=5
Day 4 (yesterday): cycles=null, wake_time="06:30", onset_latency_minutes=null
```

**Weekly Balance (before yesterday's log):**
```
total_nocturnal_cycles: 15
total_crp_cycles:       0
weekly_cycle_total:     15
cycle_deficit:          20
day_number:             4
```

**EXPECTED OUTPUT:**
```
active_states: ["US-02"]  // deficit exists from prior nights, but day_number=4 < 5

// Missing log handling:
cycles_completed_yesterday: null   // NOT coerced to 0
// No CRP triggered BECAUSE of the null log
// CRP MAY be triggered because of the prior accumulated deficit — but NOT from "yesterday was bad"

recommendations:
  [0] rec_type: "REC-02"    // Tonight's sleep onset — always available
      priority: "HIGH"

MUST NOT trigger REC-03 with message framing "last night was short"
// REC-03 may fire from the weekly deficit, but not from the missing log itself
```

**Critical pass condition:**
```
IF reason for REC-03 = "cycles_yesterday < 4"
  THEN TEST FAILS  // null log must not trigger RULE-CYCLES-01
```

---

### SIM-10 — No Logs at All (VALIDATE-03)

**Scenario description:** New user, one day post-onboarding. No sleep logs or daily logs have been submitted. VALIDATE-03 must fire and return the onboarding recommendation set only.

**User Profile:**
```
user_id:       "sim-10"
arp_time:      "06:30"
arp_committed: true   // ARP committed during onboarding
chronotype:    "PMer"
cycle_target:  5
onboarding_completed: false  // still in framework introduction
```

**Sleep Logs:** `[]` (empty array)

**Daily Logs:** `[]` (empty array)

**Weekly Balance:**
```
total_nocturnal_cycles: 0
total_crp_cycles:       0
weekly_cycle_total:     0
cycle_deficit:          35
day_number:             1
deficit_risk_flag:      false  // day_number (1) < 5
```

**EXPECTED OUTPUT:**
```
gate_blocked: false   // VALIDATE-03 does not block; returns onboarding set
active_states: ["US-12"]

recommendations:
  [0] rec_type: "REC-20"  // Framework Reset / Introduction
  [1] rec_type: "REC-01"  // ARP Commitment reconfirm
  [2] rec_type: "REC-04"  // MRM Introduction
  [3] rec_type: "REC-06"  // Post-Sleep Routine Introduction

MUST NOT contain:
  - REC-03  // no CRP from zero cycles on day 1
  - REC-14  // no weekly review (no data)
  - US-03   // deficit alert suppressed — new user, no data

flags:
  show_weekly_balance: false  // nothing to show
  show_cycle_count:    false  // nothing to show
```

**Pass Conditions:**
- US-12 is the only active state
- Deficit state (US-03) does NOT fire despite cycle_deficit = 35
- Day plan IS available (computed from ARPConfig alone — no log dependency)

---

## 3. FULL SCENARIO MATRIX

Summary of all 10 core scenarios:

| Test ID | State Expected | Primary Rec | Key Suppression | MVP |
|---------|---------------|-------------|-----------------|-----|
| SIM-01 | US-01 | REC-05 | None | Yes |
| SIM-02 | US-02 | REC-03 (CRP at 14:00) | None | Yes |
| SIM-03 | US-03 | REC-03 + REC-14 | REC-19 | Yes |
| SIM-04 | US-07 + US-03 | REC-15 + REC-16 + REC-13 | REC-19, outcome metrics | Yes |
| SIM-05 | US-05 | REC-21 + REC-12 | ARP-shift (occupation constraint) | Yes |
| SIM-06 | US-15 | REC-23 | Deficit framing | V2 |
| SIM-07 | US-16 | REC-24 | Deficit alerts, target display | V2 |
| SIM-08 | US-17 | REC-03 (at 03:00) | Standard ARP | V2 |
| SIM-09 | US-02 | REC-02 | REC-03 from null log | Yes |
| SIM-10 | US-12 | REC-20 + REC-01 + REC-04 | US-03, REC-14 | Yes |

---

## 4. VALIDATION GATE TESTS

These tests verify the three pre-engine validation gates. They run before state detection and can short-circuit the full evaluation pipeline.

---

### GATE-01 — No ARP Committed (VALIDATE-01)

**Input:**
```
profile.arp_committed: false
profile.arp_time:      null
```

**EXPECTED OUTPUT:**
```
gate_blocked:  true
gate_reason:   "no_arp_committed"
active_states: ["US-12", "US-04"]

recommendations:
  [0] rec_type: "REC-01"   // ARP Commitment — critical
  [1] rec_type: "REC-20"   // Framework Reset

// Engine stops here — no further state evaluation
MUST NOT contain: any scheduling recommendation (REC-02, REC-03, REC-05)
```

**Pass Condition:** Engine returns after VALIDATE-01 without evaluating any other rules.

---

### GATE-02 — ARP Config Stale (VALIDATE-02)

**Input:**
```
profile.arp_time:            "07:00"   // user changed ARP
profile.updated_at:          "2026-03-12T10:00:00Z"
arp_config.arp_time:         "06:30"   // config not yet regenerated
arp_config.generated_at:     "2026-03-11T09:00:00Z"  // older than profile.updated_at
```

**EXPECTED OUTPUT:**
```
// Engine detects: arp_config.generated_at < profile.updated_at
// Action: regenerate arp_config from profile.arp_time = "07:00"

arp_config regenerated: true
new_arp_config.arp_time:         "07:00"
new_arp_config.sleep_onset_5cycle: "23:30"
new_arp_config.crp_window_open:    "14:30"

// Engine continues with updated config
gate_blocked: false
```

**Pass Condition:** Engine regenerates the ARPConfig from the new ARP before proceeding. All subsequent rule evaluations use the new config.

---

### GATE-03 — No Sleep Logs (VALIDATE-03)

**Input:**
```
profile.arp_committed:     true
profile.arp_time:          "06:30"
sleep_logs:                []
daily_logs:                []
```

**EXPECTED OUTPUT:**
```
gate_blocked: false
active_states: ["US-12"]

recommendations: ["REC-20", "REC-01", "REC-04", "REC-06"]

// Engine stops here — no state detection beyond US-12
```

**Pass Condition:** Engine returns the onboarding set and does not evaluate deficit or behavioural states.

---

### GATE-04 — Incomplete Onboarding

**Input:**
```
profile.arp_committed:         true
profile.onboarding_completed:  false
profile.chronotype:            null   // not yet collected
```

**EXPECTED OUTPUT:**
```
// Engine can run (ARP is committed)
// But chronotype-dependent states cannot be evaluated
active_states: ["US-12"]   // Framework Gap remains active

// States that cannot fire without chronotype:
// US-05 (Chronotype Conflict) — SKIPPED (no chronotype data)
// RULE-ARP-02 (Social Jet Lag) — SKIPPED

recommendations:
  [0] rec_type: "REC-01"   // ARP recommit / confirm
  [1] rec_type: "REC-04"   // MRM introduction

// Scheduling recs CAN fire because arp_time is known
  [2] rec_type: "REC-02"   // Tonight's onset
```

**Pass Condition:** Engine continues without chronotype but skips all chronotype-dependent rules. Does not throw an error for null chronotype.

---

### GATE-05 — ARP Instability Detection (VALIDATE after GATE-01 passes)

**Input:**
```
profile.arp_committed: true
profile.arp_time:      "06:30"
sleep_logs: [
  Day 1: wake_time="06:30"
  Day 2: wake_time="06:30"
  Day 3: wake_time="08:00"   // 90-minute deviation
  Day 4: wake_time="06:30"
  Day 5: wake_time="07:30"   // 60-minute deviation
]
```

**Wake variance calculation:**
```
wake_times = ["06:30", "06:30", "08:00", "06:30", "07:30"]
max = 08:00, min = 06:30 → variance = 90 minutes
90 > 30 → activate(US-04)
```

**EXPECTED OUTPUT:**
```
active_states: ["US-04"]
gate_blocked: false   // US-04 from variance does not block; it signals instability

recommendations:
  [0] rec_type: "REC-01"   // ARP recommitment prompt
      // "Your wake time has varied by 90 minutes this week. Hold your anchor."
```

**Pass Condition:** US-04 fires. Engine continues (does not stop). REC-01 fires as a recommitment prompt (not as the initial blocking gate).

---

## 5. WEEKLY ACCOUNTING TESTS

These tests verify the `WeeklyCycleBalance` computation and the deficit thresholds that trigger state escalation.

---

### ACCT-01 — 35-Cycle Target Hit Exactly

**Input:**
```
nocturnal_cycles: [5, 5, 5, 5, 5, 5, 5]
crp_cycles:       [0, 0, 0, 0, 0, 0, 0]
day_number:       7
```

**EXPECTED COMPUTATION:**
```
total_nocturnal_cycles: 35
total_crp_cycles:       0
weekly_cycle_total:     35
cycle_deficit:          0
on_track:               true
deficit_risk_flag:      false
```

**State check:** US-01 eligible (no deficit, arp_stable, mrm_count adequate).

---

### ACCT-02 — 28-Cycle Floor Hit Exactly

**Input:**
```
nocturnal_cycles: [4, 4, 4, 4, 4, 4, 4]
crp_cycles:       [0, 0, 0, 0, 0, 0, 0]
day_number:       7
```

**EXPECTED COMPUTATION:**
```
weekly_cycle_total:     28
cycle_deficit:          7
on_track:               false  // projected cannot reach 35 (already at 28, no more days)
deficit_risk_flag:      true   // deficit (7) is NOT > 7; it equals 7 → FALSE
```

**Critical check:**
```
deficit_risk_flag = (cycle_deficit > 7) AND (day_number >= 5)
                  = (7 > 7) AND (7 >= 5)
                  = false AND true
                  = false   // strict greater-than; deficit of exactly 7 does NOT flag
```

**Pass Condition:** `deficit_risk_flag = false` at deficit = 7. US-03 does NOT fire from deficit threshold alone (consecutive low nights test below takes it there instead).

---

### ACCT-03 — Deficit > 7, Day 5 (US-03 threshold met)

**Input:**
```
nocturnal_cycles: [4, 3, 4, 3, 3, 0, 0]  // days 6 and 7 not yet logged
crp_cycles:       [0, 0, 0, 0, 0, 0, 0]
day_number:       5
```

**EXPECTED COMPUTATION:**
```
total_nocturnal_cycles: 17
weekly_cycle_total:     17
cycle_deficit:          18
deficit_risk_flag:      true  // (18 > 7) AND (5 >= 5) → true

State: US-03 activates
```

---

### ACCT-04 — CRP Credit Boundary (20-min rule)

**Test A — exactly 20 minutes:**
```
crp_duration_minutes: 20
EXPECTED: crp_cycle_credited = true
```

**Test B — 19 minutes (just below):**
```
crp_duration_minutes: 19
EXPECTED: crp_cycle_credited = false
          // Message: "counts as an extended MRM — aim for 20+ next time"
```

**Test C — 30 minutes (standard):**
```
crp_duration_minutes: 30
EXPECTED: crp_cycle_credited = true
```

**Test D — CRP out of window:**
```
crp_start_time:       "19:30"   // after crp_window_close of 18:30
crp_duration_minutes: 30
EXPECTED:
  crp_in_window:     false
  crp_cycle_credited: true      // out-of-window CRP still counts — credit is not window-dependent
  // But note: coaching message surfaces sub-optimal timing
```

**Critical pass condition for Test D:** `crp_cycle_credited = true` even though `crp_in_window = false`. The credit rule is duration-only, not location-dependent.

---

### ACCT-05 — Mixed Week (Nocturnal + CRP)

**Input:**
```
nocturnal_cycles: [5, 3, 5, 4, 4, 3, null]  // day 7 not yet logged
crp_cycles:       [0, 1, 0, 1, 0, 1, 0]     // CRP on days 2, 4, 6
day_number:       7
```

**EXPECTED COMPUTATION:**
```
total_nocturnal_cycles: 24   // 5+3+5+4+4+3+0 (null → 0 for accounting)
total_crp_cycles:       3
weekly_cycle_total:     27
cycle_deficit:          8
on_track:               false
deficit_risk_flag:      true   // (8 > 7) AND (7 >= 5) → true
```

**Note on null handling:** In weekly accounting, `nocturnal_cycles[day_7] = null` is treated as 0 for the purposes of total calculation. This is the only place null is treated as 0 — it is NOT used to trigger CRP from a "bad night" inference.

---

### ACCT-06 — CRP Replaces MRM (Not In Addition)

**Input:**
```
crp_scheduled_at: "14:00"
mrm_times:        ["08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "17:00", ...]
```

**EXPECTED:**
```
// CRP at 14:00 occupies the C6 slot
// MRM at 14:00 must NOT fire while CRP is scheduled there
mrm_notification_at_14:00: suppressed
// The CRP replaces — does not add to — the MRM at that position
```

---

### ACCT-07 — Projected Weekly Total (on_track logic)

**Input on day 3:**
```
nocturnal_cycles: [5, 5, 4, 0, 0, 0, 0]
crp_cycles:       [0, 0, 0, 0, 0, 0, 0]
day_number:       3
```

**EXPECTED COMPUTATION:**
```
weekly_cycle_total: 14
remaining_days:     4
projected_total = 14 + (4 × 5) = 34
on_track = (34 >= 28) → true
deficit_risk_flag = (21 > 7) AND (3 >= 5) → false  // day 3 < 5
```

**Pass Condition:** `on_track = true` even with a deficit, because remaining days can cover it. `deficit_risk_flag = false` because it is not yet day 5.

---

### ACCT-08 — MRM Count Threshold for US-01

**Condition for US-01:** `mean(daily_logs[last_7].mrm_count) >= 4`

**Test A — passes US-01 mrm condition:**
```
mrm_counts: [5, 6, 4, 5, 4, 5, 4]
mean = 4.71 → >= 4 → passes
```

**Test B — fails US-01 mrm condition:**
```
mrm_counts: [5, 2, 2, 5, 2, 2, 5]
mean = 3.29 → < 4 → US-01 mrm gate fails → US-01 cannot activate
```

**Combined US-01 activation test:**
```
Requires ALL of:
  weekly_cycle_total >= 33          ✓ (e.g. 33)
  arp_stable = true                  ✓ (variance ≤ 15 min)
  mean(mrm_count[last_7]) >= 4       ✓ (≥ 4.0)
  no active state with priority <= 3 ✓ (no US-02 through US-17)
→ US-01 activates
```

---

## 6. ANXIETY SAFETY TESTS

These tests verify that the engine never generates anxiety-triggering outputs. They are safety-critical — a failure here is a product safety issue, not just a logic error.

---

### SAFE-01 — REC-19 Suppressed While US-07 Active

**Input:** US-07 is active. US-03 is also active (cycle_deficit > 7, day >= 5). The structural conditions for REC-19 are theoretically met.

```
active_states: ["US-07", "US-03"]
US-03.persistence_days: 15  // more than 14 days → normally triggers REC-19
```

**EXPECTED:**
```
active_recommendations: does NOT contain REC-19

// RULE-SR-01 suppression check:
// SUPPRESSION: Never fire REC-19 if active(US-07)

suppressed_recommendations: ["REC-19"]
suppression_reason:         "US-07_active"
```

**Failure scenario to prevent:** Engine fires REC-19 while US-07 is active because the deficit condition is met and the engine evaluates US-03 rules without checking the US-07 override. This is the most dangerous failure mode.

---

### SAFE-02 — Outcome Metric Suppression on Home Screen

**Input:** US-07 active.

**EXPECTED HomeScreenPayload flags:**
```
flags.tone_override_active:     true
flags.suppress_outcome_metrics: true
flags.show_cycle_count:         false
flags.show_weekly_balance:      false
flags.show_tonight_onset:       true  // onset time is process, not outcome → keep
```

**What MUST NOT appear in the payload:**
- `weekly_balance.total` (do not include in rendered payload — set `show_weekly_balance: false`)
- Any comparison phrasing ("you completed X cycles vs your target of Y")
- Sleep quality score or percentage
- `cycle_deficit` value exposed to UI layer

---

### SAFE-03 — REC-19 Suppressed in First 14 Days

**Input:**
```
user.created_at:    14 days ago or less
US-03.active:       true
US-03.persistence_days: 16
US-07.active:       false
```

**EXPECTED:**
```
suppressed_recommendations: ["REC-19"]
suppression_reason:         "user_age_less_than_14_days"
```

**Note:** Both suppression conditions are independent. The engine must check both:
1. `NOT active(US-07)` — anxiety safety
2. `user.created_at > 14 days ago` — minimum app age safety

---

### SAFE-04 — No Deficit Alert from Missing Log

**Input:**
```
sleep_logs:
  yesterday: cycles_completed = null  // user did not log
weekly_balance.cycle_deficit: 15
day_number: 3
```

**EXPECTED:**
```
// No CRP trigger from RULE-CYCLES-01 (yesterday was null, not < 4)
// No "you had a short night" message

active_recommendations:
  // REC-03 may appear if weekly deficit triggers it separately
  // But the coaching_message MUST NOT reference "last night" as the cause

IF REC-03 fires: verify reason = "weekly_deficit" NOT "cycles_yesterday_short"
```

---

### SAFE-05 — Tracker Score Suppressed When US-09 Active

**Input:**
```
profile.tracker_in_use: true
US-09.active: true
tracker_data_available: true
```

**EXPECTED HomeScreenPayload:**
```
flags.suppress_tracker_nightly_score: true
// Weekly averages may be shown; nightly scores must not

// The engine must not surface tracker metrics as a primary recommendation
// REC-18 (Tracker Calibration) is the primary output
active_recommendations:
  [0] rec_type: "REC-18"
```

---

### SAFE-06 — US-07 + US-03 Conflict — Structural Audit Continues but Tone is Overridden

This is the most complex safety scenario. US-03 (significant deficit) is real and requires structural attention. US-07 (anxiety loop) is also real and overrides the tone. Both must be respected simultaneously.

**Input:**
```
active_states: ["US-07", "US-03"]
tone_override_active: true
cycle_deficit: 12
```

**EXPECTED:**
```
// US-03 structural audit continues (the deficit is real and should be addressed)
// BUT: all US-03 outputs are reframed to process-only language

recommendations:
  [0] rec_type: "REC-15"   // 15-min rule (US-07)
  [1] rec_type: "REC-13"   // Cycle reframe (US-07)
  [2] rec_type: "REC-08"   // Wind-down (US-07)
  // REC-03 (CRP) may appear but coaching_message must use process framing:
  // "Today's plan includes a CRP at 14:00" — NOT "you had a short night"

// The deficit exists but is handled through process framing, not outcome pressure
// "Let's focus on today's process" rather than "you're 12 cycles short"

flags:
  show_weekly_balance: false
  show_cycle_count:    false
  tone_override_active: true

MUST NOT contain:
  "You are 12 cycles short"
  "Bad week"
  "You only got [N] cycles"
  REC-19
```

---

## 7. MVP TEST PACK

The minimum set of tests that MUST pass before the engine is used by any UI. These 8 tests cover the highest-risk failure modes.

| Priority | Test ID | Scenario | Why Critical |
|----------|---------|----------|-------------|
| 1 | SAFE-01 | REC-19 suppressed while US-07 active | Safety: anxiety can worsen if this fires incorrectly |
| 2 | GATE-01 | No ARP — engine returns gate response | Correctness: without ARP, nothing works |
| 3 | SIM-04 | US-07 detected + tone_override | Safety: most sensitive recommendation output |
| 4 | SIM-09 | Null cycle log → no CRP trigger | Correctness: false positive harms user trust |
| 5 | ACCT-04 | CRP credit boundary (20 min) | Financial: weekly balance accuracy |
| 6 | SIM-02 | US-02 → REC-03 at correct time | Core UX: this is the most common daily scenario |
| 7 | GATE-03 | No logs → onboarding set only | New user first impression |
| 8 | SAFE-06 | US-07 + US-03 concurrent | Correctness: hardest conflict resolution case |

### MVP Pass Criteria

The engine is considered MVP-ready when:
- All 8 tests above pass with zero deviations
- All 5 GATE tests pass
- All 4 ACCT boundary tests pass (ACCT-02, ACCT-03, ACCT-04, ACCT-06)
- No anxiety-safety test produces a false positive

### Recommended First Test to Run

**SAFE-01** — REC-19 suppression under US-07.

Rationale: This is the highest-stakes test. If it fails, the engine can make sleep anxiety worse by applying a demanding clinical protocol (sleep restriction) to a user who is already anxious. It should be verified before any other recommendation-generation logic is considered stable.

---

## 8. V2 TEST PACK

These tests are deferred until V2 features are implemented. They should not be run against the MVP engine.

| Test ID | Scenario | Requires |
|---------|----------|---------|
| SIM-06 | Pre-event high arousal (US-15) | EventContext.event_type = "pre_event" |
| SIM-07 | Illness recovery mode (US-16) | US-16 state + illness mode modifiers |
| SIM-08 | Shift worker two-ARP model (US-17) | `multishift_enabled = true`; shift-specific ARPConfig |
| V2-01 | REC-19 correctly fires after 14 days, no US-07 | US-03 persistence tracking across sessions |
| V2-02 | Tracker integration: data used as background only | `submit_tracker_data()` endpoint + signal weighting |
| V2-03 | Travel jet lag direction protocol | EventContext.timezone_offset_hours + travel direction |
| V2-04 | Chronotype calibration after 4 weeks | `chronotype_confidence` progression |
| V2-05 | In-betweener reclassification as PMer | US-14 + 4-week data window |
| V2-06 | CRP stigma escalation (2 dismissals → REC-13) | `REC-03.dismissed_count >= 2` |
| V2-07 | US-09 escalation: tracker-free period after 7 days | `REC-18.delivered AND US-09 still active after 7 days` |
| V2-08 | Exercise timing risk: AMer late exercise | `daily_log.exercise_start_time > phase_3_start AND chronotype = AMer` |
| V2-09 | REC-21 cooldown: does not re-fire for 30 days | Cooldown enforcement for 30-day recs |
| V2-10 | Partner conflict: individual duvet recommendation | `sleep_partner = true AND temperature_conflict = true` |

### V2 Test Priority Order

When implementing V2, run tests in this order:
1. SIM-08 (shift work) — highest complexity, most different from standard flow
2. V2-01 (REC-19 correct firing) — safety-adjacent; must be validated before enabling
3. SIM-07 (illness mode) — common enough to test early
4. V2-03 (travel protocol) — travel is a common disruption vector
5. All others in any order

---

## FINAL REPORT

### Total Scenarios Created

| Category | Count |
|----------|-------|
| Core simulation scenarios (Section 2) | 10 |
| Validation gate tests (Section 4) | 5 |
| Weekly accounting tests (Section 5) | 8 (with sub-tests) |
| Anxiety safety tests (Section 6) | 6 |
| V2 deferred tests (Section 8) | 10 |
| **Total** | **39** |

**MVP-critical tests:** 28 (all except V2 pack)

---

### MVP-Critical Scenarios (minimum test pack before build)

The 8 tests that must pass before any UI implementation:

1. **SAFE-01** — REC-19 hard-suppressed while US-07 active
2. **GATE-01** — Engine returns gate response when no ARP committed
3. **SIM-04** — US-07 + tone_override + correct rec set
4. **SIM-09** — Null cycle count does not trigger CRP
5. **ACCT-04** — CRP credit boundary at 20 minutes (including 19 min = false)
6. **SIM-02** — US-02 → REC-03 at the correct CRP window time
7. **GATE-03** — No logs → onboarding rec set only (no deficit state)
8. **SAFE-06** — US-07 + US-03 concurrent: structural audit continues, tone overridden

---

### Highest-Risk Failure Cases

In order of impact severity:

| Rank | Test | Risk if it Fails |
|------|------|-----------------|
| 1 | SAFE-01 | Engine fires sleep restriction at an anxious user — directly worsens their condition |
| 2 | SIM-04 | Outcome metrics shown to anxious user — reinforces anxiety loop |
| 3 | SAFE-06 | US-07 + US-03 mishandled — anxiety worsened while deficit is shown as outcome pressure |
| 4 | SIM-09 | Null log triggers CRP — user receives false alarm about a night that didn't happen |
| 5 | GATE-01 | Engine runs without ARP — all cycle calculations are invalid; bogus recs generated |
| 6 | ACCT-04C | CRP under 20 min is falsely credited — weekly balance inflated; deficit masked |
| 7 | ACCT-02 | Deficit-risk-flag fires at deficit = 7 instead of > 7 — US-03 false-positive |
| 8 | SIM-10 | New user day 1 sees deficit alert (US-03) — most damaging first impression possible |

---

### Recommended First Simulation to Run

**SAFE-01: REC-19 suppressed while US-07 is active.**

This is the correct first test for the following reasons:

1. **It is the safety-critical path.** If the engine fires REC-19 (sleep restriction) while the user is in an anxiety loop, the app actively worsens the condition it is supposed to treat.

2. **It tests the most complex interaction.** US-07 must override US-03. US-03 must detect correctly. Both states are active. REC-19 is suppressed. This interaction chain touches more of the engine logic than any other single test.

3. **It validates the core design principle.** The R90 system's central claim is "process over outcome." If the engine fails SAFE-01, the entire design principle is violated. If it passes, the most fundamental safety constraint is confirmed before anything else is built.

4. **It is fast to run.** The input context is simple (two active states, one suppression rule), and the expected output is unambiguous (REC-19 absent from recommendations).

*Sources: `R90_RULE_ENGINE_SPEC.md`, `R90_DATA_MODEL.md`, `R90_APP_IMPLEMENTATION_SPEC.md`, `R90_BACKEND_API_CONTRACT.md`*
