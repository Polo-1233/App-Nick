# NICK BRAIN — Complete Project Summary

**Date:** 2026-03-11
**Status:** Engine and backend complete. Not yet connected to a mobile app.
**For:** Product, engineering, and founder reference.

---

## 1. PROJECT PURPOSE

### What is nick_brain?

Nick Brain is the intelligence layer for an R90 sleep recovery application. It codifies the full methodology of sleep expert Nick Littlehales into a deterministic, rule-based engine that detects each user's recovery situation and generates personalised, ranked, safe recommendations.

The system sits between a Supabase database and a mobile app. Users log sleep and daily data; the engine analyses those logs against their profile, detects which of 17 recovery states they are in, and returns screen-ready payloads — no raw logic reaches the app.

### What problem does it solve?

Most people think in hours ("I need 8 hours"). R90 reframes sleep as 90-minute cycles across a structured 24-hour day, anchored to a fixed wake time (ARP). The system:

- Replaces hours-thinking with **cycle accounting** (weekly target: 35 cycles)
- Detects when users are in deficit, anxiety, or environmental friction states
- Recommends specific interventions (CRP, MRM, phase management, light) based on the user's actual pattern
- Enforces anxiety safety rules — never prescribes sleep restriction when the user is anxious about sleep
- Produces pre-assembled payloads so the app only renders — it does not compute

### Relationship to the app

```
Mobile App
    │  (reads pre-assembled payloads)
    │  (submits sleep/daily logs)
    ▼
HTTP Backend  ←── Auth middleware (Supabase JWT)
    │  (assembles EngineContext from DB)
    │  (runs deterministic engine)
    │  (persists states + recommendations)
    ▼
R90 Engine (pure TypeScript, no I/O)
    │
    ▼
Supabase (PostgreSQL + Auth + RLS)
```

---

## 2. KNOWLEDGE LAYER

### Files (22 documents in `knowledge/`)

| File | Purpose | Status |
|------|---------|--------|
| `R90_CANONICAL_SYSTEM.md` | **Frozen** master reference — the complete R90 methodology distilled from all sources | **FROZEN** |
| `R90_DATA_MODEL.md` | Entity definitions, field names, computed vs input fields, MVP scope | Complete |
| `R90_RULE_ENGINE_SPEC.md` | All 43 detection rules in IF/THEN/ELSE format, 7-pass evaluation order, safety rules | Complete |
| `R90_USER_STATES.md` | All 17 user states with triggers, detection signals, co-occurrence matrix | Complete |
| `R90_RECOMMENDATION_ENGINE.md` | All 26 recommendations with priorities, trigger states, cooldowns, output types | Complete |
| `R90_ENGINE_SIMULATION_TESTS.md` | 39 test cases: SIM/GATE/ACCT/SAFE scenarios. MVP-critical 8 passing | Complete |
| `R90_APP_IMPLEMENTATION_SPEC.md` | 8 MVP screens, 8 API functions, build milestones, out-of-scope list | Complete |
| `R90_BACKEND_API_CONTRACT.md` | 16 function signatures, 6 payload schemas, 5 worked examples | Complete |
| `R90_PROFILING_SYSTEM.md` | Chronotype classification, profiling interview structure | Complete |
| `R90_SYSTEM_OVERVIEW.md` | Synthesis: philosophy, 16-cycle model, weekly accounting, key formulas | Complete |
| `R90_DECISION_RULES.md` | DR-001–DR-079: granular behavioural rules behind all state detection | Complete |
| `R90_BEHAVIOURAL_PATTERNS.md` | BP-001–BP-043: observed patterns from source material | Complete |
| `R90_CORE_PRINCIPLES.md` | P-001–P-171: raw extracted principles from audio/doc sources | Complete |
| `R90_TERMINOLOGY.md` | Canonical definitions of all R90 terms | Complete |
| `R90_COACHING_OUTPUTS.md` | Coaching message tone, language principles | Complete |
| `R90_APP_FEATURE_MAPPING.md` | Maps each user state to specific app screens and interactions | Complete |
| `R90_DECISION_ENGINE.md` | Visual decision tree overview | Complete |
| `R90_SYSTEM_ARCHITECTURE.md` | Technical architecture reference | Complete |
| `R90_OPEN_QUESTIONS.md` | Remaining ambiguities and open research questions | Partial — 4 high-priority items remain |
| `R90_SOURCE_INDEX.md` | Index of all 42+ processed source documents | Complete |
| `R90_BATCH_QUEUE.md` | Queue of sources pending processing | Partially processed |

