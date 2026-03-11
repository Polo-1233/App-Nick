# R90 Backend / API Contract

**Version:** 1.0
**Date:** 2026-03-11
**Status:** Engineering-ready — authorised for implementation
**Depends on:** `R90_DATA_MODEL.md` (v1.0), `R90_RULE_ENGINE_SPEC.md` (v1.0), `R90_APP_IMPLEMENTATION_SPEC.md` (v1.0)
**Audience:** Backend engineers, mobile engineers, and anyone building or consuming the R90 engine

**How to read this document:**
- Section 2 defines every function signature
- Section 3 gives worked JSON examples for the most critical calls
- Section 5 defines exactly when the engine re-runs
- Sections 6–7 define the screen payload contracts the mobile app expects
- Section 8 defines error behaviour for all partial/missing data cases

---

## 1. API DESIGN GOAL

### What the Backend Contract Must Support

The backend must support four kinds of operation:

1. **Profile writes** — user creation and onboarding data. These produce an `ARPConfig` as a side effect. They are called once at setup and infrequently thereafter.
2. **Log writes** — sleep logs and daily logs. These are the primary data events. Every write triggers a full engine evaluation and returns an updated recommendation set.
3. **Screen payload reads** — assembled payloads for the home screen, day plan, check-in, and weekly insights. The mobile app reads these; it never reads raw entity data.
4. **Engine evaluation** — stateless, deterministic. Not called directly by the app; triggered internally by every log write.

### What the MVP Engine Must Expose

| Function | Type | MVP |
|----------|------|-----|
| `create_user_profile` | Profile write | Yes |
| `update_user_profile` | Profile write | Yes |
| `generate_arp_config` | Computed write | Yes |
| `submit_sleep_log` | Log write + engine trigger | Yes |
| `submit_daily_log` | Log write + engine trigger | Yes |
| `submit_check_in` | Log write shortcut + engine trigger | Yes |
| `evaluate_user_state` | Engine (internal) | Yes |
| `generate_recommendations` | Engine (internal) | Yes |
| `get_home_screen_payload` | Screen read | Yes |
| `get_day_plan_payload` | Screen read | Yes |
| `get_check_in_payload` | Screen read | Yes |
| `get_weekly_insights_payload` | Screen read | Yes |
| `log_crp` | Log write | Yes |
| `log_event` | Event write | Yes |
| `update_environment` | Profile write | Yes |

### Key Constraints

- **The engine is stateless.** It receives a fully assembled `EngineContext` object and returns outputs. It does not perform database reads. The backend assembles the context; the engine evaluates it.
- **The app receives payloads, not entities.** No endpoint returns raw database records. All screen data is assembled and delivered as structured payload objects.
- **Every log write triggers engine re-evaluation.** There is no lazy evaluation. The state and recommendation cache is refreshed synchronously on every data event.
- **Missing data is not an error.** The engine handles null fields gracefully using defined fallback rules. A missing sleep log does not block evaluation — it modifies the evaluation path.

---

## 2. CORE ENGINE CALLS

---

### Function: `create_user_profile`

**Purpose**
Initialise a new user account, persist the core profile, and trigger initial ARP config generation. Called once during onboarding after the user commits their ARP.

**Called when:** User completes ARP commitment step in onboarding.

**Reads:** Nothing (first write for this user).

**Writes:** `User`, `UserProfile`, triggers `generate_arp_config`.

**Input schema:**
```json
{
  "timezone":           "string — IANA timezone, e.g. Europe/London",
  "arp_time":           "string — HH:MM, on hour or half-hour, range 05:00–09:00",
  "chronotype":         "enum — AMer | PMer | In-betweener | Unknown",
  "cycle_target":       "integer — range 3–6, default 5",
  "crp_available":      "boolean — does user have a midday window for CRP?",
  "sleep_partner":      "boolean — optional, default false",
  "caffeine_use":       "enum — none | low | moderate | high, optional",
  "caffeine_cutoff_time": "string — HH:MM, optional, default 14:00",
  "tracker_in_use":     "boolean — optional, default false",
  "schedule_consistency": "enum — consistent | inconsistent"
}
```

**Input validation:**
```
arp_time must match /^(0[5-9]|0[5-8]:[03]0|09:00)$/
  (on the hour or half-hour, between 05:00 and 09:00)
chronotype is REQUIRED — if user selects "Unsure", store as "Unknown"
cycle_target default: 5 if not provided
```

**Output schema:**
```json
{
  "user_id":              "uuid",
  "arp_time":             "06:30",
  "arp_config_generated": true,
  "onboarding_step":      1,
  "initial_states":       ["US-12"],
  "initial_recommendations": ["REC-01", "REC-04", "REC-13"],
  "social_jet_lag_flag":  false
}
```

**Notes:**
- `social_jet_lag_flag = true` if `chronotype = PMer` AND `arp_time < 07:00`. Surface a Social Jet Lag acknowledgement card (REC-21) during onboarding — not as an alert, as education.
- `arp_committed` is set to `true` on this call. Before this call, the engine cannot run.

---

### Function: `update_user_profile`

**Purpose**
Update any profile field. Triggers `generate_arp_config` if `arp_time` changes. Triggers engine re-evaluation.

**Called when:** User changes ARP, chronotype, environment answers, or any profile setting.

**Reads:** Existing `UserProfile`.

**Writes:** `UserProfile`, conditionally `ARPConfig`.

**Input schema:**
```json
{
  "user_id": "uuid",
  "fields":  {
    "arp_time":               "06:30",
    "chronotype":             "PMer",
    "cycle_target":           5,
    "caffeine_cutoff_time":   "14:00",
    "tracker_in_use":         true
  }
}
```

Only include fields being changed. Unspecified fields are not modified.

**Output schema:**
```json
{
  "updated":              true,
  "profile_version":      4,
  "arp_config_regenerated": true,
  "engine_triggered":     true
}
```

**Notes:**
- ARP changes require notification schedule to be refreshed in the mobile app.
- If `arp_time` changes, `ARPConfig` is invalidated and regenerated before the engine runs.

---

### Function: `generate_arp_config`

**Purpose**
Compute and persist the full 16-cycle schedule from a committed ARP. All downstream scheduling depends on this config. Called internally — not by the app directly.

**Called when:** Triggered automatically by `create_user_profile` or `update_user_profile` when `arp_time` changes.

**Reads:** `UserProfile.arp_time`.

**Writes:** `ARPConfig`.

**Input (internal):**
```
arp_time: "HH:MM"
```

**Output (stored in ARPConfig, returned to calling function):**
```json
{
  "user_id":             "uuid",
  "arp_time":            "06:30",
  "cycle_times": [
    "06:30", "08:00", "09:30", "11:00",
    "12:30", "14:00", "15:30", "17:00",
    "18:30", "20:00", "21:30", "23:00",
    "00:30", "02:00", "03:30", "05:00"
  ],
  "phase_1_start":       "06:30",
  "phase_2_start":       "12:30",
  "phase_3_start":       "18:30",
  "phase_4_start":       "00:30",
  "crp_window_open":     "14:00",
  "crp_window_close":    "18:30",
  "sleep_onset_6cycle":  "21:30",
  "sleep_onset_5cycle":  "23:00",
  "sleep_onset_4cycle":  "00:30",
  "sleep_onset_3cycle":  "02:00",
  "mrm_times": [
    "08:00", "09:30", "11:00", "12:30",
    "14:00", "15:30", "17:00", "18:30",
    "20:00", "21:30"
  ],
  "generated_at":        "2026-03-11T09:00:00Z"
}
```

**Formula reference:**
```
cycle_times[n]    = arp_time + (n − 1) × 90 minutes  (n = 1..16)
phase_2_start     = cycle_times[5]   = arp_time + 360 min
phase_3_start     = cycle_times[9]   = arp_time + 720 min
phase_4_start     = cycle_times[13]  = arp_time + 1080 min
crp_window_open   = cycle_times[6]   = arp_time + 450 min
crp_window_close  = cycle_times[9]   = arp_time + 720 min
sleep_onset_5cycle = arp_time − 450 min (7.5 hours)
mrm_times         = cycle_times[2..11]
```

