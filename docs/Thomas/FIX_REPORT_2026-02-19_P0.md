# P0 Fix Report — 2026-02-19 (second pass)

**Branch:** `chore/expo-upgrade`
**Outcome:** TypeScript **EXIT:0** · Scenario tests **26/26 PASS**

This document covers the P0 items from `docs/APP_AUDIT_REPORT.md` as specified in the
second-pass brief. Each issue is evaluated against the current codebase;
already-resolved items are stated with evidence.

---

## P0-1 — Native modules in `apps/mobile/package.json`

**Status: ALREADY FIXED** (fixed in first pass, `docs/FIX_REPORT_2026-02-19.md`)

**Evidence:**
```json
// apps/mobile/package.json — all four native modules present:
"expo-av": "~16.0.8",
"expo-haptics": "~15.0.8",
"expo-linear-gradient": "~15.0.8",
"expo-splash-screen": "~31.0.13",
```
Root `package.json` has no `dependencies` block — zero native modules at the
workspace root. EAS autolinking will resolve from `apps/mobile/node_modules` (or
the workspace-hoisted copy, which is the same package).

**How to test:**
```bash
cd apps/mobile && npx expo install --check
# Should report 0 mismatched packages for the four listed modules.
```

---

## P0-2 — `clearAllStorage()` must clear ALL app keys

**Status: IMPROVED** — coverage was complete in first pass; this pass adds a
single-source-of-truth constant to prevent future drift.

### Root cause (pre-fix)
The first-pass fix hardcoded all key strings directly inside `clearAllStorage()`.
The permission keys from `lib/permissions.ts` were duplicated as raw strings
(`'@r90:permissionsPromptShown:v1'` etc.) in two places, creating a drift risk: if
a developer added a new key in `permissions.ts` they could easily forget to update
`clearAllStorage()`.

### Fix applied
**Files changed:**
- `apps/mobile/lib/storage.ts`
- `apps/mobile/lib/permissions.ts`

**`storage.ts` changes:**
1. Added `PERMISSION_KEYS` export — the single authoritative definition of all
   permission-layer storage keys:
   ```ts
   export const PERMISSION_KEYS = {
     PROMPT_SHOWN:  '@r90:permissionsPromptShown:v1',
     CALENDAR:      '@r90:permissions:calendar',
     NOTIFICATIONS: '@r90:permissions:notifications',
   } as const;
   ```
2. Added `ALL_STORAGE_KEYS` export — a flat array derived from both key maps:
   ```ts
   export const ALL_STORAGE_KEYS: readonly string[] = [
     ...Object.values(STORAGE_KEYS),
     ...Object.values(PERMISSION_KEYS),
   ] as const;
   ```
3. `clearAllStorage()` now uses `ALL_STORAGE_KEYS`:
   ```ts
   await AsyncStorage.multiRemove([...ALL_STORAGE_KEYS]);
   ```

**`permissions.ts` changes:**
- Removed the local `const KEYS = { ... }` definition.
- Imports `PERMISSION_KEYS` from `./storage` and aliases it as `KEYS` for internal
  use. No external API changed.

**Keys cleared (10 total):**
| Key | Module |
|-----|--------|
| `@r90:version` | STORAGE_KEYS.VERSION |
| `@r90:profile:v1` | STORAGE_KEYS.PROFILE |
| `@r90:weekHistory:v1` | STORAGE_KEYS.WEEK_HISTORY |
| `@r90:crpRecords:v1` | STORAGE_KEYS.CRP_RECORDS |
| `@r90:usage:v1` | STORAGE_KEYS.USAGE |
| `@r90:onboarding:v1` | STORAGE_KEYS.ONBOARDING |
| `@r90:acquisitionSource:v1` | STORAGE_KEYS.ACQUISITION |
| `@r90:permissionsPromptShown:v1` | PERMISSION_KEYS.PROMPT_SHOWN |
| `@r90:permissions:calendar` | PERMISSION_KEYS.CALENDAR |
| `@r90:permissions:notifications` | PERMISSION_KEYS.NOTIFICATIONS |

**How to test (manual):**
1. Complete onboarding; grant calendar + notification permissions.
2. In Profile → Settings → "Reset data", tap confirm.
3. Force-quit the app and relaunch.
4. App should show onboarding (profile cleared) with no "permissions already shown" gate.
5. Calendar permission request should appear again (permission flag cleared).

