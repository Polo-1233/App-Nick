/**
 * daily-notifications.ts
 *
 * Schedules two recurring daily push notifications:
 *   - Morning briefing: anchorTime + 15 min (e.g. 06:45)
 *   - Evening prep:     preSleepStart (bedtime - 90 min, e.g. 21:30)
 *
 * Content is fetched from the backend at scheduling time.
 * On each app open, we reschedule to keep content fresh.
 *
 * Identifiers:
 *   r90-morning-briefing
 *   r90-evening-prep
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from './supabase';
import { BASE_URL as BACKEND_URL } from './api';

const MORNING_ID  = 'r90-morning-briefing';
const EVENING_ID  = 'r90-evening-prep';
const LAST_SCHED  = '@r90:dailyNotifScheduled';
const COOLDOWN_MS = 6 * 3_600_000; // reschédule au max toutes les 6h

// ─── Fetch notification content from backend ─────────────────────────────────

async function fetchNotifContent(endpoint: 'morning-briefing' | 'evening-prep'): Promise<string | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const res = await fetch(`${BACKEND_URL}/notifications/${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { message?: string };
    return data.message ?? null;
  } catch {
    return null;
  }
}

// ─── Build trigger time for today or tomorrow ─────────────────────────────────

function buildDailyTrigger(hour: number, minute: number): Notifications.NotificationTriggerInput {
  return {
    type:    Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
  };
}

// ─── Schedule / reschedule both notifications ────────────────────────────────

export async function scheduleDailyNotifications(
  anchorTimeMin: number,   // e.g. 420 = 07:00
  preSleepMin:   number,   // e.g. 1290 = 21:30
): Promise<void> {
  try {
    // Throttle: only reschedule if cooldown elapsed
    const lastStr = await AsyncStorage.getItem(LAST_SCHED);
    if (lastStr && Date.now() - parseInt(lastStr, 10) < COOLDOWN_MS) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Cancel previous scheduled versions
    await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => null);
    await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => null);

    // Morning: anchorTime + 15 min
    const morningMin    = (anchorTimeMin + 15) % 1440;
    const morningHour   = Math.floor(morningMin / 60);
    const morningMinute = morningMin % 60;
    const morningBody   = await fetchNotifContent('morning-briefing')
      ?? 'Check your sleep plan for today.';

    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: {
        title: 'R-Lo · Morning',
        body:  morningBody,
        data:  { screen: 'coach', type: 'morning' },
      },
      trigger: buildDailyTrigger(morningHour, morningMinute),
    });

    // Evening: preSleepStart (bedtime - 90 min)
    const eveningHour   = Math.floor(((preSleepMin % 1440) + 1440) % 1440 / 60);
    const eveningMinute = ((preSleepMin % 1440) + 1440) % 1440 % 60;
    const eveningBody   = await fetchNotifContent('evening-prep')
      ?? 'Time to wind down. Check your bedtime.';

    await Notifications.scheduleNotificationAsync({
      identifier: EVENING_ID,
      content: {
        title: 'R-Lo · Evening',
        body:  eveningBody,
        data:  { screen: 'coach', type: 'evening' },
      },
      trigger: buildDailyTrigger(eveningHour, eveningMinute),
    });

    await AsyncStorage.setItem(LAST_SCHED, String(Date.now()));
  } catch {
    // Non-critical — silent fail
  }
}

export async function cancelDailyNotifications(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => null);
  await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => null);
  await AsyncStorage.removeItem(LAST_SCHED);
}
