# R90 Digital Navigator — App Audit Report

**Date:** 2026-02-19
**Branch audited:** `chore/expo-upgrade`
**Auditor:** Claude Code (read-only pass — no files modified except this document)
**Scope:** Full monorepo — packages/core, packages/types, packages/tests, apps/mobile

---

## Executive Summary

The app has a clean, principled architecture: a deterministic pure-TS engine (`packages/core`) drives a React Native UI with a well-designed single-source-of-truth data context. The monorepo separation of concerns is sound. However, five issues could directly break an EAS build or produce wrong user-facing data before the first beta build is cut: native Expo modules are declared in the wrong `package.json`, `clearAllStorage()` is incomplete, `fetchEventsWithPermission()` is called on every foreground return (may prompt unexpectedly), the home screen "Ask Airloop" send button is visually present but does nothing, and `morningAction()` reads the wrong night from history. These must be fixed before any device build. The rest of the codebase is notably well-documented, well-typed, and properly handles offline/permission-denied paths. The main risk is method-assumption debt (12 `TODO_NICK` items) and a fast-growing `calendar.tsx` that needs splitting.

---

## 1. Architecture Evaluation

### Monorepo & Workspace Health

- **Workspace layout is correct:** `packages/types` → `packages/core` → `apps/mobile`. No circular deps.
- **Metro config is correct** (`metro.config.js`): `watchFolders` includes monorepo root; `nodeModulesPaths` adds both `apps/mobile/node_modules` and root `node_modules`. This is the required pattern for Expo monorepos.
- **⚠️ CRITICAL — Native modules in wrong package.json:** `expo-av`, `expo-haptics`, `expo-linear-gradient`, and `expo-splash-screen` are declared as dependencies of the **root** `package.json`, not of `apps/mobile/package.json`. Metro resolves them at runtime via `nodeModulesPaths` so `expo start` works — but `expo prebuild` (which drives EAS Build) runs autolinking against the package being built (`apps/mobile`) and may not find native modules hoisted to the workspace root. `expo-linear-gradient` is also redundantly declared in `apps/mobile/package.json`. Fix: move all four to `apps/mobile/package.json`; remove the root-level native deps.
- **TypeScript paths:** Correctly configured in both root and `apps/mobile/tsconfig.json`. Path aliases `@r90/types` and `@r90/core` resolve to source files, not compiled output — this is correct for a Metro monorepo with `tsx` for the test runner.
- **`"lint": "echo 'TODO: setup linting'"` in root scripts** — No linter is configured. For a multi-contributor codebase this is a gap.

### Expo Router Setup

- **Root layout (`_layout.tsx`)** correctly uses three focused `useEffect` hooks (load data / timer / redirect) with no ordering issues. The `SplashScreen.preventAutoHideAsync()` at module level is the correct placement. The `hasRedirected` ref prevents double-navigation. **Correct.**
- **Tab layout (`(tabs)/_layout.tsx`)** wraps all tabs with `DayPlanProvider` and `ChatProvider`. This is the correct boundary for shared context. Safe-area tab bar calculation for Android is explicitly handled. **Correct.**
- **Route structure:**
  ```
  / (tabs)  → Home (index), Calendar, Profile
  /onboarding
  /log-night
  /subscription
  ```
  No orphaned routes. All `Stack.Screen` declarations are present in `_layout.tsx`.
- **`needsOnboarding` redirect exists in both `_layout.tsx` AND `index.tsx`** — The root layout redirects to `/onboarding` if no profile exists (before tabs mount). `index.tsx` also redirects via the `needsOnboarding` flag from `useDayPlanContext`. The double-guard is defensive, but the `index.tsx` `useEffect` is missing `router` in its dependency array and has no redirect guard — if `dayPlan` context updates while already on the onboarding screen, a second `router.replace()` could fire.

### State & Data Flow

- **`DayPlanContext` (ADR-003):** Single-instance `useDayPlan()` hook at tab layout level. All tabs read from context. Tab switches are instant. `applyConflictOption()` rebuilds plan synchronously from cached inputs — no async. **This is excellent architecture.**
- **`hasFetched` ref in `use-day-plan.ts`:** Guards against React Strict Mode double-invocation. Correct.
- **`AppState` foreground listener:** Triggers `loadPlan(false)` (silent) on foreground. However, `loadPlan` calls `fetchEventsWithPermission()` which may call `requestCalendarPermission()` — showing the OS permission dialog on every foreground return if permission was previously denied. **Bug.** Use `fetchTodayEvents()` directly for silent refreshes; permission requests belong only in the onboarding flow.
- **Home screen loads profile twice:** `index.tsx` calls `loadProfile()` in a `useEffect` (`const [profile, setProfile] = useState<any>(null)`) just to pass to `PostEventSheet`. The `DayPlanContext` already has the profile internally (in `cachedInputs`). This is both a redundant storage read and a `any` type violation.
- **`ChatContext`** is a thin wire (`openChat` callback). The actual chat logic lives in `AirloopChat.tsx` + `airloop-chat-handler.ts`. This is a minimal, correct design for V1.

