# Architecture State

**Version:** 2.0 (V1 RC)
**Date:** 2026-02-17

---

## Overview

Monorepo using npm workspaces. Four layers: types → core → tests → mobile app.

```
┌─────────────────────────────────────────┐
│   apps/mobile                            │  Expo Router + React Native 0.81
│   (presentation + interaction)           │  SDK 54, 3-tab navigation
├─────────────────────────────────────────┤
│   packages/core                          │  Pure TypeScript, zero deps
│   (logic engine — SOVEREIGN)             │  Deterministic, never overridden
├─────────────────────────────────────────┤
│   packages/types                         │  Shared type definitions
│   (contracts)                            │  Single source of truth
├─────────────────────────────────────────┤
│   packages/tests                         │  Scenario test harness
│   (validation)                           │  25 scenarios, runs via tsx
└─────────────────────────────────────────┘
```

---

## Architectural Decisions

### D1: Pure TypeScript core with zero dependencies
**Rationale:** The logic engine must be deterministic, portable, and testable without a runtime environment. No date libraries, no frameworks. Time is represented as `MinuteOfDay` (0-1439) to avoid timezone complexity.

**Trade-off:** Midnight wraparound must be handled manually in every time calculation. All time arithmetic must use `addMinutes`/`subtractMinutes`/`isTimeBetween` from `time-utils.ts` — never raw addition.

### D2: MinuteOfDay as primary time representation
**Rationale:** Simpler than Date objects for 90-minute cycle math. Avoids timezone and DST issues.

**Trade-off:** Cannot natively represent multi-day spans. Sleep windows that cross midnight require wraparound logic (23:00 = 1380, 06:30 = 390).

### D3: npm workspaces monorepo (no Turborepo/Nx)
**Rationale:** Minimal tooling. No build step needed — tsx runs TypeScript directly. Expo Metro resolves workspace packages.

### D4: Expo Router for mobile (SDK 54, file-based routing)
**Rationale:** File-based routing, fast iteration. `(tabs)` group handles 3-tab layout. Stack handles onboarding + log-night as modal screens.

### D5: AsyncStorage for local persistence (versioned keys)
**Key schema:** `@r90:{type}:v{STORAGE_VERSION}`
- `@r90:profile:v1` — UserProfile
- `@r90:weekHistory:v1` — NightRecord[] (last 7 nights)
- `@r90:crpRecords:v1` — CRPRecord[] (last 30 days)
- `@r90:usage:v1` — UsageRecord (premium gate counters)

### D6: Custom scenario test harness (not Jest/Vitest)
**Rationale:** Scenario-based testing maps directly to the Logic Map document. Each scenario has a traceable ID. 25 scenarios cover cycle windows, readiness zones, conflicts, CRP blocks, and next action types.

### D7: DayPlanContext at tab layout level (ADR-003)
**Rationale:** `useDayPlan()` runs exactly ONCE at `(tabs)/_layout.tsx` via `DayPlanProvider`. All tabs consume `useDayPlanContext()`. No tab triggers its own data fetch.

**Key pattern:** `applyConflictOption(CycleWindow)` — instant in-memory plan rebuild using `cachedInputs` ref. Zero async operations.

### D8: Template-based AI (V1) — no LLM
**Rationale:** V1 Airloop messages are deterministic templates from `airloop-messages.ts`. The switch in `airloop-chat-handler.ts` is exhaustively typed — adding a prompt requires a new `PromptId` union member and a new case (TypeScript enforces completeness).

### D9: Client-side premium gates (V1)
**Rationale:** No backend in V1. Premium gates check local `UsageRecord` counts in `premium-gates.ts`. V1.5 will replace usage-count gates with IAP receipt validation.

---

## Module Responsibilities

### Core Engine (`packages/core`)

| Module | Responsibility | Rule IDs |
|--------|---------------|----------|
| `cycles.ts` | Cycle window, missed bedtime, post-event protocol | R001–R006, R013–R014 |
| `planner.ts` | Orchestrator: DayPlan, CRP blocks, timeline, `buildDayPlanFromWindow()` | All |
| `conflicts.ts` | Calendar conflict detection (midnight-safe), resolution options | R030–R033 |
| `readiness.ts` | Green/Yellow/Orange zone from last 3 nights avg | R050–R053 |
| `actions.ts` | Next Best Action (morning, midday CRP, pre-sleep, bedtime, general) | R010–R012, R020, R022, R060 |
| `airloop-messages.ts` | Airloop message generation (renamed from `rlo.ts`) | R060–R065 |
| `premium-gates.ts` | Premium feature gate evaluation, `UsageRecord` | — |
| `rules.ts` | Static registry (documentation mirror, not execution engine) | All |
| `time-utils.ts` | Time conversion and arithmetic (midnight-safe) | — |

### Mobile App (`apps/mobile`)

#### Hooks / Context

