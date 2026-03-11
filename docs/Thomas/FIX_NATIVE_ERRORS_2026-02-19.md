# Fix Report — Native Runtime Errors — 2026-02-19

**Branch:** `chore/expo-upgrade`
**Outcome:** TypeScript **EXIT:0** · Scenario tests **26/26 PASS**

Three runtime symptoms, two independent root causes.

---

## Symptoms

```
ERROR  Cannot find native module 'ExponentAV'
ERROR  TypeError: Cannot read property 'ErrorBoundary' of undefined (RootErrorBoundary)
LOG    [profile] missing → redirect to onboarding   ← repeated many times
```

---

## Root Cause Analysis

### Error 1 — `Cannot find native module 'ExponentAV'`

**Cause:** With `newArchEnabled: true`, `requireNativeModule('ExponentAV')` is called
synchronously when the `expo-av` JS module is first imported. If the native
`ExponentAV` module is absent from the running binary (Expo Go, or a dev-client build
that pre-dates the `expo-av` install), this throws immediately at module load time.

`onboarding.tsx` had a static top-level import:
```ts
import { Audio } from 'expo-av'; // line 34 — OLD
```
This caused the entire `onboarding` route module to fail to initialize.

**Fix:** Replaced with a dynamic import inside the `startMusic()` async function, which
is already wrapped in a `try { } catch { }` block:
```ts
const { Audio } = await import('expo-av'); // inside startMusic() try-catch
```
If the native module is absent, `import('expo-av')` throws inside the catch block and
audio silently does not start — onboarding continues normally.

The `soundRef` type was changed from `Audio.Sound | null` to a minimal `AVSound`
interface (declared locally) so no static type dependency on expo-av remains:
```ts
interface AVSound {
  stopAsync(): Promise<unknown>;
  unloadAsync(): Promise<unknown>;
  setVolumeAsync(v: number): Promise<unknown>;
}
```

### Error 2 — `TypeError: Cannot read property 'ErrorBoundary' of undefined`

**Cause:** CASCADE from Error 1. When `onboarding.tsx` fails to initialize, Expo Router
receives `undefined` when it tries to load the `/onboarding` route module. It then
accesses `undefinedModule.ErrorBoundary` internally, producing this second error.

**Fix:** Fixing Error 1 resolves this error entirely. The `RootErrorBoundary` class
component in `_layout.tsx` is structurally correct and required no changes.

### Error 3 — `[profile] missing → redirect to onboarding` log spam

**Cause:** Two compounding factors:

1. `storage.ts → loadProfile()` emitted `console.log('[profile] missing → redirect to
   onboarding')` on every call that found no stored profile. This is a normal expected
   state (first install, after reset). The message was misleading (the function has no
   knowledge of routing) and verbose.

2. `use-day-plan.ts → loadPlan()` emits the same message AND registers an `AppState`
   listener that calls `loadPlan(false, true)` every time the app comes to the
   foreground. On a fresh install (no profile), this fires on every foreground event,
   producing repeated logs.

**Fix:** Removed all verbose informational logs that fire in the normal "no profile"
path. Error-level logs (invalid stored data, storage failure) are retained.

---

## Files Changed

### `apps/mobile/app/onboarding.tsx`

- **Removed** `import { Audio } from 'expo-av';` (static top-level import)
- **Added** `AVSound` minimal interface (local, no expo-av dependency)
- **Changed** `soundRef` type: `Audio.Sound | null` → `AVSound | null`
- **Added** `const { Audio } = await import('expo-av');` inside `startMusic()` try-catch

### `apps/mobile/lib/storage.ts`

- **Removed** `console.log('[profile] missing → redirect to onboarding')` from
  `loadProfile()` — this fires in the normal first-install path
- **Removed** `console.log('[profile] loaded ok')` from `loadProfile()` — debug noise

### `apps/mobile/lib/use-day-plan.ts`

- **Removed** `console.log('[useDayPlan] profile missing → redirect to onboarding')`
  — same normal path, redundant with the state change
- **Removed** `console.log("[useDayPlan] app foregrounded → silent plan refresh")`
  — fires on every foreground event, debug noise

---

## Rebuild Requirement

The `ExponentAV` native module must be present in the running binary for audio to
work at runtime. The dynamic import guards against a crash when it is absent, but
audio will only actually play on a build that includes `expo-av`.

**To get a working build with audio:**

```bash
# EAS development build (recommended):
eas build --profile development --platform android
eas build --profile development --platform ios

# Or local build:
cd apps/mobile
npx expo run:android
npx expo run:ios
```

`expo-av ~16.0.8` is declared in `apps/mobile/package.json` and listed in no
`app.json` plugins (it links automatically via autolinking). EAS Build will include
the native module. **Expo Go will not** — audio silently skips, which is correct
behavior (no crash).

---

## Validation Summary

| Check | Result |
|-------|--------|
| `npx tsc --project apps/mobile/tsconfig.json --noEmit` | **EXIT:0** |
| `npm test` (26 scenarios) | **26/26 PASS** |
| Static `import { Audio }` removed from `onboarding.tsx` | **Verified** |
| Dynamic `import('expo-av')` inside try-catch | **Verified** |
| Verbose profile logs removed from `storage.ts` | **Verified** |
| Verbose logs removed from `use-day-plan.ts` | **Verified** |
| `RootErrorBoundary` in `_layout.tsx` structurally correct | **No changes needed** |