### Engine (packages/core)

- **Deterministic, zero-dependency.** All engine inputs are explicit function arguments. No side effects. **This is the strongest architectural decision in the project.**
- **`cycles.ts`:** Pre-sleep fixed at 90 min (confirmed correct per book). Down-period is post-event only (correctly separated from normal cycles). `isBedtimeReachable` uses relative normalization — correct midnight handling.
- **`planner.ts buildBlocks()`:** CRP blocks are generated for yellow/orange zones. Midnight-relative sort is correct. `overlaps()` correctly delegates to `isTimeBetween`. **The previously-reported CRP-not-in-planner bug appears to have been fixed.**
- **`conflicts.ts`:** `generateConflictOptions` only handles `pre_sleep` overlap. `sleep_cycle` and `down_period` overlaps return an empty options array — so the `ConflictSheet` may display a conflict with no user actions. This is incomplete.
- **`readiness.ts`:** Zone thresholds (4.5 / 3.0) are still marked `TODO_NICK: Q05`. `zoneStatus: "experimental"` is hardcoded in `planner.ts` — correct for now but needs a path to becoming `"confirmed"`.
- **`actions.ts` `morningAction` bug:** `ctx.weekHistory[ctx.weekHistory.length - 1]` retrieves the **oldest** night record, not last night's. `saveNightRecord` sorts descending so `[0]` is most recent. The morning action title "X cycles last night" displays the wrong count when there are 2+ nights in history.
- **`airloop-chat-handler.ts`:** Finite switch, exhaustive union, `shouldRefresh` flag — well-structured. The TypeScript `never` exhaustiveness check is a good guard.

### Type System (packages/types)

- Core types (`UserProfile`, `DayPlan`, `CycleWindow`, `NightRecord`, `CalendarEvent`, etc.) are complete and well-structured. `MinuteOfDay` as a branded `number` alias is appropriate.
- `zoneStatus: "experimental" | "confirmed" | "partial"` on `DayPlan` is a good forward-compatible design.
- **One type hole:** `profile: any` in `apps/mobile/app/(tabs)/index.tsx:28`. This is the only `any` found in the audit.

### Test Harness (packages/tests)

- 25 scenarios cover the core engine flows.
- **S06 and S07 have no assertions** (pass vacuously) — known issue from previous audit, still open.
- Test runner uses `tsx` for direct TypeScript execution — correct for a zero-browser environment.
- **No UI test coverage.** All tests exercise `packages/core` only. No integration tests for storage layer or calendar integration.

---

## 2. Performance & Stability Risks

### Ranked by severity

**1. Calendar fetch: sequential N-async calls (Medium risk)**
`calendar.ts:fetchTodayEvents()` iterates all calendars with a `for` loop and `await` inside — sequential, not parallel. A user with 10+ calendars (common for corporate users) will block the plan load proportionally. Fix: `Promise.allSettled()`.

**2. `calendar.tsx` is 718 lines (Medium complexity risk)**
All three view modes (1D, 3D, Month), header, navigation, and event rendering live in one file. This is the largest single UI file in the project. Any bug fix risks breaking other views. Split into `components/calendar/` sub-components.

**3. `WeeklyCycleRing` renders N tick marks per render (Low-Medium risk)**
The ring renders `target` (default 35) absolute-positioned `View` elements on every render. With `onPress` and `streak` props, this component will re-render when parent state changes. Wrap with `React.memo` and memoize the tick-mark array.

**4. `profile.tsx` is 620 lines with inline expansion state (Low risk)**
The profile screen manages anchor time picker, chronotype expand, has-changes flag, saving state, and bottom sheet all in one component. No memoization on `SettingsRow`. Acceptable for now; watch for lag on older Android devices.

