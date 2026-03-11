# V1 Scope Definition

**Version:** 1.0
**Date:** 2026-02-17
**Status:** Draft
**Context:** R90 Digital Navigator — React Native / Expo monorepo

---

## What V1 IS

V1 is the minimal product that:

1. **Delivers daily value** — a user opens the app every morning, sees their plan, follows it, and logs the result. They can resolve calendar conflicts (not just acknowledge them), track their consistency via streaks, and get reminded at the right moments via local push notifications.

2. **Sets up AI data collection** — every user interaction (plan viewed, conflict resolved, post-event triggered, CRP completed, night logged) is captured in a local telemetry log with typed contracts. No ML models run in V1. No data leaves the device. But when V2 adds pattern learning, the data is already there.

3. **Proves the loop** — the full cycle works: onboard, plan, act, log, score, repeat. A user can run V1 for 4 weeks and have a complete dataset of their sleep recovery journey.

V1 is NOT a public App Store release. It ships to TestFlight for Nick and a closed group of testers.

---

## V1 Feature Matrix

| Feature | Status | V1 Target | Notes |
|---|---|---|---|
| **Dashboard** | | | |
| Readiness zone (green/yellow/orange) | DONE | Ship as-is | Thresholds pending Nick validation (A04) |
| Next action card | DONE | Ship as-is | `selectNextAction()` in `packages/core/src/actions.ts` |
| R-Lo messages | DONE | Ship as-is | `generateRLoMessage()` in `packages/core/src/rlo.ts` |
| Timeline view | DONE | Ship as-is | `TimelineView.tsx` component |
| **Navigator** | | | |
| 24h cycle map | DONE | Ship as-is | Part of `TimelineView` |
| Calendar sync | DONE | Ship as-is | `apps/mobile/lib/calendar.ts` via expo-calendar |
| Conflict detection | DONE | Ship as-is | `detectConflicts()` in `packages/core/src/conflicts.ts` |
| Conflict resolution (2-option picker) | NOT DONE | **BUILD** | `generateConflictOptions()` exists but `ConflictSheet.tsx` only shows info + "Got It" |
| Weekly view (35-cycle progress) | NOT DONE | **BUILD** | New screen |
| **Scoreboard** | | | |
| Streaks (anchor/ideal-night/CRP) | NOT DONE | **BUILD** | New system, AsyncStorage |
| Badges (beginner to legend) | NOT DONE | DEFER to V2 | Streaks first, badges later |
| **Recovery Room Audit** | | | |
| 7-step questionnaire | NOT DONE | DEFER to V2 | |
| Scoring system | NOT DONE | DEFER to V2 | |
| Light hunter mini-game | NOT DONE | DEFER to V2+ | |
| **Post-Event Mode** | | | |
| Basic post-event sheet | DONE | Ship as-is | `PostEventSheet.tsx` |
| Event-type selection (physical/mental/social) | NOT DONE | **BUILD** | Extend `PostEventSheet.tsx` |
| Pattern learning from event types | NOT DONE | DEFER to V2+ | AI/ML territory |
| **Elite Modes** | | | |
| Travel Mode | NOT DONE | DEFER to V2 | |
| **Infrastructure** | | | |
| Local storage (AsyncStorage) | DONE | Ship as-is | `apps/mobile/lib/storage.ts` |
| Push notifications (local) | NOT DONE | **BUILD** | expo-notifications, no server |
| Telemetry logging layer | NOT DONE | **BUILD** | Local-first event log |
| AI data contracts (types only) | NOT DONE | **BUILD** | Interfaces in `packages/types/src/index.ts` |
| Settings screen | NOT DONE | **BUILD** | Edit anchor, chronotype, reset |
| Day plan auto-refresh | NOT DONE | **BUILD** | AppState listener in `useDayPlan` |
| Wearable integration | NOT DONE | DEFER to V2 | |
| Backend / cloud sync | NOT DONE | DEFER to V2 | |
| LLM-powered R-Lo | NOT DONE | DEFER to V2+ | |
| Multi-language | NOT DONE | DEFER to V2+ | |

---

## IN Scope (V1)

### 1. Conflict Resolution Dialog

**Problem:** `ConflictSheet.tsx` currently shows conflict info and a "Got It" button. It does not call `generateConflictOptions()` or let the user pick a resolution.