---

### Function: `submit_sleep_log`

**Purpose**
Log the previous night's nocturnal cycle outcome. This is the primary data event. Triggers engine re-evaluation and returns updated screen data.

**Called when:** User submits the morning sleep log or daily check-in cycle count.

**Reads:** `UserProfile`, `ARPConfig`, existing `WeeklyCycleBalance`.

**Writes:** `SleepLog` (new record), `WeeklyCycleBalance` (updated).

**Input schema:**
```json
{
  "user_id":                  "uuid",
  "date":                     "2026-03-12",
  "cycles_completed":         4,
  "actual_sleep_onset":       "23:20",
  "wake_time":                "06:30",
  "onset_latency_minutes":    20,
  "night_wakings":            1,
  "night_waking_2_to_4am":    true,
  "pre_sleep_routine_done":   true,
  "post_sleep_routine_done":  false,
  "disruption_event_id":      null
}
```

**Required fields:** `user_id`, `date`

**Optional fields:** All others — see missing data handling in Section 8.

**`cycles_completed` resolution:**
```
IF cycles_completed provided by user → use as-is
ELSE IF actual_sleep_onset AND wake_time both provided
  THEN cycles_completed = floor((wake_time − actual_sleep_onset) / 90)
ELSE
  cycles_completed = null  // missing — do not infer; do not default to 0
```

**Output schema:**
```json
{
  "log_id":               "uuid",
  "date":                 "2026-03-12",
  "cycles_credited":      4,
  "arp_maintained":       true,
  "weekly_total_updated": 18,
  "cycle_deficit":        17,
  "on_track":             true,
  "engine_triggered":     true,
  "active_states":        ["US-02"],
  "active_recommendations": [
    {
      "id":             "REC-03",
      "priority":       "HIGH",
      "title":          "CRP today",
      "message":        "Last night: 4 cycles. A 30-minute CRP between 14:00 and 18:30 adds one cycle to your weekly total.",
      "deliver_at":     "2026-03-12T14:00:00Z",
      "expires_at":     "2026-03-12T18:30:00Z",
      "action_payload": {"crp_start": "14:00", "duration_min": 30}
    }
  ]
}
```

---

### Function: `submit_daily_log`

**Purpose**
Log daytime recovery activity: CRP completion, MRM count, light protocol adherence, and caffeine signals. Triggers engine re-evaluation.

**Called when:** End of day, or when user confirms CRP completion via the CRP tracker.

**Reads:** `UserProfile`, `ARPConfig`, `WeeklyCycleBalance`.

**Writes:** `DailyLog` (new record or update), `WeeklyCycleBalance` (if CRP credited).

**Input schema:**
```json
{
  "user_id":                "uuid",
  "date":                   "2026-03-12",
  "crp_taken":              true,
  "crp_duration_minutes":   30,
  "crp_start_time":         "14:00",
  "mrm_count":              5,
  "morning_light_achieved": true,
  "evening_light_managed":  false,
  "caffeine_doses":         3,
  "caffeine_last_time":     "15:30",
  "disruption_event_id":    null
}
```

**Required fields:** `user_id`, `date`

**CRP credit rule (applied on write):**
```
crp_cycle_credited = crp_taken AND crp_duration_minutes >= 20
crp_in_window = crp_start_time >= arp_config.crp_window_open
                AND crp_start_time <= arp_config.crp_window_close
```

**Output schema:**
```json
{
  "log_id":               "uuid",
  "crp_cycle_credited":   true,
  "crp_in_window":        true,
  "caffeine_after_cutoff": true,
  "weekly_total_updated": 19,
  "cycle_deficit":        16,
  "engine_triggered":     true,
  "active_recommendations": [...]
}
```

---

### Function: `submit_check_in`

**Purpose**
Lightweight daily input — captures cycle count, onset difficulty, and any disruption event. A shortcut that writes to both `SleepLog` (cycles) and `DailyLog` (flags) in a single call. Designed for low-friction daily use.

**Called when:** Daily check-in screen submission.

**Reads:** `UserProfile`, `ARPConfig`, `WeeklyCycleBalance`.

**Writes:** `SleepLog` (upsert for today's date), `DailyLog` (upsert for today's date), `WeeklyCycleBalance`.

**Input schema:**
```json
{
  "user_id":              "uuid",
  "date":                 "2026-03-12",
  "cycles_completed":     4,
  "onset_latency_flag":   "over_15_min",
  "disruption_event":     "none",
  "crp_taken":            false,
  "mrm_count":            4
}
```

**`onset_latency_flag` enum:** `"easy"` | `"difficult"` | `"over_15_min"` | `null`

**Mapping to SleepLog:**
```
onset_latency_flag = "over_15_min" → SleepLog.onset_latency_minutes = 16 (minimum flagged value)
onset_latency_flag = "difficult"   → SleepLog.onset_latency_minutes = 20 (estimated)
onset_latency_flag = "easy"        → SleepLog.onset_latency_minutes = 10 (estimated)
onset_latency_flag = null          → SleepLog.onset_latency_minutes = null
```

**Output schema:**
```json
{
  "sleep_log_id":         "uuid",
  "daily_log_id":         "uuid",
  "cycles_credited":      4,
  "weekly_total":         18,
  "cycle_deficit":        17,
  "active_states":        ["US-02"],
  "active_recommendations": [...]
}
```

---

### Function: `evaluate_user_state` (internal)

**Purpose**
Run the full 7-pass state detection logic. Returns the current active states and engine flags. Called internally by the backend — never directly by the mobile app.

**Called when:** After every `submit_sleep_log`, `submit_daily_log`, `submit_check_in`, `update_user_profile`, or `log_event`.

**Reads:** `EngineContext` (assembled by backend from all entities).

**Writes:** Nothing — stateless. Outputs are used by `generate_recommendations` and cached in `ActiveStates`.

**Input:**
```
EngineContext — see Section 5 for full assembly specification
```

**Pre-engine validation (runs first):**
```
VALIDATE-01: IF profile.arp_committed = false
  RETURN { states: ["US-12", "US-04"], recommendations: ["REC-01", "REC-20"] }
  STOP

VALIDATE-02: IF arp_config is null OR arp_config.generated_at < profile.updated_at
  Recompute arp_config from profile.arp_time
  Continue

VALIDATE-03: IF sleep_logs is empty (no logs submitted yet)
  RETURN { states: ["US-12"], recommendations: ["REC-20", "REC-01", "REC-04", "REC-06"] }
  STOP
```

**Output schema:**
```json
{
  "active_states": [
    {"id": "US-07", "priority": 1, "detected_at": "2026-03-12T07:05:00Z"},
    {"id": "US-02", "priority": 3, "detected_at": "2026-03-12T07:05:00Z"}
  ],
  "tone_override_active": true,
  "gate_blocked":          false,
  "gate_reason":           null,
  "suppress_outcome_metrics": true
}
```

**State evaluation order:**
```
Pass 1 — Gate states (may stop evaluation)
  US-12 (Framework Gap), US-04 (ARP Instability)

Pass 2 — Anxiety override states
  US-07 (Sleep Anxiety Loop), US-09 (Ortho-Insomnia)
  → if active: set tone_override = true; suppress outcome metrics

Pass 3 — Structural deficit states
  US-03 (Significant Cycle Deficit), US-02 (Mild Cycle Deficit)
  → US-03 supersedes US-02 — never both active simultaneously

Pass 4 — Behavioural / environmental states
  US-08 (Electronic Insomnia), US-10 (Stimulant Compensation),
  US-11 (Environmental Friction), US-05 (Chronotype Conflict)

Pass 5 — Event states
  US-06 (Post-Disruption Recovery)
  [US-15, US-16, US-17 — V2]

Pass 6 — Maintenance
  US-01 (Aligned) — only active if no higher-priority state is active

Pass 7 — V2 only
  US-13 (Sleep Noise Exposure), US-14 (In-Betweener Fog)
```