### What the canonical system contains

The frozen system defines:
- The **90-minute cycle model** and ARP formula: `Cn = ARP + (n−1) × 90 min`
- **4-phase daily structure**: P1 (C1-C4 activation), P2 (C5-C8 CRP window), P3 (C9-C12 wind-down), P4 (C13-C16 nocturnal)
- **Weekly accounting**: 35-cycle target (28 nocturnal + 7 CRP); 28 cycles = floor; deficit tracking
- **CRP mechanics**: 30/20-min tiers; Phase 2 window (C6-C9 / 14:00-18:30 for 06:30 ARP); 20 min = 1 cycle credit
- **MRM mechanics**: 7/day at cycle boundaries; 2-5 min; light exposure pairing
- **3 chronotypes**: AMer (30%), PMer (70%), In-betweener (masked PMer)
- **Light protocol**: 10,000 Lux on ARP, 500 Lux threshold for melatonin suppression
- **Anxiety safety rule**: worry about sleep is the primary disruptor — the system never prescribes restriction when anxiety is present

### What is still partial or open

- OQ-004: Exact circadian peak performance times (not needed for MVP)
- OQ-005: ARP/nadir relationship (not needed for MVP)
- OQ-013: Formal chronotype diagnostic tool (not yet implemented)
- OQ-016: "Urgent need" concept (not yet defined)
- Shift work full specification: US-17 defined but not engine-implemented (V2)
- Illness recovery (US-16): partially specified, V2 implementation

---

## 3. ENGINE LAYER

### Files (7 TypeScript modules in `engine/`)

| File | What it does |
|------|-------------|
| `types.ts` | All TypeScript interfaces: `EngineContext`, `EngineOutput`, `UserProfile`, `SleepLog`, `DailyLog`, `WeeklyCycleBalance`, `DetectedState`, `RecommendationOutput`, etc. |
| `arp-config.ts` | Generates the full ARP schedule from a single wake time string: 16 cycle times, 4 phase starts, CRP window, sleep onset targets (3/4/5/6 cycle), MRM times |
| `weekly-accounting.ts` | Pure computation of weekly cycle totals, deficit, risk flag, ARP stability, MRM averages, CRP count. Helpers used by state-detector. |
| `state-detector.ts` | 7-pass state evaluation producing a sorted `DetectedState[]`. No I/O. |
| `recommendation-engine.ts` | Generates candidate recommendations from active states and context. Applies cooldown gating. Returns ranked `RecommendationOutput[]`. |
| `conflict-resolution.ts` | Suppression rules (US-07 hard-suppresses REC-19), tone override computation, `show_cycle_count`/`show_deficit_warning` flags |
| `engine-runner.ts` | Entry point: assembles steps 1-9, injects fresh weekly balance, runs safe wrapper. Exports `runEngine()` and `runEngineSafe()`. |

**Compiled to:** `engine-dist/`
**Build command:** `npm run build:engine`
**Smoke tests:** `node engine-dist/engine/smoke-test.mjs`

### How the engine works

```
EngineContext (pre-assembled from DB)
    │
    ▼ Step 1: Resolve/regenerate ARP config if stale
    ▼ Step 2: Validation gates (no ARP? no logs? → gate_blocked)
    ▼ Step 3: Compute weekly accounting from current logs
    ▼ Step 3b: Inject fresh WeeklyCycleBalance into context
    ▼ Step 4: State detection (7 passes, priority-sorted)
    ▼ Step 5: Generate candidate recommendations
    ▼ Step 6: Apply suppression rules (US-07, US-09, US-12, US-16)
    ▼ Step 7: Apply conflict tone adjustments
    ▼ Step 8: Cap recommendations (max 5; REC-01, REC-20 exempt)
    ▼ Step 9: Compute UI flags (show_cycle_count, tone_override, deficit_warning)
    │
    ▼
EngineOutput (gate_blocked, active_states, recommendations, tone_override, weekly_accounting, arp_config)
```

