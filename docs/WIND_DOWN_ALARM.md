# Wind-Down Mode & Set-Alarm Feature

## Overview

Two complementary features that help users protect their anchor time (R90 wake time):

| Feature | What it does |
|---|---|
| **Wind-down reminders** | Local notification 90 min before planned bedtime |
| **Wind-down music** | Optional ambient audio on the wind-down screen |
| **Set alarm now** | Opens system Clock app prefilled with wake time (Android) or shows time prompt (iOS) |

---

## Wind-Down Mode

### How it works

1. User enables "Wind-down reminders" in Profile → Settings.
2. On every plan load (mount + foreground resume), `scheduleWindDownForToday()` in `lib/wind-down.ts` fires.
3. If notifications are granted and wind-down is enabled, a local notification is scheduled 90 min before `plan.cycleWindow.bedtime`.
4. The notification is idempotent: `LAST_SCHEDULED` key prevents duplicate scheduling on the same calendar day.
5. If the computed fire time has already passed today, scheduling is silently skipped.
6. Tapping the notification deep-links to `/wind-down` via `data.route` handled in `app/_layout.tsx`.

### Wind-down screen (`app/wind-down.tsx`)

- Full-screen fire-camp background with dark gradient overlay.
- Static pre-sleep checklist (dim lights, prep tomorrow, no caffeine, screen brightness, room temperature).
- Optional ambient music from `assets/music/ambient.mp3` (played only if "Wind-down music" is on).
- CTA "Start routine" → `router.back()`.

### Platform behaviour

| | iOS | Android |
|---|---|---|
| Local notification | ✓ | ✓ |
| Deep-link on tap | ✓ | ✓ |
| System DND / Focus | ✗ (not automated) | ✗ (not automated) |

### Storage keys

All keys are defined in `lib/wind-down.ts` (WIND_DOWN_KEYS) and mirrored in `lib/storage.ts`
(WIND_DOWN_STORAGE_KEYS) so `clearAllStorage()` clears them on data reset.

| Key | Value |
|---|---|
| `@r90:windDown:enabled:v1` | `'true'` / `'false'` |
| `@r90:windDown:musicEnabled:v1` | `'true'` / `'false'` |
| `@r90:windDown:lastScheduled:v1` | ISO date `YYYY-MM-DD` |
| `@r90:windDown:notifId:v1` | Expo notification ID string |

---

## Set Alarm Now

### How it works

A ghost pill button on the Home screen shows the suggested wake time and opens the system alarm app.

```
HomeScreen → "⏰  Wake-up · 07:00" pill → openAlarmApp()
```

Suggested time = `plan.cycleWindow.wakeTime` (falls back to `profile.anchorTime`).

### Platform behaviour

| Platform | Primary method | Fallback |
|---|---|---|
| **Android** | `ACTION_SET_ALARM` intent via `expo-intent-launcher` (prefills hour, minute, label; user confirms in Clock UI) | `clock:` URL scheme → opens Clock app |
| **iOS** | `clock-alarm://` URL scheme | `clock://` URL scheme → in-app Alert showing the time |

On iOS, Apple does not expose a public API to prefill an alarm. The app therefore shows an Alert with the suggested time so the user can open Clock themselves.

### Privacy

- We never create alarms silently. `SKIP_UI=false` on Android means the user always confirms.
- `expo-intent-launcher` is imported dynamically inside an `async function`, so it is never loaded on iOS builds.

---

## Dependencies

| Package | Purpose | Platform |
|---|---|---|
| `expo-notifications` | Local notification scheduling & deep-link | iOS + Android |
| `expo-av` | Ambient audio (dynamic import only) | iOS + Android |
| `expo-intent-launcher` | ACTION_SET_ALARM intent | Android only (dynamic import) |
| `expo-linking` | Clock URL scheme fallbacks | iOS + Android |

### Installation note

After adding `expo-intent-launcher` to `package.json`, install the correct SDK-compatible version:

```bash
npx expo install expo-intent-launcher
```

---

## Testing Checklist

### Wind-down reminders
- [ ] Enable toggle in Profile → Settings (notifications permission dialog appears if undetermined)
- [ ] Deny permission → toggle stays off, Alert is shown
- [ ] Grant permission → toggle turns on, notification scheduled
- [ ] Kill and reopen app → notification is NOT re-scheduled for same day (idempotent guard)
- [ ] Tap notification → app opens `/wind-down` screen
- [ ] Disable toggle → scheduled notification is cancelled

### Wind-down music
- [ ] Enable toggle → music plays on wind-down screen
- [ ] Disable toggle → music does not play
- [ ] Navigate away from wind-down screen → music fades out

### Set alarm now
- [ ] **Android**: tap pill → system Clock app opens with alarm prefilled at anchor time
- [ ] **Android** (no intent support): tap pill → Clock app opens without prefill
- [ ] **iOS**: tap pill → Alert shown with suggested time
- [ ] Suggested time matches `profile.anchorTime` when no plan is loaded
- [ ] Suggested time matches `plan.cycleWindow.wakeTime` when plan is available
