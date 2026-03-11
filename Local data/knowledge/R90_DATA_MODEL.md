# R90 Data Model

**Version:** 1.0
**Date:** 2026-03-11
**Status:** Design draft — ready for engineering review
**Depends on:** `R90_CANONICAL_SYSTEM.md` (frozen), `R90_DECISION_ENGINE.md`
**Purpose:** Define every entity, attribute, and relationship required for the R90 engine to operate. No new principles are introduced — all logic derives from the canonical system.

**Notation conventions:**
- `REQUIRED` — must be present for the engine to function
- `OPTIONAL` — improves precision but has a safe default
- `COMPUTED` — derived; not stored by the user directly
- `MVP` — included in the minimum viable first release
- `V2` — defer to second release

---

## 1. SYSTEM ENTITIES

The R90 engine operates on eight primary entities. They form two layers: the **persistent profile layer** (who this person is) and the **operational log layer** (what happened today and this week).

```
┌─────────────────────────────────────────────────────┐
│                  PROFILE LAYER                      │
│  User ──► UserProfile ──► EnvironmentContext        │
│               │                                     │
│               └──► ARPConfig                        │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                  OPERATIONAL LAYER                  │
│  SleepLog ──► DailyLog ──► WeeklyCycleBalance       │
│                                                     │
│  EventContext (contextual modifier)                 │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                  ENGINE LAYER                       │
│  UserState ──► Recommendation                      │
└─────────────────────────────────────────────────────┘
```

---

### Entity 1 — User

The root account record. Identity only — no behavioural data.

| Attribute | Type | Required | MVP | Description | Example |
|-----------|------|----------|-----|-------------|---------|
| `user_id` | UUID | REQUIRED | MVP | Unique identifier | `a3f2...` |
| `created_at` | datetime | REQUIRED | MVP | Account creation timestamp | `2026-03-11T09:00:00Z` |
| `onboarding_completed` | boolean | REQUIRED | MVP | Whether the user has completed the setup flow | `false` |
| `onboarding_step` | integer | REQUIRED | MVP | Current onboarding step (1=ARP, 2=chronotype, 3=cycles, 4=environment) | `2` |
| `locale` | string | OPTIONAL | V2 | Language/region for coaching message localisation | `en-GB` |
| `timezone` | string | REQUIRED | MVP | IANA timezone — used for all cycle time calculations | `Europe/London` |

---

### Entity 2 — UserProfile

The persistent characterisation of the user. Updated during onboarding and refined over time.

| Attribute | Type | Required | MVP | Description | Example |
|-----------|------|----------|-----|-------------|---------|
| `user_id` | UUID | REQUIRED | MVP | FK → User | — |
| `chronotype` | enum | REQUIRED | MVP | `AMer` / `PMer` / `In-betweener` / `Unknown` | `PMer` |
| `chronotype_confidence` | enum | COMPUTED | V2 | `self_reported` / `inferred` / `calibrated` (after 4+ weeks of data) | `self_reported` |
| `arp_committed` | boolean | REQUIRED | MVP | Whether user has committed to a fixed ARP | `true` |
| `arp_time` | time | REQUIRED | MVP | Fixed daily wake time on the hour or half-hour (HH:MM) | `06:30` |
| `arp_committed_at` | datetime | OPTIONAL | V2 | When ARP was committed (for 7-day trial tracking) | `2026-03-11T06:30:00Z` |
| `cycle_target` | integer | REQUIRED | MVP | Default nocturnal cycle target. Range: 3–6. Default: 5 | `5` |
| `multishift_enabled` | boolean | REQUIRED | MVP | Whether shift work dual-ARP mode is active | `false` |
| `shift_arp_day` | time | OPTIONAL | V2 | Day-shift ARP (default 06:00 for multishift) | `06:00` |
| `shift_arp_night` | time | OPTIONAL | V2 | Night-shift ARP (default 18:00 for multishift) | `18:00` |
| `active_shift` | enum | OPTIONAL | V2 | `day` / `night` — determines which ARP is active this week | `day` |
| `sleep_partner` | boolean | OPTIONAL | MVP | Shared bed — triggers duvet and position recommendations | `true` |
| `dominant_hand` | enum | OPTIONAL | V2 | `left` / `right` / `unknown` — determines bed side (foetal position) | `right` |
| `morphotype` | enum | OPTIONAL | V2 | `ectomorph` / `mesomorph` / `endomorph` / `unknown` — mattress surface | `mesomorph` |
| `caffeine_use` | enum | OPTIONAL | MVP | `none` / `low` / `moderate` / `high` | `moderate` |
| `caffeine_cutoff_time` | time | OPTIONAL | MVP | Latest usual caffeine consumption time | `14:00` |
| `tracker_in_use` | boolean | OPTIONAL | MVP | Sleep tracker active — triggers ortho-insomnia risk monitoring | `true` |
| `travel_frequency` | enum | OPTIONAL | V2 | `rare` / `monthly` / `weekly` / `very_frequent` | `monthly` |
| `occupation_schedule` | enum | OPTIONAL | V2 | `standard` / `early_starts` / `late_finishes` / `shift_work` / `irregular` | `standard` |
| `profile_version` | integer | REQUIRED | MVP | Increments on any profile change — for cache invalidation | `3` |
| `updated_at` | datetime | REQUIRED | MVP | Last profile update | `2026-03-11T10:00:00Z` |

---

### Entity 3 — ARPConfig

Computed from the ARP time. All cycle times, phase boundaries, and scheduling windows derive from this entity. Recalculated whenever `arp_time` changes. **Never input directly by the user** — always derived.

| Attribute | Type | MVP | Description | Example (ARP 06:30) |
|-----------|------|-----|-------------|---------------------|
| `user_id` | UUID | MVP | FK → User | — |
| `arp_time` | time | MVP | Source ARP (copied from UserProfile) | `06:30` |
| `cycle_times` | time[16] | MVP | Cn = ARP + (n−1) × 90min, for n=1..16 | `[06:30, 08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00, 21:30, 23:00, 00:30, 02:00, 03:30, 05:00]` |
| `phase_1_start` | time | MVP | C1 — ARP itself | `06:30` |
| `phase_2_start` | time | MVP | C5 — ARP + 6h | `12:30` |
| `phase_3_start` | time | MVP | C9 — ARP + 12h | `18:30` |
| `phase_4_start` | time | MVP | C13 — ARP + 18h | `00:30` |
| `crp_window_open` | time | MVP | C6 — earliest CRP start (ARP + 7.5h) | `14:00` |
| `crp_window_close` | time | MVP | C9 — latest CRP end (ARP + 12h) | `18:30` |
| `sleep_onset_6cycle` | time | MVP | ARP − 9h | `21:30` |
| `sleep_onset_5cycle` | time | MVP | ARP − 7.5h (target) | `23:00` |
| `sleep_onset_4cycle` | time | MVP | ARP − 6h (floor) | `00:30` |
| `sleep_onset_3cycle` | time | MVP | ARP − 4.5h (emergency) | `02:00` |
| `pre_sleep_window_open` | time | MVP | C11 (earliest standard onset) | `21:30` |
| `pre_sleep_window_ideal` | time | MVP | C12 (5-cycle target onset) | `23:00` |
| `pre_sleep_window_floor` | time | MVP | C13 (4-cycle floor onset) | `00:30` |
| `deep_sleep_window_open` | time | MVP | ~23:00 for standard ARP — first high-quality deep sleep cycle | `23:00` |
| `deep_sleep_window_close` | time | MVP | ~02:00 — after this, deep sleep proportion drops | `02:00` |
| `mrm_times` | time[10] | MVP | One MRM target per waking cycle (C2–C11): ARP + n × 90min, n=1..10 | `[08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00, 21:30]` |
| `generated_at` | datetime | MVP | When this config was computed | `2026-03-11T06:30:00Z` |