### User states implemented

| State | Name | Implemented |
|-------|------|-------------|
| US-01 | Aligned | ✓ Pass 6 |
| US-02 | Mild Cycle Deficit | ✓ Pass 3 |
| US-03 | Significant Cycle Deficit | ✓ Pass 3 |
| US-04 | ARP Instability | ✓ Pass 1 (gate) |
| US-05 | Chronotype Conflict | ✓ Pass 4 |
| US-06 | Post-Disruption Recovery | ✓ Pass 5 |
| US-07 | Sleep Anxiety Loop | ✓ Pass 2 (CRITICAL) |
| US-08 | Electronic Insomnia | ✓ Pass 4 |
| US-09 | Ortho-Insomnia | ✓ Pass 2 |
| US-10 | Stimulant Compensation | ✓ Pass 4 |
| US-11 | Environmental Friction | ✓ Pass 4 |
| US-12 | Framework Gap | ✓ Pass 1 (gate) |
| US-13 | Sleep Noise Exposure | V2 only |
| US-14 | In-Betweener Fog | V2 only |
| US-15 | Pre-Event High Arousal | ✓ Pass 5 (partial — needs EventContext) |
| US-16 | Illness/Injury Recovery | ✓ Pass 5 (partial — needs EventContext) |
| US-17 | Shift Work/Multishift | V2 only |

**MVP implemented:** 15 of 17 states (US-13, US-14, US-17 deferred to V2)

### Recommendations implemented

All 26 recommendations (REC-01 through REC-26) are defined in the engine with:
- Cooldown hours per rec type
- Priority levels (CRITICAL/HIGH/MEDIUM/LOW)
- Trigger state conditions
- Suppression rules
- Action payloads

**Key safety rule — hard-coded in engine:**
`REC-19` (sleep restriction protocol) returns `null` immediately if `US-07` is active. This is tested as SAFE-01 and cannot be bypassed.

**Recommendation cap:** Max 5 active. `REC-01` and `REC-20` are cap-exempt (always shown if triggered).

### What the smoke tests validate

8 MVP-critical tests pass against the built engine:

| Test | What it validates |
|------|------------------|
| GATE-01 | No ARP → `gate_blocked: true`, US-12 detected |
| GATE-03 | No logs → `gate_blocked: true`, `no_logs` reason |
| SIM-09 | Null sleep log does NOT trigger CRP recommendation |
| SAFE-01 | REC-19 absent when US-07 active (anxiety + deficit) |
| SAFE-06 | US-07 + US-03 → REC-15 leads, REC-19 suppressed, tone override active |
| SIM-04 | 3 of 5 nights high latency → US-07 detected, tone override |
| ACCT-04 | CRP 20 min = 1 cycle credit; 19 min = 0 |
| SIM-02 | US-02 active → REC-03 generated with correct crp_start |

**Not yet run:** 31 remaining simulation tests from `R90_ENGINE_SIMULATION_TESTS.md` (SIM-03 through SIM-10, all GATE/ACCT/SAFE variants).

---

## 4. BACKEND LAYER

### Files (~20 TypeScript files in `backend/`)

**`backend/types.ts`** — All HTTP request/response shapes: `SleepLogInput`, `DailyLogInput`, `CheckInInput`, `ProfileUpdateInput`, `EnvironmentInput`, `HomeScreenPayload`, `DayPlanPayload`, `CheckInPayload`, `WeeklyBalanceSummary`.

**`backend/db/`**

| File | What it does |
|------|-------------|
| `client.ts` | Supabase service-role client factory; `resolveUserId(authUid → app user.id)` |
| `queries.ts` | All read queries: 9 tables, TIME normalisation (`HH:MM:SS` → `HH:MM`), typed row interfaces |
| `mutations.ts` | All writes: upsert sleep/daily logs, weekly balance, ARP config, states, recommendations, cooldowns, environment, events |
| `rec-metadata.ts` | Static lookup tables: `REC_CATEGORY`, `REC_COOLDOWN_HOURS`, `REC_DELIVERY_CHANNEL` |

**`backend/context/assembler.ts`** — Reads 9 DB tables in parallel → builds `EngineContext`. Handles all type mapping between DB strings and engine enums.

**`backend/services/`**

