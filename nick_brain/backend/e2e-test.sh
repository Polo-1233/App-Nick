#!/usr/bin/env bash
# =============================================================================
# R90 Backend — End-to-End Validation Script
#
# Tests the full lifecycle: signup → profile setup → sleep log → check-in
# → home screen → day plan → recommendation action.
#
# Prerequisites:
#   1. Backend running:   npm run serve
#   2. Supabase running:  local or hosted project with migrations applied
#   3. Auth user exists:  created via Supabase dashboard, CLI, or API
#   4. JWT obtained:      sign in via Supabase client and copy the access token
#
# Usage:
#   BASE_URL=http://localhost:3000  \
#   TOKEN=<supabase-access-token>  \
#   ./backend/e2e-test.sh
#
# Optional (skip user creation if users row already exists):
#   SKIP_SIGNUP=1  BASE_URL=... TOKEN=... ./backend/e2e-test.sh
#
# Requires: curl, jq
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

BASE="${BASE_URL:-http://localhost:3000}"
SKIP_SIGNUP="${SKIP_SIGNUP:-0}"
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)

if [ -z "${TOKEN:-}" ]; then
  echo "Error: TOKEN env var required (Supabase access token)"
  echo "Usage: TOKEN=eyJ... ./backend/e2e-test.sh"
  exit 1
fi

AUTH=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

# ─── Helpers ──────────────────────────────────────────────────────────────────

pass() { printf "  ✓ %s\n" "$1"; }
fail() { printf "  ✗ %s\n" "$1"; exit 1; }
section() { echo; echo "━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

check_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    pass "$label → HTTP $actual"
  else
    fail "$label → expected HTTP $expected, got $actual"
  fi
}

post() {
  local path="$1" body="$2"
  curl -s -w "\n%{http_code}" -X POST "${AUTH[@]}" -d "$body" "${BASE}${path}"
}

get() {
  local path="$1"
  curl -s -w "\n%{http_code}" "${AUTH[@]}" "${BASE}${path}"
}

split_response() {
  # Given curl output with \n<status> appended, splits into body and status
  local raw="$1"
  RESPONSE_BODY=$(echo "$raw" | head -n -1)
  RESPONSE_STATUS=$(echo "$raw" | tail -1)
}

# ─── 1. Health ────────────────────────────────────────────────────────────────

section "1. Health check"
RAW=$(curl -s -w "\n%{http_code}" "${BASE}/health")
split_response "$RAW"
check_status "GET /health" "200" "$RESPONSE_STATUS"
echo "  $(echo "$RESPONSE_BODY" | jq -c '.')"

# ─── 2. POST /users ───────────────────────────────────────────────────────────

section "2. Register user (POST /users)"

if [ "$SKIP_SIGNUP" = "1" ]; then
  echo "  (skipped — SKIP_SIGNUP=1)"
  USER_ID="${EXISTING_USER_ID:?Set EXISTING_USER_ID when using SKIP_SIGNUP=1}"
else
  RAW=$(post "/users" '{"timezone":"Europe/London"}')
  split_response "$RAW"

  if [ "$RESPONSE_STATUS" = "201" ]; then
    pass "POST /users → 201 (new user)"
  elif [ "$RESPONSE_STATUS" = "200" ]; then
    pass "POST /users → 200 (already registered — idempotent)"
  else
    fail "POST /users → unexpected status $RESPONSE_STATUS: $RESPONSE_BODY"
  fi

  USER_ID=$(echo "$RESPONSE_BODY" | jq -r '.user_id')
  IS_NEW=$(echo "$RESPONSE_BODY" | jq -r '.is_new')
  echo "  user_id: $USER_ID"
  echo "  is_new:  $IS_NEW"
fi

# ─── 3. Commit ARP (POST /profile) ───────────────────────────────────────────

section "3. Commit ARP and chronotype (POST /profile)"
PROFILE_BODY=$(cat <<'JSON'
{
  "arp_time": "06:30",
  "arp_committed": true,
  "chronotype": "AMer",
  "cycle_target": 5,
  "caffeine_use": "moderate",
  "onboarding_step": 3,
  "onboarding_completed": false
}
JSON
)

RAW=$(post "/profile" "$PROFILE_BODY")
split_response "$RAW"
check_status "POST /profile" "200" "$RESPONSE_STATUS"

