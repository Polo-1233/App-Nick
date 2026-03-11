# R90 Schema — Deliverables Summary

**Date:** 2026-03-11
**Source of truth:** R90_DATA_MODEL.md v1.0, R90_CANONICAL_SYSTEM.md v1.0, R90_RULE_ENGINE_SPEC.md v1.0, R90_BACKEND_API_CONTRACT.md v1.0

---

## 1. Table Relationship Summary

```
users (root)
  ├── 1:1  user_profiles        (user_id UNIQUE FK)
  ├── 1:1  arp_configs           (user_id UNIQUE FK)
  ├── 1:1  environment_contexts  (user_id UNIQUE FK)
  ├── 1:N  sleep_logs            (user_id FK, UNIQUE on user_id+date)
  ├── 1:N  daily_logs            (user_id FK, UNIQUE on user_id+date)
  ├── 1:N  weekly_cycle_balances (user_id FK, UNIQUE on user_id+week_start)
  ├── 1:N  user_states           (user_id FK, partial UNIQUE on user_id+state_id WHERE active)
  ├── 1:N  recommendations       (user_id FK)
  ├── 1:N  recommendation_cooldowns (user_id FK, UNIQUE on user_id+rec_type)
  └── 1:N  event_contexts        (user_id FK)

event_contexts
  ├── 0:1 ← sleep_logs.disruption_event_id    (optional FK, ON DELETE SET NULL)
  └── 0:1 ← daily_logs.disruption_event_id    (optional FK, ON DELETE SET NULL)
```

**Key relationships:**

- `users` is the root entity. Every other table references `users(id)` with `ON DELETE CASCADE`.
- `user_profiles`, `arp_configs`, and `environment_contexts` are strict 1:1 — enforced by `UNIQUE(user_id)`.
- `sleep_logs` and `daily_logs` are 1-per-user-per-date — enforced by `UNIQUE(user_id, date)`.
- `weekly_cycle_balances` is 1-per-user-per-week — enforced by `UNIQUE(user_id, week_start)`.
- `user_states` allows multiple active states per user, but only one active instance per state type — enforced by a partial unique index `WHERE active = TRUE`.
- `event_contexts` allows multiple concurrent events per user (e.g., travel + stress).
- `recommendation_cooldowns` is a helper table (not in the original data model) that tracks per-user, per-rec-type cooldown state.

---

## 2. Migration Files

| File | Purpose |
|------|---------|
| `001_r90_schema.sql` | Full schema: enums, 11 tables, indexes, trigger functions |
| `002_r90_rls_policies.sql` | Row Level Security policies for all tables |
| `003_r90_seed_data.sql` | Test seed data for 5 users (dev/test only) |

---

## 3. Seed Data Users

| User | Chronotype | ARP | States Active | Scenario |
|------|-----------|-----|---------------|----------|
| Alice | AMer | 06:30 | US-01 (Aligned) | Ideal user — 5 cycles/night, good CRP/MRM, stable ARP |
| Bob | PMer | 06:30 | US-02, US-05 | Mild deficit, chronotype conflict (PMer with early ARP), no CRPs, high caffeine |
| Carol | In-betweener | 07:00 | US-07, US-08, US-11 | Sleep anxiety loop (onset latency 45–75 min), screen use, high environment friction |
| Dave | AMer | 06:00 | US-06 | Post-travel recovery (westward -5h), active event context, improving cycle count |
| Eve | Unknown | 07:00 | US-12 | New user, mid-onboarding (step 2), no logs yet, framework gap |

---

## 4. RLS Policy Design

The RLS approach splits tables into two categories:

**User-writable** (INSERT + UPDATE + SELECT): `user_profiles`, `sleep_logs`, `daily_logs`, `environment_contexts`, `event_contexts`

**Engine-only / read-only for client** (SELECT only): `arp_configs`, `weekly_cycle_balances`, `user_states`, `recommendations` (UPDATE allowed for status changes), `recommendation_cooldowns`

**Special cases:**
- `users` table: SELECT + UPDATE only. INSERT is handled server-side by a Supabase auth trigger.
- `recommendations`: UPDATE is allowed so the client can mark recommendations as actioned/dismissed.
- No DELETE policies anywhere — data is soft-archived, never hard-deleted by the client.

All policies filter on `user_id` ownership via a helper function `current_app_user_id()` that resolves `auth.uid()` → `users.id`.

---

## 5. Schema Ambiguities Requiring Product Decisions

### 5.1 Weekly Accounting Boundary

**Issue:** The data model says "rolling 7 days from ARP commitment date" but also references "Monday–Sunday" in some examples. The seed data uses Monday starts.

**Recommendation:** Use ARP commitment date as rolling week anchor for MVP. This is more faithful to the canonical system ("7 days from when you start"). Add calendar-week alignment as a V2 option.

**Decision needed:** Confirm rolling vs calendar week start.

### 5.2 Onset Latency — MVP or V2?