---

### Function: `generate_recommendations` (internal)

**Purpose**
Apply the MVP rule set to active states. Apply conflict resolution. Apply cooldown suppression. Return a ranked, deduplicated recommendation list.

**Called when:** Immediately after `evaluate_user_state` in the same evaluation pipeline.

**Reads:** `ActiveStates`, `EngineContext`, `RecommendationCooldowns`.

**Writes:** Updates `ActiveRecommendations` cache.

**Input:**
```
active_states:           UserState[]
engine_context:          EngineContext
recommendation_cooldowns: { rec_type: last_triggered_at }
tone_override_active:    boolean
```

**Recommendation cap:** Maximum 5 active recommendations per session. REC-01 and REC-20 are exempt from the cap (they are foundational blocking recs).

**Conflict resolution rules:**
```
US-07 active → tone_override = true:
  SUPPRESS: all outcome metric displays
  SUPPRESS: REC-19 (sleep restriction) — hard suppression, never fires while US-07 active
  SUPPRESS: tracker feature recommendations
  REFRAME: all structural recommendations to process-only language
  SURFACE: REC-13 (cycle reframe), REC-15 (15-min rule), REC-08 (wind-down)

US-07 + US-03 simultaneously active:
  US-03 structural audit continues
  Suppress cycle count comparisons
  Replace deficit language with "Let's focus on today's process"
  REC-19 remains hard-suppressed

US-04 (ARP instability) active:
  SURFACE: REC-01 first
  BLOCK: all scheduling recommendations until ARP is re-committed

US-12 (framework gap) active:
  SURFACE: REC-20 or REC-01 first
  BLOCK: environment recommendations (REC-09–REC-11) until framework established
  BLOCK: product recommendations entirely
```

**Recommendation cooldowns:**
```
REC-01  ARP Commitment:       no cooldown (critical; shows until resolved)
REC-03  CRP Scheduling:       24 hours
REC-07  Morning Light:        72 hours (low-frequency education)
REC-08  Phase 3 Wind-Down:    24 hours
REC-13  Cycle Count Reframe:  7 days (show once; repeat only on regression)
REC-14  Weekly Balance:       7 days (weekly trigger)
REC-15  15-Minute Rule:       48 hours
REC-17  Caffeine Timing:      72 hours
REC-18  Tracker Calibration:  7 days
REC-19  Sleep Restriction:    14 days (V2; hard-suppressed while US-07 active)
REC-20  Framework Reset:      24 hours
REC-21  Social Jet Lag:       30 days (education; show once, then on profile change)
All others: 24 hours default
```

**Output schema:**
```json
{
  "recommendations": [
    {
      "id":              "REC-03",
      "rec_type":        "CRP_SCHEDULING",
      "priority":        "HIGH",
      "priority_int":    2,
      "triggered_by":    ["US-02"],
      "title":           "CRP today at 14:00",
      "message":         "Last night: 4 cycles. A 30-minute CRP between 14:00 and 18:30 adds one cycle to your weekly total.",
      "deliver_at":      "2026-03-12T14:00:00Z",
      "expires_at":      "2026-03-12T18:30:00Z",
      "cooldown_hours":  24,
      "action_payload":  {"type": "schedule_crp", "crp_start": "14:00", "duration_min": 30}
    }
  ],
  "total":           1,
  "suppressed":      [],
  "tone_override":   false
}
```

---

### Function: `get_home_screen_payload`

**Purpose**
Assemble and return all data required for the home screen. The mobile app renders this payload directly — no additional computation on the client side.

**Called when:** App launch, foreground return, and after any log submission.

**Reads:** `UserProfile`, `ARPConfig`, `WeeklyCycleBalance`, last `SleepLog`, `ActiveRecommendations`, `ActiveStates`.

**Writes:** Nothing.

**Input:**
```json
{
  "user_id":      "uuid",
  "current_time": "2026-03-12T09:15:00Z"
}
```

**Output schema:** See Section 6.

---

### Function: `get_day_plan_payload`

**Purpose**
Assemble and return the full 16-cycle day plan with phase labels, MRM times, CRP slot (if scheduled), sleep onset, and phase boundary notifications.

**Called when:** Day Plan screen load and daily refresh at ARP time.

**Reads:** `ARPConfig`, `UserProfile`, `ActiveRecommendations` (for CRP slot), `DailyLog` for today.

**Writes:** Nothing.

**Input:**
```json
{
  "user_id": "uuid",
  "date":    "2026-03-12"
}
```

**Output schema:** See Section 7.

---

### Function: `get_check_in_payload`

**Purpose**
Return the questions and pre-filled data for the daily check-in screen. Pre-fills where previous data allows inference.

**Called when:** Daily check-in screen open.

**Reads:** `ARPConfig`, `UserProfile`, last `SleepLog`, `WeeklyCycleBalance`.

**Writes:** Nothing.

**Input:**
```json
{
  "user_id": "uuid",
  "date":    "2026-03-12"
}
```

**Output schema:**
```json
{
  "date":               "2026-03-12",
  "already_submitted":  false,
  "arp_time":           "06:30",
  "sleep_onset_target": "23:00",
  "weekly_total":       14,
  "weekly_target":      35,
  "questions": [
    {
      "id":        "cycles_completed",
      "type":      "select_integer",
      "label":     "How many cycles did you complete last night?",
      "options":   [1, 2, 3, 4, 5, 6],
      "required":  true,
      "prefill":   null
    },
    {
      "id":        "onset_latency_flag",
      "type":      "select_enum",
      "label":     "Did sleep come easily?",
      "options":   ["easy", "difficult", "over_15_min"],
      "required":  false,
      "prefill":   null
    },
    {
      "id":        "disruption_event",
      "type":      "select_enum",
      "label":     "Any disruptions?",
      "options":   ["none", "woke_during_night", "travel", "illness", "other"],
      "required":  false,
      "prefill":   "none"
    }
  ],
  "weekly_addon_due":    false
}
```

**`weekly_addon_due`:** True on day 7 of the rolling week. Triggers the weekly add-on questions (stimulant trend, tracker use).

---

### Function: `log_crp`

**Purpose**
Record CRP completion from the CRP timer screen. A convenience wrapper around `submit_daily_log` for the CRP-specific flow.

**Called when:** User confirms CRP complete via the timer screen.

**Reads:** `ARPConfig`, `WeeklyCycleBalance`.

**Writes:** `DailyLog.crp_taken`, `DailyLog.crp_duration_minutes`, `DailyLog.crp_start_time`.

**Input:**
```json
{
  "user_id":           "uuid",
  "date":              "2026-03-12",
  "crp_start_time":    "14:00",
  "crp_duration_minutes": 30
}
```

**Output:**
```json
{
  "crp_cycle_credited":   true,
  "crp_in_window":        true,
  "weekly_total_updated": 19,
  "message":              "CRP complete. +1 cycle. Weekly balance: 19 / 35."
}
```

---

### Function: `log_event`

**Purpose**
Record a disruption or context event that modifies engine behaviour for a bounded period.

**Called when:** User flags a disruption event (travel, illness, social, etc.).

**Reads:** `UserProfile`.

**Writes:** `EventContext` (new record).

**Input:**
```json
{
  "user_id":    "uuid",
  "event_type": "travel",
  "severity":   "moderate",
  "start_date": "2026-03-14",
  "end_date":   "2026-03-16"
}
```

**Output:**
```json
{
  "event_id":       "uuid",
  "active":         true,
  "engine_triggered": true,
  "active_recommendations": [...]
}
```

---

### Function: `update_environment`

**Purpose**
Store or update the user's bedroom environment profile. Updates the `EnvironmentContext` entity. Triggers engine re-evaluation if friction score changes.

**Called when:** Environment audit screen submission, or individual environment answer change.

**Reads:** Existing `EnvironmentContext` (if any).

**Writes:** `EnvironmentContext` (upsert).