**How to test (automated):**
```bash
# Verify all 10 keys are present in ALL_STORAGE_KEYS
node -e "
const { STORAGE_KEYS, PERMISSION_KEYS, ALL_STORAGE_KEYS } = require('./apps/mobile/lib/storage');
console.log('STORAGE_KEYS count:', Object.keys(STORAGE_KEYS).length);
console.log('PERMISSION_KEYS count:', Object.keys(PERMISSION_KEYS).length);
console.log('ALL_STORAGE_KEYS count:', ALL_STORAGE_KEYS.length);
console.log(ALL_STORAGE_KEYS);
"
```
_(Note: requires ts-node or tsx since the file is TypeScript; the counts should be
7 + 3 = 10.)_

---

## P0-3 — `morningAction()` reads wrong history index

**Status: ALREADY FIXED** (fixed in first pass, `docs/FIX_REPORT_2026-02-19.md`)

**Evidence:**
```ts
// packages/core/src/actions.ts, morningAction():
const lastNight = ctx.weekHistory[0]; // history is newest-first (sorted desc by date)
```

### Regression test added (this pass)

**Root cause of regression risk:** The test harness had no assertion that checked
the action's *title text*, so the bug could silently re-appear even with existing
test coverage.

**Files changed:**
- `packages/types/src/index.ts` — Added `nextActionTitleContains?: string` to
  `ScenarioExpectation`
- `packages/tests/src/run-scenarios.ts` — Added assertion block for
  `nextActionTitleContains`
- `packages/tests/src/scenarios.ts` — Added **S26**

**S26 scenario spec:**
```ts
// Two nights in history: index 0 = 5 cycles (most recent), index 1 = 3 cycles (older)
// Morning time (07:00) → morningAction() runs
// Yellow zone (avg 4.0) → general_guidance branch (not take_crp)
// Bug would produce: "3 cycles last night"  (weekHistory[length-1])
// Fix produces:      "5 cycles last night"  (weekHistory[0])
weekHistory: [
  nightRecord("2026-02-16", 5), // newest
  nightRecord("2026-02-15", 3), // older
],
expected: {
  nextActionTitleContains: "5 cycles",
}
```

**Verification:** Temporarily reverting `weekHistory[0]` back to
`weekHistory[weekHistory.length - 1]` causes S26 to fail.

**How to test:**
```bash
npm test
# S26 must PASS; would FAIL with the old index bug.
```

---

## P0-4 — Foreground silent refresh must never prompt for calendar permission

**Status: ALREADY FIXED** (fixed in first pass, `docs/FIX_REPORT_2026-02-19.md`)

**Evidence:**
```ts
// apps/mobile/lib/use-day-plan.ts — loadPlan signature:
const loadPlan = useCallback(async (isInitial: boolean, isBackground = false) => {
  ...
  const calendarEvents = isBackground
    ? await fetchTodayEvents()           // checks permission, returns [] if denied
    : await fetchEventsWithPermission(); // may request permission (onboarding only)
  ...
}, []);

// AppState handler:
if (nextState === "active") {
  loadPlan(false, true); // isBackground = true → fetchTodayEvents(), no OS prompt
}
```

`fetchTodayEvents()` in `lib/calendar.ts` calls `hasCalendarPermission()` and returns
`[]` if not granted. It never calls `requestCalendarPermissionsAsync()`.

**How to test (manual):**
1. Install app on device; deny calendar permission when prompted during onboarding.
2. Use the app normally; background it and foreground it multiple times.
3. The OS calendar permission dialog should **never** reappear.

---

## P0-5 — Home "Ask Airloop" send button must not be dead UI

**Status: ALREADY FIXED** (fixed in first pass, `docs/FIX_REPORT_2026-02-19.md`)

**Evidence:**
```tsx
// apps/mobile/app/(tabs)/index.tsx
const { openChat } = useChatContext();
...
<Pressable
  style={styles.sendBtn}
  onPress={() => { openChat(); setInputText(""); }}
  accessibilityRole="button"
  accessibilityLabel="Send message to Airloop"
>
```

**How to test (manual):**
1. Open the Home tab.
2. Tap the `↑` send button in the "Ask Airloop" input row.
3. The Airloop chat bottom sheet must open.

---

## P0-6 — Remove `profile: any` type hole

**Status: ALREADY FIXED** (fixed in first pass, `docs/FIX_REPORT_2026-02-19.md`)

**Evidence:**
```tsx
// apps/mobile/app/(tabs)/index.tsx
const [profile, setProfile] = useState<UserProfile | null>(null);
```

**How to test:**
```bash
npx tsc --project apps/mobile/tsconfig.json --noEmit
# Must exit 0 with no "any" errors.
```

---

## P0-7 — Android icon/splash correctness for dev builds

**Status: FIXED in this pass**

### Root cause
Three distinct issues:

1. **`expo-splash-screen` not in `app.json` plugins** — `expo prebuild` (used by EAS
   Build) reads the `plugins` array to configure native modules. Without this entry,
   the Android splash screen is not regenerated from the `splash` config block when
   `expo prebuild` runs. The existing native `android/` directory was built without
   this plugin entry, so the splash was not generated from `ecran4.png`.

