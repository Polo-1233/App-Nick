# Audit Report — v1

**Date:** 2026-02-17
**Auditor:** Claude (dev agent)
**Scope:** Full repository — docs, core engine, tests, mobile app, reference materials

---

## Executive Summary

The foundation is structurally sound. The core engine correctly implements the fundamental R90 cycle calculation (backward from anchor, 90-min cycles, weekly target framing). The architecture is clean: pure TS core with zero dependencies, proper type contracts, and a scenario test suite that traces to documented rules.

However, the audit identified **3 method-level errors**, **4 code bugs**, **6 inconsistencies between docs and code**, and **several under-defined areas** that must be resolved before proceeding to feature development.

The most significant finding: **the pre-sleep model is incorrect**. The code implements a 120-minute wind-down (30-min pre-sleep + 90-min down-period) when Nick's book prescribes a single 90-minute pre-sleep routine. This affects all bedtime-related calculations and the entire day timeline.

---

## 1. Structural Weaknesses

### S1: Pre-Sleep / Down-Period Model Error [CRITICAL]

**Finding:** The codebase implements two distinct phases before bedtime:
- Pre-sleep routine: 30 minutes (PRE_SLEEP_BUFFER = 30)
- Down-period: 90 minutes (DOWN_PERIOD_DURATION = 90)
- Total: 120 minutes before bedtime

**Book says:** One 90-minute pre-sleep routine before bedtime. No separate "down-period" for normal nights.

**"Down-period"** as a distinct concept appears only in the Product Vision document for the **post-event protocol** (adrenaline clearance after a late night event). It was incorrectly generalized to every night.

**Impact:** Every `CycleWindow` has `preSleepStart` 120 min before bedtime instead of 90 min. The timeline shown to users is wrong. Conflict detection windows are off by 30 minutes.

**Fix:** Merge pre-sleep and down-period into a single 90-minute `preSleepStart` block. Reserve "down-period" terminology exclusively for the post-event protocol in `calculatePostEventWindow()`.

**Files affected:** `cycles.ts`, `planner.ts`, `conflicts.ts`, `actions.ts`, types (`CycleWindow`), scenarios, Logic Map doc

### S2: Midnight Wraparound Bugs [HIGH]

**Finding:** Several modules fail when time ranges cross midnight:

| Location | Bug |
|---|---|
| `conflicts.ts:101-108` | `overlaps()` uses `aStart < bEnd && aEnd > bStart` — fails when sleep window wraps (bedtime 1380, wake 390) |
| `actions.ts:19` | `wakeTime + 120` — raw arithmetic, no modulo wraparound |
| `actions.ts:29` | `preSleepStart - 120` — raw subtraction, can go negative |
| `TimelineView.tsx:44` | `Math.abs(block.end - block.start)` — shows 1350 min instead of 90 min for midnight-spanning blocks |
| `planner.ts:119` | `blocks.sort((a, b) => a.start - b.start)` — incorrect order for day view (wake at 390 sorts before sleep at 1380, but sleep comes first chronologically in a day view) |

**Impact:** For the default anchor (06:30) these bugs are mostly masked because pre-sleep (21:00) and bedtime (23:00) are both before midnight. They will break for PMer profiles (anchor 08:00, bedtime 00:30) and for any event-driven recalculation that crosses midnight.

**Fix:** All time range operations must use `isTimeBetween()` or a normalized comparison. The planner should order blocks relative to anchor time (day starts at anchor, not at midnight).

### S3: CRP Not Integrated into Day Plan [MEDIUM]

**Finding:** The `buildBlocks()` function in `planner.ts` never generates CRP blocks, despite `"prc"` being a valid `BlockType` in types.ts. CRP is mentioned in `actions.ts` (as a recommendation) and `rlo.ts` (as a message) but never appears in the actual timeline.

**Impact:** The timeline view will never show a CRP window. Users see "PRC recommended" in an action card but no block in the timeline indicating when to do it.

**Fix:** `planner.ts` should generate CRP blocks based on readiness zone and available windows (13:00-15:00, or 17:00-19:00 if midday blocked by calendar events).

### S4: Empty Documentation Directories [LOW]