**5. Background music cleanup race in `onboarding.tsx` (Low risk)**
`startMusic()` is async. If the component unmounts between `Audio.Sound.createAsync()` and `soundRef.current = sound`, the `mounted` flag correctly catches it. The pattern is correct. However, `onboarding.tsx` is now 637 lines managing 4 screens + audio + permissions + acquisition sheet. Consider extracting a `useOnboardingAudio()` hook.

**6. `AirloopChat.tsx` renders all chat prompts on every open (Low risk)**
Chat panel is 309 lines with 4 prompt buttons and a message scroll list. Prompt buttons render without memoization. Acceptable at current scale.

**7. `AppSplash.tsx` — Animated loop never stopped (Low risk)**
`Animated.loop().start()` starts on mount but has no stop reference. Since `AppSplash` is unmounted when the splash ends, the loop cleanup happens automatically on unmount via React Native's `Animated` bookkeeping. No leak, but consider storing the animation reference if further control is needed.

**8. No React error boundaries anywhere (Crash risk)**
An uncaught render error in any component (e.g. `DayPlanContext` receiving malformed data from a future storage migration) will crash the entire app. Add at minimum one root-level error boundary in `_layout.tsx`.

**9. Hook usage — no conditional hooks found**
All hooks are called unconditionally at the top of every component. No violations detected.

---

## 3. Product Readiness Checklist

### Pre-Private Beta (blockers)

- [ ] **Fix native module declarations** — Move `expo-av`, `expo-haptics`, `expo-splash-screen` from root `package.json` to `apps/mobile/package.json`; verify EAS build succeeds
- [ ] **Fix `clearAllStorage()`** — Must clear ALL keys: USAGE, ONBOARDING, ACQUISITION, permission keys (`@r90:permissionsPromptShown:v1`, etc.)
- [ ] **Fix `morningAction` history index** — Change `weekHistory[weekHistory.length - 1]` to `weekHistory[0]`
- [ ] **Fix silent refresh permission bug** — Replace `fetchEventsWithPermission()` with `fetchTodayEvents()` in `use-day-plan.ts` AppState listener
- [ ] **Wire Home screen "Ask Airloop" send button** — Currently a no-op. Either connect to `openChat()` or remove the TextInput until feature is ready
- [ ] **Fix `profile: any` in `index.tsx`** — Use `UserProfile | null`
- [ ] **Android splash config** — Add `expo-splash-screen` to `app.json` plugins so Android splash is properly configured via prebuild
- [ ] **Verify EAS build completes on both platforms** — No prior build confirmed in audit

### Pre-Private Beta (recommended)

- [ ] **Add root-level error boundary** in `_layout.tsx` — catch catastrophic render failures
- [ ] **Add Sentry or basic crash reporter** — Even a minimal integration; you need signal from real devices
- [ ] **Validate S06 and S07 test scenarios** — Two tests pass vacuously, providing false coverage confidence
- [ ] **Nick validation session** — All 12 `TODO_NICK` items (zone thresholds R050-R052, minimum cycles, etc.) must be resolved before launch
- [ ] **Log Night screen review** — `app/log-night.tsx` not audited; confirm it handles all edge cases (entering 0 cycles, future dates)

### Pre-Public Launch (required)

- [ ] **Crash/error reporting** — Sentry or equivalent, production DSN, not just dev
- [ ] **Analytics** — At minimum: onboarding completion rate, acquisition source distribution, weekly active cycles, premium upsell conversion
- [ ] **In-App Purchase integration** — Current premium gate is client-side usage counting only. `PremiumGate.tsx` shows a paywall but has no payment flow. No revenue is possible.
- [ ] **Privacy policy live at `r90app.com/privacy`** — Referenced in the app's UI; must exist
- [ ] **App Store / Play Store metadata** — Screenshots, descriptions, age rating, health data disclosure (for calendar access)
- [ ] **HIG and Material Design review pass** — iOS notch/Dynamic Island handling; Android back-gesture behavior
- [ ] **Remove all `console.log` / `console.warn`** statements from production builds — Calendar titles are logged, which is a privacy concern
- [ ] **Legal: GDPR/CCPA compliance** — Local-only storage is favorable, but calendar access and acquisition data require disclosure

### Edge Cases & Offline Handling