**Formula reference:**
```
Cn            = arp_time + (n − 1) × 90 minutes
sleep_onset_N = arp_time − (N × 90 minutes)
crp_window    = [C6, C9]  =  [ARP + 450min, ARP + 720min]
mrm_times     = [C2..C11] =  [ARP + 90min, ARP + 180min, ..., ARP + 900min]
```

---

### Entity 4 — SleepLog

One record per night. Captures what happened during the nocturnal sleep period.

| Attribute | Type | Required | MVP | Description | Example |
|-----------|------|----------|-----|-------------|---------|
| `log_id` | UUID | REQUIRED | MVP | Unique identifier | — |
| `user_id` | UUID | REQUIRED | MVP | FK → User | — |
| `date` | date | REQUIRED | MVP | The calendar date of the *morning* wake (not the night of sleep) | `2026-03-12` |
| `intended_sleep_onset` | time | REQUIRED | MVP | Calculated target onset from ARPConfig | `23:00` |
| `actual_sleep_onset` | time | REQUIRED | MVP | Self-reported time of actually getting into bed/attempting sleep | `23:15` |
| `sleep_felt_onset` | time | OPTIONAL | V2 | Estimated time when sleep actually occurred (vs getting into bed) | `23:30` |
| `wake_time` | time | REQUIRED | MVP | Actual wake time (should match ARP if adhered) | `06:30` |
| `arp_maintained` | boolean | COMPUTED | MVP | Whether `wake_time` is within 15 min of `arp_time` | `true` |
| `cycles_completed` | integer | REQUIRED | MVP | Self-reported or calculated from onset-to-wake (range 0–6) | `5` |
| `onset_latency_minutes` | integer | OPTIONAL | MVP | How long it took to fall asleep after getting into bed (0–120+) | `15` |
| `onset_latency_flag` | boolean | COMPUTED | MVP | `true` if onset_latency > 15 min | `false` |
| `night_wakings` | integer | OPTIONAL | MVP | Number of times woken during the night (0–5+) | `0` |
| `night_waking_2_to_4am` | boolean | OPTIONAL | MVP | Woke specifically in the 2–4am window | `false` |
| `waking_cause` | enum | OPTIONAL | V2 | `none` / `alarm` / `natural` / `partner` / `noise` / `unknown` | `natural` |
| `pre_sleep_routine_done` | boolean | OPTIONAL | MVP | Phase 3 wind-down completed | `true` |
| `post_sleep_routine_done` | boolean | OPTIONAL | MVP | Post-ARP sequence completed | `true` |
| `subjective_energy_on_waking` | integer | OPTIONAL | MVP | 1 (exhausted) – 5 (excellent) | `4` |
| `disruption_event_id` | UUID | OPTIONAL | MVP | FK → EventContext (if a disruption applies) | — |
| `notes` | string | OPTIONAL | V2 | Free text (for coaching review) | `"Noisy neighbours at 2am"` |
| `created_at` | datetime | REQUIRED | MVP | Log entry creation time | — |

**Cycle calculation rule (used when user does not self-report a cycle count):**
```
cycles_completed = floor((wake_time − actual_sleep_onset) / 90 minutes)
```

---

### Entity 5 — DailyLog

One record per calendar day. Captures daytime recovery activity (CRP, MRM) and key signals.

| Attribute | Type | Required | MVP | Description | Example |
|-----------|------|----------|-----|-------------|---------|
| `log_id` | UUID | REQUIRED | MVP | Unique identifier | — |
| `user_id` | UUID | REQUIRED | MVP | FK → User | — |
| `date` | date | REQUIRED | MVP | Calendar date | `2026-03-12` |
| `crp_taken` | boolean | REQUIRED | MVP | Whether a CRP was completed today | `true` |
| `crp_count` | integer | COMPUTED | MVP | Number of CRPs today (usually 0–1; up to 2 in recovery mode) | `1` |
| `crp_duration_minutes` | integer | OPTIONAL | MVP | Duration of CRP: 20, 30, or 90 | `30` |
| `crp_start_time` | time | OPTIONAL | MVP | When the CRP started | `14:00` |
| `crp_type` | enum | OPTIONAL | V2 | `standard` / `nsdr` / `extended` | `standard` |
| `crp_in_window` | boolean | COMPUTED | MVP | Whether CRP fell within the Phase 2 window (crp_window_open to crp_window_close) | `true` |
| `crp_cycle_credited` | boolean | COMPUTED | MVP | `true` if crp_duration ≥ 20 min — counts as 1 cycle | `true` |
| `mrm_count` | integer | REQUIRED | MVP | Number of MRMs taken (target: 7; range 0–12) | `5` |
| `mrm_target` | integer | COMPUTED | MVP | Always 7 | `7` |
| `mrm_with_daylight` | integer | OPTIONAL | V2 | How many MRMs were paired with daylight/outdoor exposure | `3` |
| `morning_light_achieved` | boolean | OPTIONAL | MVP | Whether 10,000 Lux exposure occurred in Cycle 1 | `true` |
| `morning_light_method` | enum | OPTIONAL | V2 | `outdoor` / `dws` / `light_therapy` / `window` / `none` | `outdoor` |
| `evening_light_managed` | boolean | OPTIONAL | MVP | Whether Phase 3 light was shifted to amber/dim | `true` |
| `subjective_energy_midday` | integer | OPTIONAL | MVP | 1–5 energy rating at midday (Phase 2) | `3` |
| `subjective_energy_evening` | integer | OPTIONAL | MVP | 1–5 energy rating at Phase 3 entry | `4` |
| `caffeine_doses` | integer | OPTIONAL | MVP | Number of caffeinated drinks today | `2` |
| `caffeine_last_time` | time | OPTIONAL | MVP | Last caffeine consumption time | `13:30` |
| `caffeine_after_cutoff` | boolean | COMPUTED | MVP | `true` if caffeine_last_time > user.caffeine_cutoff_time | `false` |
| `exercise_completed` | boolean | OPTIONAL | V2 | Whether exercise was done today | `true` |
| `exercise_start_time` | time | OPTIONAL | V2 | Time exercise began | `17:30` |
| `exercise_phase` | enum | COMPUTED | V2 | `phase_1` / `phase_2` / `phase_3` — derived from exercise_start_time vs phase boundaries | `phase_3` |
| `late_exercise_flag` | boolean | COMPUTED | V2 | AMer + exercise in Phase 3 → risk flag | `true` |
| `disruption_event_id` | UUID | OPTIONAL | MVP | FK → EventContext | — |
| `created_at` | datetime | REQUIRED | MVP | — | — |