**Finding:** `docs/20_product/`, `docs/30_design/`, `docs/40_legal/` were empty (20_product now has MVP_SCOPE_v1.md). 30_design and 40_legal still empty.

**Impact:** No immediate technical impact, but the R-Lo persona definition and copy guidelines (critical for tone validation) have no document.

**Fix:** Create `docs/30_design/RLO_PERSONA.md` (extract from Product Vision doc) before R-Lo message development continues.

---

## 2. Method Risks

### M1: "Confirmed" Rules That Are Actually Assumptions

**Finding:** Several rules marked CONFIRMED in the Logic Map and rules.ts have no direct book citation. They were inferred from the Product Vision document (which is MetaLab's interpretation, not Nick's direct validation).

| Rule | Claim | Actual Source |
|---|---|---|
| R050-R052 | Readiness zone thresholds | Invented for MVP — no book or Nick source |
| R013 | Adrenaline clearance = 90 min | Product Vision only — not in book |
| R041 | Below 28 by Thursday → flag | Invented — book says 28 is minimum for the week, not by day |

**Risk:** Shipping "confirmed" rules that Nick hasn't validated could misrepresent the method.

**Fix:** Downgrade R013, R041 to TODO_NICK. Zone rules (R050-R052) are already TODO_NICK.

### M2: PRC/CRP Terminology Inconsistency

**Finding:** The codebase uses "PRC" (Post-sleep Recovery Controlled period) while Nick's book uses "PRC" as the French abbreviation for "Période de Récupération Contrôlée." The English translation is "Controlled Recovery Period" (CRP). The charter originally defined both PRC and CRP as separate terms.

**Impact:** Confusion when discussing with Nick (who uses English). Code comments reference "PRC" but the canonical English term from the Product Vision is also PRC.

**Fix:** Standardize on **CRP** in all English-language code and documentation. Already corrected in Charter v0.2 and Canonical Method v2.

### M3: Scenario-to-Document Misalignment

**Finding:**
- Logic Map S01 says "pre-sleep 21:30, down-period 21:30" — identical times, which is impossible. Correct values with 90-min pre-sleep: pre-sleep 21:30, bedtime 23:00.
- Logic Map S05 says "Orange zone" for avg 3 cycles/night, but code correctly returns "yellow" (threshold is `>= 3` for yellow).
- Logic Map S14 says "Consecutive short nights (3+3)" but code scenario S14 tests (2+2+2).
- Scenarios S06 and S07 pass but have no assertions — they test nothing.

**Fix:** Rewrite the Logic Map scenarios table to match the canonical method v2 and the actual test scenarios. Add assertions to S06/S07.

---

## 3. Over-Engineering Risks

### O1: Rule Interface with `evaluate` Function [LOW]

**Finding:** `types.ts` defines a `Rule` interface with `evaluate: (context: RuleContext) => RuleResult | null`. This suggests a pluggable rules engine pattern. But no code uses this interface. Rules are hardcoded in module functions. The `rules.ts` file uses a simpler `RuleEntry` type instead.

**Risk:** The `Rule` interface implies a future architecture that may never be needed. If someone tries to implement it, they'll create an unnecessary abstraction layer.

**Fix:** Remove the `Rule` interface from types.ts. Keep `RuleEntry` in rules.ts. The deterministic module-function approach is correct for the MVP.

### O2: `ConflictOption` / `generateConflictOptions` [LOW]

**Finding:** `generateConflictOptions()` is implemented but never called. The planner detects conflicts but doesn't generate resolution options.

**Risk:** Dead code that suggests a feature exists when it doesn't.

**Fix:** Keep the function (it will be needed) but don't count it as "implemented" in MVP scope.

---

## 4. Under-Definition Risks

### U1: R-Lo Persona Not Documented

**Finding:** R-Lo's character is described extensively in the Product Vision PDF but has no canonical document in the repository. The code in `rlo.ts` generates messages but there is no copy guide, tone rubric, or message catalog for review.

**Risk:** R-Lo messages may drift from Nick's intended tone as more are added. No review process.

**Fix:** Extract R-Lo persona definition from Product Vision into `docs/30_design/RLO_PERSONA.md`.

### U2: No Persistence Model Defined

**Finding:** `NightRecord` type exists but there is no storage module, no data migration plan, no schema version. The mobile app uses hardcoded mock data.

