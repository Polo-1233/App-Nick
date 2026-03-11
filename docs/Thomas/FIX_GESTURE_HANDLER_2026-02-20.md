# Fix Report — Gesture Handler Native Module — 2026-02-20

**Branch:** `chore/expo-upgrade`
**Outcome:** TypeScript **EXIT:0** · Scenario tests **26/26 PASS**

---

## Errors fixed

```
TurboModuleRegistry.getEnforcing(...): 'RNGestureHandlerModule' could not be found
TypeError: Cannot read property 'ErrorBoundary' of undefined
```

---

## Root cause

The second error is a **cascade** — when any module fails to initialize, Expo Router
receives `undefined` for that route module and immediately crashes accessing
`.ErrorBoundary` on it. The underlying cause is the first error.

`RNGestureHandlerModule` is a **native module**. For it to be available at runtime
the module must be:

1. Declared as a JS dependency (`package.json`) → so Metro can bundle it
2. **Compiled into the native binary** (the `.apk` / dev-client installed on device)
3. **Bootstrapped before any React Native code** via `import 'react-native-gesture-handler'`
   in the entry file
4. **Wrapped with `GestureHandlerRootView`** at the outermost React component level

Items 1 was already correct (`react-native-gesture-handler: ~2.28.0` in
`apps/mobile/package.json`). Items 3 and 4 were missing. Item 2 requires a rebuild.

**Why stale dev-client causes this:**
The `android/` directory is pre-built. When `react-native-gesture-handler` was added
to `package.json` AFTER the last EAS build, autolinking had not yet run for that
binary. The installed app does not have the native `RNGestureHandlerModule` compiled
in, so `TurboModuleRegistry.getEnforcing()` throws immediately on boot.

---

## What changed

### 1 — `apps/mobile/index.js` (entry point)

Added `import 'react-native-gesture-handler'` as the **very first import**:

```js
// MUST be the very first import — bootstraps the native gesture handler module
// before any other React Native code runs.
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
```

**Why:** RNGH's JS module registers gesture responders and patches the touch system.
If this import runs after other React Native code starts, some gesture infrastructure
may not be set up in time, especially on New Architecture (`newArchEnabled: true`).

### 2 — `apps/mobile/app/_layout.tsx` (root layout)

Added `GestureHandlerRootView` as the outermost wrapper:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={ghrv.root}>
      <RootErrorBoundary>
        <RootLayoutInner />
      </RootErrorBoundary>
    </GestureHandlerRootView>
  );
}
const ghrv = StyleSheet.create({ root: { flex: 1 } });
```

**Why:** Every `GestureDetector` in the tree must have a `GestureHandlerRootView`
ancestor. Without it, RNGH cannot establish the gesture responder chain and gestures
silently fail or crash. The `style={{ flex: 1 }}` is mandatory — without it the view
collapses to zero height.

This is the outermost component in the Expo Router tree, so all screens (Home,
Calendar, Profile, Onboarding) are covered automatically.

### 3 — No changes to `babel.config.js`

`react-native-reanimated` is not used in this codebase (no `useSharedValue`,
`useAnimatedStyle`, etc.). The `react-native-reanimated/plugin` Babel plugin must
NOT be added unless reanimated is actively used; adding it unnecessarily increases
build time and can cause subtle transform issues.

### 4 — No changes to `apps/mobile/package.json`

`react-native-gesture-handler: ~2.28.0` was already present from the previous
session's fix. No version changes needed.

---

## Dependency audit

| Package | Version in `apps/mobile/package.json` | Status |
|---------|--------------------------------------|--------|
| `react-native-gesture-handler` | `~2.28.0` | ✅ correct |
| `react-native-screens` | `~4.16.0` | ✅ correct |
| `react-native-reanimated` | (not listed) | ✅ not needed |

---

## Rebuild required

The JS-side fixes above are not sufficient alone. The native binary on the device must
also include `RNGestureHandlerModule`. You must build a new dev-client APK.

### Step 1 — Install dependencies

```bash
# From the repo root
npm install
```

### Step 2 — Build new dev-client (Android)

```bash
cd apps/mobile
eas build --profile development --platform android
```

Wait for the EAS Build to complete. Download and install the resulting `.apk` on the
device (or use the QR code EAS provides).

### Step 3 — Start Metro

```bash
# From apps/mobile (or the repo root with the workspace script)
npx expo start --dev-client
```

Scan the QR code or open the app — it will connect to Metro automatically.

### Step 4 — iOS (if applicable)

```bash
eas build --profile development --platform ios
```

Install via TestFlight or direct device install.

---

## Verification checklist

After installing the new build and connecting Metro:

- [ ] App boots on Android without `RNGestureHandlerModule` error in the Metro log
- [ ] No `TypeError: Cannot read property 'ErrorBoundary' of undefined` crash
- [ ] Onboarding flow navigates correctly (tap Next, finish)
- [ ] Home / Calendar / Profile tabs switch via tap
- [ ] Horizontal swipe between tabs works (Home ↔ Calendar ↔ Profile)
- [ ] No layout shift on Android with system navigation bar (Samsung safe-area fix)
- [ ] AirloopChat bottom sheet opens and closes without gesture interference

---

## Related files

| File | Role |
|------|------|
| `apps/mobile/index.js` | Entry point — gesture handler first import |
| `apps/mobile/app/_layout.tsx` | Root layout — `GestureHandlerRootView` wrapper |
| `apps/mobile/app/(tabs)/_layout.tsx` | Tab layout — `GestureDetector` + `SwipeNavigator` |
| `apps/mobile/package.json` | Native dep declaration (autolinking source) |