**Issue:** `onset_latency_minutes` is marked OPTIONAL/MVP in the data model, but US-07 (Sleep Anxiety Loop) — the highest-priority state — depends on it. Without this field, the most critical state cannot be reliably detected.

**Recommendation:** Treat `onset_latency_minutes` as soft-required for MVP. Include it in the daily log flow even if it's technically optional. The data model notes this same concern.

**Decision needed:** Elevate to REQUIRED in MVP, or keep optional with reduced US-07 detection?

### 5.3 `schedule_consistency` Field Source

**Issue:** This field appears in the schema (`user_profiles.schedule_consistency`) but is not explicitly defined in the data model Entity 2 (UserProfile). It's implied by occupation_schedule and travel_frequency but never formally specified.

**Recommendation:** Keep it as a derived/summary field. Could be computed from 7-day ARP variance, or collected during onboarding as a self-report.

**Decision needed:** Self-reported during onboarding, or computed from log data?

### 5.4 `crp_count` — User Input or Computed?

**Issue:** The data model marks `crp_count` as COMPUTED, but in practice, a user could take 2 CRPs in a recovery day. The current schema allows values 0–3.

**Recommendation:** Let the user log each CRP individually (input), and compute `crp_count` as the number of CRPs logged that day. For MVP, a single boolean `crp_taken` plus optional duration is sufficient.

**Decision needed:** Support multi-CRP logging in MVP, or cap at 1?

### 5.5 `arp_locked` — Truly Computed or Static?

**Issue:** The data model says `arp_locked` is COMPUTED and "always true" in event contexts. If it's always true, it's redundant as a stored field.

**Recommendation:** Keep it in the schema as a boolean default TRUE. It enables future flexibility (e.g., an event type where ARP adjustment is permitted), but for now it's effectively a constant.

**Decision needed:** Remove as unnecessary, or keep for forward compatibility?

### 5.6 MRM Target — 42 or 49?

**Issue:** The data model mentions "42 (7/day × 6 active days)" but also "49 (7×7)" in parentheses. The weekly_cycle_balances schema uses 42.

**Recommendation:** 42 is more realistic (assumes 1 rest day or partial day). 49 is the theoretical maximum. Use 42 as the default target in the schema.

**Decision needed:** Confirm 42 as the standard MRM weekly target.

### 5.7 `user_reported_tracker_anxiety` — Detection Path

**Issue:** US-09 (Ortho-Insomnia) requires both `tracker_in_use = true` AND `user_report of tracker anxiety`. The `user_reported_tracker_anxiety` field exists in the profile, but there's no defined UI flow for when/how this flag gets set.

**Recommendation:** Add a prompt after 2 weeks of tracker use: "Has tracking your sleep ever made you more anxious about it?" This sets the flag and triggers US-09 detection.

**Decision needed:** When in the user journey to surface this prompt?

### 5.8 Recommendation `priority_label` vs `priority` Integer

**Issue:** The schema stores both a numeric `priority` (1–5) and a `priority_label` enum (CRITICAL/HIGH/MEDIUM/LOW). These could drift out of sync.

**Recommendation:** Either compute the label from the integer in the application layer, or add a CHECK constraint to enforce consistency. Current schema stores both for query convenience.

**Decision needed:** Keep both (denormalized for query speed), or derive label at app layer?

---

## 6. MVP vs V2 Field Coverage

All fields marked MVP in the data model are present in `001_r90_schema.sql`. V2 fields are included in the schema but commented as V2 — they have nullable defaults so they don't block MVP operation.

**V2 fields included in schema but not exercised in seed data:**
- `sleep_felt_onset`, `waking_cause`, `notes` (SleepLog)
- `crp_type`, `mrm_with_daylight`, `morning_light_method`, `exercise_*` fields (DailyLog)
- `shift_arp_day`, `shift_arp_night`, `active_shift`, `dominant_hand`, `morphotype`, `travel_frequency`, `occupation_schedule`, `arp_committed_at` (UserProfile)
- `noise_profile`, `individual_duvets`, `mattress_gap_test_passed`, `air_quality_managed` (EnvironmentContext)

---

## 7. Computed Fields and Triggers

| Trigger | Table | Fields Computed |
|---------|-------|----------------|
| `trg_environment_friction` | environment_contexts | `environment_friction_score`, `blackout_without_dws`, `updated_at` |
| `trg_sleep_log_flags` | sleep_logs | `onset_latency_flag` |
| `trg_daily_log_flags` | daily_logs | `crp_cycle_credited` |
| `trg_user_profile_version` | user_profiles | `profile_version`, `updated_at` |

**Not implemented as triggers (should be computed by the engine/backend):**
- `arp_maintained` on sleep_logs — requires joining arp_configs
- `crp_in_window` on daily_logs — requires joining arp_configs
- `caffeine_after_cutoff` on daily_logs — requires joining user_profiles
- `weekly_cycle_balances` totals — complex multi-row aggregation
- `user_states` detection — rule engine logic, not a simple trigger