---

### Entity 6 — WeeklyCycleBalance

One record per calendar week. The primary accounting unit of the R90 system. **Computed nightly** from the SleepLog and DailyLog records for the current week.

| Attribute | Type | Required | MVP | Description | Example |
|-----------|------|----------|-----|-------------|---------|
| `balance_id` | UUID | REQUIRED | MVP | Unique identifier | — |
| `user_id` | UUID | REQUIRED | MVP | FK → User | — |
| `week_start` | date | REQUIRED | MVP | Monday of this week | `2026-03-09` |
| `week_end` | date | REQUIRED | MVP | Sunday of this week | `2026-03-15` |
| `day_number` | integer | COMPUTED | MVP | Current day of the week (1–7); used for pace calculation | `4` |
| `nocturnal_cycles` | integer[7] | REQUIRED | MVP | Cycles per night for each day of the week | `[5, 4, 5, 3, 0, 0, 0]` |
| `crp_cycles` | integer[7] | REQUIRED | MVP | CRP cycles per day (0 or 1 per day; up to 2 in recovery mode) | `[1, 1, 0, 1, 0, 0, 0]` |
| `total_nocturnal_cycles` | integer | COMPUTED | MVP | Sum of nocturnal_cycles | `17` |
| `total_crp_cycles` | integer | COMPUTED | MVP | Sum of crp_cycles | `3` |
| `weekly_cycle_total` | integer | COMPUTED | MVP | total_nocturnal + total_crp | `20` |
| `weekly_target` | integer | REQUIRED | MVP | Always 35 | `35` |
| `weekly_floor` | integer | REQUIRED | MVP | Always 28 | `28` |
| `cycle_deficit` | integer | COMPUTED | MVP | weekly_target − weekly_cycle_total | `15` |
| `projected_weekly_total` | integer | COMPUTED | MVP | weekly_cycle_total + (remaining_days × daily_standard) — estimates end-of-week total | `30` |
| `on_track` | boolean | COMPUTED | MVP | `true` if projected_weekly_total ≥ 28 | `true` |
| `deficit_risk_flag` | boolean | COMPUTED | MVP | `true` if cycle_deficit > 7 AND day_number ≥ 5 | `false` |
| `mrm_total` | integer | COMPUTED | MVP | Sum of mrm_count across the week | `22` |
| `mrm_target` | integer | REQUIRED | MVP | Always 42 (7/day × 6 active days, or 7×7=49 — use 42 as standard floor) | `42` |
| `crp_count_total` | integer | COMPUTED | MVP | Number of days on which a CRP was taken | `3` |
| `crp_target` | integer | REQUIRED | MVP | Always 5 (floor: 5 CRPs per week) | `5` |
| `arp_variance_minutes` | integer | COMPUTED | MVP | Max deviation from arp_time across logged wake_times this week | `5` |
| `arp_stable` | boolean | COMPUTED | MVP | `true` if arp_variance ≤ 15 min across all days | `true` |
| `computed_at` | datetime | REQUIRED | MVP | Last computation timestamp | `2026-03-12T07:00:00Z` |

**Weekly accounting rules (from canonical system):**
```
weekly_cycle_total = Σ nocturnal_cycles[1..7] + Σ crp_cycles[1..7]
cycle_deficit      = 35 − weekly_cycle_total
deficit_risk_flag  = (cycle_deficit > 7) AND (day_number >= 5)
on_track           = projected_weekly_total >= 28
```

---

### Entity 7 — UserState

The engine's current classification of the user's recovery situation. Multiple states can be active simultaneously. The engine surfaces the highest-priority active state for primary recommendation generation.

| Attribute | Type | Required | MVP | Description | Example |
|-----------|------|----------|-----|-------------|---------|
| `state_record_id` | UUID | REQUIRED | MVP | Unique identifier for this state instance | — |
| `user_id` | UUID | REQUIRED | MVP | FK → User | — |
| `state_id` | enum | REQUIRED | MVP | `US-01` through `US-17` | `US-02` |
| `active` | boolean | REQUIRED | MVP | Whether this state is currently active | `true` |
| `priority` | integer | REQUIRED | MVP | Lower number = higher priority (1=critical, 2=high, 3=medium, 4=low) | `2` |
| `detected_at` | datetime | REQUIRED | MVP | When this state was first detected | `2026-03-12T07:00:00Z` |
| `resolved_at` | datetime | OPTIONAL | MVP | When the state was resolved (null if ongoing) | `null` |
| `trigger_signals` | string[] | REQUIRED | MVP | Human-readable list of what triggered this state | `["cycles_last_3_nights: [4, 3, 4]", "crp_not_taken: 2 days"]` |
| `detection_source` | enum | REQUIRED | MVP | `sleep_log` / `daily_log` / `weekly_balance` / `onboarding` / `user_report` | `weekly_balance` |
| `auto_resolved` | boolean | COMPUTED | MVP | `true` if state resolved without explicit user action | `false` |

---

### Entity 8 — Recommendation

A single actionable output from the engine. Generated when a UserState is active and the relevant recommendation has not recently been delivered.

| Attribute | Type | Required | MVP | Description | Example |
|-----------|------|----------|-----|-------------|---------|
| `rec_id` | UUID | REQUIRED | MVP | Unique identifier | — |
| `user_id` | UUID | REQUIRED | MVP | FK → User | — |
| `recommendation_type` | enum | REQUIRED | MVP | `REC-01` through `REC-26` | `REC-03` |
| `category` | enum | REQUIRED | MVP | `foundation` / `scheduling` / `environment_light` / `anxiety_mindset` / `tracking_review` / `specialist` | `scheduling` |
| `triggered_by_states` | enum[] | REQUIRED | MVP | Which UserStates triggered this recommendation | `["US-02", "US-03"]` |
| `priority` | integer | REQUIRED | MVP | 1=CRITICAL, 2=HIGH, 3=MEDIUM, 4=LOW | `2` |
| `status` | enum | REQUIRED | MVP | `pending` / `delivered` / `actioned` / `dismissed` / `expired` | `delivered` |
| `delivery_channel` | enum | REQUIRED | MVP | `push_notification` / `in_app_card` / `weekly_review` / `onboarding_step` | `in_app_card` |
| `generated_at` | datetime | REQUIRED | MVP | When this recommendation was created | `2026-03-12T07:00:00Z` |
| `deliver_at` | datetime | REQUIRED | MVP | When to surface it (may be immediate or scheduled) | `2026-03-12T12:00:00Z` |
| `expires_at` | datetime | OPTIONAL | MVP | After which this recommendation is no longer relevant | `2026-03-12T18:30:00Z` |
| `coaching_message` | string | REQUIRED | MVP | User-facing coaching language | `"You had 3 cycles last night. A 30-minute rest this afternoon between 12:30 and 18:30 will add one full cycle to this week's total."` |
| `action_payload` | json | OPTIONAL | MVP | Machine-readable action data (e.g. CRP time to schedule) | `{"crp_start": "14:00", "duration": 30}` |
| `actioned_at` | datetime | OPTIONAL | MVP | When user acknowledged or acted | `null` |
| `dismissed_at` | datetime | OPTIONAL | MVP | When user dismissed | `null` |
| `cooldown_hours` | integer | REQUIRED | MVP | Minimum hours before the same recommendation_type can fire again | `24` |

