# MVP Risk Register

**Version:** 1.0
**Date:** 2026-02-17
**Scope:** All risks from today to MVP private beta deployment

---

## Risk Matrix

| Probability | Impact: Low | Impact: Medium | Impact: High |
|---|---|---|---|
| **High** | — | RK04, RK07 | RK01 |
| **Medium** | RK08 | RK03, RK06 | RK02, RK05 |
| **Low** | RK09 | RK10 | — |

---

## Risk Details

### RK01: Pre-Sleep Model Fix Cascade [HIGH × HIGH]

**Description:** Changing from 30+90 to 90-minute pre-sleep model touches `cycles.ts`, `planner.ts`, `conflicts.ts`, `actions.ts`, `types/index.ts`, and all 14 scenarios. A mistake in the cascade can introduce regressions that are hard to trace.

**Probability:** High — this is a structural change across 6+ files with tight coupling.

**Impact:** High — incorrect sleep timing recommendations (the core product promise).

**Mitigation:**
1. Change types first (B1.1), then engine (B1.2), then consumers (B1.3–B1.5), then scenarios (B1.6) — strict order
2. Run full test suite after EACH file change, not just at the end
3. Manually verify 3 profiles (default 06:30, AMer 05:00, PMer 08:00) after completion
4. Keep a git branch so the entire change can be reverted cleanly

**Owner:** Dev lead
**Status:** Open

---

### RK02: Midnight Wraparound Incompleteness [MEDIUM × HIGH]

**Description:** Even after fixing the known wraparound bugs, there may be edge cases in time arithmetic we haven't anticipated. The `MinuteOfDay` representation makes midnight-crossing inherently error-prone.

**Probability:** Medium — we know the specific bugs, but new code paths (CRP scheduling, post-event) may introduce new ones.

**Impact:** High — wrong bedtime calculations for PMer users (anchor 08:00, bedtime 00:30). Silent failures that produce incorrect but plausible-looking output.

**Mitigation:**
1. Use `isTimeBetween()`, `addMinutes()`, `subtractMinutes()` for ALL time operations — never raw arithmetic
2. Add PMer-specific scenario (S15) that crosses midnight in every time window
3. Add a unit test: for every time function, test with inputs that cross midnight
4. Consider: add an assertion in time-utils that flags values > 1440 or < 0

**Owner:** Dev lead
**Status:** Open

---

### RK03: Nick Validation Delays [MEDIUM × MEDIUM]

**Description:** 12 TODO_NICK items require Nick's input. The MVP roadmap (from PDF) schedules 4 collaboration calls, but Nick's availability is unpredictable. If validation is delayed, we ship with unconfirmed rules or we delay launch.

**Probability:** Medium — Nick is a busy public figure with an international schedule.

**Impact:** Medium — we can ship with TODO_NICK rules hidden/defaulted, but the product won't feel complete. Readiness zones (R050–R052) are entirely TODO_NICK.

**Mitigation:**
1. Prioritize: get pre-sleep confirmation (Q01) and CRP accounting (Q03) in the FIRST call
2. Prepare a concise validation document (10 min read) for Nick before each call
3. Design the app so TODO_NICK features degrade gracefully (e.g., if zone thresholds unconfirmed, default to yellow + "calibrating")
4. Batch lower-priority questions for later calls

**Owner:** Product lead
**Status:** Open

---

### RK04: Calendar API Complexity [HIGH × MEDIUM]

**Description:** Reading device calendars via Expo Calendar API introduces complexity: permission handling, recurring events, multi-day events, timezone conversion, different calendar providers (Google, Apple, Exchange).

**Probability:** High — calendar APIs are notoriously inconsistent. Recurring event expansion is a known pain point.