2. **`expo-dev-client` not in `app.json` plugins** — `eas.json` declares
   `"developmentClient": true` for the `development` build profile, which requires
   `expo-dev-client` to be listed in plugins for proper native linking during EAS
   development builds.

3. **Android `colors.xml` `splashscreen_background: #FFFFFF`** — The splash background
   color was white, causing a white flash on Android before the `AppSplash` component
   rendered. This color is used by the `expo-splash-screen` native module and by any
   future `expo prebuild` run.

4. **`Theme.App.SplashScreen` referenced `@drawable/ic_launcher_background`** —
   This is the adaptive icon background drawable (a solid `#0A0A0A` XML), not the
   standard `expo-splash-screen` pattern. Using `@color/splashscreen_background`
   directly is correct and consistent with what `expo prebuild` generates.

5. **`statusBarColor: #ffffff`** in `AppTheme` — incorrect for a dark-theme app.

### Fix applied

**Files changed:**
- `apps/mobile/app.json`
- `apps/mobile/android/app/src/main/res/values/colors.xml`
- `apps/mobile/android/app/src/main/res/values/styles.xml`

**`app.json` — added two plugins:**
```json
"expo-dev-client",
["expo-splash-screen", {
  "backgroundColor": "#0A0A0A",
  "image": "./assets/images/ecran4.png",
  "resizeMode": "cover"
}]
```

**`colors.xml` — fixed all three color values:**
```xml
<color name="splashscreen_background">#0A0A0A</color>  <!-- was #FFFFFF -->
<color name="colorPrimary">#0A0A0A</color>             <!-- was #023c69 -->
<color name="colorPrimaryDark">#0A0A0A</color>         <!-- was #ffffff -->
```

**`styles.xml` — updated splash theme and status bar:**
```xml
<style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
  ...
  <item name="android:statusBarColor">@color/splashscreen_background</item>  <!-- was #ffffff -->
</style>
<style name="Theme.App.SplashScreen" parent="AppTheme">
  <item name="android:windowBackground">@color/splashscreen_background</item>  <!-- was @drawable/ic_launcher_background -->
</style>
```

### Why `android.package` in `app.json` is "ignored"

`app.json` fields in the `android` block (`package`, `adaptiveIcon`, `splash`, etc.)
are **prebuild configuration** — they're consumed by `expo prebuild` to *generate*
the native `android/` directory. Once the `android/` directory exists, those values
are compiled into the native code and `app.json` has no further effect at build time.

The authoritative sources after prebuild are:
| Config | Native file that controls it |
|--------|------------------------------|
| `android.package` | `android/app/build.gradle` — `applicationId` field |
| `android.adaptiveIcon` | `android/app/src/main/res/mipmap-*/` (webp files) |
| `android.splash` | `android/app/src/main/res/values/styles.xml` + `colors.xml` |
| `android.permissions` | `android/app/src/main/AndroidManifest.xml` |

To regenerate the native directory from `app.json` (e.g. after adding plugins):
```bash
cd apps/mobile && npx expo prebuild --clean
```
⚠️ `--clean` deletes the existing `android/` and `ios/` directories. Commit all
manual native changes first, or apply them again after prebuild.

### How to test

**EAS build:**
```bash
eas build --profile development --platform android
# Should succeed; splash screen should show dark background.
```

**Local dev build (expo-dev-client):**
```bash
cd apps/mobile && npx expo run:android
# App should launch with dark splash, no white flash.
```

**Manual visual check:**
1. Build and install on an Android device or emulator.
2. Launch the app — the initial native splash screen should show a solid `#0A0A0A`
   dark background.
3. The in-app `AppSplash` (with `ecran4.png` + gear rotation) should appear
   seamlessly as JS loads.
4. The launcher icon should show the adaptive icon from `mipmap-*/ic_launcher.webp`.

---

## Validation Summary

| Check | Result |
|-------|--------|
| `npx tsc --project apps/mobile/tsconfig.json --noEmit` | **EXIT:0** |
| `npm test` (26 scenarios) | **26/26 PASS** |
| S26 regression test catches P0-3 re-introduction | **Verified** |
| `ALL_STORAGE_KEYS` covers all 10 `@r90:*` keys | **Verified** |
| `PERMISSION_KEYS` imported in `permissions.ts` (no duplication) | **Verified** |
| `expo-splash-screen` in `app.json` plugins | **Verified** |
| Android `splashscreen_background` = `#0A0A0A` | **Verified** |
| Android `Theme.App.SplashScreen` uses `@color/splashscreen_background` | **Verified** |