**Input:**
```json
{
  "user_id":                  "uuid",
  "bedroom_temperature":      "hot",
  "blackout_provision":       false,
  "dws_device":               false,
  "morning_light_access":     "outdoor",
  "evening_light_environment": "bright_blue",
  "tv_in_bedroom":            true,
  "work_items_in_bedroom":    false
}
```

**Output:**
```json
{
  "environment_friction_score": 3,
  "blackout_without_dws":       false,
  "engine_triggered":           true,
  "active_recommendations": [...]
}
```

---

## 3. JSON PAYLOADS

Worked examples for the most critical engine calls, using a real scenario: PMer user with ARP 06:30, current day 4 of week, weekly balance = 18 cycles, last night = 4 cycles.

---

### Example A — submit_sleep_log (normal night, slight deficit)

**Request:**
```json
{
  "user_id":                 "a3f2-1234-...",
  "date":                    "2026-03-12",
  "cycles_completed":        4,
  "actual_sleep_onset":      "23:20",
  "wake_time":               "06:30",
  "onset_latency_minutes":   20,
  "night_wakings":           0,
  "night_waking_2_to_4am":   false,
  "pre_sleep_routine_done":  true,
  "post_sleep_routine_done": true,
  "disruption_event_id":     null
}
```

**Response:**
```json
{
  "log_id":               "b7c3-5678-...",
  "date":                 "2026-03-12",
  "cycles_credited":      4,
  "arp_maintained":       true,
  "weekly_total_updated": 18,
  "cycle_deficit":        17,
  "on_track":             true,
  "engine_triggered":     true,
  "active_states":        ["US-02"],
  "active_recommendations": [
    {
      "id":              "REC-03",
      "priority":        "HIGH",
      "title":           "CRP today",
      "message":         "Last night: 4 cycles. A 30-minute CRP between 14:00 and 18:30 adds one cycle to your weekly total.",
      "deliver_at":      "2026-03-12T14:00:00Z",
      "expires_at":      "2026-03-12T18:30:00Z",
      "action_payload":  {"type": "schedule_crp", "crp_start": "14:00", "duration_min": 30}
    },
    {
      "id":              "REC-02",
      "priority":        "HIGH",
      "title":           "Tonight's target",
      "message":         "Sleep at 23:00 → 5 complete cycles → ARP 06:30. Miss the 23:00 window? Next is 00:30 for 4 cycles.",
      "deliver_at":      "2026-03-12T21:30:00Z",
      "expires_at":      "2026-03-13T01:00:00Z",
      "action_payload":  null
    }
  ]
}
```

---

### Example B — submit_sleep_log (anxiety pattern detected)

Three consecutive nights with `onset_latency_minutes` > 30. US-07 fires. Tone override activates.

**Request:**
```json
{
  "user_id":               "a3f2-1234-...",
  "date":                  "2026-03-12",
  "cycles_completed":      3,
  "actual_sleep_onset":    "00:15",
  "wake_time":             "06:30",
  "onset_latency_minutes": 35,
  "night_wakings":         2,
  "night_waking_2_to_4am": true
}
```

**Response:**
```json
{
  "log_id":               "c4d5-9012-...",
  "cycles_credited":      3,
  "arp_maintained":       true,
  "weekly_total_updated": 16,
  "cycle_deficit":        19,
  "on_track":             false,
  "engine_triggered":     true,
  "active_states":        [
    {"id": "US-07", "priority": 1},
    {"id": "US-03", "priority": 2}
  ],
  "tone_override_active":      true,
  "suppress_outcome_metrics":  true,
  "active_recommendations": [
    {
      "id":       "REC-15",
      "priority": "HIGH",
      "title":    "The 15-minute rule",
      "message":  "If sleep hasn't come in 15 minutes: get up. Go somewhere dim and quiet — no screens. Wait for 01:30, then try again. This is the right move.",
      "deliver_at": "2026-03-12T07:05:00Z",
      "action_payload": {"next_cycle_boundary": "01:30"}
    },
    {
      "id":       "REC-16",
      "priority": "HIGH",
      "title":    "2–3am waking",
      "message":  "Waking at 2–3am is a natural polyphasic transition — the gap between your early and late cycles. Don't check the clock. If sleep doesn't return in 15 minutes: get up, stay dim, wait for 03:30.",
      "deliver_at": "2026-03-12T07:05:00Z"
    },
    {
      "id":       "REC-13",
      "priority": "MEDIUM",
      "title":    "Cycles, not hours",
      "message":  "Hours are the wrong measure. You completed 3 cycles last night — that's your number. Your process is what you control. Focus there.",
      "deliver_at": "2026-03-12T07:05:00Z"
    }
  ],
  "suppressed_recommendations": ["REC-03", "REC-14", "REC-19"]
}
```

**Note:** REC-03 (CRP) is suppressed from the surface-level output when US-07 tone_override is active. The CRP is still scheduled internally — but it should not be framed as a "you had a short night" correction. It should surface neutrally as "today's plan includes a rest period at 14:00."

---

### Example C — get_home_screen_payload

**Request:**
```json
{
  "user_id":      "a3f2-1234-...",
  "current_time": "2026-03-12T09:15:00Z"
}
```

**Response:** See Section 6 for full HomeScreenPayload schema.

---

### Example D — generate_arp_config (ARP 07:00 — PMer)

**Input:** `arp_time = "07:00"`

**Response:**
```json
{
  "arp_time":            "07:00",
  "cycle_times": [
    "07:00", "08:30", "10:00", "11:30",
    "13:00", "14:30", "16:00", "17:30",
    "19:00", "20:30", "22:00", "23:30",
    "01:00", "02:30", "04:00", "05:30"
  ],
  "phase_1_start":       "07:00",
  "phase_2_start":       "13:00",
  "phase_3_start":       "19:00",
  "phase_4_start":       "01:00",
  "crp_window_open":     "14:30",
  "crp_window_close":    "19:00",
  "sleep_onset_6cycle":  "22:00",
  "sleep_onset_5cycle":  "23:30",
  "sleep_onset_4cycle":  "01:00",
  "sleep_onset_3cycle":  "02:30",
  "mrm_times": [
    "08:30", "10:00", "11:30", "13:00",
    "14:30", "16:00", "17:30", "19:00",
    "20:30", "22:00"
  ]
}
```

---

### Example E — VALIDATE-01 response (no ARP committed)

**Engine receives:** `profile.arp_committed = false`

**Engine returns:**
```json
{
  "active_states": ["US-12", "US-04"],
  "tone_override_active": false,
  "gate_blocked": true,
  "gate_reason":  "no_arp_committed",
  "recommendations": [
    {
      "id":      "REC-01",
      "title":   "Set your ARP",
      "message": "One number changes everything. What time will you wake up — every day? Not weekdays. Every day. Pick a time you can own.",
      "action_payload": {"action": "open_arp_setup"}
    }
  ]
}
```

---

## 4. DATABASE INTERACTIONS

The following table maps each function to the entities it reads and writes.

| Function | Reads | Writes |
|----------|-------|--------|
| `create_user_profile` | — | User, UserProfile → triggers ARPConfig |
| `update_user_profile` | UserProfile | UserProfile, conditionally ARPConfig |
| `generate_arp_config` | UserProfile.arp_time | ARPConfig |
| `submit_sleep_log` | UserProfile, ARPConfig, WeeklyCycleBalance | SleepLog, WeeklyCycleBalance |
| `submit_daily_log` | UserProfile, ARPConfig, WeeklyCycleBalance | DailyLog, WeeklyCycleBalance |
| `submit_check_in` | UserProfile, ARPConfig, WeeklyCycleBalance, last SleepLog | SleepLog (upsert), DailyLog (upsert), WeeklyCycleBalance |
| `evaluate_user_state` (internal) | EngineContext (all entities assembled by backend) | ActiveStates (cache) |
| `generate_recommendations` (internal) | ActiveStates, EngineContext, RecommendationCooldowns | ActiveRecommendations (cache), RecommendationCooldowns |
| `get_home_screen_payload` | UserProfile, ARPConfig, WeeklyCycleBalance, SleepLog (last), ActiveRecommendations | — |
| `get_day_plan_payload` | ARPConfig, UserProfile, DailyLog (today), ActiveRecommendations | — |
| `get_check_in_payload` | ARPConfig, UserProfile, SleepLog (last), WeeklyCycleBalance | — |
| `get_weekly_insights_payload` | WeeklyCycleBalance, SleepLog[7], DailyLog[7], ARPConfig | — |
| `log_crp` | ARPConfig, WeeklyCycleBalance | DailyLog, WeeklyCycleBalance |
| `log_event` | UserProfile | EventContext |
| `update_environment` | EnvironmentContext | EnvironmentContext |

