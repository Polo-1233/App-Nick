# Airloop — R90 Digital Navigator

A sleep recovery execution system based on Nick Littlehales' R90 methodology.
Built by MetaLab.

**Version:** 1.0.0-rc.1

---

## Principles

- **Cycles, not hours.** Think in 90-minute blocks and weekly targets.
- **One action at a time.** Always surface the single most important thing to do now.
- **Calm over clever.** No scores, grades, or streaks. Just data and guidance.
- **Engine sovereignty.** The R90 calculation engine is never overridden by AI interpretation.
- **Life-first.** The system adapts to the user's schedule, not the other way around.

---

## Project Structure

```
r90-digital-navigator/
├── docs/
│   ├── 00_context/              # Vision, constraints, charter
│   ├── 10_method/               # R90 Logic Map, rules, scenarios
│   ├── 20_product/              # MVP scope, user flows
│   ├── 30_design/               # Airloop persona, style guide
│   ├── 40_legal/                # NDA notes, IP, licensing
│   ├── ARCHITECTURE_STATE.md    # Decisions, modules, data flow
│   ├── RELEASE_NOTES_v1.0.md   # V1 RC feature list + limitations
│   ├── TODO_NICK.md             # Rules requiring Nick validation
│   ├── V1.5_PLANNING.md         # Next priorities: notifications, IAP, telemetry
│   └── AIRLOOP_STYLE_GUIDE.md  # Airloop tone and message rules
├── apps/
│   └── mobile/                  # Expo React Native app (SDK 54)
├── packages/
│   ├── core/                    # Pure TS logic engine (cycles, planning, rules)
│   ├── tests/                   # Scenario test suite (25 scenarios)
│   └── types/                   # Shared TypeScript types
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9 (workspaces support)
- Expo CLI (`npx expo`)

### Install

```bash
npm install
```

### Run Tests

```bash
npm -w @r90/tests run test
```

Runs 25 scenario tests against the core logic engine. All must pass before any commit.

### Run Mobile App

```bash
cd apps/mobile && npx expo start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator.

### TypeScript Check

```bash
npx tsc --noEmit
```

---

## Architecture

### Core Engine (`packages/core`) — Sovereign

Pure TypeScript, zero dependencies, fully deterministic. AI never overrides this layer.

| Module | Purpose |
|--------|---------|
| `cycles.ts` | Sleep cycle windows, missed bedtime, post-event protocol |
| `planner.ts` | `buildDayPlan()` orchestrator — DayPlan, timeline, CRP blocks |
| `conflicts.ts` | Calendar conflict detection + resolution options |
| `readiness.ts` | Green / Yellow / Orange zone from last 3 nights |
| `actions.ts` | Single next-best action selection |
| `airloop-messages.ts` | Template-based Airloop message generation |
| `premium-gates.ts` | Premium feature gate logic (client-side, V1) |
| `time-utils.ts` | Midnight-safe time arithmetic |

### Mobile App (`apps/mobile`)

Expo Router (SDK 54) with 3-tab navigation and full local data flow.

**Tabs:**

| Tab | Purpose |
|-----|---------|
| Home | Airloop message, next action, CRP card, post-event sheet |
| Calendar | Full-day timeline, conflict resolution with premium gate |
| Profile | Weekly cycle chart, night history, settings |

**Key patterns:**

- `DayPlanContext` — `useDayPlan()` runs once at tab layout level. All tabs share one plan.
- `applyConflictOption(CycleWindow)` — instant in-memory plan rebuild, no re-fetch.
- `AppState` listener — silent background refresh when app returns to foreground.
- `usePremium()` — checks + records feature usage against `UsageRecord` in AsyncStorage.
- Airloop Chat — finite switch (`PromptId` union), exhaustively typed, no LLM.

---

## V1 Feature Set

- Airloop-first onboarding (splash → anchor → chronotype → confirm)
- Home: readiness zone, next best action, CRP card, Airloop message
- Calendar: full-day timeline, conflict cards with Option A/B resolution
- Profile: 7-day cycle chart, night history, anchor + chronotype settings
- Airloop Chat: 4 pre-built prompts backed by engine calls
- Post-event protocol: Physical / Mental / Social selector + live plan update
- Premium gates (client-side): conflict resolution + recalculate (1 free each)
- Skeleton loading screens, error-safe onboarding
- 25 engine scenarios (all passing)

---

## Contributing

1. Every rule must trace back to `R90_LOGIC_MAP_v0.1.md` via a rule ID.
2. Rules marked `TODO_NICK` must not be treated as authoritative until validated. See `docs/TODO_NICK.md`.
3. Never show raw metrics. Translate everything to actions.
4. Never use anxiety language (score, grade, poor, bad, fail). See `docs/AIRLOOP_STYLE_GUIDE.md`.
5. Keep modules small and testable. Prefer clarity over cleverness.
6. All time arithmetic uses `addMinutes`/`subtractMinutes`/`isTimeBetween` — never raw addition.
7. Any change to `packages/core` must pass all 25 scenarios before committing.

---

## Status

**Version:** 1.0.0-rc.1
**Phase:** V1 RC — awaiting TestFlight device testing and Nick validation call
**Tests:** 25/25 passing | TypeScript: 0 errors

### Week-by-Week Build Log

| Week | Commit | Deliverable |
|------|--------|-------------|
| 2 | `58879ef` + `65c9c01` | Airloop rebrand, 3-tab navigation |
| 3 | `4840c03` | AirloopPresence, AppState refresh |
| 4 | `2b5f329` | Calendar tab, ConflictCard, DayPlanContext |
| 5 | `9ff76f3` | AirloopChat, chat handler |
| 6 | `eb9717a` | Profile tab, WeeklyCycleChart, NightHistoryList |
| 7 | `275f48e` | Premium gates, PostEventSheet selector |
| 8 | `2a4d766` | Onboarding redesign, SkeletonLoader |
| 9 | `53d4bf7` | 25 scenarios, bug fixes |
| 10 | current | V1 RC docs, version bump |

### Next Steps

1. TestFlight build via EAS (`eas build --platform ios --profile preview`)
2. Nick validation call — work through `docs/TODO_NICK.md`
3. V1.5 planning — push notifications, IAP, telemetry
