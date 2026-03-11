# Testing Protocol — Phase E Internal Testing

**Version:** 1.0
**Date:** 2026-02-17
**Phase:** E (Internal Testing)
**Status:** Active

---

## Purpose

This protocol defines the steps for validating the R90 Digital Navigator end-to-end before private beta. Every tester executes this protocol and records results in the feedback table at the end.

---

## Prerequisites

```bash
# Clone and install
git clone <repo>
npm install

# Run automated tests first — must all pass before manual testing
npm test
# Expected: 17 passed, 0 failed

# Start dev server
npm run dev:mobile
```

Device requirements:
- Physical iOS or Android device OR iOS Simulator (14+)
- Expo Go installed, OR native build via `npx expo run:ios --device`
- Calendar app with at least 2 test events added (see test event setup below)

---

## Test Event Setup (Calendar)

Before starting, add these events to the device calendar:

| Event | Time | Purpose |
|---|---|---|
| Evening Meeting | 21:30 – 23:00 tonight | Tests pre-sleep conflict detection |
| Morning Event | 07:30 – 08:30 tomorrow | Tests post-anchor event (no conflict) |

---

## E3: Full-Day Test #1 — Default Profile (Anchor 06:30)

**Tester:** _______________
**Date:** _______________
**Device:** _______________

### Step 1 — First Launch (Onboarding)

1. Install fresh app (clear app data if re-testing)
2. App should open directly to onboarding screen
3. Set anchor time to **06:30** using the time picker
4. Select chronotype **Flexible (Neither)**
5. Tap "Start Your R90 Journey"

**Expected:**
- [ ] Onboarding screen loads without crash
- [ ] Time picker responds to input
- [ ] Chronotype selection highlights in green when selected
- [ ] Tapping confirm navigates to home screen
- [ ] Home screen shows R-Lo message and timeline

**Actual result:** _______________

---

### Step 2 — Home Screen (Morning, ~07:00)

1. Open app at or shortly after anchor time (06:30)
2. Observe all UI components

**Expected:**
- [ ] R-Lo message shows morning context ("X cycles last night" or generic first-day message)
- [ ] Readiness zone shows green (no history = green zone)
- [ ] Timeline shows: Wake (06:30), Pre-Sleep, Sleep Cycles
- [ ] Next Action card shows a morning action
- [ ] NO CRP card visible (green zone)
- [ ] "📝 Log Last Night" button visible
- [ ] "🌙 Late Event?" button visible

**Actual result:** _______________

---

### Step 3 — Log Last Night

1. Tap "📝 Log Last Night"
2. Log 3 cycles (below target to move toward yellow zone)
3. Confirm

**Expected:**
- [ ] Log night screen opens with yesterday's date pre-filled
- [ ] Cycle count selector allows 2–6 cycles
- [ ] Tapping confirm saves and returns to home
- [ ] Home screen reloads without crash

**Actual result:** _______________

---

### Step 4 — CRP Card (Midday, ~13:00)

Log 3 more short nights to trigger yellow zone, then open app at midday.

**Expected:**
- [ ] If zone is yellow/orange: CRP card visible with correct duration (30 min yellow, 90 min orange)
- [ ] CRP card shows time hint: "Best time: 13:00–15:00 or 17:00–19:00"
- [ ] Tapping "Mark Completed" saves record and shows checkmark
- [ ] If zone is green: no CRP card

**Actual result:** _______________

---

### Step 5 — Conflict Detection (Evening, ~20:00)

With "Evening Meeting 21:30–23:00" in calendar and calendar permission granted:

**Expected:**
- [ ] App requests calendar permission on first load (if not already granted)
- [ ] ConflictSheet appears automatically showing the evening meeting conflict
- [ ] Conflict card shows event name "Evening Meeting"
- [ ] Conflict type shows "🌙 Pre-Sleep Overlap"
- [ ] Conflict description explains the overlap
- [ ] "Got It" and "Dismiss" buttons work
- [ ] Permission denied → app loads normally with no conflict sheet

**Actual result:** _______________

---

### Step 6 — Post-Event Protocol (Evening)

1. Tap "🌙 Late Event?"
2. Set event end time to **23:00**

**Expected:**
- [ ] PostEventSheet opens
- [ ] New sleep window displays with bedtime after 23:00 + 90 min = 00:30+
- [ ] Cycle count shown is ≤ ideal (fewer cycles due to late start)
- [ ] Setting event end time very late (e.g., 03:00) shows "No window available" message
- [ ] Confirm button updates display; Close button dismisses

**Actual result:** _______________

---

### Step 7 — Next Morning Reload

1. Open app the morning after (~06:30)

**Expected:**
- [ ] App loads with updated plan for today
- [ ] Timeline reflects today's anchor time
- [ ] No crash on reload
- [ ] R-Lo message is contextually appropriate for morning

**Actual result:** _______________

---

## E4: Full-Day Test #2 — PMer Profile (Anchor 08:00)

**Tester:** _______________
**Date:** _______________
**Device:** _______________

This test verifies midnight-crossing behavior for PMer profiles.

### Setup

1. Clear app data (or re-install)
2. Set anchor time to **08:00**, chronotype **Evening (PMer)**
3. Note expected bedtime: 08:00 − (5 × 90 min) = 00:30 next day (crosses midnight)

### Step 1 — Home Screen