---

### Entity 9 — EnvironmentContext

The user's persistent physical sleep environment profile. Collected during onboarding and updated during the environment audit (REC-11).

| Attribute | Type | Required | MVP | Description | Example |
|-----------|------|----------|-----|-------------|---------|
| `env_id` | UUID | REQUIRED | MVP | — | — |
| `user_id` | UUID | REQUIRED | MVP | FK → User | — |
| `bedroom_temperature` | enum | OPTIONAL | MVP | `hot` / `comfortable` / `cool` / `variable` | `hot` |
| `blackout_provision` | boolean | OPTIONAL | MVP | Blackout blinds or equivalent | `false` |
| `dws_device` | boolean | OPTIONAL | MVP | Dawn Wake Simulator present | `false` |
| `blackout_without_dws` | boolean | COMPUTED | MVP | Risk flag: blackout blinds present but no DWS | `false` |
| `morning_light_access` | enum | OPTIONAL | MVP | `outdoor` / `window` / `dws` / `light_therapy` / `none` | `outdoor` |
| `evening_light_environment` | enum | OPTIONAL | MVP | `bright_blue` / `mixed` / `amber_managed` | `bright_blue` |
| `tv_in_bedroom` | boolean | OPTIONAL | MVP | TV present in bedroom | `true` |
| `work_items_in_bedroom` | boolean | OPTIONAL | MVP | Work equipment or desk present | `false` |
| `noise_profile` | enum | OPTIONAL | V2 | `silent` / `ambient` / `loud` / `managed_white_noise` | `ambient` |
| `individual_duvets` | boolean | OPTIONAL | V2 | Separate duvets for partners | `false` |
| `mattress_gap_test_passed` | boolean | OPTIONAL | V2 | Foetal-position gap test ≤ 6cm (2 flat hands) | `true` |
| `air_quality_managed` | boolean | OPTIONAL | V2 | Hypoallergenic bedding and regular airing | `false` |
| `environment_friction_score` | integer | COMPUTED | MVP | 0–5: count of active friction factors (temp, light, TV, work items, no blackout) | `2` |
| `last_audit_date` | date | OPTIONAL | MVP | Date of last environment audit | `2026-03-11` |
| `updated_at` | datetime | REQUIRED | MVP | — | — |

**Friction factor scoring:**
```
+1 if bedroom_temperature IN (hot, variable)
+1 if evening_light_environment == bright_blue
+1 if tv_in_bedroom == true
+1 if work_items_in_bedroom == true
+1 if blackout_without_dws == true
environment_friction_score = sum of above (0–5)
```

---

### Entity 10 — EventContext

A contextual modifier that changes how the engine applies rules during a bounded time period. Multiple events can overlap (e.g. travel + stress).

| Attribute | Type | Required | MVP | Description | Example |
|-----------|------|----------|-----|-------------|---------|
| `event_id` | UUID | REQUIRED | MVP | — | — |
| `user_id` | UUID | REQUIRED | MVP | FK → User | — |
| `event_type` | enum | REQUIRED | MVP | `travel` / `illness` / `injury` / `shift_change` / `high_stress` / `social_disruption` / `new_parent` / `pre_event` | `travel` |
| `severity` | enum | REQUIRED | MVP | `minor` / `moderate` / `significant` | `moderate` |
| `start_date` | date | REQUIRED | MVP | Event begins | `2026-03-14` |
| `end_date` | date | OPTIONAL | MVP | Event ends (null = ongoing) | `2026-03-16` |
| `destination_timezone` | string | OPTIONAL | MVP | For travel events — IANA timezone of destination | `America/New_York` |
| `timezone_offset_hours` | integer | COMPUTED | MVP | Signed hour difference from home timezone | `-5` |
| `direction` | enum | COMPUTED | MVP | `eastward` / `westward` / `none` — for jet lag protocol | `westward` |
| `expected_recovery_days` | integer | COMPUTED | MVP | Estimated days to baseline after event | `2` |
| `cycle_floor_override` | integer | OPTIONAL | MVP | Override minimum acceptable cycles for this event period (e.g. 3 for travel nights) | `3` |
| `arp_locked` | boolean | COMPUTED | MVP | Whether ARP must be held fixed during this event (always true) | `true` |
| `active` | boolean | COMPUTED | MVP | Whether this event is currently in effect | `true` |
| `notes` | string | OPTIONAL | V2 | Free text | `"Conference in NYC, 5h timezone shift"` |

---

## 2. USER PROFILE MODEL

The full set of persistent user attributes, assembled across `User`, `UserProfile`, `ARPConfig`, and `EnvironmentContext`.

### Onboarding Input Sequence

The app collects profile data in this order. The engine is gated — each step unlocks the next.

| Step | Gate | Data Collected | Unlocks |
|------|------|---------------|---------|
| 1 | CRITICAL | `arp_time` — committed fixed wake time | Cycle schedule generation |
| 2 | REQUIRED | `chronotype` — self-assessed (5 questions) | Chronotype-adjusted scheduling |
| 3 | REQUIRED | `cycle_target` — default nocturnal target (3–6; default 5) | Sleep onset recommendation |
| 4 | OPTIONAL | `sleep_partner`, `caffeine_use`, `caffeine_cutoff_time`, `tracker_in_use` | Contextual risk detection |
| 5 | OPTIONAL | `bedroom_temperature`, `blackout_provision`, `dws_device`, `morning_light_access`, `evening_light_environment`, `tv_in_bedroom`, `work_items_in_bedroom` | Environment recommendations |

### ARP Validation Rules

When the user submits their `arp_time`:

```
VALID:   arp_time must be on the hour or half-hour (e.g. 06:00, 06:30, 07:00)
VALID:   arp_time must be in range 05:00–09:00 (standard coaching range)
WARNING: chronotype = PMer AND arp_time < 07:00 → flag Social Jet Lag (RULE-ARP-02)
BLOCK:   if onboarding_completed = false, no cycle schedule is generated until arp_committed = true
```

### Chronotype-Derived Adjustments

Once chronotype is set, the following are automatically applied to the ARPConfig:

| Adjustment | AMer | PMer | In-betweener |
|-----------|------|------|-------------|
| Peak cognitive window | Phase 1–2 (morning) | Phase 3 (evening) | Unknown — default to AMer; monitor |
| Peak physical window | ~17:00–18:00 | ~18:30–20:00 | Unknown |
| Melatonin onset | ~21:00 | ~22:30–23:00 | Unknown |
| Late exercise risk flag | After 19:00 | After 20:30 | After 19:00 |
| Social jet lag threshold | ARP < 05:30 | ARP < 07:00 | ARP < 06:00 |

### Shift Work Profile Variant

When `multishift_enabled = true`:

```
active_arp = (active_shift == day) ? shift_arp_day : shift_arp_night
ARPConfig generated from active_arp
All cycle, phase, CRP, and MRM calculations use active_arp
Shift CRP rule:
  day_shift:   CRP at C16 (active_arp + 22.5h = 16:30 for day ARP 06:00)
  night_shift: CRP at C7  (active_arp + 9h    = 03:00 for night ARP 18:00)
```

---

## 3. DAILY DATA MODEL

What the engine needs each day to compute the user's current situation and generate recommendations.

### Required Daily Inputs (MVP)

| Field | Source | Timing | Why Needed |
|-------|--------|--------|------------|
| `cycles_completed` last night | SleepLog — self-reported or calculated | Morning | Weekly balance; state detection |
| `actual_sleep_onset` | SleepLog | Morning | Onset scheduling feedback; onset latency calc |
| `wake_time` | SleepLog | Morning | ARP stability check |
| `crp_taken` | DailyLog | End of day | Weekly balance; CRP recommendation loop |
| `mrm_count` | DailyLog | End of day | Adherence monitoring; state detection |
| `subjective_energy_on_waking` | SleepLog | Morning | Felt recovery signal; state detection |

### Optional Daily Inputs (MVP — improve signal quality)

| Field | Why Useful |
|-------|-----------|
| `onset_latency_minutes` | Detects US-07 (anxiety loop), US-08 (electronic insomnia) |
| `night_wakings` | Detects 2–3am pattern; environmental friction |
| `night_waking_2_to_4am` | Distinguishes polyphasic waking (normal) from fragmented sleep |
| `pre_sleep_routine_done` | Adherence to Phase 3 protocol |
| `post_sleep_routine_done` | Adherence to post-ARP routine |
| `morning_light_achieved` | Light protocol adherence |
| `evening_light_managed` | Phase 3 protocol adherence |
| `caffeine_last_time` | Stimulant risk detection |
| `disruption_event_id` | Routes to US-06 vs US-03 (bounded vs structural deficit) |

### Daily Computed Fields (engine calculates automatically)

| Field | Computation |
|-------|------------|
| `arp_maintained` | `abs(wake_time − arp_time) ≤ 15 min` |
| `crp_in_window` | `crp_start_time ∈ [crp_window_open, crp_window_close]` |
| `crp_cycle_credited` | `crp_duration_minutes ≥ 20` |
| `onset_latency_flag` | `onset_latency_minutes > 15` |
| `caffeine_after_cutoff` | `caffeine_last_time > user.caffeine_cutoff_time` |
| `late_exercise_flag` | `exercise_start_time > phase_3_start AND chronotype = AMer` |
| `cycles_from_logs` | `floor((wake_time − actual_sleep_onset) / 90)` (fallback if not self-reported) |

---

## 4. WEEKLY ACCOUNTING MODEL

### Core Logic

```
For each week (Monday–Sunday):

  nocturnal_cycles[d]  = SleepLog.cycles_completed for day d
  crp_cycles[d]        = DailyLog.crp_cycle_credited for day d (1 if CRP taken and valid, else 0)

  weekly_cycle_total   = Σ nocturnal_cycles[1..7] + Σ crp_cycles[1..7]
  cycle_deficit        = 35 − weekly_cycle_total

  remaining_days       = 7 − day_number
  projected_total      = weekly_cycle_total + (remaining_days × 5)  [assumes 5 nocturnal per remaining night]

  on_track             = projected_total ≥ 28
  deficit_risk_flag    = (cycle_deficit > 7) AND (day_number ≥ 5)
```

### Pace Thresholds

| Threshold | Condition | State Triggered | Action |
|-----------|-----------|-----------------|--------|
| On track | projected_total ≥ 35 | US-01 | Maintenance |
| Mild deficit | weekly_cycle_total: 28–34, day ≤ 5 | US-02 | Schedule CRP |
| Significant deficit | cycle_deficit > 7 by day 5 | US-03 | Audit + CRP escalation |
| Floor breach | weekly_cycle_total < 28 by day 7 | US-03 | Structural review |
| ARP instability | arp_variance > 30 min any 3 days | US-04 | ARP re-commitment |

### MRM and CRP Targets

| Metric | Weekly Target | Floor |
|--------|--------------|-------|
| Total cycles (nocturnal + CRP) | 35 | 28 |
| CRP sessions | 7 | 5 |
| MRM sessions | 49 (7/day) | 35 |

---

## 5. USER STATE MODEL

### State Detection Logic

State detection runs:
- Every morning after the SleepLog is submitted
- When a significant input event occurs (disruption logged, ARP change, CRP submission)
- At the end of each week (weekly balance calculation)

Multiple states can be active. The engine applies the **highest-priority active state** as the primary recommendation driver, while secondary states inform supporting recommendations.

### Complete State Map

| State ID | Name | Priority | MVP | Trigger Conditions | Detection Source |
|----------|------|----------|-----|--------------------|-----------------|
| US-01 | Aligned | 5 (lowest) | MVP | weekly_cycle_total ≥ 33, arp_stable = true, mrm_count ≥ 4/day avg, no other states active | weekly_balance |
| US-02 | Mild Cycle Deficit | 3 | MVP | weekly_cycle_total: 28–34, day ≤ 5 | weekly_balance |
| US-03 | Significant Cycle Deficit | 2 | MVP | cycle_deficit > 7 by day 5, OR 3+ consecutive nights < 4 cycles | weekly_balance + sleep_log |
| US-04 | ARP Instability | 2 | MVP | wake_time variance > 30 min across any 7-day window, OR arp_committed = false | sleep_log |
| US-05 | Chronotype Conflict | 3 | MVP | chronotype = PMer AND arp_time < 07:00 | user_profile |
| US-06 | Post-Disruption Recovery | 3 | MVP | disruption_event active AND cycle_deficit < 14 AND no structural flags | event_context + weekly_balance |
| US-07 | Sleep Anxiety Loop | 1 (highest) | MVP | onset_latency > 30 min on 3+ consecutive nights, OR user_report of sleep worry | sleep_log + user_report |
| US-08 | Electronic Insomnia | 2 | MVP | screen use in Phase 3 (inferred from sleep_onset delay pattern OR user_report) | sleep_log + user_report |
| US-09 | Ortho-Insomnia | 2 | MVP | tracker_in_use = true AND user_report of tracker anxiety | user_profile + user_report |
| US-10 | Stimulant Compensation | 3 | MVP | caffeine_doses ≥ 3/day OR caffeine_after_cutoff = true repeatedly | daily_log |
| US-11 | Environmental Friction | 3 | MVP | environment_friction_score ≥ 2 | environment_context |
| US-12 | Framework Gap | 2 | MVP | arp_committed = false OR (mrm_count avg < 2 AND crp_taken < 2 per week) | onboarding + daily_log |
| US-13 | Sleep Noise Exposure | 4 | V2 | user_report of heavy sleep content consumption | user_report |
| US-14 | In-Betweener Fog | 4 | V2 | chronotype = In-betweener AND stimulant reliance flagged | user_profile + daily_log |
| US-15 | Pre-Event High Arousal | 3 | MVP | event_type = pre_event active within 48h | event_context |
| US-16 | Illness / Injury Recovery | 2 | MVP | event_type ∈ (illness, injury) active | event_context |
| US-17 | Shift Work / Multishift | 3 | V2 | multishift_enabled = true | user_profile |