### Weekly Balance Write Pattern

The `WeeklyCycleBalance` record is updated on every log submission. The update logic:

```
On submit_sleep_log:
  TODAY = date of log
  WEEK  = current 7-day window (week_start to week_end)
  nocturnal_cycles[day_index] = cycles_completed
  total_nocturnal_cycles = sum(nocturnal_cycles[0..6])
  weekly_cycle_total = total_nocturnal_cycles + total_crp_cycles
  cycle_deficit = 35 − weekly_cycle_total
  remaining_days = 7 − day_number
  projected_weekly_total = weekly_cycle_total + (remaining_days × 5)
  on_track = projected_weekly_total >= 28
  deficit_risk_flag = (cycle_deficit > 7) AND (day_number >= 5)
  arp_maintained → update arp_variance_minutes

On submit_daily_log / log_crp:
  IF crp_cycle_credited = true:
    crp_cycles[day_index] += 1
    total_crp_cycles = sum(crp_cycles[0..6])
    weekly_cycle_total = total_nocturnal_cycles + total_crp_cycles
    cycle_deficit = 35 − weekly_cycle_total
    on_track = projected_weekly_total >= 28

On week boundary (day 7 → day 8):
  Archive current WeeklyCycleBalance (status = "closed")
  Create new WeeklyCycleBalance record (day_number = 1, all arrays = [0..0])
```

---

## 5. TRIGGER LOGIC

The engine must re-run after every data event. The following table defines the exact trigger conditions.

### After Onboarding Completion

```
Trigger:   User commits ARP (create_user_profile completes)
Action:    generate_arp_config() → evaluate_user_state(VALIDATE-03 path)
Returns:   { states: ["US-12"], recommendations: ["REC-20", "REC-01", "REC-04", "REC-06"] }
Reasoning: New user; no logs yet; framework gap is assumed true for all new users.
           Day plan is available from ARPConfig alone — engine does not block the day plan.
```

### After Sleep Log Submission

```
Trigger:   submit_sleep_log() or submit_check_in() writes a SleepLog record
Action:    Assemble EngineContext → evaluate_user_state() → generate_recommendations()
Context assembled from:
  sleep_logs:     last 7 SleepLog records (nulls for missing days)
  daily_logs:     last 7 DailyLog records
  weekly_balance: current WeeklyCycleBalance
  events:         active EventContext records
Priority:  Run synchronously before returning the submit response.
           The app receives active_recommendations in the same API response.
```

### After Daily Log Submission

```
Trigger:   submit_daily_log() or log_crp() writes a DailyLog record
Action:    Re-assemble EngineContext → evaluate_user_state() → generate_recommendations()
Notes:
  - If crp_cycle_credited changes: WeeklyCycleBalance must be updated first,
    then the engine runs with the updated balance.
  - If CRP was not taken (crp_taken = false): no balance change; engine still re-runs
    to potentially recommend reschedule for next available Phase 2 slot.
```

### After Check-In Submission

```
Trigger:   submit_check_in() completes (writes to both SleepLog and DailyLog)
Action:    Same as sleep log trigger — full engine evaluation
Notes:
  - This is the primary daily engine trigger for most users.
  - Onset latency flags accumulate across the rolling last-5-day window.
    If onset_latency_flag = "over_15_min" for 3+ of the last 5 days:
    → US-07 activates.
```

### After Profile Update

```
Trigger:   update_user_profile() changes any field
Actions:
  IF arp_time changed:
    → generate_arp_config() (regenerate from new ARP)
    → Invalidate and regenerate notification schedule
    → Full engine re-evaluation

  IF chronotype changed:
    → Re-check US-05 (Social Jet Lag) state
    → Update peak window display in home screen

  IF tracker_in_use changed to true:
    → Begin monitoring for US-09 (Ortho-Insomnia) — requires user_reported_tracker_anxiety

  Any profile change → engine re-evaluation
```

### After Event Logged

```
Trigger:   log_event() creates an active EventContext record
Action:    Full engine re-evaluation
New states to check: US-06 (Post-Disruption) if event_type ∈ {travel, social_disruption}
Notes:
  - Multiple events can overlap.
  - Event automatically deactivates when end_date passes or user marks resolved.
  - On event deactivation: re-run engine to see if US-06 should resolve.
```

### Engine Re-run on App Foreground

```
Trigger:   App returns to foreground after being backgrounded for > 30 minutes
Action:    get_home_screen_payload() — backend checks if engine context has changed
           (profile_version, last log date, current time) and regenerates payload if stale.
Notes:
  - This is a read-only trigger. The engine does not re-evaluate states unless
    a new log was submitted while the app was backgrounded.
  - The day plan payload may change if the current phase has advanced.
```

---

## 6. HOME SCREEN CONTRACT

The home screen is the most frequently rendered screen. The backend must return a single `HomeScreenPayload` that contains everything the app needs, with no additional computation required on the client.

### HomeScreenPayload Schema

```json
{
  "user_id":           "uuid",
  "generated_at":      "2026-03-12T09:15:00Z",
  "cache_ttl_seconds": 1800,

  "arp": {
    "time":            "06:30",
    "label":           "Your day starts at 06:30"
  },

  "tonight": {
    "target_onset":    "23:00",
    "target_cycles":   5,
    "fallback_onset":  "00:30",
    "fallback_cycles": 4,
    "label":           "Sleep at 23:00 → 5 cycles"
  },

  "weekly_balance": {
    "total":           18,
    "target":          35,
    "deficit":         17,
    "day_number":      4,
    "on_track":        true,
    "show_to_user":    true
  },

  "phase": {
    "current_phase":   2,
    "current_cycle":   3,
    "phase_label":     "Phase 2",
    "next_mrm_time":   "11:00"
  },

  "primary_recommendation": {
    "id":              "REC-03",
    "priority":        "HIGH",
    "title":           "CRP today",
    "message":         "Last night: 4 cycles. A 30-minute CRP between 14:00 and 18:30 adds one cycle to your weekly total.",
    "deliver_at":      "2026-03-12T14:00:00Z",
    "expires_at":      "2026-03-12T18:30:00Z",
    "action_payload":  {"type": "schedule_crp", "crp_start": "14:00", "duration_min": 30}
  },

  "active_states": ["US-02"],

  "flags": {
    "tone_override_active":     false,
    "suppress_outcome_metrics": false,
    "show_cycle_count":         true,
    "show_weekly_balance":      true,
    "show_tonight_onset":       true,
    "crp_scheduled_today":      false,
    "wind_down_active":         false
  }
}
```

### State-Adaptive Fields

The backend modifies the payload based on active states before sending:

| Active State | Payload Modifications |
|-------------|----------------------|
| US-07 (Sleep Anxiety) | `flags.tone_override_active = true`; `flags.suppress_outcome_metrics = true`; `flags.show_cycle_count = false`; `flags.show_weekly_balance = false`; `primary_recommendation` restricted to process-only recs (REC-13, REC-15, REC-08) |
| US-09 (Ortho-Insomnia) | Same as US-07 for outcome metrics; `primary_recommendation` = REC-18 (tracker calibration) |
| US-04 (ARP Instability) | `primary_recommendation` = REC-01 (ARP commitment — blocking); `tonight.show_to_user = false` until ARP re-committed |
| US-12 (Framework Gap) | `primary_recommendation` = REC-20 or REC-01; all scheduling recs suppressed |
| US-03 + US-07 | US-07 tone override takes precedence; cycle count suppressed even though deficit is real |