| Module | Responsibility |
|--------|---------------|
| `lib/use-day-plan.ts` | Loads real data, calls `buildDayPlan`, caches inputs, `AppState` refresh, exposes `applyConflictOption` |
| `lib/day-plan-context.tsx` | `DayPlanProvider` + `useDayPlanContext()` — ADR-003 single source |
| `lib/use-premium.ts` | Loads `UsageRecord`, exposes `checkGate(feature)` + `recordUsage(feature)` |
| `lib/calendar.ts` | Expo Calendar permission, fetch, MinuteOfDay conversion |
| `lib/storage.ts` | AsyncStorage adapter: profile, week history, CRP records, usage, export |
| `lib/airloop-chat-handler.ts` | Finite switch over 4 `PromptId` values; exhaustive typing |

#### Screens

| Screen | Tab | Purpose |
|--------|-----|---------|
| `app/(tabs)/index.tsx` | Home | Readiness zone, Airloop message, next action, CRP, log/event buttons |
| `app/(tabs)/calendar.tsx` | Calendar | Full-day timeline, conflict resolution with premium gate |
| `app/(tabs)/profile.tsx` | Profile | Weekly chart, night history, settings, data export, reset |
| `app/onboarding.tsx` | — | 4-step: Airloop splash → anchor → chronotype → confirm |
| `app/log-night.tsx` | — | Manual cycle entry |

#### Components

| Component | Purpose |
|-----------|---------|
| `AirloopCard` | Airloop message bubble with "A" avatar |
| `AirloopChat` | Slide-up chat modal; 4 prompt buttons; premium-gated recalculate |
| `AirloopPresence` | Subtle breathing dot at bottom of Home; pulses on new message |
| `AirloopSplash` | Fade-in splash for onboarding (auto-advances after ~2s) |
| `ChatBubble` | User (right/blue) + Airloop (left/dark) message bubbles |
| `ConflictCard` | Option A/B picker for Calendar conflict resolution |
| `ConflictSheet` | Modal listing conflicts (Home screen auto-show) |
| `CRPCard` | CRP reminder in Yellow/Orange zones |
| `NightHistoryList` | Reverse-chrono table: date / cycles (coloured) / anchor deviation |
| `NextActionCard` | Single next best action card |
| `OnboardingStep` | Progress dots + Airloop message bubble; reusable onboarding wrapper |
| `PostEventSheet` | Physical/Mental/Social selector + time picker + plan preview; updates via `applyConflictOption` |
| `PremiumGate` | Fade Modal shown when feature gate triggers; V1 CTA placeholder |
| `ReadinessIndicator` | Green/Yellow/Orange zone chip |
| `SkeletonLoader` | `HomeSkeletonScreen`, `CalendarSkeletonScreen`, `ProfileSkeletonScreen` — pulsing placeholders |
| `TimelineView` | Colour-coded day timeline (sleep / CRP / event blocks) |
| `WeeklyCycleChart` | 7-slot bar chart; green/yellow/orange per cycle count |

---

## Data Flow (V1)

```
UserProfile + NightRecord[] + CalendarEvent[] + now
                    │
                    ▼
            buildDayPlan() ──── or ──── buildDayPlanFromWindow(CycleWindow, ...)
           ┌────────┼────────┐
           ▼        ▼        ▼
  calculateCycleWindow  computeReadiness  detectConflicts
           │        │
           ▼        ▼
  selectNextAction  generateAirloopMessage
           │        │
           ▼        ▼
         DayPlan (returned)
                    │
                    ▼
           DayPlanContext (shared across all 3 tabs)
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       Home      Calendar   Profile
```

---

## Known Technical Debt (V1 RC)

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | CRP completion does not add to weekly cycle count | P0 | Pending Nick Q07 validation |
| 2 | Premium gates reset on app reinstall (client-side count only) | P1 | V1.5: tie to IAP receipt |
| 3 | No push notifications for pre-sleep / anchor reminders | P1 | V1.5 scope |
| 4 | No IAP wiring — "Get Premium" CTA is placeholder | P1 | V1.5 scope |
| 5 | Chronotype stored but not used in cycle calculation | P2 | Pending Nick Q08 validation |
| 6 | No cloud sync — data lost if app deleted | P2 | V2 scope (requires backend) |
| 7 | No wearable integration — cycles logged manually only | P3 | V2 scope |

---

## Resolved Technical Debt (from AUDIT_REPORT_v1.md)

All items from the original audit are resolved:

- ~~Midnight wraparound bugs~~ — all time arithmetic uses `addMinutes`/`subtractMinutes`/`isTimeBetween`
- ~~Pre-sleep model incorrect~~ — `PRE_SLEEP_DURATION = 90` confirmed; down-period is post-event only
- ~~CRP not in planner~~ — `buildBlocks()` generates CRP blocks for yellow/orange zones
- ~~`formatTime` duplicated~~ — single implementation in `time-utils.ts`
- ~~`PostEventSheet` confirm doesn't update live day plan~~ — now calls `applyConflictOption(CycleWindow)` → instant context update
- ~~`ConflictSheet` doesn't offer resolution~~ — `ConflictCard` in Calendar tab with Option A/B via `applyConflictOption`
- ~~R-Lo mascot character~~ — replaced with Airloop discrete expert guide throughout
