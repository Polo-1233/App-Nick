# Open Assumptions

**Version:** 1.0
**Date:** 2026-02-17
**Purpose:** Explicit list of every assumption in the codebase that requires Nick validation before shipping.

**Phase A Updates (2026-02-17):**
- Logic Map scenarios S01/S05/S14 corrected to align with R90_CANONICAL_METHOD_v2.md
- Rules R013 (adrenaline clearance timing) and R041 (weekly threshold by-day rule) downgraded from CONFIRMED to TODO_NICK pending validation
- Phase B will implement code fixes for assumptions A01/A02 after Nick confirms pre-sleep model

**Phase B–E Updates (2026-02-17):**
- A01, A02 RESOLVED in code (Phase B)
- A06, A09, A12 RESOLVED in code (Phase B)
- Remaining open assumptions A03–A05, A07–A08, A10–A11 still require Nick validation before Phase 2

---

## Critical Assumptions (Block Shipping)

### A01: Pre-Sleep Duration = 90 minutes ✅ RESOLVED
**Assumed:** Pre-sleep routine is 90 minutes (matching book).
~~Current code: Implements 30-min pre-sleep + 90-min down-period = 120 minutes.~~
**Resolution (Phase B):** `PRE_SLEEP_DURATION = 90` in cycles.ts. Single pre-sleep block from `preSleepStart` to `bedtime`. Code now matches book.
**Traces to:** R010, R011

### A02: Down-Period Protocol is Post-Event Only ✅ RESOLVED
**Assumed:** The 90-minute adrenaline clearance "down-period" applies ONLY after late events (matches, dinners, social events). It is NOT a nightly routine.
~~Current code: Implements down-period as a nightly block for ALL nights.~~
**Resolution (Phase B):** `CycleWindow.downPeriodStart` is optional, only populated by `calculatePostEventWindow()`. Normal `buildBlocks()` does not include a down-period block. Code now matches assumption.
**Traces to:** R013, R014

### A03: CRP Cycle Accounting
**Assumed:** Both 30-min and 90-min CRP count as 1 cycle toward the weekly total.
**Book says:** "celui accompli ici — peu importe qu'il dure trente ou quatre-vingt-dix minutes — compte dans le total de ladite semaine"
**Risk:** If 30-min CRP = 1 full cycle, it's easy to game the system. If 0.5, the book seems to disagree.
**Action needed:** Ask Nick for exact accounting rule for the app.
**Traces to:** R023

### A04: Readiness Zone Thresholds
**Assumed:** Green ≥ 4.5 avg, Yellow ≥ 3.0 avg, Orange < 3.0 avg (last 3 nights).
**Source:** Invented for MVP. No basis in book or product vision.
**Risk:** Thresholds may not match Nick's intent. May cause incorrect zone assignments.
**Action needed:** Nick must define zone criteria.
**Traces to:** R050, R051, R052

### A05: Absolute Minimum Cycles = 2
**Assumed:** The engine will never recommend fewer than 2 cycles.
**Book says:** Jess example shows a Saturday with 2 cycles, but it's presented as extreme.
**Risk:** Recommending 2 cycles as viable may conflict with Nick's guidance.
**Action needed:** Confirm floor.
**Traces to:** R005

## Medium Assumptions (Affect Accuracy)

### A06: Morning/Midday/Evening Boundaries ✅ RESOLVED
~~Assumed in rlo.ts: Morning = 05:00–12:00, Midday = 12:00–17:00, Evening = 17:00–midnight.~~
**Resolution (Phase B):** `determineMoment()` in rlo.ts now uses `minutesSinceAnchor = (now - anchorTime + 1440) % 1440`. Morning = 0–6h after anchor, Midday = 6–11h, Evening = 11–16h. Fully anchor-relative.
**Traces to:** R060, R061, R062

### A07: Readiness Uses Last 3 Nights Only
**Assumed:** Zone is based on the 3 most recent nights.
**Book says:** Weekly view is more important. Also emphasizes consecutive-night patterns.
**Risk:** 3-night window may miss important weekly context. Doesn't flag "3 consecutive short nights" rule (R043).
**Traces to:** R050-R052, R043

### A08: No Wearable Signal Input Yet
**Assumed:** Readiness computation ignores wearable data entirely.
**Logic Map says:** Rules R050-R052 mention "wearable red flags" as part of zone criteria.
**Risk:** Acceptable for MVP (wearables are Phase 2), but must not ship zone rules as "CONFIRMED" — they're incomplete without wearable input.
**Traces to:** R050, R051, R052

### A09: CRP Window ✅ RESOLVED
~~Assumed in actions.ts: `isTimeBetween(now, 660, 900)` — CRP window is 11:00–15:00.~~
**Resolution (Phase B):** Fixed to `isTimeBetween(now, 780, 900)` = 13:00–15:00 (book-confirmed). Variable renamed from PRC to CRP throughout.
**Traces to:** R020

### A10: Chronotype Has No Effect on Cycle Count
**Assumed:** All chronotypes default to 5 cycles.
**Book says:** "Commencez par cinq cycles, et voyez comment vous vous sentez." Implies 5 is starting point for everyone, with personal adjustment to 4 or 6.
**Risk:** Probably correct assumption, but should be validated.
**Traces to:** R002

## Low-Risk Assumptions (Cosmetic / Deferrable)

### A11: "No data = green zone"
**Assumed in readiness.ts:** When weekHistory is empty, zone defaults to "green."
**Rationale:** New user shouldn't see a warning on first launch.
**Risk:** Minor. Could also default to "yellow" (neutral).

### A12: Block Sort Order ✅ RESOLVED
~~Assumed in planner.ts: Blocks sort by `start` value (ascending).~~
**Resolution (Phase B):** `buildBlocks()` in planner.ts sorts blocks relative to `cycleWindow.wakeTime` (anchor). `(block.start - anchorTime + 1440) % 1440` — blocks after anchor sort first, then pre-anchor blocks (sleep window) sort last. PMer (anchor 08:00, sleep 23:00–08:00) renders correctly.
