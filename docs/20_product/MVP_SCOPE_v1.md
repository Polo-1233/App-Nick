# MVP Scope — v1

**Version:** 1.0
**Date:** 2026-02-17
**Phase:** Weeks 1–10
**Status:** Draft

---

## In Scope (MVP)

### Core Logic Engine
- [x] Cycle calculation backward from anchor time
- [x] Day plan builder (timeline of blocks)
- [x] Calendar conflict detection
- [x] Conflict resolution options (2 choices)
- [x] Readiness zone computation (green/yellow/orange)
- [x] Next Best Action selector
- [x] R-Lo message generator (deterministic, rule-based)
- [x] Rules registry with CONFIRMED/TODO_NICK status
- [x] **FIXED (Phase B):** Pre-sleep model — `PRE_SLEEP_DURATION = 90`, down-period post-event only
- [x] **FIXED (Phase B+C):** CRP blocks in day plan timeline (midday + evening fallback)
- [x] **FIXED (Phase B):** Midnight wraparound in conflict detection and actions
- [x] Post-event (down-period) protocol in planner (`calculatePostEventWindow`)
- [ ] Missed-bedtime recalculation wired into planner flow (engine has `recalculateFromMissedBedtime`, not yet surfaced in UI)
- [x] CRP scheduling in planner (midday 13:00–15:00 + evening 17:00–19:00 fallback)

### Mobile App Shell
- [x] Home screen with R-Lo message
- [x] Next Best Action card
- [x] Timeline of day blocks
- [x] Readiness zone indicator (X/35)
- [x] **DONE (Phase C):** Onboarding: set anchor time + chronotype
- [x] **DONE (Phase C):** Manual night logging (cycles completed)
- [x] **DONE (Phase C):** CRP trigger/reminder UI
- [x] **DONE (Phase C):** Post-event bottom sheet
- [x] **DONE (Phase C):** Real data from AsyncStorage (no more mock data in production flow)

### Calendar Integration (Read-Only)
- [x] **DONE (Phase D):** iOS Apple Calendar integration (expo-calendar)
- [x] **DONE (Phase D):** Android calendar integration
- [x] **DONE (Phase D):** Conflict detection against real calendar data
- [x] **DONE (Phase D):** Permission handling (graceful fallback if denied)
- [ ] Conflict resolution dialog (show 2 options, let user pick) — ConflictSheet shows info but not resolution options (Phase F backlog)

### Scenario Test Suite
- [x] 17 scenarios covering core paths (was 14, added S15–S17 in Phase B+C)
- [x] **FIXED (Phase B):** Aligned scenario expectations with canonical method v2
- [x] **DONE (Phase B):** CRP-specific scenarios (S16, S17)
- [x] **DONE (Phase B):** Post-event protocol scenarios with assertions (S06, S07)
- [x] **DONE (Phase B):** PMer midnight-crossing scenario (S15)

### Documentation
- [x] Project Charter
- [x] R90 Logic Map v0.1
- [x] R90 Canonical Method v2 (consolidated from book + vision)
- [x] Architecture state document (updated Phase E)
- [x] Open assumptions list (updated Phase E)
- [x] Audit report v1
- [x] **NEW (Phase A):** R-Lo Persona document
- [x] **NEW (Phase E):** Testing Protocol

## Out of Scope (Phase 2+)

| Feature | Phase | Rationale |
|---|---|---|
| Authentication / user accounts | 2 | MVP is single-user, local-only |
| Backend / cloud sync | 2 | Local storage sufficient for testing |
| Wearable data integration (HealthKit, Whoop, Oura) | 2 | Requires health data permissions, complex mapping |
| Travel Mode / jet lag protocol | 2+ | Complex feature, needs Nick validation |
| Recovery Room Audit | 2+ | Nice-to-have, not core execution loop |
| Scoreboard / gamification (streaks, badges) | 2 | Engagement layer, not core logic |
| LLM-powered R-Lo responses | 2+ | Deterministic rules first, LLM optional later |
| Subscription / payments | 3 | No commercial activation in MVP |
| Public launch (App Store / Play Store) | 3 | MVP is private beta via TestFlight |
| Push notifications | 2 | Requires notification permissions |
| Multi-language support | 2+ | English first |
| Light Hunter mini-game | 3 | Engagement feature, not core |

## MVP Exit Criteria

Before moving to Phase 2, the following must be true:

1. All TODO_NICK rules resolved (Nick validation call completed)
2. All 14+ scenarios pass with assertions aligned to canonical method v2
3. Pre-sleep model corrected (90 min, not 30+90)
4. Midnight wraparound bugs fixed in conflict detection and timeline
5. CRP windows integrated into day plan
6. Mobile app displays accurate day plan from core engine
7. At least one real-day test performed (Nick or team member runs the app for a day)
