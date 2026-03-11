# Fix Report — 2026-02-19

All P0 and P1 issues from `docs/APP_AUDIT_REPORT.md` have been resolved.
TypeScript: **EXIT:0**. Scenario tests: **25/25 PASS**.

---

## P0 Fixes (Build-breaking / Crash / Wrong Data)

### P0-1 — Native modules in wrong package.json
**Files:** `package.json` (root), `apps/mobile/package.json`

Removed `expo-av ~16.0.8`, `expo-haptics ~15.0.8`, `expo-linear-gradient ~15.0.8`,
`expo-splash-screen ~31.0.13` from the root `dependencies` block (root `package.json`
now has zero `dependencies`). Added the three missing ones (`expo-av`, `expo-haptics`,
`expo-splash-screen`) alongside the existing `expo-linear-gradient` in
`apps/mobile/package.json`. EAS autolinking requires native modules to live in the
app's own `package.json`.

### P0-2 — LinearGradient duplicate warning
Resolved as a side-effect of P0-1: `expo-linear-gradient` is now declared only in
`apps/mobile/package.json`; the duplicate root declaration is gone.

### P0-3 — `clearAllStorage()` incomplete
**File:** `apps/mobile/lib/storage.ts`

`clearAllStorage()` previously cleared only `PROFILE`, `WEEK_HISTORY`, `CRP_RECORDS`.
It now clears **all** versioned storage keys (`VERSION`, `PROFILE`, `WEEK_HISTORY`,
`CRP_RECORDS`, `USAGE`, `ONBOARDING`, `ACQUISITION`) plus the three permission keys
that live outside `STORAGE_KEYS` in `lib/permissions.ts`
(`@r90:permissionsPromptShown:v1`, `@r90:permissions:calendar`,
`@r90:permissions:notifications`).

### P0-4 — `morningAction()` reads wrong history index
**File:** `packages/core/src/actions.ts`

`weekHistory[weekHistory.length - 1]` returned the **oldest** night because history
is sorted newest-first. Fixed to `weekHistory[0]`. The displayed cycle count on the
morning card now reflects last night's actual cycles.

### P0-5 — AppState foreground refresh triggers OS permission dialog
**File:** `apps/mobile/lib/use-day-plan.ts`

`loadPlan()` accepted an `isBackground` flag (default `false`). The AppState
`"active"` handler now calls `loadPlan(false, true)`. When `isBackground === true`,
the code uses `fetchTodayEvents()` (checks permission silently, returns `[]` if
denied) instead of `fetchEventsWithPermission()` (which can request permission and
show the OS dialog). The initial mount and manual `refreshPlan()` still use
`fetchEventsWithPermission()` so first-launch permission flow is unaffected.

### P0-6 — Home "Ask Airloop" send button dead
**File:** `apps/mobile/app/(tabs)/index.tsx`

Imported `useChatContext` and called `openChat()` in the send button's `onPress`.
The input text is cleared after opening chat. The button now also has proper
`accessibilityRole` and `accessibilityLabel`.

### P0-7 — `profile: any` type
**File:** `apps/mobile/app/(tabs)/index.tsx`

Changed `useState<any>(null)` to `useState<UserProfile | null>(null)`. Added
`UserProfile` to the `@r90/types` import. The redundant `loadProfile()` call that
loaded data already in `DayPlanContext` is unchanged (still needed for the
`PostEventSheet` prop) but now properly typed.

---

## P1 Fixes (Reliability / Cleanliness)

### P1-8 — Double redirect guard in `index.tsx`
**File:** `apps/mobile/app/(tabs)/index.tsx`

Added `hasRedirected` ref. The `needsOnboarding` effect now checks
`!hasRedirected.current` before redirecting and sets it to `true` immediately.
Added `router` to the effect dependency array.

### P1-9 — `generateConflictOptions()` empty for sleep_cycle conflicts
**File:** `packages/core/src/conflicts.ts`

Added a `sleep_cycle` branch: returns one option ("Later bedtime — drop 1 cycle")
via `calculateCycleWindow(profile, idealCyclesPerNight - 1)`. `down_period` conflicts
have no adjustable engine options (post-event block is locked); the existing
`ConflictCard` fallback message handles them gracefully.

### P1-10 — Privacy logs (calendar titles, profile fields)
**Files:** `apps/mobile/lib/calendar.ts`, `apps/mobile/lib/storage.ts`

- Removed event title from the calendar fetch log: changed to
  `"Fetched N events for today (titles omitted)"`.
- Removed `anchorTime` and `chronotype` values from the profile load log: changed
  to `"[profile] loaded ok"`.

### P1-11 — No root-level Error Boundary
**File:** `apps/mobile/app/_layout.tsx`

Added `RootErrorBoundary` class component (`Component<{children}, {hasError}>`)
above `RootLayout`. On error it shows a minimal dark-themed fallback screen with
a "Try again" button that resets `hasError`. `RootLayout` is now a thin shell that
wraps `RootLayoutInner` with `<RootErrorBoundary>`.

### P1-12 — Sequential calendar fetch (N round-trips)
**File:** `apps/mobile/lib/calendar.ts`

Replaced the `for…await` loop over calendars with `Promise.allSettled(calendars.map(...))`.
All calendar fetches now run in parallel. Individual calendar failures are still
handled gracefully (the settled result is skipped with a `console.warn`).

### P1-13 — Duplicate banner components
**Files deleted:** `apps/mobile/components/AirloopAdviceBanner.tsx`,
`apps/mobile/components/RloAdviceBanner.tsx`

Neither file was imported anywhere in `app/`. The single canonical banner is
`BottomAdviceBanner.tsx` (used in `calendar.tsx`). The two unused drafts have
been removed.

### P1-14 — S06/S07 vacuous tests
**File:** `packages/tests/src/scenarios.ts`

S06 and S07 previously had only `readinessZone` assertions (S06 had been partially
fixed; originally both had zero assertions). Both now include `cycleWindow`
assertions that verify the post-event adrenaline-clearance logic:
- **S06** (event ends 22:00): `{ bedtime: 30, wakeTime: 390, cycleCount: 4 }`
- **S07** (event ends midnight): `{ bedtime: 120, wakeTime: 390, cycleCount: 3 }`

All 25 scenario tests pass.

---

## Verification

```
npx tsc --project apps/mobile/tsconfig.json --noEmit  →  EXIT:0
npm test                                               →  25/25 PASS
```