### State Priority Hierarchy

```
Priority 1 (CRITICAL — override all other states):
  US-07 Sleep Anxiety Loop

Priority 2 (HIGH — require structural action):
  US-04 ARP Instability
  US-03 Significant Cycle Deficit
  US-08 Electronic Insomnia
  US-09 Ortho-Insomnia
  US-12 Framework Gap
  US-16 Illness / Injury

Priority 3 (MEDIUM — important but not blocking):
  US-02 Mild Cycle Deficit
  US-05 Chronotype Conflict
  US-06 Post-Disruption Recovery
  US-10 Stimulant Compensation
  US-11 Environmental Friction
  US-15 Pre-Event High Arousal

Priority 4 (LOW — improvement opportunity):
  US-13 Sleep Noise Exposure
  US-14 In-Betweener Fog
  US-17 Shift Work / Multishift

Priority 5 (MAINTENANCE):
  US-01 Aligned
```

### State Detection Logic — Selected Examples

```
// US-04 ARP Instability
IF (
  arp_committed = false
  OR max(wake_time) − min(wake_time) over last 7 days > 30 min
)
THEN activate(US-04)

// US-07 Sleep Anxiety Loop
IF (
  onset_latency_minutes > 30 for 3+ consecutive nights
  OR user explicitly reports worrying about sleep
)
THEN activate(US-07) WITH priority_override = 1

// US-02 Mild Cycle Deficit
IF (
  weekly_cycle_total BETWEEN 28 AND 34
  AND day_number <= 5
  AND NOT active(US-03)
)
THEN activate(US-02)

// US-11 Environmental Friction
IF environment_friction_score >= 2
THEN activate(US-11)

// US-01 Aligned (only when no other states active)
IF (
  weekly_cycle_total >= 33
  AND arp_stable = true
  AND NO other states with priority <= 3 are active
)
THEN activate(US-01)
```

---

## 6. RECOMMENDATION MODEL

### Recommendation Generation Rules

```
FOR each active UserState (ordered by priority):
  eligible_recs = REC_MAP[state_id]  // see mapping table below
  FOR each rec IN eligible_recs:
    IF (rec NOT recently_delivered within cooldown_hours)
    AND (rec.condition_met(current_data))
    THEN generate Recommendation record
```

### State → Recommendation Mapping

| State | Primary Recommendations | Supporting Recommendations |
|-------|------------------------|---------------------------|
| US-01 | REC-05 (MRM reminders), REC-14 (weekly review) | REC-12 (chronotype refinement) |
| US-02 | REC-03 (CRP scheduling), REC-25 (recovery day) | REC-05, REC-14 |
| US-03 | REC-03, REC-14, REC-25 | REC-19 (sleep restriction — if persistent) |
| US-04 | REC-01 (ARP commitment — BLOCKING) | REC-06 (post-sleep routine) |
| US-05 | REC-12 (chronotype adjustment), REC-21 (social jet lag) | REC-03 (CRP bridge) |
| US-06 | REC-22 (post-disruption rebalancing), REC-03 | REC-26 (travel setup) |
| US-07 | REC-13 (cycle reframe), REC-15 (15-min rule), REC-16 (2–3am protocol) | REC-08 (wind-down) |
| US-08 | REC-08 (phase 3 wind-down), REC-09 (evening light) | REC-07 (morning light) |
| US-09 | REC-18 (tracker calibration) | REC-13 (reframe) |
| US-10 | REC-17 (caffeine timing) | REC-03, REC-04 |
| US-11 | REC-11 (environment audit), REC-10 (temperature), REC-09 (light) | REC-07 |
| US-12 | REC-20 (framework reset — BLOCKING), REC-01 | REC-04, REC-06 |
| US-13 | REC-13 | REC-08 |
| US-14 | REC-12 | REC-04 |
| US-15 | REC-23 (pre-event arousal) | REC-08 |
| US-16 | REC-24 (illness recovery mode) | REC-03 |
| US-17 | REC-01 (ARP recalculation for shift) | REC-03 (shift-specific CRP) |

### Recommendation Record — Full Specification

```json
{
  "rec_id":                "uuid",
  "user_id":               "uuid",
  "recommendation_type":   "REC-03",
  "category":              "scheduling",
  "triggered_by_states":   ["US-02"],
  "priority":              2,
  "status":                "pending",
  "delivery_channel":      "in_app_card",
  "generated_at":          "2026-03-12T07:00:00Z",
  "deliver_at":            "2026-03-12T12:00:00Z",
  "expires_at":            "2026-03-12T18:30:00Z",
  "coaching_message":      "You had 3 cycles last night. Your week is 4 cycles short of target. A 30-minute rest between 14:00 and 18:30 today counts as a full cycle and brings you back on track.",
  "action_payload": {
    "crp_window_open":     "14:00",
    "crp_window_close":    "18:30",
    "crp_duration":        30,
    "cycle_credit":        1
  },
  "cooldown_hours":        24
}
```

### Recommendation Cooldowns

| Recommendation | Cooldown | Reason |
|---------------|----------|--------|
| REC-01 ARP Commitment | None — shown until resolved | Gate-level requirement |
| REC-03 CRP Scheduling | 24h | One CRP per day maximum |
| REC-05 MRM Reminders | Per cycle boundary | Triggered at each 90-min mark |
| REC-07 Morning Light | 24h | Daily habit reminder |
| REC-08 Phase 3 Wind-down | 24h | Daily habit prompt |
| REC-13 Cycle Reframe | 72h | Coaching message — not daily |
| REC-15 15-min Rule | 48h | Situational; not chronic |
| REC-18 Tracker Calibration | 7 days | Structural intervention |
| REC-19 Sleep Restriction | 14 days | Clinical-adjacent; use sparingly |
| REC-20 Framework Reset | None — shown until onboarding complete | Gate-level |
| REC-22 Post-Disruption | 48h | Event-bounded |
| REC-23 Pre-Event Arousal | Per event | Event-specific |
| REC-24 Illness Mode | Per event | Event-specific |

---

## 7. EVENT CONTEXT MODEL

Events are contextual modifiers that temporarily change how the engine applies its rules. They do not override core principles — they adapt them.

### Event Types and Engine Modifications

#### TRAVEL

```
event_type = travel
timezone_offset_hours = destination_tz − home_tz

Modifications:
  cycle_floor_override = 3          // travel nights: 3 cycles is acceptable
  arp_locked = true                  // ARP held at destination-aligned time from night 1
  IF direction = westward:
    // Body clock says morning, local time says night
    recommendation = "Avoid sleeping on plane; dim all lights on arrival; 3 cycles acceptable"
  IF direction = eastward:
    // Body clock says night, local time says morning
    recommendation = "Sleep on plane; maximise daylight on arrival day; use CRPs"
  weekly_cycle_deficit: exempt from deficit_risk_flag for event duration
```

#### ILLNESS / INJURY

```
event_type = illness OR injury
cycle_target_override = 6            // increase nocturnal target
crp_restriction = none               // CRPs permitted across all phases (not just Phase 2)
mrm_target_override = 3             // reduce MRM burden during illness
arp_locked = true                    // ARP held; no sleeping in
recommendation = REC-24             // Illness Recovery Mode
deficit_flag_suppressed = true      // Weekly deficit flags suppressed during illness
```