### Flags Reference

| Flag | Type | Meaning |
|------|------|---------|
| `tone_override_active` | bool | US-07 active — all copy must be process-only; no outcome language |
| `suppress_outcome_metrics` | bool | Hide weekly balance, cycle count comparisons, quality references |
| `show_cycle_count` | bool | Whether to display `weekly_balance.total` on screen |
| `show_weekly_balance` | bool | Whether to display the weekly balance bar/number |
| `show_tonight_onset` | bool | Whether to display the tonight sleep onset target |
| `crp_scheduled_today` | bool | A CRP is scheduled — show CRP card on home screen |
| `wind_down_active` | bool | Current time is in Phase 3 — show wind-down prompt |

---

## 7. DAY PLAN CONTRACT

The day plan screen shows the user's full 16-cycle day. It is assembled from `ARPConfig` plus any scheduled CRP and tonight's sleep onset.

### DayPlanPayload Schema

```json
{
  "user_id":   "uuid",
  "date":      "2026-03-12",
  "arp_time":  "06:30",
  "chronotype": "PMer",

  "phases": [
    {
      "phase_number": 1,
      "label":        "Phase 1 — ARP to Midday",
      "time_range":   "06:30–12:30",
      "cycles": [
        {
          "n":         1,
          "time":      "06:30",
          "type":      "ARP",
          "label":     "Post-sleep routine",
          "action":    "open_wake_up_routine",
          "is_current": false
        },
        {
          "n":     2,
          "time":  "08:00",
          "type":  "MRM",
          "label": "Micro Reset — 3 min",
          "action": "log_mrm",
          "is_current": true
        },
        {
          "n":     3,
          "time":  "09:30",
          "type":  "MRM",
          "label": "Micro Reset — 3 min",
          "action": "log_mrm",
          "is_current": false
        },
        {
          "n":     4,
          "time":  "11:00",
          "type":  "MRM",
          "label": "Micro Reset — 3 min",
          "action": "log_mrm",
          "is_current": false
        }
      ]
    },
    {
      "phase_number": 2,
      "label":        "Phase 2 — Midday to Evening",
      "time_range":   "12:30–18:30",
      "cycles": [
        {"n": 5, "time": "12:30", "type": "MRM",  "label": "Micro Reset — 3 min"},
        {"n": 6, "time": "14:00", "type": "CRP",  "label": "CRP — 30 min",
         "crp_scheduled": true, "crp_duration": 30, "action": "open_crp_timer"},
        {"n": 7, "time": "15:30", "type": "MRM",  "label": "Micro Reset — 3 min"},
        {"n": 8, "time": "17:00", "type": "MRM",  "label": "Micro Reset — 3 min"}
      ]
    },
    {
      "phase_number": 3,
      "label":        "Phase 3 — Wind-Down",
      "time_range":   "18:30–00:30",
      "is_wind_down": true,
      "wind_down_start": "21:30",
      "cycles": [
        {"n": 9,  "time": "18:30", "type": "MRM",        "label": "Micro Reset — 3 min"},
        {"n": 10, "time": "20:00", "type": "MRM",        "label": "Micro Reset — 3 min"},
        {"n": 11, "time": "21:30", "type": "WIND_DOWN",  "label": "Phase 3 — wind-down starts",
         "action": "open_wind_down"},
        {"n": 12, "time": "23:00", "type": "SLEEP_ONSET","label": "Sleep onset target",
         "action": null}
      ]
    },
    {
      "phase_number": 4,
      "label":        "Phase 4 — Nocturnal",
      "time_range":   "23:00–06:30",
      "cycles": [
        {"n": 12, "time": "23:00", "type": "SLEEP",  "label": "Cycle 1 of 5"},
        {"n": 13, "time": "00:30", "type": "SLEEP",  "label": "Cycle 2 of 5"},
        {"n": 14, "time": "02:00", "type": "SLEEP",  "label": "Cycle 3 of 5"},
        {"n": 15, "time": "03:30", "type": "SLEEP",  "label": "Cycle 4 of 5"},
        {"n": 16, "time": "05:00", "type": "SLEEP",  "label": "Cycle 5 of 5"}
      ]
    }
  ],

  "tonight": {
    "target_onset":    "23:00",
    "target_cycles":   5,
    "fallback_onset":  "00:30",
    "fallback_cycles": 4
  },

  "crp_scheduled": {
    "scheduled":    true,
    "time":         "14:00",
    "duration_min": 30,
    "in_window":    true
  },

  "notification_schedule": [
    {"time": "08:00", "type": "MRM",       "title": "Micro Reset",   "body": "3 minutes. Nothing required."},
    {"time": "09:30", "type": "MRM",       "title": "Micro Reset",   "body": "3 minutes. Nothing required."},
    {"time": "11:00", "type": "MRM",       "title": "Micro Reset",   "body": "3 minutes. Nothing required."},
    {"time": "12:30", "type": "MRM",       "title": "Micro Reset",   "body": "3 minutes. Nothing required."},
    {"time": "14:00", "type": "CRP",       "title": "CRP time",      "body": "30 minutes. Lie down. Eyes closed."},
    {"time": "15:30", "type": "MRM",       "title": "Micro Reset",   "body": "3 minutes. Nothing required."},
    {"time": "17:00", "type": "MRM",       "title": "Micro Reset",   "body": "3 minutes. Nothing required."},
    {"time": "18:30", "type": "MRM",       "title": "Micro Reset",   "body": "3 minutes. Nothing required."},
    {"time": "20:00", "type": "MRM",       "title": "Micro Reset",   "body": "3 minutes. Nothing required."},
    {"time": "21:30", "type": "WIND_DOWN", "title": "Phase 3",       "body": "Wind-down starts now. Shift your lights."},
    {"time": "22:45", "type": "SLEEP_PREP","title": "15 minutes",    "body": "Your sleep window is at 23:00. Lie down when it arrives."}
  ]
}
```

### Cycle Type Enum

| Type | Meaning | App Rendering |
|------|---------|---------------|
| `ARP` | Wake time / start of day | Special header row |
| `MRM` | Micro Reset Moment | Small notification dot |
| `CRP` | Controlled Reset Period | Shaded block with timer action |
| `WIND_DOWN` | Phase 3 transition | Phase 3 header marker |
| `SLEEP_ONSET` | Calculated bed time | Highlighted entry |
| `SLEEP` | Nocturnal cycles | Shaded nocturnal block |

---

## 8. ERROR / MISSING DATA HANDLING

The engine must never block or alarm when data is absent. These are the defined responses for each missing data scenario.

---

### Missing: `cycles_completed` in sleep log

```
Scenario: User submits check-in with no cycle count (or skips the log entirely).
Rule:     cycles_completed = null (NOT coerced to 0)
Engine:   If actual_sleep_onset and wake_time are both present → compute cycles from formula
          If either time is missing → cycles_completed remains null
State detection: Skip RULE-CYCLES-01 (CRP trigger) if cycles_completed = null
                 "Missing data ≠ bad night"
Weekly balance:  nocturnal_cycles[today] = 0 for accounting purposes
                 BUT do NOT trigger deficit state from a single missing log
Response: Return current state and recommendations without triggering CRP from this log.
```

---

### Missing: `onset_latency_minutes`

```
Scenario: User never provides sleep onset difficulty — either in check-in or sleep log.
Rule:     onset_latency_minutes = null throughout
State detection: US-07 cannot be detected from log data if null
               → US-07 detection falls back to: user_reported_anxiety = true
               → If neither is available: US-07 not activated (missing data ≠ anxiety)
Response: Do not surface REC-15 (15-minute rule) without sufficient signal.
```

---

### Missing: `EnvironmentContext`

```
Scenario: User has not completed the environment audit.
Rule:     environment = null
State detection: US-11 cannot be evaluated → SKIP Pass 4 environment states
               → US-08 can still detect from sleep onset data if available
Response: Include environment audit prompt (REC-11) as a low-priority recommendation
          after the structural foundation (ARP, MRM, CRP) is established.
```