**Impact:** Medium — calendar is a "nice to have" for MVP. App works without it (user just doesn't see conflicts).

**Mitigation:**
1. Build calendar as an optional layer — app works 100% without calendar permission
2. Start with simple events only (single-day, non-recurring). Add recurring event support if time permits.
3. Test early (Phase D) on a real device with a populated calendar
4. Hard-code a "known-good" calendar event format for testing if API proves unreliable

**Owner:** Dev lead
**Status:** Open

---

### RK05: CRP Cycle Accounting Ambiguity [MEDIUM × HIGH]

**Description:** The book says CRP "counts toward the weekly total" but doesn't specify whether 30 min = 1 cycle or 0.5. Our weekly counter (X/35) depends on this. A wrong assumption makes the weekly tracking inaccurate.

**Probability:** Medium — this IS on the Nick validation list (Q03), but we need to ship something before confirmation.

**Impact:** High — the weekly cycle count is shown to users on every screen. If we count 30-min CRP as 1 full cycle, users can "game" their weekly total. If we count as 0, the book contradicts us.

**Mitigation:**
1. Default: 30-min CRP = 1 cycle (matches book quote literally)
2. Mark clearly as TODO_NICK in code and UI
3. Make the CRP accounting value a configurable constant (`CRP_CYCLE_VALUE = 1`) so it can be changed in one place
4. Prioritize this question in Nick call #1

**Owner:** Dev lead + Product lead
**Status:** Open

---

### RK06: Scenario Test Coverage Gaps [MEDIUM × MEDIUM]

**Description:** Current scenarios (14) cover basic paths but miss: midnight-crossing profiles, CRP scheduling, post-event with assertions, consecutive short-night warnings, conflict resolution options. After Phase B changes, scenario expectations must all be re-validated.

**Probability:** Medium — we know the gaps (S06/S07 have no assertions, no PMer midnight test).

**Impact:** Medium — untested paths may contain bugs that surface in real usage during Phase E.

**Mitigation:**
1. Phase B adds S15 (PMer), S16 (CRP midday), S17 (CRP evening fallback)
2. S06 and S07 get real assertions
3. After Phase B completion, do a full scenario review: does every scenario test something meaningful?
4. During Phase E, any bug found in testing → immediately add a scenario to prevent regression

**Owner:** Dev lead
**Status:** Open

---

### RK07: EAS Build / TestFlight Configuration [HIGH × MEDIUM]

**Description:** First-time Expo EAS Build setup requires Apple Developer account, provisioning profiles, bundle identifier, and correct app.json configuration. This is a common source of delays for first deployments.

**Probability:** High — first EAS build almost never succeeds on the first try.

**Impact:** Medium — delays TestFlight deployment but doesn't affect app functionality.

**Mitigation:**
1. Start EAS configuration (F1, F2) during Phase E — don't wait until Phase F
2. Do a dry-run build early (even with incomplete app) to validate the build pipeline
3. Ensure Apple Developer account is active and has available TestFlight slots
4. Budget 2x estimated time for Phase F

**Owner:** Dev lead
**Status:** Open

---

### RK08: State Management Complexity [MEDIUM × LOW]

**Description:** The mobile app uses AsyncStorage for profile, night records, and CRP records. As the data model grows, managing state updates (record a night → recalculate readiness → update UI) may become fragile without a proper state management pattern.

**Probability:** Medium — AsyncStorage is fine for MVP scale, but the read-compute-display pipeline has multiple steps.

**Impact:** Low — worst case is stale UI that refreshes on next app open. No data loss.

**Mitigation:**
1. Keep storage adapter simple: read on app open, write on user action, recompute day plan after each write
2. Use React state + useEffect, not a state management library (avoid over-engineering)
3. If bugs surface, consider adding a simple event bus pattern in Phase E

**Owner:** Dev lead
**Status:** Open

---

### RK09: R-Lo Tone Drift [LOW × LOW]

**Description:** Without a formal R-Lo persona document and copy review process, new messages may gradually drift from the intended calm/pragmatic tone. Forbidden words might sneak in.

**Probability:** Low — we have guardrails in code comments and will create RLO_PERSONA.md in Phase A.

**Impact:** Low — wrong tone is fixable quickly. No structural damage.

**Mitigation:**
1. Phase A creates RLO_PERSONA.md with explicit tone rubric and forbidden words
2. Phase E includes an R-Lo message audit (task E6)
3. All new R-Lo messages must reference RLO_PERSONA.md in PR review

**Owner:** Product lead
**Status:** Open

---

### RK10: Over-Scoping During Development [LOW × MEDIUM]

**Description:** During implementation, it's tempting to add features not in MVP scope (push notifications, wearable hooks, travel mode). Each addition delays the critical path.

**Probability:** Low — MVP_DEFINITION_v1.md has a clear "out of scope" list.

**Impact:** Medium — scope creep is the #1 killer of MVPs. Even small additions compound.

**Mitigation:**
1. MVP_DEFINITION_v1.md is the contract. If it's not listed, it doesn't get built.
2. Any new idea goes into a `docs/BACKLOG.md` file, not into code
3. If Nick requests something during validation that's out of scope, acknowledge it and add to backlog with his priority ranking

**Owner:** Product lead
**Status:** Open

---

## Time Estimates

| Scenario | Total Hours | Weekly Pace | Calendar Time |
|---|---|---|---|
| **Optimistic** | 55 hours | 18 hrs/week | ~3 weeks |
| **Realistic** | 70 hours | 14 hrs/week | ~5 weeks |
| **Conservative** | 85 hours | 12 hrs/week | ~7 weeks |

**Assumptions:**
- Single developer
- Nick validation call happens within first 2 weeks
- No major surprises in calendar API integration
- Apple Developer account already active

**Critical path bottleneck:** Phase B (core engine). If pre-sleep fix takes longer than estimated (RK01 materializes), add 1 week to all timelines.

---

## Risk Review Schedule

| When | Action |
|---|---|
| After Phase A | Review RK03 (Nick availability) — is call scheduled? |
| After Phase B | Review RK01, RK02, RK06 — did the engine fix cascade cleanly? |
| After Phase D | Review RK04 — did calendar integration work? |
| After Phase E | Review all — go/no-go for TestFlight |

---

*This register should be updated after each phase completion.*