**Risk:** When persistence is added, it could be implemented inconsistently. Weekly history calculations depend on data shape.

**Fix:** Create `packages/core/src/storage.ts` with a `StorageAdapter` interface before implementing real persistence. Acceptable to defer to next sprint.

### U3: Post-Event Protocol Not Fully Specified

**Finding:** `calculatePostEventWindow()` exists in cycles.ts but is never called from the planner flow. There's no UI for triggering it, and the Product Vision describes event-type selection (physical vs. mental) that doesn't exist in the type system.

**Risk:** A core Product Vision feature (the "Down-Period Protocol") is partially implemented but not wired up.

**Fix:** After Nick confirms post-event rules, wire `calculatePostEventWindow()` into the planner when `lateEventEndTime` is provided.

---

## 5. Technical Debt

| ID | Item | Severity | Files |
|---|---|---|---|
| TD1 | `formatTime` / `formatMinutes` duplicated in 4 files | Low | time-utils.ts, rlo.ts, actions.ts, mock-data.ts |
| TD2 | `Rule` interface (with `evaluate`) is dead code | Low | types.ts |
| TD3 | `DayPlan` unused import `ReadinessState` in planner.ts | Trivial | planner.ts |
| TD4 | `isTimeBetween` import in conflicts.ts but not used | Trivial | conflicts.ts |
| TD5 | `determineMoment()` in rlo.ts has dead `wakeTime` variable | Low | rlo.ts |
| TD6 | `RuleContext` not used in rules.ts (only in types.ts) | Trivial | — |
| TD7 | Scenario anchorTime hardcoded in `nightRecord()` helper | Low | scenarios.ts |

---

## 6. Recommended Corrections Before Proceeding

### Priority 1: Must Fix Before Next Feature
1. **Fix pre-sleep model** — Merge into single 90-min block, remove nightly down-period
2. **Fix midnight wraparound** in `conflicts.ts`, `actions.ts`, `TimelineView.tsx`
3. **Fix Logic Map scenarios** — Align S01, S05, S14 with canonical method and code
4. **Add assertions to S06/S07** — Currently pass vacuously
5. **Fix PRC window** in actions.ts — Change from 660-900 (11:00-15:00) to 780-900 (13:00-15:00)

### Priority 2: Should Fix This Sprint
6. **Consolidate `formatTime`** — Single implementation in time-utils.ts, import everywhere
7. **Remove dead `Rule` interface** from types.ts
8. **Add CRP blocks** to planner output
9. **Create R-Lo Persona doc** in docs/30_design/
10. **Make `determineMoment()` anchor-relative** — Use profile.anchorTime instead of hardcoded ranges

### Priority 3: Can Defer
11. Clean up trivial dead imports
12. Create storage adapter interface
13. Add onboarding flow to mobile app
14. Implement post-event protocol UI

---

## 7. Files Requiring Changes (Summary)

| File | Changes Needed |
|---|---|
| `packages/core/src/cycles.ts` | Remove DOWN_PERIOD_DURATION from normal flow; keep for post-event only; adjust PRE_SLEEP_BUFFER to 90 |
| `packages/types/src/index.ts` | Remove `Rule` interface; update `CycleWindow` (remove `downPeriodStart` for normal nights) |
| `packages/core/src/conflicts.ts` | Fix midnight wraparound in `overlaps()` |
| `packages/core/src/actions.ts` | Fix wraparound arithmetic; fix PRC window; use consolidated formatTime |
| `packages/core/src/rlo.ts` | Make determineMoment() anchor-relative; remove dead variable; use consolidated formatTime |
| `packages/core/src/planner.ts` | Add CRP blocks; fix block sort order; integrate post-event path |
| `packages/core/src/rules.ts` | Update R010/R011; rename PRC→CRP references |
| `packages/tests/src/scenarios.ts` | Fix S01 expectations; add S06/S07 assertions; realign S14 |
| `apps/mobile/components/TimelineView.tsx` | Fix duration calc for midnight-spanning blocks |
| `docs/10_method/R90_LOGIC_MAP_v0.1.md` | Fix S01, S05 descriptions; align with canonical method v2 |

---

*This audit must be resolved before any new feature development begins.*