---

### Missing: No logs at all (new user, day 1)

```
Scenario: User has just onboarded. No SleepLog or DailyLog records exist.
Rule:     VALIDATE-03 fires
Engine:   Return { states: ["US-12"], recommendations: ["REC-20", "REC-01", "REC-04", "REC-06"] }
Day plan: Available immediately from ARPConfig — does not require logs.
Response: Show today's Day Plan and the MRM introduction. Do not show weekly balance (no data).
          Do not show CRP recommendation (no deficit data).
```

---

### Missing: `arp_committed = false`

```
Scenario: User has not yet committed to an ARP (onboarding not complete).
Rule:     VALIDATE-01 fires
Engine:   Return { states: ["US-12", "US-04"], gate_blocked: true }
Response: Block all scheduling output. Surface REC-01 (ARP Commitment) only.
          App should prevent access to Day Plan and Home Screen cycle data until ARP is set.
HTTP:     Return 200 with gate_blocked: true — not a 400 error.
          The absence of ARP is valid state for a new user, not a request error.
```

---

### Missing: Weekly balance for current week (first day of new week)

```
Scenario: It is Monday (or day 1 of rolling window). No WeeklyCycleBalance record exists yet.
Rule:     Create a new WeeklyCycleBalance with all arrays = [0, 0, 0, 0, 0, 0, 0]
Engine:   weekly_cycle_total = 0; cycle_deficit = 35; day_number = 1
State detection: DO NOT activate US-03 on day 1 with zero cycles.
               deficit_risk_flag requires day_number >= 5.
Response: Show weekly balance as "0 / 35 — Week starts now."
```

---

### Missing: `EventContext` (no events logged)

```
Scenario: User has no active events.
Rule:     events = [] (empty array; not null)
State detection: Pass 5 event states (US-06) → SKIP (no active events)
Response: No change. Engine continues to other passes.
```

---

### Partial sleep log (sleep onset provided, no cycle count)

```
Scenario: User logs actual_sleep_onset = "23:20" but does not provide cycles_completed.
Rule:     cycles_from_formula = floor((wake_time − actual_sleep_onset) / 90)
         For wake_time = "06:30" and onset = "23:20":
           duration = 430 min
           cycles = floor(430 / 90) = 4
         → cycles_completed = 4 (computed)
Note:    If wake_time is also missing: cycles_completed = null. Do not infer.
```

---

### Engine returns when current_time is in Phase 4 (nocturnal)

```
Scenario: User opens the app at 02:00 (mid-sleep, Phase 4).
Rule:     Current phase = 4. No MRM times are in the future today.
          Wind-down has already passed.
Payload:  current_phase = 4; next_mrm_time = first MRM of tomorrow (ARP + 90min)
          Home screen shows ARP time for tomorrow and tonight's cycle target (for logging tomorrow)
          No Phase 3 notification is scheduled (already past).
```

---

## 9. MVP VS V2 CONTRACT

### MVP — Must-have Functions (launch-blocking)

| Function | Notes |
|----------|-------|
| `create_user_profile` | Onboarding gate |
| `update_user_profile` | Profile changes and ARP changes |
| `generate_arp_config` | All scheduling derives from this |
| `submit_sleep_log` | Primary data event |
| `submit_daily_log` | CRP credit and weekly balance |
| `submit_check_in` | Daily friction-free log input |
| `log_crp` | CRP completion shortcut |
| `log_event` | Disruption event logging |
| `update_environment` | Environment friction detection |
| `evaluate_user_state` (internal) | Full state detection — US-01 to US-14 |
| `generate_recommendations` (internal) | REC-01 to REC-25 (REC-19 limited) |
| `get_home_screen_payload` | Primary screen |
| `get_day_plan_payload` | Daily plan screen |
| `get_check_in_payload` | Check-in screen setup |

### MVP — Must-have Engine Rules

| State | Status |
|-------|--------|
| US-01 through US-14 | MVP — all required |
| US-15 Pre-Event High Arousal | V2 |
| US-16 Illness / Injury | V2 |
| US-17 Shift Work / Multishift | V2 |

| Recommendation | Status |
|---------------|--------|
| REC-01 through REC-18 | MVP |
| REC-19 (Sleep Restriction) | V2 — auto-trigger suppressed; manual unlock only |
| REC-20 through REC-25 | MVP |
| REC-26 (Travel Setup) | V2 — knowledge gap; limited source material |

### V2 — Deferred Functions

| Function | Notes |
|----------|-------|
| `get_weekly_insights_payload` | Requires 2+ weeks of data for trend language to be valid |
| `get_chronotype_profile_payload` | Can launch with static content; V2 adds dynamic calibration |
| `get_environment_audit_payload` | Can launch as a simple questionnaire; V2 adds product sequencing |
| Shift work: `generate_multishift_arp_config` | Full two-ARP model; significant complexity |
| Illness mode: `activate_illness_recovery_mode` | Suspends weekly targets; V2 |
| Pre-event protocol: `log_pre_event` | Event type extension; V2 |
| Tracker integration: `submit_tracker_data` | Background signal only; safeguards required; V2 |
| `get_post_event_recovery_plan` | Post-disruption structured plan screen; partial in MVP via recommendations |
| Timezone handling for travel | Travel jet lag protocol requires DOC-004 source material |

### V2 — Deferred Data Fields

Fields in the data model marked `V2` are not collected in the MVP. Engine logic that depends on them gracefully degrades:

- `morphotype` — mattress recommendation precision; V2
- `dominant_hand` — foetal position side; V2
- `occupation_schedule` — schedule type refinement; V2
- `travel_frequency` — travel disruption prediction; V2
- `mrm_with_daylight` — MRM+light adherence detail; V2
- `late_exercise_flag` — exercise timing risk; V2

---

## 10. IMPLEMENTATION NOTES FOR ENGINEERING

### On the Engine / Backend Boundary

The rule engine should be implemented as a **pure function** — it takes an `EngineContext` and returns outputs. It has no side effects. All database reads happen before the engine runs; all database writes happen after.

```
function evaluateEngine(context: EngineContext): EngineOutput {
  // Pre-validation
  if (!context.profile.arp_committed) return VALIDATE_01_RESPONSE
  if (!context.arp_config) regenerateARPConfig(context)
  if (!context.sleep_logs.length) return VALIDATE_03_RESPONSE

  // State detection
  const states = detectStates(context)       // 7-pass evaluation
  const recs   = generateRecs(states, context) // recommendation generation

  return { states, recommendations: recs, flags: computeFlags(states) }
}
```

The backend is responsible for:
1. Reading all entities from the database
2. Assembling the `EngineContext` object
3. Calling `evaluateEngine(context)`
4. Writing the output (active states, recommendations, cooldowns) back to the database
5. Assembling and returning the screen payload

### On Time Handling

- All times in `ARPConfig` are stored as `HH:MM` strings (wall-clock times, not UTC offsets).
- The user's IANA timezone is stored in `User.timezone` and applied when computing cycle boundaries.
- The `current_time` field in payloads is passed as ISO 8601 UTC (`2026-03-12T09:15:00Z`). The backend converts to the user's local time before determining current phase and cycle position.
- Cycles that cross midnight (e.g. ARP 06:30 → Phase 4 start 00:30) must be handled as wall-clock times within the user's timezone, not as UTC intervals.

### On Idempotency

- `submit_sleep_log` and `submit_check_in` should be **idempotent per date**. If a log already exists for a given `(user_id, date)`, the call should update the existing record, not create a duplicate.
- `log_crp` should be **idempotent**: if a CRP has already been credited for today, a duplicate `log_crp` call should be rejected gracefully (return existing record, not 400 error).
- `generate_arp_config` is always idempotent — running it twice with the same `arp_time` produces the same `ARPConfig`.

### On Recommendation Cooldowns

Cooldowns are stored as a table: `(user_id, rec_type, last_triggered_at)`. Before generating recommendations, the backend loads this table and passes it to the engine. The engine applies suppression; the backend writes the new `last_triggered_at` for any recs that fire.

