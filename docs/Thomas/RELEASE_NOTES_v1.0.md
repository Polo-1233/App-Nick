# Release Notes — Airloop v1.0.0 (RC 1)

**Date:** 2026-02-17
**Build:** 1.0.0-rc.1
**Platform:** iOS (TestFlight private beta)
**Engine:** R90 method, Nick Littlehales

---

## What's New in V1

### Core Sleep Engine

All scheduling logic lives in `packages/core` — pure TypeScript, zero dependencies, fully deterministic. The engine never changes based on AI interpretation.

- **90-minute cycle scheduling** — bedtime calculated backward from your anchor time
- **Missed bedtime recalculation** — drops 1 cycle, finds the next achievable window
- **Post-event protocol** — 90-minute adrenaline clearance after late events
- **Readiness zones** — Green / Yellow / Orange based on last 3 nights avg
- **Weekly target tracking** — 35 cycles/week default (28–35 acceptable range)
- **Calendar conflict detection** — pre-sleep and sleep-cycle overlap with real events

### Three-Tab Navigation

| Tab | Purpose |
|-----|---------|
| **Home** | Today's plan: Airloop message, next action, CRP card |
| **Calendar** | Full-day timeline, conflict resolution options |
| **Profile** | Weekly chart, night history, settings, data reset |

### Airloop Guide

Airloop is a discrete expert presence — not a character, not a mascot. It reads engine outputs and surfaces context-appropriate messages. In V1, all messages are template-based (deterministic). No LLM, no free-text.

- **Airloop Chat** — global slide-up panel accessible from all tabs via FAB
- **4 pre-built prompts**: How's my week / Explain my plan / What if I sleep late / Recalculate
- **Airloop Presence** — subtle animated dot at bottom of Home screen

### Onboarding

- Airloop splash screen → 3-question setup: anchor time, chronotype, confirm
- No emojis. Calm, direct language throughout.

### Data Logging

- **Log Last Night** — manual cycle count entry (1–7 cycles)
- **Late Event Protocol** — Physical / Mental / Social event type, time picker, immediate plan update
- **CRP completion** — mark 30-min or 90-min recovery periods

### Premium Gates (V1 client-side)

| Feature | Free tier | Premium |
|---------|-----------|---------|
| Conflict resolution | 1 per session | Unlimited |
| Plan recalculation | 1 per session | Unlimited |
| Post-event protocol | Unlimited | — |

Premium purchase is not implemented in this RC. Gate UI is present; "Get Premium" is a placeholder.

---

## Known Limitations in V1

### Requires Nick Validation Before Production

The following rules are implemented but not yet confirmed by Nick Littlehales. They ship in RC but must not be treated as authoritative guidance until validated (see `docs/TODO_NICK.md`):

- **Zone thresholds** — Green ≥4.5 avg, Yellow 3–4.5, Orange <3 (R050–R052)
- **Default cycles = 5 per night** (R002) — may vary by chronotype
- **Minimum window = 2 cycles** (R005)
- **Adrenaline clearance = 90 min** (R013) — from Product Vision, not the book
- **Down-period = 90 min** (R010)
- **Weekly target = 35** — 28–30 may be acceptable (R042)

### Technical Limitations

- **No cloud sync** — all data is local to device. Switching phones loses history.
- **No push notifications** — sleep reminders not implemented. Target: V1.5.
- **No in-app purchase** — premium gate UI present but CTA is placeholder.
- **No wearable integration** — cycles are logged manually.
- **Single device only** — no account system or cross-device sync.
- **CRP completion does not add to weekly cycle count** — pending Nick validation of A03 (does CRP substitute a sleep cycle?).

---

## Testing Status

| Suite | Result |
|-------|--------|
| Core engine scenarios | **25/25 pass** |
| TypeScript | **0 errors** |
| Manual device testing | Pending TestFlight |

---

## Commit History (Weeks 2–10)

| Commit | Week | Summary |
|--------|------|---------|
| `58879ef` | 2 | Core: Airloop rebrand, barrel fixes |
| `65c9c01` | 2 | Navigation: 3-tab layout, Calendar + Profile placeholders |
| `4840c03` | 3 | Home: AirloopPresence, AppState refresh, useFocusEffect |
| `2b5f329` | 4 | Calendar: ConflictCard, applyConflictOption, DayPlanContext |
| `9ff76f3` | 5 | Chat: AirloopChat, ChatBubble, airloop-chat-handler |
| `eb9717a` | 6 | Profile: WeeklyCycleChart, NightHistoryList, settings, reset |
| `275f48e` | 7 | Premium: gates engine, PremiumGate, PostEventSheet selector |
| `2a4d766` | 8 | Onboarding: AirloopSplash, OnboardingStep, SkeletonLoader |
| `53d4bf7` | 9 | Tests: 25 scenarios, timer bug fix, onboarding error handling |