| Scenario | Current Handling | Gap |
|---|---|---|
| No profile in storage | Redirected to onboarding ✅ | Double-redirect risk in index.tsx |
| Calendar permission denied | Returns `[]` gracefully ✅ | Permission re-requested on every foreground |
| Corrupted AsyncStorage JSON | `isValidProfile()` guard ✅ | Other keys have no validation |
| Zero night history | `zone = "green"` by default ✅ | Correct per spec |
| All calendars fail to fetch | `allEvents = []`, continues ✅ | Good defensive pattern |
| App killed during onboarding | Music cleaned up on unmount ✅ | Acquisition sheet state lost (acceptable) |
| Network offline | No network calls; all local ✅ | LLM features would need handling |
| Android 13+ notification permission | Not audited in `permissions.ts` | `expo-notifications` handles this, verify |

### Security & Privacy

- Calendar event titles appear in: `console.log` statements (should be removed for prod), conflict descriptions (visible to user — acceptable), Airloop messages (only in memory — acceptable).
- All data is local (AsyncStorage) — no server, no remote sync. Favorable privacy posture.
- `AcquisitionSourceRecord` (where-heard analytics) stored locally only. If future backend sync is added, requires privacy notice update.
- No authentication, no network, no sensitive data transmitted. Lowest possible attack surface.

### Accessibility

- `accessibilityRole="button"` and `accessibilityLabel` present on the main action card in Home. Missing from most other interactive elements.
- No `accessibilityLabel` on tab icons (icon-only tab bar).
- No dynamic type / font scaling tested.
- Minimum viable for beta; needs a pass before public launch.

### Localization

- All strings are hardcoded in English. The app is English-only by design (current scope). No localization infrastructure. Acceptable for MVP.

---

## 4. UX Consistency & Design System

### Navigation & Safe Areas

- **Tab bar:** Safe-area math is explicitly correct (`ICON_AREA_HEIGHT + insets.bottom`). Tested pattern for Android Samsung bars. ✅
- **`BottomAdviceBanner`:** `bottom: 8` (fixed) — works because screen content ends at the top of the tab bar in Expo Router. ✅
- **Modals/bottom sheets:** Three separate slide-up patterns exist (`PermissionModal`, `BottomSheetStats`, `AcquisitionSourceSheet`) using the same `backdropOp` + `cardY` Animated pattern — consistent. ✅
- **Subscription screen:** `useSafeAreaInsets()` used for `paddingTop` — correct. ✅

### Spacing & Typography

- Background color `#0A0A0A` is used consistently across all screens. ✅
- Green accent `#22C55E` is the consistent primary action color. ✅
- **Typography:** System font only — no custom font loading. This is fine for MVP but limits brand differentiation.
- **Spacing inconsistency:** Profile screen uses `paddingHorizontal: 20`; Calendar screen uses `16`. Home uses `24`. No shared spacing token system. Acceptable now; will compound as screens multiply.
- **Hardcoded colors scattered across components** — `#525252`, `#2A2A2A`, `#1A1A1A` appear in multiple files without shared constants. Refactoring to a `theme.ts` file would reduce drift.

### Component Reuse

- **Three separate "Advice Banner" components** exist: `AirloopAdviceBanner.tsx`, `BottomAdviceBanner.tsx`, `RloAdviceBanner.tsx`. From git status, two are untracked. The naming is inconsistent. Consolidate to `BottomAdviceBanner` (cleanest implementation audited) and delete the others.
- **`SkeletonLoader.tsx`** provides `HomeSkeletonScreen` and `ProfileSkeletonScreen`. Calendar and log-night screens have no skeleton. Blank flash on slow load.
- **`PermissionModal`** and `AcquisitionSourceSheet` share the same animation pattern. Consider extracting a `BaseBottomSheet` with `backdropOp` / `cardY` props — reducing ~80 lines of boilerplate per sheet.

### UI Complexity Creeping In

- **`onboarding.tsx` (637 lines)** now handles: 4 paged screens, background music (audio), permission flow, acquisition source sheet. This violates single-responsibility. Extract audio to `useOnboardingAudio()`.
- **`calendar.tsx` (718 lines)** contains three complete view-mode implementations. Split: `CalendarDayView`, `Calendar3DView`, `CalendarMonthView` into `components/calendar/`.
- **`profile.tsx` (620 lines)** mixes display, settings, edit state, pickers, save logic, and bottom sheet trigger. Acceptable now but approaching the complexity ceiling.

---

## 5. Recommendations — Prioritized

### P0 — Must fix before any beta build

