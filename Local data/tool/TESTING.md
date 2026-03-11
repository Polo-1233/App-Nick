# R90 Backend — End-to-End Testing Guide

## Prerequisites

- Node.js 20+
- A live Supabase project with migrations applied
- `curl` and `jq` installed

## 1. Apply migrations

If not already done, apply all three migrations in order:

```bash
# Via Supabase CLI (if using local dev)
supabase db reset

# Or apply manually in Supabase dashboard → SQL Editor:
# 1. supabase/migrations/001_r90_schema.sql
# 2. supabase/migrations/002_r90_rls_policies.sql
# 3. supabase/migrations/003_r90_seed_data.sql  (optional — test data only)
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=3000
```

Both values are in **Supabase Dashboard → Project Settings → API**.

- `SUPABASE_URL` → "Project URL"
- `SUPABASE_SERVICE_KEY` → "service_role" key (not the `anon` key)

## 3. Start the backend

```bash
npm install
npm run serve
```

Expected output:

```
R90 backend listening on http://localhost:3000
Routes:
  POST /users
  POST /logs/sleep
  POST /logs/daily
  POST /logs/checkin
  GET  /screen/home
  GET  /screen/day-plan
  GET  /screen/checkin
  POST /profile
  POST /profile/environment
  POST /actions/recommendation
```

For development with hot-reload:

```bash
npm run dev
```

## 4. Get a Supabase JWT

You need a real Supabase auth user. Create one using any of these methods:

### Option A — Supabase Dashboard

1. Go to **Authentication → Users → Add user**
2. Create a user with email + password
3. Sign in via the Supabase JS client to get an access token:

```javascript
const { data } = await supabase.auth.signInWithPassword({
  email: "test@example.com",
  password: "yourpassword"
})
console.log(data.session.access_token)
```

### Option B — Supabase CLI

```bash
# Get a token for a local dev user
supabase auth signin --email test@example.com --password yourpassword
```

### Option C — Direct API call

```bash
curl -X POST "https://your-project.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"yourpassword"}'
```

Copy the `access_token` from the response.

## 5. Run the E2E test

```bash
BASE_URL=http://localhost:3000 \
TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
./backend/e2e-test.sh
```

### What the script tests (in order)

| Step | Endpoint | What it validates |
|------|----------|-------------------|
| 1 | `GET /health` | Server is up |
| 2 | `POST /users` | User + profile records created |
| 3 | `POST /profile` | ARP committed, ARP config generated, engine runs |
| 4 | `POST /profile/environment` | Environment context saved |
| 5 | `GET /screen/checkin` | Cold-state questions (max 3) |
| 6 | `POST /logs/sleep` | Sleep log written, cycles resolved |
| 7 | `POST /logs/checkin` | Daily check-in written, engine re-runs |
| 8 | `GET /screen/home` | States detected, recs generated |
| 9 | `GET /screen/day-plan` | 16-cycle timeline + notification schedule |
| 10 | `GET /screen/checkin` | Prefilled values after log submission |
| 11 | `POST /actions/recommendation` | Rec actioned/dismissed |
| 12 | Various | Error cases: 400, 401, 404, 422 |

## 6. Validate in Supabase

After the script runs, check these tables in **Supabase Dashboard → Table Editor**
(or paste the SQL printed at the end of the test script into the SQL Editor):

### Expected state after a successful run

#### `users`
- 1 row with your `auth_user_id` and `onboarding_step: 3`

#### `user_profiles`
- 1 row with `arp_committed: true`, `arp_time: 06:30`, `chronotype: AMer`

#### `arp_configs`
- 1 row with `arp_time: 06:30` and 16 `cycle_times` starting at 06:30

```
cycle_times[0] = 06:30
cycle_times[1] = 08:00
...
cycle_times[15] = 05:00
```

Expected values for ARP 06:30:

| Field | Expected |
|-------|----------|
| `crp_window_open` | `14:00` |
| `crp_window_close` | `18:30` |
| `sleep_onset_5cycle` | `23:00` |
| `sleep_onset_4cycle` | `00:30` |
| `phase_1_start` | `06:30` |
| `phase_2_start` | `12:30` |
| `phase_3_start` | `18:30` |
| `phase_4_start` | `00:30` |

#### `sleep_logs`
- 1 row for yesterday with `cycles_completed: 5`, `arp_maintained: true`

#### `daily_logs`
- 1 row for today with `mrm_count: 5`, `morning_light_achieved: true`
- `crp_taken: false` → `crp_cycle_credited` should be `false` (set by DB trigger)

#### `weekly_cycle_balances`
- 1 row with `status: active`
- `nocturnal_cycles` should include the submitted value (e.g. `[5]`)
- `weekly_cycle_total` ≥ 5

#### `user_states`
- For a brand-new user with onboarding not complete: `US-12` (Framework Gap) should be active
- After onboarding is completed, US-12 resolves and other states appear