#### SHIFT CHANGE

```
event_type = shift_change
active_shift = new_shift             // update UserProfile.active_shift
arp_time = new_arp_for_shift         // recalculate ARPConfig from new ARP
crp_placement = shift-specific       // day: C16=16:30; night: C7=03:00
recommendation = REC-01              // ARP recalculation for new shift
```

#### HIGH STRESS / PRE-EVENT

```
event_type = high_stress OR pre_event
recommendation = REC-23              // Pre-Event Arousal Protocol
primary_message = "Do not try to force extra sleep; trust the system; even 3 cycles is sufficient"
deficit_flag_suppressed = false     // Still track, but don't alarm
cycle_floor_override = 3            // Acknowledge likely reduced nocturnal
crp_encouraged = true               // CRP on the day-before preferred
```

#### SOCIAL DISRUPTION

```
event_type = social_disruption
cycle_floor_override = 3            // Late night event; accept reduced cycles
arp_locked = true                   // Never shift ARP
recommendation = REC-22             // Post-disruption rebalancing
next_day_crp_priority = HIGH        // CRP the following day is highest priority
```

#### NEW PARENT

```
event_type = new_parent
cycle_target_override = 4           // Realistic reduction in nocturnal target
crp_restriction = none              // CRPs at any time, opportunistically
deficit_flag_threshold = 21         // Adjusted floor for this life stage
primary_message = "Sync your schedule with your infant's polyphasic rhythm; grab CRPs when you can; do not aim for perfection"
```

### Event Hierarchy

When multiple events are active simultaneously:

```
Priority order (highest wins for cycle_floor_override):
  illness > travel > high_stress > social_disruption > pre_event > new_parent
ARP locked = true in ALL event types (no exceptions)
```

---

## 8. DATA FLOW

The following describes how data moves through the system from raw user input to delivered recommendation.

```
USER INPUT
    │
    ├── Onboarding: ARP, chronotype, cycle_target, environment
    │       │
    │       ▼
    │   UserProfile + ARPConfig computed
    │   (cycle_times, phase_times, CRP window, MRM times, sleep_onset_N)
    │
    └── Daily input: sleep log (morning) + activity log (evening)
            │
            ▼
       ┌──────────────────────────────────────────────┐
       │         COMPUTATION LAYER                     │
       │  SleepLog fields computed:                    │
       │    arp_maintained = |wake_time − arp_time|   │
       │    cycles_from_logs = floor(duration / 90)   │
       │    onset_latency_flag = latency > 15min      │
       │                                              │
       │  DailyLog fields computed:                   │
       │    crp_in_window, crp_cycle_credited         │
       │    caffeine_after_cutoff, late_exercise_flag │
       │    environment_friction_score                │
       │                                              │
       │  WeeklyCycleBalance recomputed:              │
       │    weekly_cycle_total, deficit, on_track     │
       │    arp_variance, deficit_risk_flag           │
       └──────────────────────────────────────────────┘
            │
            ▼
       ┌──────────────────────────────────────────────┐
       │         STATE DETECTION ENGINE               │
       │  For each UserState (US-01..US-17):          │
       │    evaluate trigger conditions               │
       │    activate / resolve state record           │
       │    assign priority rank                      │
       │  Sort active states by priority              │
       │  Apply EventContext modifiers                │
       └──────────────────────────────────────────────┘
            │
            ▼
       ┌──────────────────────────────────────────────┐
       │         RULE ENGINE                          │
       │  For each active state (priority order):     │
       │    select eligible recommendations           │
       │    check cooldown period                     │
       │    evaluate condition predicates             │
       │    generate Recommendation records           │
       │    compute action_payload                    │
       │    schedule delivery timing                  │
       └──────────────────────────────────────────────┘
            │
            ▼
       ┌──────────────────────────────────────────────┐
       │         DELIVERY LAYER                       │
       │  Route by delivery_channel:                  │
       │    push_notification → morning / trigger     │
       │    in_app_card → home screen / today view    │
       │    weekly_review → Sunday evening            │
       │    onboarding_step → sequential gate         │
       └──────────────────────────────────────────────┘
            │
            ▼
       USER ACTION (actioned / dismissed / ignored)
            │
            ▼
       Update Recommendation.status → feedback loop
```

### Computation Trigger Points

| Trigger | What Runs |
|---------|-----------|
| Morning (post-ARP log submission) | SleepLog computation; WeeklyCycleBalance update; State detection; Morning recommendations |
| Midday (Phase 2 entry) | CRP recommendation delivery window opens |
| Phase 3 entry | Evening wind-down prompt; MRM reminder |
| End of day | DailyLog finalisation; State refresh |
| End of week (Sunday) | Full WeeklyCycleBalance; Weekly review recommendation |
| ARP change | ARPConfig full recalculation; All downstream data re-evaluated |
| EventContext activation | Immediate state re-evaluation; Protocol recommendations |

---

## 9. MINIMUM DATA REQUIRED FOR MVP

The following represents the smallest data set that produces a functioning R90 coaching engine.

### MVP Profile (collected once)

| Field | Why Critical |
|-------|-------------|
| `user_id` | Identity |
| `timezone` | All time calculations |
| `arp_time` | Master anchor — nothing works without it |
| `arp_committed` | Gates the entire engine |
| `chronotype` | Adjusts scheduling and risk thresholds |
| `cycle_target` | Default nocturnal target |
| `sleep_partner` | Triggers basic position/duvet guidance |

### MVP Daily Input (per day)

| Field | Source | Why Critical |
|-------|--------|-------------|
| `cycles_completed` | SleepLog | Weekly balance calculation |
| `actual_sleep_onset` | SleepLog | Onset adherence; cycle count validation |
| `wake_time` | SleepLog | ARP stability monitoring |
| `crp_taken` | DailyLog | Weekly cycle credit |
| `mrm_count` | DailyLog | Adherence signal; state detection |
| `subjective_energy_on_waking` | SleepLog | Felt recovery — triggers US-07 if chronically low |

### MVP Computed State (derived — no additional input needed)

| Field | Computation |
|-------|------------|
| `arp_maintained` | `|wake_time − arp_time| ≤ 15min` |
| `weekly_cycle_total` | `Σ cycles + Σ crp_credited` |
| `cycle_deficit` | `35 − weekly_cycle_total` |
| `active_user_states` | State detection from the above fields |
| `current_recommendations` | Recommendation engine output |
| `all ARPConfig times` | Computed from `arp_time` |

### MVP User States (detectable from minimum data)

With only the MVP input fields, the engine can reliably detect:

- US-01 Aligned
- US-02 Mild Cycle Deficit
- US-03 Significant Cycle Deficit
- US-04 ARP Instability
- US-05 Chronotype Conflict (from profile only)
- US-07 Sleep Anxiety Loop (partially — onset latency needed for full detection)
- US-11 Environmental Friction (from environment profile)
- US-12 Framework Gap

### MVP Recommendations Generatable