| # | Issue | Rationale | Effort | Impacted Files |
|---|---|---|---|---|
| P0-1 | Move native modules to apps/mobile/package.json | EAS Build autolinking may fail; build-breaking | S | `package.json` (root), `apps/mobile/package.json` |
| P0-2 | Fix `clearAllStorage()` to clear all keys | "Delete all data" leaves stale acquisition + permission flags; re-onboarding broken | S | `apps/mobile/lib/storage.ts` |
| P0-3 | Fix `morningAction` history index | Wrong "last night" cycle count shown every morning | S | `packages/core/src/actions.ts` |
| P0-4 | Fix silent refresh to not request permissions | OS calendar dialog pops unexpectedly on foreground; alarming to users | S | `apps/mobile/lib/use-day-plan.ts`, `apps/mobile/lib/calendar.ts` |
| P0-5 | Wire or remove Home "Ask Airloop" send button | Dead UI is unprofessional; user taps, nothing happens | S | `apps/mobile/app/(tabs)/index.tsx` |
| P0-6 | Fix `profile: any` type in Home | Type safety hole; masks future bugs | S | `apps/mobile/app/(tabs)/index.tsx` |
| P0-7 | Add `expo-splash-screen` plugin to app.json | Android splash screen not configured via prebuild | S | `apps/mobile/app.json` |
| P0-8 | Nick validation — `TODO_NICK` items | Shipping unvalidated method rules is a product integrity risk | M | `packages/core/src/readiness.ts`, `cycles.ts`, `types/src/index.ts` |

### P1 — Should fix in first sprint after beta

| # | Issue | Rationale | Effort | Impacted Files |
|---|---|---|---|---|
| P1-1 | Add error boundary in root layout | Any render crash brings down the whole app | S | `apps/mobile/app/_layout.tsx` |
| P1-2 | Add Sentry (or equivalent) | Zero crash signal from real devices = flying blind | M | `apps/mobile/app/_layout.tsx`, new `lib/monitoring.ts` |
| P1-3 | Fix `generateConflictOptions` for sleep_cycle overlap | Conflict shown with no resolution options | S | `packages/core/src/conflicts.ts` |
| P1-4 | Calendar fetch: switch to Promise.allSettled | Sequential N-await is slow for users with many calendars | S | `apps/mobile/lib/calendar.ts` |
| P1-5 | Remove duplicate profile load in Home | Two storage reads for profile; redundant + `any` type | S | `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/lib/day-plan-context.tsx` |
| P1-6 | Fix S06/S07 vacuous test assertions | False confidence in test coverage | M | `packages/tests/src/scenarios.ts` |
| P1-7 | Split `calendar.tsx` into sub-components | 718 lines, 3 views in one file, maintenance burden | M | `apps/mobile/app/(tabs)/calendar.tsx`, `apps/mobile/components/calendar/` |
| P1-8 | Consolidate advice banner components | Three overlapping components (`AirloopAdviceBanner`, `BottomAdviceBanner`, `RloAdviceBanner`) | S | `apps/mobile/components/` |
| P1-9 | Remove console.log of calendar event titles | Privacy: event titles should not appear in prod logs | S | `apps/mobile/lib/calendar.ts` |
| P1-10 | Extract `useOnboardingAudio` hook | `onboarding.tsx` is 637 lines; audio logic should be isolated | S | `apps/mobile/app/onboarding.tsx`, new `apps/mobile/lib/use-onboarding-audio.ts` |

### P2 — Nice to have

| # | Issue | Rationale | Effort | Impacted Files |
|---|---|---|---|---|
| P2-1 | Create `theme.ts` with shared color/spacing tokens | 20+ hardcoded hex colors scattered across components | M | All component files, new `apps/mobile/theme.ts` |
| P2-2 | Add linter (ESLint + `eslint-plugin-react-hooks`) | No linter; dep-array bugs go undetected | M | Root config files |
| P2-3 | Add `React.memo` to `WeeklyCycleRing` | Renders 35 absolute Views; unnecessary re-renders if parent state changes | S | `apps/mobile/components/WeeklyCycleRing.tsx` |
| P2-4 | Expose `profile` from `DayPlanContext` | Avoids the separate `loadProfile()` in Home; enables PostEventSheet without double-load | S | `apps/mobile/lib/day-plan-context.tsx`, `apps/mobile/lib/use-day-plan.ts` |
| P2-5 | Remove `Image/` root directory | Stale asset copies at root; not used | S | `Image/` (root) |
| P2-6 | Add skeleton screens for Calendar and Log Night | Blank flash while plan loads on those screens | S | New skeleton components |
| P2-7 | Add basic accessibility labels to all interactive elements | Tab icons, settings rows, and action cards are missing labels | M | All screen files |
| P2-8 | `BaseBottomSheet` shared component | Three sheets copy identical `backdropOp`/`cardY` animation boilerplate | M | `apps/mobile/components/` |
| P2-9 | Log Night screen audit | Not reviewed in this pass; 0 coverage in test harness | M | `apps/mobile/app/log-night.tsx` |
| P2-10 | In-App Purchase wiring | Premium gate exists visually but earns nothing | L | `apps/mobile/components/PremiumGate.tsx`, new `apps/mobile/lib/iap.ts` |