| File | What it does |
|------|-------------|
| `engine-service.ts` | `runAndPersistEngine()`: assemble context → run engine → persist states/recs/balance/ARP config |
| `sleep-log-service.ts` | Validate → compute `arp_maintained` + cycles formula → upsert → run engine |
| `daily-log-service.ts` | Validate → compute `crp_in_window` + `caffeine_after_cutoff` → upsert → run engine |
| `check-in-service.ts` | Lightweight daily input → delegates to `submitDailyLog` |

**`backend/payloads/`**

| File | What it does |
|------|-------------|
| `home-screen.ts` | Builds `HomeScreenPayload`: current phase/cycle, sleep onset targets, weekly balance summary, rec split |
| `day-plan.ts` | Builds `DayPlanPayload`: 16-cycle annotated timeline, CRP window, notification schedule |
| `check-in.ts` | Builds `CheckInPayload`: selects ≤3 questions based on engine state, fills from today's log |
| `coaching-copy.ts` | Static coaching copy for all 26 recommendation types, tone variant support |

**`backend/handlers/`**

| File | Endpoints |
|------|----------|
| `log-handlers.ts` | `POST /logs/sleep`, `POST /logs/daily`, `POST /logs/checkin` |
| `payload-handlers.ts` | `GET /screen/home`, `GET /screen/day-plan[?date=]`, `GET /screen/checkin` |
| `profile-handlers.ts` | `POST /users`, `POST /profile`, `POST /profile/environment`, `POST /actions/recommendation` |

**`backend/middleware/auth.ts`** — JWT extraction → `client.auth.getUser(token)` → `resolveUserId`. Two variants: `authenticate()` (requires existing users row) and `authenticateSignup()` (for `POST /users` where no row exists yet).

**`backend/server.ts`** — Plain Node.js `http` server. No framework. Route table, `readBody`/`sendJson`/`sendError` helpers, `.env` loader.

### All 11 HTTP endpoints

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/health` | Public health check |
| POST | `/users` | Create user record after Supabase signup (idempotent) |
| POST | `/profile` | Update profile + regenerate ARP config if ARP committed |
| POST | `/profile/environment` | Update bedroom/light environment |
| POST | `/logs/sleep` | Submit sleep log → run engine |
| POST | `/logs/daily` | Submit daily log → run engine |
| POST | `/logs/checkin` | Submit lightweight check-in → run engine |
| GET | `/screen/home` | Home screen payload |
| GET | `/screen/day-plan` | Day plan payload (optional `?date=`) |
| GET | `/screen/checkin` | Check-in questions payload |
| POST | `/actions/recommendation` | Action or dismiss a recommendation |

### How data flows end-to-end

```
POST /logs/sleep
    │ 1. Validate input (date, ranges)
    │ 2. Compute: arp_maintained, cycles_completed (formula or explicit)
    │ 3. Upsert sleep_logs row (user_id, date — idempotent)
    │ 4. runAndPersistEngine()
    │      ├─ assembleEngineContext() (9 parallel DB reads)
    │      ├─ runEngineSafe() (deterministic, pure)
    │      └─ Persist: user_states, recommendations, cooldowns, weekly_balance, arp_config
    │ 5. Return: { sleep_log_id, crp_in_window, arp_maintained, engine_output }
