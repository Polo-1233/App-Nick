/**
 * wind-down.ts — Wind-down mode scheduling and preferences.
 *
 * Wind-down = the 90-minute window before planned bedtime.
 * When enabled, we schedule a local notification 90 min before bedtime so
 * the user gets a gentle reminder to start their pre-sleep routine.
 * Tapping the notification deep-links to the /wind-down route.
 *
 * Soft implementation — no DND / Focus automation, no system "minimal mode".
 * Everything is opt-in and the user always stays in control.
 *
 * Storage keys are defined here; add them to ALL_STORAGE_KEYS in storage.ts
 * to ensure they are cleared by clearAllStorage().
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { UserProfile, DayPlan, MinuteOfDay } from '@r90/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minutes before bedtime that the wind-down notification fires. */
export const WIND_DOWN_OFFSET_MIN = 90;

/** AsyncStorage keys owned by this module. */
export const WIND_DOWN_KEYS = {
  ENABLED:         '@r90:windDown:enabled:v1',
  MUSIC_ENABLED:   '@r90:windDown:musicEnabled:v1',
  LAST_SCHEDULED:  '@r90:windDown:lastScheduled:v1',
  NOTIFICATION_ID: '@r90:windDown:notifId:v1',
} as const;

// ─── Time math ────────────────────────────────────────────────────────────────

/**
 * Compute the wind-down start time in MinuteOfDay.
 * Handles midnight wraparound (e.g. bedtime 01:30 → windDown 00:00).
 */
export function computeWindDownStart(bedtime: MinuteOfDay): MinuteOfDay {
  return ((bedtime - WIND_DOWN_OFFSET_MIN) + 1440) % 1440;
}

// ─── Permission helper ────────────────────────────────────────────────────────

/**
 * Check notification permission; request it once if undetermined.
 * Never loops — if the user already denied, returns 'denied' immediately.
 *
 * Called from the Settings toggle (user-initiated) only.
 * Background refreshes must NOT call this to avoid surprise OS prompts.
 */
export async function ensureNotificationsPermissionSoft(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'undetermined') {
      const result = await Notifications.requestPermissionsAsync();
      return result.status === 'granted' ? 'granted' : 'denied';
    }
    return 'denied';
  } catch {
    return 'denied';
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export async function loadWindDownEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WIND_DOWN_KEYS.ENABLED)) === 'true';
  } catch {
    return false;
  }
}

export async function saveWindDownEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WIND_DOWN_KEYS.ENABLED, String(enabled));
}

export async function loadWindDownMusicEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WIND_DOWN_KEYS.MUSIC_ENABLED)) === 'true';
  } catch {
    return false;
  }
}

export async function saveWindDownMusicEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WIND_DOWN_KEYS.MUSIC_ENABLED, String(enabled));
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

interface ScheduleArgs {
  profile:   UserProfile;
  plan:      DayPlan;
}

/**
 * Schedule (or skip) a wind-down notification for today.
 *
 * Guards:
 *  • Skips if notifications permission is not granted.
 *  • Skips if wind-down notification is already scheduled today
 *    (idempotent — safe to call on every plan reload).
 *  • Skips if the computed trigger time is already in the past today
 *    without rolling to tomorrow (avoids late-night false fires).
 *
 * The notification carries `data: { route: '/wind-down' }` so the response
 * handler in _layout.tsx can deep-link the user to the wind-down screen.
 */
export async function scheduleWindDownForToday(args: ScheduleArgs): Promise<void> {
  try {
    // 1. Permission check — never request here, just verify
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // 2. Already scheduled today?
    const today = new Date().toISOString().split('T')[0];
    const lastScheduled = await AsyncStorage.getItem(WIND_DOWN_KEYS.LAST_SCHEDULED);
    if (lastScheduled === today) return;

    // 3. Compute trigger time
    const bedtimeMin    = args.plan.cycleWindow.bedtime;
    const windDownMin   = computeWindDownStart(bedtimeMin);
    const windDownHour  = Math.floor(windDownMin / 60);
    const windDownMinute = windDownMin % 60;

    const now     = new Date();
    const trigger = new Date(now);
    trigger.setHours(windDownHour, windDownMinute, 0, 0);

    // If the wind-down time has already passed today, skip (don't roll to tomorrow
    // to avoid confusion; the next plan reload tomorrow will reschedule).
    if (trigger <= now) return;

    // 4. Cancel any stale notification from a previous scheduling
    await cancelWindDownNotification();

    // 5. Schedule
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Wind-down time',
        body:  'Start your pre-sleep routine to protect your anchor time.',
        data:  { route: '/wind-down' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });

    // 6. Persist so we don't reschedule the same notification today
    await AsyncStorage.setItem(WIND_DOWN_KEYS.LAST_SCHEDULED, today);
    await AsyncStorage.setItem(WIND_DOWN_KEYS.NOTIFICATION_ID, notifId);
  } catch (err) {
    // Never throw from scheduling — it's a background best-effort feature
    console.warn('[wind-down] scheduleWindDownForToday failed (non-fatal):', err);
  }
}

/**
 * Cancel the currently stored wind-down notification and clear its ID.
 * Safe to call even if no notification is scheduled.
 */
export async function cancelWindDownNotification(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(WIND_DOWN_KEYS.NOTIFICATION_ID);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(WIND_DOWN_KEYS.NOTIFICATION_ID);
    }
  } catch (err) {
    console.warn('[wind-down] cancelWindDownNotification failed (non-fatal):', err);
  }
}