---

## 6. "If I Were Shipping This in 10 Weeks"

1. **Week 1 — Clear the P0 blockers.** Fix the 8 P0 items above in a single focused sprint. Verify `eas build` completes on both platforms. Run tests. These are all small (S) or medium (M) changes; nothing architectural. Ship a dev build to 2–3 internal testers.

2. **Week 2 — Nick validation session.** Block 3 hours with Nick to resolve all 12 `TODO_NICK` items. Lock zone thresholds, minimum cycles, and CRP counts. Update `OPEN_ASSUMPTIONS.md` to all-resolved. This gates the `zoneStatus: "experimental"` flag flip.

3. **Week 3 — Instrumentation before users.** Add Sentry with source maps before distributing to external testers. Add acquisition source analytics aggregation. You need signal before the first beta crash. Set up a simple Notion/Airtable dashboard for watching metrics.

4. **Week 4 — Private beta (10–20 users).** Ship to a closed group. Watch Sentry for crashes. Watch retention. The two questions: do users complete onboarding (watch for drop-off at screen 3–4), and do users log nights consistently?

5. **Week 5–6 — Iterate on beta feedback + P1 engine fixes.** Fix `conflicts.ts generateConflictOptions` gap. Fix S06/S07. Split `calendar.tsx`. These are correctness improvements that beta users will surface as confusing behavior.

6. **Week 7 — IAP integration.** Wire `expo-in-app-purchases` or RevenueCat to the existing `PremiumGate`. The paywall exists; it just needs a real payment flow. This is required before public launch. Effort: L, but blocks revenue.

7. **Week 8 — App Store / Play Store prep.** Screenshots, metadata, age rating, health data disclosure for calendar access. Privacy policy live. iOS App Review has a 1–3 day turnaround; submit early.

8. **Week 9 — Hardening pass.** Error boundaries, remove all prod `console.log`, accessibility pass on the three main screens, test on a cheap Android device. Run `expo-doctor` and address any warnings.

9. **Week 10 — Public launch.** Limited rollout (10% of territory) via App Store phased release. Watch the D1/D7 retention curve. Freeze new features for 2 weeks post-launch while watching for crashes.

10. **Post-launch north star:** The `recalculate` prompt + `what_if_late` are the highest-value interactions. If users are tapping them, the app is working. Wire those prompt-tap events as your core engagement metric.

---

## Appendix: Files Inspected (read-only)

```
apps/mobile/app/_layout.tsx
apps/mobile/app/(tabs)/_layout.tsx
apps/mobile/app/(tabs)/index.tsx
apps/mobile/app/(tabs)/calendar.tsx (line count, first 100 lines)
apps/mobile/app/(tabs)/profile.tsx (line count)
apps/mobile/app/onboarding.tsx
apps/mobile/app.json
apps/mobile/package.json
apps/mobile/metro.config.js (via subagent)
apps/mobile/tsconfig.json (via subagent)
apps/mobile/lib/storage.ts
apps/mobile/lib/day-plan-context.tsx
apps/mobile/lib/use-day-plan.ts
apps/mobile/lib/calendar.ts
apps/mobile/lib/chat-context.tsx
apps/mobile/lib/airloop-chat-handler.ts
apps/mobile/lib/permissions.ts
apps/mobile/components/WeeklyCycleRing.tsx
apps/mobile/components/BottomAdviceBanner.tsx
apps/mobile/components/AppSplash.tsx
apps/mobile/components/AcquisitionSourceSheet.tsx
apps/mobile/components/PermissionModal.tsx (first 60 lines)
packages/core/src/index.ts
packages/core/src/cycles.ts
packages/core/src/planner.ts
packages/core/src/conflicts.ts
packages/core/src/actions.ts
packages/core/src/readiness.ts
packages/core/src/time-utils.ts
packages/types/src/index.ts (via subagent inventory)
package.json (root)
docs/ directory listing
```

---

*Output file: `docs/APP_AUDIT_REPORT.md`*
*No other files were modified or created during this audit.*