```

### Build and run

```bash
npm run build          # build engine + backend
npm run typecheck      # TypeScript strict check (0 errors)
npm run serve          # build + run server
npm run dev            # tsx hot-reload (dev only)
```

---

## 5. DATABASE LAYER

### Migrations (3 files in `supabase/migrations/`)

**`001_r90_schema.sql`** — Full schema, 680 lines. Creates:
- 12 custom PostgreSQL enums (chronotype, recommendation_type, user_state_id, etc.)
- 11 application tables
- 1 DB trigger: `crp_cycle_credited` automatically set when `crp_duration_minutes ≥ 20 min`
- Helper functions and computed column triggers

**`002_r90_rls_policies.sql`** — Row Level Security for all 11 tables:
- Helper function: `current_app_user_id()` maps `auth.uid()` → `users.id`
- User-writable tables: `user_profiles`, `sleep_logs`, `daily_logs`, `environment_contexts`, `event_contexts`
- Engine-only tables (service role writes, users read-only): `arp_configs`, `weekly_cycle_balances`, `user_states`, `recommendations`, `recommendation_cooldowns`
- The backend uses the service role key — RLS is fully bypassed server-side

**`003_r90_seed_data.sql`** — 5 test users with complete data fixtures:

| User | ARP | Chronotype | Active States | Test scenario |
|------|-----|-----------|---------------|---------------|
| Alice | 06:30 | AMer | US-01 | Ideal aligned user — positive baseline |
| Bob | 06:30 | PMer | US-02, US-05 | Mild deficit + social jet lag |
| Carol | 07:00 | In-betweener | US-07, US-08, US-11 | Anxiety loop — critical safety test |
| Dave | 06:00 | AMer | US-06 | Post-travel recovery (active event) |
| Eve | 07:00 | Unknown | US-12 | New user, onboarding incomplete |

Seed users use dummy `auth_user_id` UUIDs. To test with a real JWT, link via:
`UPDATE users SET auth_user_id = '<real-auth-uuid>' WHERE id = '<seed-user-id>';`

### The 11 tables

| Table | Layer | Purpose |
|-------|-------|---------|
| `users` | Identity | Root record — auth_user_id, timezone, onboarding_step |
| `user_profiles` | Profile | ARP, chronotype, caffeine, tracker, anxiety flags |
| `arp_configs` | Computed | 16 cycle times, phase boundaries, CRP window, sleep onset targets, MRM times |
| `sleep_logs` | Operational | Nocturnal: cycles, latency, wake time, ARP maintained |
| `daily_logs` | Operational | Daytime: MRM, CRP, light, caffeine, energy. `crp_cycle_credited` set by trigger |
| `weekly_cycle_balances` | Computed | Weekly totals, deficit, risk flag, ARP stability |
| `user_states` | Engine output | Active detected states (synced fresh on each engine run) |
| `recommendations` | Engine output | Generated recs with status (pending/delivered/actioned/dismissed/expired) |
| `recommendation_cooldowns` | Engine output | Per-user, per-rec cooldown tracking + dismissed count |
| `environment_contexts` | Profile | Bedroom: temperature, light, distractions, blackout, DWS |
| `event_contexts` | Operational | Travel, illness, shift changes with date ranges and cycle floor overrides |

### Key schema facts

- `crp_cycle_credited` is computed by a DB trigger (backend does not set it)
- All TIME columns return `HH:MM:SS` from Supabase — normalised to `HH:MM` in queries layer
- No FK constraint from `users.auth_user_id` to `auth.users` (intentional — allows seed data without real auth users)
- Unique constraints: `sleep_logs(user_id, date)`, `daily_logs(user_id, date)`, `arp_configs(user_id)`, `environment_contexts(user_id)` — all upserts are idempotent

---

## 6. TESTING LAYER

### What exists

**`engine/smoke-test.mjs`** (320 lines)
8 automated tests against the compiled engine. Run with:
```bash
node engine-dist/engine/smoke-test.mjs
```
**Status: All 8 pass.** These are purely in-process — no DB, no HTTP.

**`backend/e2e-test.sh`** (12-step shell script)
Full lifecycle test: health → user creation → profile commit → environment → sleep log → check-in → home screen → day plan → rec action → error cases.

**Status: Written. Not yet run against a live Supabase instance.** Requires real `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and a valid Supabase auth JWT.

**`TESTING.md`** (comprehensive testing guide)
Covers: how to apply migrations, get a JWT, run the E2E script, validate Supabase tables, use seed users, and manual checklist (15 items).

### What has been validated

| Layer | What's validated | Method |
|-------|-----------------|--------|
| Engine state detection | 8 of 39 simulation tests | `smoke-test.mjs` — real code, automated |
| Engine safety rules | SAFE-01 (REC-19 suppressed), SAFE-06 (anxiety+deficit) | `smoke-test.mjs` — real code, automated |
| Engine accounting | CRP credit boundary, deficit computation | `smoke-test.mjs` — real code, automated |
| Engine gate logic | No ARP gate, no logs gate | `smoke-test.mjs` — real code, automated |
| TypeScript types | Full strict compilation (0 errors) | `npm run typecheck` |
| Backend compilation | Full build (0 errors) | `npm run build` |
| DB schema | Designed and written | SQL — not applied to a real Supabase project yet |

