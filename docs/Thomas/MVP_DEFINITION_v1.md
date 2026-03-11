# MVP Definition — v1

**Version:** 1.0
**Date:** 2026-02-17
**Status:** Execution-ready
**Scope:** From current repo state to feature-complete private beta

---

## 1. What the MVP Is

A single-user iOS app (TestFlight) that:

1. **Calculates** tonight's sleep plan — backward from a fixed anchor time, in 90-minute cycles
2. **Detects** calendar conflicts with the pre-sleep routine and offers two resolution options
3. **Recommends** one CRP (daytime recovery) window when recent nights are below target
4. **Shows** a readiness zone (Green/Yellow/Orange) based on recent cycle history — never as a number
5. **Displays** a companion character (R-Lo) delivering calm, contextual guidance
6. **Surfaces** exactly one "Next Best Action" at any given moment
7. **Handles** post-event scenarios (late match/dinner → down-period protocol → recalculated bedtime)
8. **Logs** nightly cycles manually (user taps how many cycles they completed)

## 2. What the MVP Is NOT

- NOT a sleep tracker (no automatic detection)
- NOT connected to wearables (Phase 2)
- NOT multi-user / cloud-synced (local storage only)
- NOT available on App Store (TestFlight private beta only)
- NOT AI-powered for R-Lo (deterministic rule-based messages only)
- NOT a medical device (no health claims)

## 3. Functional Requirements

### F01: Onboarding
- User sets anchor time (wake-up time, fixed 7 days/week)
- User selects chronotype (AMer / PMer / Neither)
- Defaults: 5 cycles/night, 35 cycles/week
- Stored locally (AsyncStorage)

### F02: Day Plan Generation
- On app open: `buildDayPlan()` produces today's timeline
- Timeline shows: wake → [calendar events] → [CRP if recommended] → pre-sleep → sleep cycles
- All bedtimes calculated backward from anchor
- Pre-sleep routine = 90 minutes before bedtime (single block, NOT 30+90)
- Blocks sorted relative to anchor time (day starts at anchor, not midnight)

### F03: Calendar Integration (Read-Only)
- Reads device calendar (Google Calendar / Apple Calendar via Expo)
- Events passed to `detectConflicts()` against pre-sleep and sleep windows
- Conflict detected → R-Lo presents 2 options (shortened routine or drop 1 cycle)
- User selects → plan recalculated

### F04: Night Logging
- Manual entry: "How many cycles did you complete?" (2–6 selector)
- Saved to `NightRecord[]` in local storage
- Feeds into readiness computation and weekly total

### F05: CRP Integration
- When readiness zone is Yellow or Orange, day plan includes CRP block
- Midday window: 13:00–15:00 (30 or 90 min)
- Evening window: 17:00–19:00 (30 min only, if midday missed)
- CRP completion logged and counts toward weekly total

### F06: Readiness Zone
- Computed from last 3 nights (TODO_NICK: confirm thresholds)
- Green: full reserves, push if you want
- Yellow: steady state, CRP recommended
- Orange: recovery priority
- Displayed as color + R-Lo message, NEVER as a number

### F07: Next Best Action
- Exactly one action shown at any time
- Priority waterfall: wake routine → CRP window → pre-sleep approaching → bedtime → general guidance
- Time-aware: adapts to current MinuteOfDay
- Midnight-safe: all arithmetic handles wraparound

### F08: R-Lo Messages
- Contextual: morning / midday / evening / post-event
- Anchor-relative time boundaries (not hardcoded 05:00/12:00/17:00)
- Tone: calm, pragmatic, encouraging — never anxious
- Forbidden words: score, grade, rating, poor, bad, fail

### F09: Post-Event Protocol
- User triggers: "I had a late event"
- Inputs event end time
- Engine: 90-min adrenaline clearance → find next cycle boundary → recalculate
- R-Lo: "Event's done. Your next available cycle is at XX:XX. N cycles tonight — that's fine."

### F10: Weekly View
- Shows X/35 cycles this week
- Recovery framing: "You're at 24/35. Two good nights and you're back on track."
- Consecutive short-night warning (3+ nights below 5 cycles)

## 4. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Core engine: pure TS, zero dependencies | Maintained |
| Core engine: deterministic (same input → same output) | Maintained |
| All rules traceable to R90_CANONICAL_METHOD_v2.md | 100% |
| TODO_NICK rules: not shipped to users until validated | Enforced |
| Test coverage: all scenarios pass with meaningful assertions | 14+ scenarios |
| Midnight wraparound: all time operations safe | Verified |
| Local storage only (no backend) | MVP |
| iOS TestFlight deployment | MVP exit |

## 5. MVP Exit Criteria

All of the following must be TRUE before declaring MVP complete:

1. [ ] All Priority 1 audit bugs fixed (pre-sleep model, midnight wraparound, PRC window)
2. [ ] All Priority 2 audit items resolved (formatTime consolidation, dead code removal, CRP blocks, anchor-relative moments)
3. [ ] Nick validation call completed — all TODO_NICK rules resolved or deferred with his agreement
4. [ ] All 14+ scenarios pass with assertions (no vacuous passes)
5. [ ] Onboarding flow functional (set anchor + chronotype)
6. [ ] Manual night logging functional (stores to local storage)
7. [ ] Calendar integration reads device calendar and detects conflicts
8. [ ] CRP blocks appear in day plan when zone is Yellow/Orange
9. [ ] Post-event protocol wired into planner flow
10. [ ] App builds and runs on iOS via TestFlight
11. [ ] At least one real-day test performed (team member uses the app for a full day)
12. [ ] R-Lo persona document exists in `docs/30_design/`

## 6. Out of Scope (Hard Boundaries)

These are explicitly NOT part of MVP, regardless of how easy they seem:

- Authentication / user accounts
- Cloud sync / backend
- Wearable integration (HealthKit, Whoop, Oura)
- Push notifications
- Travel mode / jet lag
- Recovery Room Audit
- Gamification (streaks, badges)
- LLM-powered R-Lo
- Multi-language
- Android (Expo builds for iOS first)
- App Store submission

---

*This document is the single source of truth for what "done" means.*