#### `recommendations`
- At least 1 row with `status: pending`
- If US-12 is active, expect `REC-20` (framework re-entry)
- If onboarding complete and ARP committed, expect `REC-01` (foundation adherence)
- **Critical check**: if `user_reported_anxiety: true` is NOT set, `REC-19` may appear — confirm it is NOT appearing alongside `US-07` (anxiety safety rule)

#### `recommendation_cooldowns`
- 1 row per recommendation type generated, with `last_triggered_at` populated

## 7. Optional: test with a seed user

The seed data (migration 003) includes 5 pre-configured users. To test against them:

1. Create a real Supabase auth user
2. Get their Supabase `auth.users` UUID (from Authentication dashboard)
3. In Supabase SQL Editor, link them to a seed user:

```sql
-- Replace <auth-uuid> with the UUID from Supabase Auth dashboard
-- Replace <seed-user-id> with one of the seed user IDs below
UPDATE users
SET auth_user_id = '<auth-uuid>'
WHERE id = '<seed-user-id>';
```

Seed user IDs and states:

| ID | Name | States | Test scenario |
|----|------|--------|---------------|
| `a1000000-0000-0000-0000-000000000001` | Alice | US-01 | Ideal aligned user |
| `a1000000-0000-0000-0000-000000000002` | Bob | US-02, US-05 | Mild deficit + PMer conflict |
| `a1000000-0000-0000-0000-000000000003` | Carol | US-07, US-08, US-11 | Anxiety loop — confirms REC-19 suppression |
| `a1000000-0000-0000-0000-000000000004` | Dave | US-06 | Post-travel recovery |
| `a1000000-0000-0000-0000-000000000005` | Eve | US-12 | New user / onboarding gap |

Then run with `SKIP_SIGNUP=1`:

```bash
SKIP_SIGNUP=1 \
EXISTING_USER_ID=a1000000-0000-0000-0000-000000000001 \
BASE_URL=http://localhost:3000 \
TOKEN=<your-jwt> \
./backend/e2e-test.sh
```

### Critical safety test (Carol — seed user 3)

Carol has `US-07` (Sleep Anxiety Loop) active. The engine must:
- NOT return `REC-19` (sleep restriction)
- Apply `tone_override: PROCESS_FIRST`
- Return `REC-13` or `REC-09` (anxiety reframe, not outcome-focused)

Check in home screen response:
```json
{
  "tone_override_active": true,
  "active_states": [{"state_id": "US-07"}, ...],
  "primary_recommendation": { "rec_type": "REC-13" }  // NOT REC-19
}
```

## 8. Manual validation checklist

Run through this checklist after the script passes:

- [ ] `GET /health` returns `{"ok":true}`
- [ ] `POST /users` returns `{"user_id":"...","is_new":true}` for a new auth user
- [ ] `POST /users` with the same token returns `{"is_new":false}` (idempotent)
- [ ] `POST /profile` with `arp_time:"06:30"` causes `arp_configs` row to appear with correct cycle_times
- [ ] `POST /logs/sleep` with `cycles_completed:5` causes `sleep_logs` row with `arp_maintained:true`
- [ ] `POST /logs/sleep` without `cycles_completed` but with `actual_sleep_onset` + `wake_time` causes `cycles_completed` to be computed from formula
- [ ] `POST /logs/sleep` with no time fields causes `cycles_completed: null` (not 0)
- [ ] `GET /screen/home` with `onboarding_completed:false` returns `gate_blocked:true`
- [ ] `GET /screen/home` after completing onboarding returns `gate_blocked:false`
- [ ] `GET /screen/home` for Carol (US-07 active) returns `tone_override_active:true` and NO `REC-19`
- [ ] `GET /screen/day-plan` returns 16+ timeline entries including CRP window
- [ ] `GET /screen/checkin` returns ≤ 3 questions
- [ ] `GET /screen/checkin` after submitting mrm_count returns no mrm_count question (prefilled)
- [ ] `POST /actions/recommendation` with `"action":"actioned"` updates rec status in DB
- [ ] All endpoints return 401 without a valid `Authorization: Bearer` header
- [ ] `POST /logs/sleep` with `"date":"2099-01-01"` returns 422

## 9. Troubleshooting

### "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY"
→ Check your `.env` file is in the project root (same dir as `package.json`)

### POST /users returns 401
→ Your JWT is expired or invalid. Get a fresh token (they expire in 1 hour by default)

### POST /users returns 500 "Failed to create user record"
→ The `users` table may have a conflicting row with the same `auth_user_id`.
   Check: `SELECT * FROM users WHERE auth_user_id = '<your-auth-uuid>';`

### GET /screen/home returns gate_blocked: true after onboarding
→ Check `user_profiles.arp_committed = true`. If false, call `POST /profile` again.

### crp_cycle_credited is null in daily_logs
→ The DB trigger may not be applied. Verify migration 001 was applied:
   `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'set_crp_cycle_credited';`

### Engine output shows no recommendations
→ Check `user_states` table — if no states are detected, REC-01 (foundation) should still appear.
   If not, check that `arp_committed = true` in `user_profiles`.