**Build:**
- Update `apps/mobile/components/ConflictSheet.tsx` to accept `profile: UserProfile` prop
- For each conflict, call `generateConflictOptions(conflict, profile)` from `packages/core/src/conflicts.ts`
- Render 2 option cards (e.g., "Shortened wind-down" vs. "Full wind-down, fewer cycles") using the existing `ConflictOption` type from `packages/types/src/index.ts`
- On selection, pass `adjustedPlan: CycleWindow` back via `onResolve(option: ConflictOption)` callback
- `apps/mobile/app/index.tsx` receives the selected option and rebuilds the day plan with the adjusted cycle window

**Types already defined:**
```typescript
// packages/types/src/index.ts
interface ConflictOption {
  label: string;
  description: string;
  adjustedPlan: CycleWindow;
}
```

### 2. Weekly View Screen

**Build:**
- New screen: `apps/mobile/app/weekly.tsx`
- Displays a 7-day grid showing cycle counts per night from `loadWeekHistory()` in `apps/mobile/lib/storage.ts`
- Running total vs. `profile.weeklyTarget` (default 35)
- Visual: filled circles (completed cycles) vs. empty circles (remaining to target)
- Navigation from home screen via a "Weekly" tab or button
- Read-only in V1 (no editing past records from this screen)

### 3. Streaks System

**Build:**
- New storage keys in `apps/mobile/lib/storage.ts`:
  - `@r90:streaks:v1` — persisted streak state
- New file: `packages/core/src/streaks.ts`
- Three streak types:
  - **Anchor streak** — consecutive days waking within +/- 30 min of anchor time (based on `NightRecord.actualWakeTime`)
  - **Ideal night streak** — consecutive nights hitting `idealCyclesPerNight` (based on `NightRecord.cyclesCompleted`)
  - **CRP streak** — consecutive days completing CRP when in yellow/orange zone (based on `CRPRecord` in storage)
- New types in `packages/types/src/index.ts`:
  ```typescript
  interface StreakState {
    anchorStreak: number;
    idealNightStreak: number;
    crpStreak: number;
    longestAnchorStreak: number;
    longestIdealNightStreak: number;
    longestCrpStreak: number;
    lastUpdated: DateString;
  }
  ```
- Streak display on home screen (small card below readiness indicator)
- Streak calculation runs on each night log and CRP completion

### 4. Push Notification Foundation

**Build:**
- Install `expo-notifications` in `apps/mobile`
- New file: `apps/mobile/lib/notifications.ts`
- Three local notification types (no server required):
  - **Anchor reminder** — fires at anchor time ("Time to get up. Protect your anchor.")
  - **Pre-sleep reminder** — fires at `cycleWindow.preSleepStart` ("Start your pre-sleep routine.")
  - **CRP reminder** — fires at 13:00 when zone is yellow/orange ("CRP window open. 30 minutes for your recovery.")
- Schedule notifications after each day plan build in `useDayPlan()`
- Cancel and reschedule when plan changes (post-event, conflict resolution)
- Permission request on first schedule attempt
- All notifications are local — no push token, no server, no APNs/FCM

### 5. AI Data Contracts (Types Only)

**Build:**
- New types in `packages/types/src/index.ts`:
  ```typescript
  interface SleepPattern {
    userId: string;           // local device ID
    weekHistory: NightRecord[];
    crpHistory: CRPRecord[];
    streaks: StreakState;
    conflictResolutions: ConflictResolutionEvent[];
    postEventHistory: PostEventRecord[];
  }

  interface ConflictResolutionEvent {
    date: DateString;
    conflict: Conflict;
    chosenOption: ConflictOption;
    timestamp: number;
  }

  interface PostEventRecord {
    date: DateString;
    eventType: 'physical' | 'mental' | 'social';
    eventEndTime: MinuteOfDay;
    adjustedCycleCount: number;
    timestamp: number;
  }

  interface AIInsight {
    type: 'pattern' | 'recommendation' | 'anomaly';
    confidence: number;        // 0-1, always 1.0 for deterministic fallbacks in V1
    message: string;
    dataPoints: string[];      // references to supporting data
    generatedBy: 'deterministic' | 'ml_model';
  }
  ```
- These types are contracts only. No ML models run in V1. Every function that would return `AIInsight` returns a deterministic fallback (e.g., "You've hit 4+ anchor days in a row" is a pattern insight with `generatedBy: 'deterministic'`).

### 6. Telemetry Logging Layer