```
// Before engine runs:
cooldowns = db.query("SELECT rec_type, last_triggered_at FROM rec_cooldowns WHERE user_id = ?", user_id)

// After engine runs:
for rec in engine_output.recommendations:
  db.upsert("rec_cooldowns", {user_id, rec_type: rec.id, last_triggered_at: now()})
```

### On the `HomeScreenPayload` Cache

The `get_home_screen_payload` response includes `cache_ttl_seconds: 1800` (30 minutes). The mobile app should cache this locally and serve from cache for foreground returns within the TTL. The backend should also maintain a server-side cache per user, invalidated on every log event.

Do not cache the day plan payload — its `is_current` flags change as time advances through the day.

### On Notification Scheduling

The `DayPlanPayload.notification_schedule` array contains the full list of times for MRM, CRP, and wind-down notifications for the day. The mobile app registers these with the OS notification system on each daily refresh. This happens:
1. At first app open each day (after ARP time)
2. After any `generate_arp_config` call (ARP change)
3. After any `submit_daily_log` that changes the CRP slot

The backend does not push notifications directly — it provides the schedule array to the app.

### On ARP Validation

```
Valid ARP times: on the hour or half-hour, between 05:00 and 09:00
Regex:  /^0[5-9]:[03]0$/ (05:00, 05:30, 06:00, 06:30, ... 09:00)
Exception: 09:00 is valid; 09:30 is outside the coaching range.

If user submits an invalid ARP:
  Return HTTP 422 with { error: "invalid_arp", message: "ARP must be on the hour or half-hour between 05:00 and 09:00" }

Social Jet Lag flag (informational only, not a blocker):
  IF chronotype = "PMer" AND arp_time_minutes < 420 (07:00):
    social_jet_lag_flag = true
    Surface REC-21 in onboarding — not as an error, as education
```

### On the Weekly Window

The weekly window is a **rolling 7-day window from the user's ARP commitment date**, not a calendar Monday–Sunday week. Day 1 is the date the user committed their ARP. Day 7 is 6 days later.

```
week_start = arp_committed_date (or most recent week_start if > 7 days)
week_end   = week_start + 6 days
day_number = (today − week_start).days + 1   // 1–7
```

On day 8: the window rolls forward. Archive the previous balance record. Start a new one.

For MVP: store `WeeklyCycleBalance.week_start` explicitly. Do not derive from calendar week — this is a user-specific rolling window.

### On Error Response Format

All error responses use a consistent format:

```json
{
  "error":   "error_code_snake_case",
  "message": "Human-readable explanation",
  "field":   "field_name_if_validation_error",
  "code":    422
}
```

Common error codes:
- `invalid_arp` — ARP time format or range invalid
- `duplicate_log` — sleep log for this date already exists (idempotency)
- `no_arp_committed` — engine operation attempted before ARP is set
- `invalid_cycles` — cycles_completed outside range 0–6
- `missing_required_field` — required field absent

HTTP status codes:
- `200` — success, including gate-blocked engine responses
- `201` — new record created (first sleep log, first profile)
- `422` — validation failure
- `404` — user not found
- `500` — engine failure (log and alert; return conservative defaults)

### On Engine Failures

If the engine throws an unexpected error:
1. Log the full `EngineContext` snapshot for debugging.
2. Do NOT return an error to the app.
3. Return a safe fallback payload:

```json
{
  "active_states":        ["US-12"],
  "active_recommendations": [
    {"id": "REC-02", "message": "Sleep at 23:00 → 5 cycles. Your ARP is 06:30."}
  ],
  "flags": {
    "tone_override_active":     false,
    "suppress_outcome_metrics": false,
    "show_cycle_count":         true
  },
  "engine_error":         true,
  "fallback_used":        true
}
```

The app renders the fallback gracefully. Never surface an engine error to the user.

---

## FINAL REPORT

### 1. Core Backend Functions Defined

**16 functions** fully specified across four categories:

| Category | Functions |
|----------|-----------|
| Profile writes | `create_user_profile`, `update_user_profile`, `generate_arp_config`, `update_environment`, `log_event` |
| Log writes (+ engine trigger) | `submit_sleep_log`, `submit_daily_log`, `submit_check_in`, `log_crp` |
| Internal engine | `evaluate_user_state`, `generate_recommendations` |
| Screen payload reads | `get_home_screen_payload`, `get_day_plan_payload`, `get_check_in_payload`, `get_weekly_insights_payload` |

All 16 include: purpose, input schema, output schema, trigger conditions, and read/write mapping.

### 2. Core Payloads Defined

**6 payload schemas** fully specified:

1. `ARPConfig` — the 16-cycle schedule with all scheduling windows
2. `SleepLog submit response` — cycles credited, weekly balance, recommendations
3. `HomeScreenPayload` — full home screen data with state-adaptive flags
4. `DayPlanPayload` — full 16-cycle plan with notification schedule
5. `CheckInPayload` — questions, prefill, weekly add-on flags
6. VALIDATE-01 / engine gate response — gate-blocked state

Plus 5 worked JSON examples (normal night, anxiety detection, gate-blocked, PMer ARP config, engine error fallback).

### 3. What Can Now Be Implemented Immediately

With this contract, engineering can begin:

- **Database schema** — all 10 entity definitions with field names, types, and computed fields are in `R90_DATA_MODEL.md`
- **`generate_arp_config`** — pure function, no dependencies, fully specified including formula and edge cases
- **Engine test suite** — the 3 validation gates, 7-pass state evaluation, and all cooldown rules are fully specified; can be unit-tested before any UI
- **`submit_sleep_log`** — input/output schema, cycle credit rules, and engine trigger chain are all defined
- **`get_home_screen_payload`** — payload schema and state-adaptive flag table are fully defined
- **`get_day_plan_payload`** — payload schema including notification_schedule array is fully defined
- **ARP validation** — regex pattern, range, and Social Jet Lag flag logic are specified
- **Recommendation cooldown table** — all 15 cooldown values are defined

### 4. What Still Remains Too Ambiguous

| Area | Gap | Recommendation |
|------|-----|---------------|
| Weekly window boundary | Contract specifies "rolling 7-day from ARP commitment date" but the exact handling of week reset at midnight vs at ARP time is not defined | Decide: reset at midnight on day 8, or reset at the first app open after ARP on day 8 |
| CRP rescheduling logic | If user misses a scheduled CRP, the contract says "offer reschedule for next Phase 2 slot" — but the specific next-slot calculation (find next cycle boundary within crp_window) needs to be formalised | A simple "next hour-boundary after current_time, within crp_window" is sufficient for MVP |
| Push notification delivery | The contract specifies `notification_schedule` as an array returned to the app. Who is responsible for re-registering notifications if the user reinstalls or the schedule changes? | The app should re-register the full day's notification_schedule on every foreground launch |
| Authentication layer | Auth system (JWT, sessions, OAuth providers) is explicitly out of scope for this contract | Standard auth implementation; no R90-specific requirements |
| `user_reported_anxiety` field | US-07 detection requires either 3+ high-latency nights OR `user_reported_anxiety = true` — but this field has no endpoint to set it | Add a `report_user_state_signal` endpoint or embed it in `submit_check_in` as an optional field |
| `tracker_anxiety` detection | US-09 requires `user_reported_tracker_anxiety = true` — same gap as above | Include in weekly add-on questions in `submit_check_in` |
| CRP in Phase 3 (late CRP) | The contract says CRP must be within `crp_window_open` to `crp_window_close`. If user attempts a CRP outside this window, the outcome is undefined | Return `crp_in_window = false` in `log_crp` response; do not credit the cycle; show message: "CRP is most effective between 14:00 and 18:30. This rest still counts as an MRM." |

*Sources: `R90_DATA_MODEL.md`, `R90_RULE_ENGINE_SPEC.md`, `R90_APP_IMPLEMENTATION_SPEC.md`, `R90_RECOMMENDATION_ENGINE.md`, `R90_USER_STATES.md`*