**Expected:**
- [ ] Timeline shows sleep blocks crossing midnight (00:30 – 08:00)
- [ ] Pre-sleep at 23:00 (00:30 − 90 min)
- [ ] Duration for sleep blocks shows 450 min (5 cycles × 90 min)
- [ ] No negative durations or NaN values displayed

**Actual result:** _______________

### Step 2 — Evening R-Lo Message (~19:00)

**Expected:**
- [ ] R-Lo shows evening message referencing 23:00 pre-sleep and 00:30 first cycle
- [ ] Times formatted correctly (not "24:30" — should be "00:30")
- [ ] No crash

**Actual result:** _______________

### Step 3 — Post-Event with Midnight Crossing

1. Tap "🌙 Late Event?" with event end at 22:30
2. Expected new first cycle: 22:30 + 90 min = 00:00

**Expected:**
- [ ] Bedtime displays as "12:00 AM" (midnight) not "24:00"
- [ ] Cycle count ≥ 2 (window is still viable)
- [ ] No crash on midnight-crossing calculation

**Actual result:** _______________

---

## E3/E4 Results Summary

| Test | Pass | Fail | Note |
|---|---|---|---|
| E3-1 Onboarding | | | |
| E3-2 Home screen morning | | | |
| E3-3 Log last night | | | |
| E3-4 CRP card | | | |
| E3-5 Conflict detection | | | |
| E3-6 Post-event protocol | | | |
| E3-7 Next morning reload | | | |
| E4-1 PMer home screen | | | |
| E4-2 PMer evening message | | | |
| E4-3 PMer midnight crossing | | | |

---

## E6: R-Lo Message Audit

**Auditor:** Internal (automated pass)
**Date:** 2026-02-17
**Method:** Manual review of `packages/core/src/rlo.ts` and `packages/core/src/actions.ts` against `docs/30_design/RLO_PERSONA.md`

### Forbidden Word Check

| Word | rlo.ts | actions.ts | Result |
|---|---|---|---|
| score | ✅ absent | ✅ absent | PASS |
| grade / rating / rank | ✅ absent | ✅ absent | PASS |
| poor / bad / terrible | ✅ absent | ✅ absent | PASS |
| failure / failed | ✅ absent | ✅ absent | PASS |
| must / should / need to | ✅ absent | ✅ absent | PASS |
| warning / alert | ✅ absent | ✅ absent | PASS |
| debt / deficit | ✅ absent | ✅ absent | PASS |
| optimize / maximize | ✅ absent | ✅ absent | PASS |
| HRV / REM / deep sleep | ✅ absent | ✅ absent | PASS |
| percentages / scores | ✅ absent | ✅ absent | PASS |

### Tone Compliance Check

| Criterion | Status | Notes |
|---|---|---|
| Uses cycles as unit | ✅ PASS | "X cycles last night", "X/Y cycles this week" |
| One action per message | ✅ PASS | Each message has exactly one CTA |
| No demands ("must", "need to") | ✅ PASS | Uses "can", "try", "want" |
| Anti-anxiety framing | ✅ PASS | "Totally manageable", "Let's make tonight count" |
| Anchor-relative moment detection | ✅ PASS | `determineMoment()` uses anchor-relative math |
| Direct, second-person | ✅ PASS | "You're at X/Y", "Your evening is clear" |
| Preferred vocab used | ✅ PASS | CRP, pre-sleep routine, anchor time, reserves |

### Minor Observations (Not Blocking)

1. **`actions.ts`** — "Start your pre-sleep routine in X minutes." uses "Start" (imperative). Acceptable — it's an action prompt at the right time, not a demand. Not a forbidden word.
2. **`rlo.ts` orange morning** — "Your body's asking for rest." — good, avoids "sleep debt", frames physiologically without judgment.
3. **`rlo.ts` general message** — "On track." — concise, calm, compliant.

**Audit verdict: PASS — all messages comply with RLO_PERSONA.md.**

---

## Automated Scenario Verification (E2)

Run before every manual test session:

```bash
npm test
```

Expected output (as of 2026-02-17):
```
Results: 17 passed, 0 failed, 17 total
All scenarios passed!
```

Scenarios covered:
- S01–S05: Core nightly scenarios (green/yellow/orange zones)
- S06–S07: Post-event protocol (22:00 and midnight)
- S08–S09: Chronotype profiles (AMer 05:00, PMer 08:00)
- S10: Early meeting overlapping final sleep cycle
- S11: CRP window blocked → evening fallback
- S12: Weekend recovery scenario
- S13–S14: Consecutive short nights (stress test)
- S15: PMer midnight-crossing bedtime
- S16–S17: CRP scheduling (midday + evening fallback)

---

## E5: Bug Log

Record bugs found during E3/E4 testing here:

| ID | Severity | Screen | Description | Fixed? |
|---|---|---|---|---|
| — | — | — | No bugs at time of writing | — |

---

## Sign-Off

Before Phase F deployment, the following must be confirmed:

- [ ] E2 — All 17 automated scenarios pass
- [ ] E3 — Full-day test with default profile completed (or in progress)
- [ ] E4 — Full-day test with PMer profile completed
- [ ] E5 — All bugs from testing fixed
- [ ] E6 — R-Lo message audit passed (see above — PASS)
- [ ] E7 — Docs updated to reflect Phase B–D completion
- [ ] E8 — README reflects current state

**Sign-off:** _______________
**Date:** _______________