### What is still theoretical

- End-to-end HTTP flow (auth → handler → service → engine → persist → payload)
- All 31 remaining simulation test scenarios
- Real JWT authentication flow
- Supabase RLS policies in a live database
- `crp_cycle_credited` DB trigger behaviour
- Weekly balance accuracy over time (7-day rolling window)
- Recommendation expiry and cooldown enforcement in the DB

---

## 7. CURRENT PROJECT STATUS

### Fully complete

| Component | Detail |
|-----------|--------|
| Knowledge base | 22 docs, methodology frozen, all states/rules/recs specified |
| Engine types | All engine interfaces in TypeScript (no compile errors) |
| ARP config generator | Correct formula for all 16 cycles, phases, CRP window, MRM times |
| Weekly accounting | Cycle totals, deficit, risk flag, ARP stability, MRM averages |
| State detection | 15 of 17 user states (US-13, US-14, US-17 V2) |
| Recommendation engine | All 26 recs with cooldowns, suppression, cap, priorities |
| Conflict resolution | Suppression rules, tone override, UI flags |
| Engine runner | 9-step execution, fresh balance injection, safe wrapper |
| 8 smoke tests | All MVP-critical scenarios validated against real code |
| DB schema | 11 tables, enums, trigger, 3 migrations written |
| Seed data | 5 test users covering all major state scenarios |
| RLS policies | All 11 tables with service-role bypass pattern |
| Backend DB layer | Queries, mutations, rec-metadata — all read/write paths |
| Context assembler | 9-table parallel read → EngineContext |
| Service layer | sleep-log, daily-log, check-in, engine-service |
| Payload builders | home-screen, day-plan, check-in, coaching-copy |
| HTTP server | 11 endpoints, JWT auth middleware, env loader, error handling |
| `POST /users` | Idempotent signup registration with `authenticateSignup()` |
| E2E test script | 12-step shell script with exact commands and expected outputs |
| Testing guide | TESTING.md — complete setup, validation, and troubleshooting |

### Partially complete

| Component | What's done | What's missing |
|-----------|-------------|----------------|
| Simulation tests | 8 of 39 passing | 31 scenarios not yet run |
| E2E validation | Script written | Not yet run on real Supabase |
| User states | 15 of 17 | US-13, US-14, US-17 (V2) |
| Onboarding flow | Profile and ARP endpoints exist | No explicit onboarding-step sequencing endpoint |
| Coaching copy | Static strings for all 26 recs | No localisation, no tone variant system in API layer |

### Not yet implemented / not yet connected

| Component | Status |
|-----------|--------|
| Mobile app | Not started — this project is backend-only |
| Push notifications | Day plan generates `notification_schedule` but nothing dispatches them |
| Supabase deployment | Migrations written but not applied to a real project |
| Supabase Edge Functions | Not wrapped — server runs as plain Node.js process |
| Weekly insights payload | `get_weekly_insights_payload` specified in API contract, not implemented |
| Tracker integration | Out of scope (V2) |
| Shift work (US-17) | Specified, not engine-implemented (V2) |
| Clinical escalation | Out of scope by design |

---

## 8. KEY RISKS / OPEN POINTS

### Risk 1 — E2E validation not yet run

The engine has been validated in isolation (smoke tests). The full HTTP pipeline — auth → handler → service → engine → Supabase write → payload — has never been executed end-to-end against a real database. All integration assumptions must be validated before connecting the mobile app.

**Mitigation:** Follow `TESTING.md`. Run `e2e-test.sh` against a real Supabase project before any app work begins.

### Risk 2 — Supabase migrations not yet applied

The schema, RLS policies, and seed data exist as SQL files. They have not been applied to a real Supabase project. The `crp_cycle_credited` trigger, the `current_app_user_id()` RLS helper function, and all enum types need to be applied in order.

**Mitigation:** Apply in sequence: 001 → 002 → 003 (seed optional). Verify via Supabase dashboard.

### Risk 3 — onset_latency_minutes dependency for US-07

US-07 (Sleep Anxiety Loop) detection requires `onset_latency_minutes` in the sleep log. This is a user-reported field. If the mobile app doesn't surface this input clearly, US-07 may never trigger — making the most important safety rule permanently inactive.

