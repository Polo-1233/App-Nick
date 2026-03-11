# TODO_NICK — Validation Items for Nick Littlehales

**Purpose:** Items that must be confirmed by Nick before the app can give authoritative guidance.
**Format:** Each item has a Question ID, the current assumption, the risk if wrong, and where in the code it lives.

These are tracked in `packages/core/src/rules.ts` as `status: "TODO_NICK"`.

---

## Q01 — Default cycles per night

**Rule:** R002
**Current assumption:** Default = 5 cycles per night (7h30 sleep)
**In code:** `UserProfile.idealCyclesPerNight = 5` (onboarding default), `DEFAULT_PROFILE` in test scenarios
**Question:** Is 5 always the correct default? Does it vary by chronotype (AMer vs PMer) or age?
**Risk if wrong:** Users presented with wrong bedtime from day one. High impact.

---

## Q02 — Minimum cycles per window

**Rule:** R005
**Current assumption:** Never recommend fewer than 2 cycles (3 hours) in a single sleep window
**In code:** `minimumCycles = 2` in `recalculateFromMissedBedtime()` and `calculatePostEventWindow()` — `cycles.ts:47,67`
**Question:** Is 2 the correct absolute floor? Should it ever be 1 cycle (90 min)?
**Risk if wrong:** Users directed to bed for dangerously short windows, or conversely denied a useful 90-min nap.

---

## Q03 — Down-period duration

**Rule:** R010
**Current assumption:** Pre-sleep down-period = 90 minutes before bedtime (confirmed from book ch. 4)
**In code:** `PRE_SLEEP_DURATION = 90` — `cycles.ts:12`
**Status:** Marked CONFIRMED in rules.ts, but the split between "down-period" and "pre-sleep routine" (R011) needs clarification.
**Question:** Is 90 min always the pre-sleep down-period? Is the 30-min "pre-sleep routine" inside or outside the 90-min window?

---

## Q04 — Adrenaline clearance after events

**Rule:** R013
**Current assumption:** After a late event, user needs 90 minutes before sleep can begin (adrenaline clearance)
**In code:** `DOWN_PERIOD_DURATION = 90` used in `calculatePostEventWindow()` — `cycles.ts:13,69`
**Source:** Product Vision document only — not found verbatim in the R90 book
**Question:** Does the 90-min clearance apply universally (Physical / Mental / Social)? Should Physical events require more?
**Risk if wrong:** Post-event protocol gives incorrect bedtime. Users either sleep too early (cortisol still elevated) or unnecessarily delay sleep.

---

## Q05 — Readiness zone thresholds

**Rules:** R050, R051, R052
**Current assumption:**
- Green = last 3 nights avg cycles ≥ 4.5
- Yellow = last 3 nights avg cycles ≥ 3.0 (and < 4.5)
- Orange = last 3 nights avg cycles < 3.0

**In code:** `determineZone()` — `readiness.ts:36-44`
**Question:** Are these thresholds correct? Should the window be 3 nights or 7 nights? Should the green threshold be 4 (not 4.5)?
**Risk if wrong:** Wrong zone shown → wrong guidance (CRP recommendation appears/disappears at wrong times).

---

## Q06 — Weekly cycle target

**Rule:** R042 (and related)
**Current assumption:** Weekly target = 35 cycles (5 per night × 7 nights)
**In code:** `UserProfile.weeklyTarget = 35` (onboarding default)
**Question:** The book says 28–30 is "acceptable for most." Should the default target be 35 (ideal) or 28 (acceptable)? Should the app show both thresholds?
**Risk if wrong:** Users with realistic 28–30 cycle weeks shown as perpetually in yellow zone.

---

## Q07 — CRP counts toward weekly total

**Rule:** A03 (unimplemented assumption)
**Current assumption:** CRP (30-min or 90-min recovery) does NOT add to the weekly cycle count
**In code:** `saveCRPRecord()` stores CRP records separately; `computeReadiness()` only counts `NightRecord.cyclesCompleted`
**Question:** Should a 90-min CRP count as 1 cycle toward the weekly total? Should a 30-min CRP count as 0.5?
**Risk if wrong:** If CRP should count and doesn't, users in yellow/orange zones are never able to reach green through CRP recovery. This is a core mechanic decision.

---

## Q08 — Chronotype effect on bedtime

**Current assumption:** Chronotype (AMer/Neither/PMer) is stored in the profile but does NOT shift the bedtime calculation. It is metadata only.
**In code:** `calculateCycleWindow()` uses only `profile.anchorTime` and `profile.idealCyclesPerNight` — chronotype ignored in scheduling
**Question:** Should AMer users get an earlier bedtime push? Should PMer users get a later-shifted window?
**Risk if wrong:** The chronotype question in onboarding is misleading if it has no mechanical effect.

---

## Q09 — Anchor time: absolute or preferred

**Rule:** R031
**Current assumption:** Anchor time is NEVER moved, even for late events or missed bedtimes. It is the one constant.
**In code:** `wakeTime` in all `CycleWindow` calculations always equals `profile.anchorTime`
**Question:** Is this confirmed as absolute? Or should the app offer to temporarily shift anchor on weekends?
**Risk if wrong:** Weekend users who sleep in on Sunday are shown as "off anchor" when they meant to take a rest day.

---

## Validation Priority

| Priority | ID | Risk Level |
|----------|----|-----------|
| P0 (block production) | Q05 | High — wrong zones shown to all users |
| P0 (block production) | Q07 | High — CRP recovery mechanic unclear |
| P1 (fix before V1.5) | Q01 | High — wrong default bedtime |
| P1 (fix before V1.5) | Q06 | Medium — wrong target perception |
| P2 (V1.5 scope) | Q04 | Medium — post-event protocol accuracy |
| P2 (V1.5 scope) | Q02 | Low — edge case |
| P3 (V2 scope) | Q08 | Low — chronotype currently decorative |
| P3 (V2 scope) | Q03 | Low — confirmed, just needs clarification |
| P3 (V2 scope) | Q09 | Low — anchor is stated as absolute |