GATE=$(echo "$RESPONSE_BODY" | jq -r '.engine_output.gate_blocked // false')
echo "  gate_blocked: $GATE"
pass "Profile updated — ARP config generated"

# ─── 4. Set environment (POST /profile/environment) ──────────────────────────

section "4. Set environment (POST /profile/environment)"
ENV_BODY=$(cat <<'JSON'
{
  "bedroom_temperature": "cool",
  "evening_light_environment": "amber_managed",
  "tv_in_bedroom": false,
  "work_items_in_bedroom": false,
  "blackout_provision": true,
  "dws_device": false
}
JSON
)

RAW=$(post "/profile/environment" "$ENV_BODY")
split_response "$RAW"
check_status "POST /profile/environment" "200" "$RESPONSE_STATUS"
pass "Environment context saved"

# ─── 5. Check-in payload (GET /screen/checkin) ────────────────────────────────

section "5. Check-in payload — before any logs"
RAW=$(get "/screen/checkin")
split_response "$RAW"
check_status "GET /screen/checkin (cold)" "200" "$RESPONSE_STATUS"

Q_COUNT=$(echo "$RESPONSE_BODY" | jq '.questions | length')
Q_IDS=$(echo "$RESPONSE_BODY" | jq -r '[.questions[].id] | join(", ")')
echo "  questions ($Q_COUNT): $Q_IDS"
[ "$Q_COUNT" -le 3 ] && pass "≤ 3 questions returned" || fail "Too many questions: $Q_COUNT"

# ─── 6. Submit sleep log (POST /logs/sleep) ───────────────────────────────────

section "6. Submit sleep log (POST /logs/sleep)"
SLEEP_BODY=$(cat <<JSON
{
  "date": "$YESTERDAY",
  "wake_time": "06:30",
  "actual_sleep_onset": "23:00",
  "cycles_completed": 5,
  "onset_latency_minutes": 10,
  "arp_maintained": true,
  "subjective_energy_on_waking": 4
}
JSON
)

RAW=$(post "/logs/sleep" "$SLEEP_BODY")
split_response "$RAW"
check_status "POST /logs/sleep" "200" "$RESPONSE_STATUS"

SLEEP_LOG_ID=$(echo "$RESPONSE_BODY" | jq -r '.sleep_log_id')
CRP_IN_WINDOW=$(echo "$RESPONSE_BODY" | jq -r '.crp_in_window')
echo "  sleep_log_id: $SLEEP_LOG_ID"
echo "  crp_in_window: $CRP_IN_WINDOW"
[ "$SLEEP_LOG_ID" != "null" ] && pass "Sleep log written" || fail "sleep_log_id is null"

# ─── 7. Submit check-in (POST /logs/checkin) ──────────────────────────────────

section "7. Submit daily check-in (POST /logs/checkin)"
CHECKIN_BODY=$(cat <<JSON
{
  "date": "$TODAY",
  "mrm_count": 5,
  "morning_light_achieved": true,
  "crp_taken": false
}
JSON
)

RAW=$(post "/logs/checkin" "$CHECKIN_BODY")
split_response "$RAW"
check_status "POST /logs/checkin" "200" "$RESPONSE_STATUS"

DAILY_LOG_ID=$(echo "$RESPONSE_BODY" | jq -r '.daily_log_id')
echo "  daily_log_id: $DAILY_LOG_ID"
[ "$DAILY_LOG_ID" != "null" ] && pass "Check-in written" || fail "daily_log_id is null"

# ─── 8. Home screen (GET /screen/home) ────────────────────────────────────────

section "8. Home screen after logs"
RAW=$(get "/screen/home")
split_response "$RAW"
check_status "GET /screen/home" "200" "$RESPONSE_STATUS"

GATE=$(echo "$RESPONSE_BODY" | jq -r '.gate_blocked')
TONE=$(echo "$RESPONSE_BODY" | jq -r '.tone_override_active')
ARP=$(echo "$RESPONSE_BODY" | jq -r '.arp_time')
STATES=$(echo "$RESPONSE_BODY" | jq -r '[.active_states[].state_id] | join(", ")')
REC=$(echo "$RESPONSE_BODY" | jq -r '.primary_recommendation.rec_type // "(none)"')
WEEKLY=$(echo "$RESPONSE_BODY" | jq -c '.weekly_balance | {total,deficit,day_number}')

echo "  gate_blocked:      $GATE"
echo "  tone_override:     $TONE"
echo "  arp_time:          $ARP"
echo "  active_states:     ${STATES:-(none)}"
echo "  primary_rec:       $REC"
echo "  weekly_balance:    $WEEKLY"