**Mitigation:** The sleep log screen must include an onset latency field (or a simple "how long to fall asleep" selector). This is a UI design requirement.

### Risk 4 — Weekly balance day_number accuracy

The engine computes the rolling week from `arp_committed_at`. If a user's profile is created before ARP is committed, or if `arp_committed_at` is null, the day number calculation falls back to `ctx.today`, which may cause incorrect deficit risk flags.

**Mitigation:** Ensure `POST /profile` with `arp_committed: true` always sets `arp_committed_at` (it does — see `sanitiseProfileInput` in mutations.ts). Verify this in the E2E test.

### Risk 5 — Recommendation ID in `POST /actions/recommendation`

The recommendation action endpoint requires a `recommendation_id` UUID. This UUID is generated by the engine (`randomUUID()`) and stored in the `recommendations` table. The mobile app must read it from the `/screen/home` payload (`primary_recommendation.id`) and pass it back. If the payload builder doesn't include the recommendation ID, the action endpoint is unusable.

**Check needed:** Verify `HomeScreenPayload` includes `primary_recommendation.id`. (The `RecommendationOutput` type has `id: string` — confirm `home-screen.ts` passes it through.)

### Risk 6 — Token expiry during a session

Supabase JWTs expire in 1 hour by default. If a user leaves the app open, their next API call will return 401. The mobile app must handle token refresh silently via `supabase.auth.refreshSession()` and retry.

### Risk 7 — 31 untested simulation scenarios

Many edge cases have not been validated in code:
- US-04 (ARP instability) with partial wake time data
- US-09 (Ortho-insomnia) with tracker in use
- US-10 (stimulant compensation) caffeine pattern detection
- US-15/US-16 via EventContext (only partially specified)
- Recommendation cooldown expiry over multiple days
- Weekly balance reset at week boundary

These must be tested before launch to ensure correctness.

### Risk 8 — Missing `weekly_insights_payload` endpoint

The API contract specifies `get_weekly_insights_payload` (weekly summary screen). This has not been implemented. If the app needs a weekly summary view before launch, this must be added.

---

## NEXT STEPS TO CONNECT NICK BRAIN TO THE APP

### Phase 1 — Validate the backend (do this first, before any app work)

**Step 1: Apply migrations to a real Supabase project**

1. Create a Supabase project (or use an existing one)
2. In the SQL Editor, apply in order:
   - `supabase/migrations/001_r90_schema.sql`
   - `supabase/migrations/002_r90_rls_policies.sql`
   - `supabase/migrations/003_r90_seed_data.sql` (optional — test data)
3. Verify: check that `arp_configs`, `user_states`, `recommendations`, `recommendation_cooldowns` tables exist
4. Verify: run `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'set_crp_cycle_credited';` — should return a row

**Step 2: Configure environment and start the backend**

```bash
cp .env.example .env
# fill in SUPABASE_URL and SUPABASE_SERVICE_KEY from Supabase dashboard
npm install
npm run serve
```

**Step 3: Run the E2E test**

```bash
# Get a JWT: sign in via Supabase dashboard or supabase.auth.signInWithPassword()
TOKEN=<access_token> ./backend/e2e-test.sh
```

Expected: all 12 steps pass. Check Supabase table editor to confirm rows appear in all 9 expected tables.

**Step 4: Run the Carol safety test**

```bash
# Link a real auth user to Carol's seed row
# UPDATE users SET auth_user_id = '<your-auth-uuid>' WHERE id = 'a1000000-0000-0000-0000-000000000003';

SKIP_SIGNUP=1 \
EXISTING_USER_ID=a1000000-0000-0000-0000-000000000003 \
TOKEN=<access_token> \
./backend/e2e-test.sh
```

Check: home screen response must have `tone_override_active: true` and NO `REC-19` in recommendations.

---

### Phase 2 — Connect the mobile app

**What the app needs from the backend (6 integrations):**

#### Integration 1: Authentication

The app uses Supabase Auth directly (Supabase client handles sign-in/sign-up). After signup:
- App calls `POST /users` with `Authorization: Bearer <access_token>` and `{ timezone: "Europe/London" }`
- Backend creates users + user_profiles rows
- App stores the returned `user_id` locally