**Build:**
- New file: `apps/mobile/lib/telemetry.ts`
- Local-first event logging to AsyncStorage key `@r90:telemetry:v1`
- Event types:
  ```typescript
  type TelemetryEvent =
    | { type: 'plan_viewed'; date: DateString; timestamp: number }
    | { type: 'night_logged'; date: DateString; cycles: number; timestamp: number }
    | { type: 'crp_completed'; date: DateString; duration: 30 | 90; timestamp: number }
    | { type: 'conflict_resolved'; date: DateString; option: string; timestamp: number }
    | { type: 'post_event_triggered'; date: DateString; eventType: string; timestamp: number }
    | { type: 'notification_received'; notificationType: string; timestamp: number }
    | { type: 'streak_milestone'; streakType: string; count: number; timestamp: number };
  ```
- Privacy-safe: no PII, no location, no device identifiers beyond a random local UUID
- Circular buffer: keep last 90 days, prune on write
- Export function for future cloud sync (V2): `exportTelemetry(): TelemetryEvent[]`

### 7. Settings Screen

**Build:**
- New screen: `apps/mobile/app/settings.tsx`
- Edit anchor time (time picker, same as onboarding) — calls `saveProfile()` in `apps/mobile/lib/storage.ts`
- Edit chronotype (3-option selector)
- View current profile summary
- "Reset All Data" button — calls `clearAllStorage()` from `apps/mobile/lib/storage.ts`, navigates to onboarding
- Accessible from home screen header (gear icon)

### 8. Day Plan Auto-Refresh

**Problem:** `useDayPlan()` in `apps/mobile/lib/use-day-plan.ts` only runs once (guarded by `hasFetched.current`). If the user leaves and returns, the plan is stale.

**Build:**
- Add `AppState` listener in `useDayPlan()`: on `active` state change, re-run `loadPlan()`
- Remove or reset `hasFetched` guard when app returns to foreground
- Debounce to avoid rapid re-computation (300ms)
- After post-event confirmation in `apps/mobile/app/index.tsx`, trigger plan rebuild (currently logs to console only: `console.log('Post-event triggered:', eventEndTime)`)

### 9. Post-Event Improvements

**Problem:** `PostEventSheet.tsx` has no event-type selection. All late events are treated identically. This blocks future pattern learning.

**Build:**
- Add event-type picker to `apps/mobile/components/PostEventSheet.tsx`: three options — Physical (match, gym, race), Mental (work deadline, exam), Social (dinner, concert, party)
- Store selection in `PostEventRecord` type (see AI Data Contracts above)
- Pass event type through `onConfirm` callback: `onConfirm(eventEndTime: number, eventType: 'physical' | 'mental' | 'social')`
- Log to telemetry
- No behavior change in V1 based on event type (all use same `calculatePostEventWindow()`). The data is collected for V2 pattern learning.

---

## OUT of Scope (V1)

| Feature | Deferred To | Reason |
|---|---|---|
| Wearable integration (Whoop / Oura / Apple Watch) | V2 | Requires HealthKit bridge, device-specific APIs, data normalization. Massive scope. |
| Recovery Room Audit (7-step questionnaire) | V2 | Self-contained pillar, no dependency on V1 features. Ship separately. |
| Travel Mode (pre-departure shifting, light exposure) | V2 | Requires timezone API, multi-day planning engine. |
| Badge system (beginner to legend) | V2 | Streaks are the prerequisite. Ship streaks in V1, add badge tiers in V2. |
| LLM-powered R-Lo | V2+ | Requires backend, API keys, prompt engineering. V1 R-Lo is deterministic and sufficient. |
| Backend / cloud sync | V2 | V1 is local-only. Cloud sync requires auth, conflict resolution, GDPR compliance. |
| Multi-language support | V2+ | V1 ships in English. Internationalization is a full-app pass. |
| Light Hunter mini-game | V2+ | Part of Recovery Room Audit pillar. Fun but not essential. |
| App Store public launch | V2 | V1 ships to TestFlight only. Public launch requires polish, legal, ASO. |
| ML pattern learning models | V2+ | V1 collects data and defines interfaces. V2 runs models. |

---

## What Remains from Phase D/E/F (MVP)

These items were planned in `docs/MVP_EXECUTION_PLAN_v1.md` but are not yet complete:

### Phase E: Manual Device Testing (Needs Execution)

The testing protocol exists at `docs/TESTING_PROTOCOL.md` but has not been executed:

- **E3**: Full-day test #1 with default profile (anchor 06:30) — protocol written (7 steps), results table empty
- **E4**: Full-day test #2 with PMer profile (anchor 08:00) — protocol written (3 steps), results table empty
- **E5**: Bug log — currently shows "No bugs at time of writing"
- **Sign-off checklist** — all items unchecked:
  - E2 automated scenarios pass (17/17 as of last run)
  - E3 full-day test completed
  - E4 PMer test completed
  - E5 bugs fixed
  - E6 R-Lo audit passed (DONE)
  - E7 docs updated
  - E8 README updated

### Phase F: EAS Build + TestFlight (Not Started)

Per `docs/MVP_EXECUTION_PLAN_v1.md` tasks F1-F6:
- `eas.json` not yet created
- `app.json` version not set to 0.1.0
- No EAS Build has been run
- No TestFlight submission
- No `RELEASE_NOTES_v0.1.md`

### Known Code Issues Carried Into V1

1. **ConflictSheet shows info only, no 2-option picker**
   - File: `apps/mobile/components/ConflictSheet.tsx`
   - Current: Shows conflict description + "Got It" / "Dismiss" buttons
   - Missing: Does not call `generateConflictOptions()`, does not present `ConflictOption[]` choices
   - MVP plan (D6/D7) called for this but it was not implemented

2. **PostEventSheet confirm does not update live day plan**
   - File: `apps/mobile/app/index.tsx` lines 104-106
   - Current: `onConfirm` callback logs to console only: `console.log('Post-event triggered:', eventEndTime)`
   - Missing: Does not call `buildDayPlan()` with the post-event window or update `dayPlan` state

3. **CRP completion does not add to weekly cycle count**
   - Open assumption A03 in `docs/OPEN_ASSUMPTIONS.md`
   - Book says CRP counts toward weekly total regardless of duration (30 or 90 min)
   - Code in `apps/mobile/components/CRPCard.tsx` saves a `CRPRecord` but `computeReadiness()` in `packages/core/src/readiness.ts` only reads `NightRecord.cyclesCompleted`
   - Blocked on Nick validation: does 1 CRP = 1 cycle toward weekly 35?

4. **useDayPlan does not re-run after post-event confirmation**
   - File: `apps/mobile/lib/use-day-plan.ts`
   - `hasFetched` ref guard (line 23) prevents re-computation
   - No `AppState` listener for foreground return
   - No imperative `refresh()` function exposed to callers

---

## "No Bullshit" Constraints

### Resources
- **1 developer, 10 weeks.** No team scaling. No contractor handoff. Every line of code is written and tested by one person.

### Architecture
- **No backend in V1.** All storage is `AsyncStorage` via `apps/mobile/lib/storage.ts`. Keys are versioned (`@r90:profile:v1`, `@r90:weekHistory:v1`, etc.) for future migration. No REST API, no Firebase, no Supabase.
- **No ML models in V1.** The `AIInsight` interface exists. The `SleepPattern` data structure exists. Every function that would return an AI-generated insight returns a deterministic fallback with `generatedBy: 'deterministic'` and `confidence: 1.0`.
- **Wearable data is V2.** Do not install `react-native-health`, do not build HealthKit bridges, do not add Whoop/Oura OAuth flows. The `ReadinessState` type (in `packages/types/src/index.ts`) does not include a `wearableSignals` field until V2.

### Sequencing
- **Ship streaks before badges.** Streaks are 3 counters stored in AsyncStorage. Badges require tier definitions, unlock logic, visual assets, and a badge gallery screen. Streaks ship in V1; badges ship in V2.
- **Push notifications must work without a server.** Use `expo-notifications` local scheduling only. No push tokens, no APNs certificates for remote push, no notification server. Three notification types: anchor reminder, pre-sleep reminder, CRP reminder. All scheduled locally from `useDayPlan()` output.
- **Every AI interface must have a deterministic fallback that works today.** If we define `getPatternInsight(): AIInsight`, there must be a working implementation that returns a rule-based insight (e.g., "3 days at anchor in a row") without any ML model. The ML model plugs in later; the app never shows a blank screen.

### Shipping
- **V1 ships to TestFlight, not the App Store.** The audience is Nick + 5-10 testers. No ASO, no screenshots, no App Store review process.
- **Phase E testing must be executed before V1 features are built.** The MVP has untested code paths (E3/E4/E5). Fix those bugs first, then build V1 features on a stable foundation.

---

*This document is the single source of truth for what V1 includes. If it is not listed in "IN Scope," it is not in V1.*