[ "$GATE" = "false" ] && pass "gate_blocked = false" || echo "  ⚠ gate_blocked = $GATE (may be expected for new user)"
[ "$ARP" = "06:30" ] && pass "arp_time = 06:30" || fail "arp_time mismatch: $ARP"

# ─── 9. Day plan (GET /screen/day-plan) ──────────────────────────────────────

section "9. Day plan"
RAW=$(get "/screen/day-plan?date=$TODAY")
split_response "$RAW"
check_status "GET /screen/day-plan" "200" "$RESPONSE_STATUS"

TIMELINE=$(echo "$RESPONSE_BODY" | jq '.cycle_timeline | length')
NOTIFS=$(echo "$RESPONSE_BODY" | jq '.notification_schedule | length')
CRP_WIN=$(echo "$RESPONSE_BODY" | jq -c '.crp_window')
echo "  timeline entries:    $TIMELINE"
echo "  notifications:       $NOTIFS"
echo "  crp_window:          $CRP_WIN"
[ "$TIMELINE" -gt 0 ] && pass "Timeline has entries" || fail "Empty timeline"

# ─── 10. Check-in payload (post-log) ─────────────────────────────────────────

section "10. Check-in payload — after check-in submitted"
RAW=$(get "/screen/checkin")
split_response "$RAW"
check_status "GET /screen/checkin (post-log)" "200" "$RESPONSE_STATUS"

Q_COUNT_2=$(echo "$RESPONSE_BODY" | jq '.questions | length')
PREFILLED=$(echo "$RESPONSE_BODY" | jq -c '.prefilled')
echo "  questions remaining: $Q_COUNT_2"
echo "  prefilled:           $PREFILLED"
pass "Check-in payload (post-log) OK"

# ─── 11. Recommendation action ────────────────────────────────────────────────

section "11. Recommendation action"
REC_ID=$(curl -s "${AUTH[@]}" "${BASE}/screen/home" \
  | jq -r '.primary_recommendation.id // empty')

if [ -z "${REC_ID:-}" ] || [ "$REC_ID" = "null" ]; then
  echo "  (no recommendation to action — skipping)"
  pass "No rec to action (OK for fresh user)"
else
  echo "  actioning recommendation: $REC_ID"
  RAW=$(post "/actions/recommendation" "{\"recommendation_id\":\"$REC_ID\",\"action\":\"actioned\"}")
  split_response "$RAW"
  check_status "POST /actions/recommendation" "200" "$RESPONSE_STATUS"
  pass "Recommendation actioned"
fi

# ─── 12. Error handling ───────────────────────────────────────────────────────

section "12. Error handling"

# Bad JSON body
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${AUTH[@]}" -d "not-json" "${BASE}/logs/sleep")
check_status "bad JSON body" "400" "$STATUS"

# Future date validation
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${AUTH[@]}" -d '{"date":"2099-01-01","cycles_completed":5}' "${BASE}/logs/sleep")
check_status "future date → 422" "422" "$STATUS"

# Missing auth
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/screen/home")
check_status "no auth → 401" "401" "$STATUS"

# Unknown route
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${AUTH[@]}" "${BASE}/not-a-route")
check_status "unknown route → 404" "404" "$STATUS"

# ─── Summary ──────────────────────────────────────────────────────────────────

section "ALL TESTS PASSED"
echo
echo "  user_id:       $USER_ID"
echo "  sleep_log_id:  $SLEEP_LOG_ID"
echo "  daily_log_id:  $DAILY_LOG_ID"
echo
echo "  Supabase table checks:"
echo "    SELECT * FROM users WHERE id = '$USER_ID';"
echo "    SELECT * FROM arp_configs WHERE user_id = '$USER_ID';"
echo "    SELECT * FROM sleep_logs WHERE user_id = '$USER_ID' ORDER BY date DESC LIMIT 3;"
echo "    SELECT * FROM daily_logs WHERE user_id = '$USER_ID' ORDER BY date DESC LIMIT 3;"
echo "    SELECT * FROM user_states WHERE user_id = '$USER_ID';"
echo "    SELECT * FROM recommendations WHERE user_id = '$USER_ID' AND status = 'pending';"
echo "    SELECT * FROM weekly_cycle_balances WHERE user_id = '$USER_ID';"
echo