With minimum data, the engine can deliver all recommendations in Categories 1 and 2 (Foundation and Scheduling): **REC-01 through REC-06, REC-13, REC-14, REC-20, REC-25**.

---

## 10. OPTIONAL DATA FOR V2

The following fields are not required for a functional first release but improve precision, personalisation, and coaching depth significantly.

### V2 Sleep Log Additions

| Field | What It Enables |
|-------|----------------|
| `onset_latency_minutes` | Precise US-07 detection; 15-min rule trigger |
| `night_wakings` | 2–3am pattern detection; US-08 differentiation |
| `night_waking_2_to_4am` | Polyphasic vs fragmented sleep distinction |
| `waking_cause` | Personalised disruption coaching |
| `pre_sleep_routine_done` | Phase 3 adherence; US-08 correlation |
| `post_sleep_routine_done` | Post-ARP habit tracking |
| `notes` (free text) | Coaching context; pattern discovery |

### V2 Daily Log Additions

| Field | What It Enables |
|-------|----------------|
| `morning_light_achieved` | REC-07 feedback loop; habit tracking |
| `morning_light_method` | Light protocol personalisation |
| `evening_light_managed` | Phase 3 adherence; US-08 feedback |
| `mrm_with_daylight` | MRM + light pairing effectiveness |
| `caffeine_doses` | Full stimulant profile; US-10 precision |
| `exercise_start_time` | Late exercise risk flag (AMer) |
| `crp_type` (nsdr/standard/extended) | NSDR adoption tracking |
| `subjective_energy_midday` | Daytime recovery signal; CRP effectiveness |

### V2 Profile Additions

| Field | What It Enables |
|-------|----------------|
| `dominant_hand` | Sleeping position personalisation |
| `morphotype` | Mattress surface guidance |
| `travel_frequency` | Proactive travel protocol prep |
| `occupation_schedule` | Constraint-aware scheduling |
| `individual_duvets` | Couple environment coaching |
| `mattress_gap_test_passed` | Physical setup audit completion |
| `noise_profile` | Bedroom environment audit |
| `arp_committed_at` | 7-day trial tracking; ARP refinement |

### V2 Environment Additions

| Field | What It Enables |
|-------|----------------|
| `air_quality_managed` | Full bedroom audit completion |
| `noise_profile` | Environmental friction scoring |
| `individual_duvets` | Partner comfort differentiation |

### V2 System Features

| Feature | What It Enables |
|---------|----------------|
| `chronotype_confidence` tracking | Chronotype refinement after 4+ weeks (REC-12) |
| Shift work dual-ARP (US-17) | Full multishift mode with ARP switching |
| EventContext — new_parent variant | Life stage–appropriate coaching |
| `disruption_event_id` on logs | US-06 vs US-03 accurate differentiation |
| Tracker data integration | Sleep stage data as supplementary signal (with ortho-insomnia safeguards) |
| Weekly review report | Longitudinal trend analysis |

---

## Modelling Report

### 1. Entities Created

| Entity | Records Per User | Purpose |
|--------|-----------------|---------|
| User | 1 | Identity and account |
| UserProfile | 1 | Persistent characteristics |
| ARPConfig | 1 (updated on ARP change) | All computed schedule times |
| SleepLog | 1 per day | Nocturnal sleep record |
| DailyLog | 1 per day | Daytime recovery record |
| WeeklyCycleBalance | 1 per week | The primary accounting unit |
| UserState | 1 per active state | Recovery situation classification |
| Recommendation | N per trigger event | Engine outputs |
| EnvironmentContext | 1 (updated on audit) | Physical environment |
| EventContext | 1 per event (multiple concurrent) | Contextual modifiers |

**Total: 10 entities.** No more are needed to implement the full R90 engine.

---

### 2. Fields Required for MVP

**Minimum to produce a working coaching session:**

- `User`: user_id, timezone, onboarding_completed
- `UserProfile`: arp_time, arp_committed, chronotype, cycle_target
- `ARPConfig`: all computed fields (zero user input — pure computation)
- `SleepLog`: cycles_completed, actual_sleep_onset, wake_time, subjective_energy_on_waking
- `DailyLog`: crp_taken, mrm_count
- `WeeklyCycleBalance`: all computed fields
- `UserState`: state_id, active, priority
- `Recommendation`: recommendation_type, coaching_message, deliver_at, status

**Total: ~20 user-input fields + ~30 computed fields.**

---

### 3. Fields Recommended for V2

The following unlock deeper coaching:
- `onset_latency_minutes` — unlocks precise US-07 detection
- `night_wakings` + `night_waking_2_to_4am` — unlocks 2–3am pattern coaching
- `caffeine_doses` + `caffeine_last_time` — unlocks US-10 precision
- `morning_light_achieved` + `evening_light_managed` — unlocks light adherence feedback
- `exercise_start_time` — unlocks chronotype-specific exercise risk
- `disruption_event_id` — unlocks US-06 accurate routing
- `chronotype_confidence` — unlocks chronotype refinement over time
- `multishift_enabled` + dual-ARP fields — unlocks US-17 full mode
- Tracker data integration — supplementary signal with ortho-insomnia safeguards

---

### 4. Modelling Uncertainties

| Uncertainty | Impact | Recommended Handling |
|-------------|--------|---------------------|
| **Cycle count self-reporting accuracy** | Users may not know how many cycles they completed. The `cycles_from_logs` fallback (onset-to-wake ÷ 90) is an approximation. | Accept approximation for MVP. Offer optional tracker integration in V2 with clear caveats (ortho-insomnia risk). |
| **Chronotype confidence over time** | Self-reported chronotype may be inaccurate for in-betweeners. No formal instrument exists. | Start with self-report; add a `chronotype_confidence` progression after 4+ weeks of logged data; surface refinement prompt (REC-12). |
| **US-07 detection without onset latency** | Sleep anxiety loop (the highest-priority state) is harder to detect without `onset_latency_minutes`. Relying solely on user reports is less reliable. | Include `onset_latency_minutes` as a soft-required MVP field — even if not strictly required for engine function, it is essential for the most critical state. |
| **CRP cycle credit for partial compliance** | If user takes a 15-minute rest (below the 20-minute floor), no cycle is credited. The system needs a clear rule. | `crp_cycle_credited = crp_duration_minutes >= 20`. Duration 15–19 min: no credit, but no penalty. Under 15 min: treated as an MRM. |
| **MRM self-reporting granularity** | Users may not accurately count MRMs. A simple "how many did you take today?" input is low-fidelity. | Accept integer count for MVP. V2: optional per-MRM timestamp logging for precise analysis. Avoid making MRM logging burdensome — it would worsen the anxiety loop. |
| **Event overlap handling** | Multiple simultaneous events (e.g., travel + illness) create complex modifier interactions. | Apply the priority hierarchy (illness > travel > ...) for cycle_floor_override. For ARP: always locked regardless of event. For recommendations: deliver the primary event's recommendation first, then supporting. |
| **Weekly accounting boundary** | The canonical system uses a 7-day rolling week, not necessarily Monday–Sunday. This needs a product decision. | Define week start as the user's ARP commitment date (rolling 7 days from onboarding) for MVP. Add calendar-week option in V2. |