The app must:
- Use `@supabase/supabase-js` in the mobile client for auth only
- Call `supabase.auth.refreshSession()` when tokens expire (after ~1 hour)
- Pass the fresh `access_token` as `Authorization: Bearer` on every API request

#### Integration 2: Onboarding (3 calls)

```
POST /users           → registers user
POST /profile         → sets chronotype, ARP time, arp_committed: true, onboarding_step: 3
POST /profile/environment  → sets bedroom conditions
```

After these 3 calls, the engine can run fully and US-12 (Framework Gap) resolves.

**Order matters:** Don't call `/profile/environment` before `/users` creates the user row.

**Critical:** `POST /profile` with `arp_committed: true` must include `arp_time`. This triggers ARP config generation. Without it, no schedule exists.

#### Integration 3: Daily log submission (2 calls per day)

```
POST /logs/sleep      → morning, after waking
POST /logs/checkin    → midday or evening check-in
```

`/logs/sleep` minimum viable body:
```json
{ "date": "YYYY-MM-DD", "wake_time": "HH:MM", "cycles_completed": 5 }
```

For US-07 (anxiety) detection to work, the app must also collect and submit `onset_latency_minutes`. This is required for the most important safety rule.

#### Integration 4: Screen payloads (3 reads)

```
GET /screen/home       → rendered on app open / foreground
GET /screen/day-plan   → day plan screen
GET /screen/checkin    → check-in questions screen
```

All return pre-assembled JSON. The app renders these — no business logic in the app.

**Home screen payload includes:**
- `gate_blocked`: if true, show onboarding prompt instead of schedule
- `active_states`: drives which UI sections to show
- `tone_override_active`: if true, suppress cycle count comparisons
- `primary_recommendation.rec_type`: which coaching card to show
- `primary_recommendation.id`: needed for recommendation actions

#### Integration 5: Recommendation action

When the user taps "Done" or dismisses a coaching card:
```
POST /actions/recommendation
Body: { "recommendation_id": "<uuid>", "action": "actioned" }
```

The `recommendation_id` must come from the home screen payload. The app must store it when rendering the card.

#### Integration 6: Environment and profile updates

```
POST /profile/environment  → when user changes bedroom settings
POST /profile              → when user updates chronotype or ARP time
```

Both trigger an engine re-run. The response includes `engine_output` — the app can use this to update its state immediately.

---

### Phase 3 — Push notifications (after app MVP)

The day plan payload includes `notification_schedule` — a list of timed notifications (ARP wake-up, MRM reminders, CRP window open, Phase 3 start, sleep onset). The backend generates these but does not dispatch them.

To implement:
1. Mobile app registers device push token with Supabase
2. A scheduled function (Supabase Edge Function or cron) reads `notification_schedule` for each user and dispatches at the specified times via Expo Push API or FCM
3. Not required for MVP — the app can show inline reminders from the day plan payload instead

---

### Recommended implementation order

```
1. Apply migrations to Supabase project         (1 hour)
2. Run e2e-test.sh — confirm backend works      (1-2 hours)
3. Fix any issues found in E2E validation       (variable)
4. Run remaining 31 simulation tests            (2-3 hours — extend smoke-test.mjs)
5. Build onboarding screens (3 API calls)       (mobile work)
6. Build home screen (reads /screen/home)       (mobile work)
7. Build sleep log screen (POST /logs/sleep)    (mobile work)
8. Build check-in screen (GET + POST /screen/checkin + /logs/checkin)  (mobile work)
9. Build day plan screen (GET /screen/day-plan) (mobile work)
10. Wire recommendation actions                 (mobile work)
11. Implement push notification dispatch        (after MVP)
12. Implement weekly insights endpoint          (after MVP)
```

---

### What the mobile app does NOT need to compute

The backend handles all business logic. The app's job is to:
- Collect user inputs (wake time, cycles, MRM count, etc.)
- Submit them via the log endpoints
- Read and render the pre-assembled payloads
- Pass recommendation IDs back when a card is actioned

The app does not need to:
- Know about R90 rules or user states
- Calculate cycle times or phase boundaries
- Determine which questions to ask (check-in payload does this)
- Decide what coaching card to show (home screen payload does this)

---

*Summary last updated: 2026-03-11*
