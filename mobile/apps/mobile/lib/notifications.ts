/**
 * notifications.ts — R90 Navigator push notification scheduler
 *
 * Schedules local notifications for the four core R90 reminders:
 *
 *   N1 — Anchor reminder:  fires AT anchor time if no night logged yet
 *   N2 — Pre-sleep:        fires at preSleepStart (90 min before bedtime)
 *   N3 — CRP window:       fires at 13:00 when zone is Yellow or Orange
 *   N4 — Log nudge:        fires at anchor + 30 min if last night not logged
 *
 * Design rules:
 *   - All notifications are LOCAL (no backend required)
 *   - Never fire during the sleep window (bedtime → anchor)
 *   - All are idempotent — safe to call on every app open
 *   - User can toggle each category in Settings (future)
 *   - Requires notifications permission (checked before scheduling)
 *
 * Storage keys (all versioned):
 *   @r90:notif:anchor:v1    — notification id for N1
 *   @r90:notif:preSleep:v1  — notification id for N2
 *   @r90:notif:crp:v1       — notification id for N3
 *   @r90:notif:logNudge:v1  — notification id for N4
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayPlan, UserProfile, NightRecord, TimeBlock } from '@r90/types';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const NOTIF_KEYS = {
  ANCHOR:       '@r90:notif:anchor:v1',
  PRE_SLEEP:    '@r90:notif:preSleep:v1',
  CRP:          '@r90:notif:crp:v1',
  LOG_NUDGE:    '@r90:notif:logNudge:v1',
  MRM:          '@r90:notif:mrm:v1',
  MISSED_CYCLE: '@r90:notif:missedCycle:v1',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a Date for a MinuteOfDay today (or tomorrow if the time has passed).
 */
function minuteOfDayToDate(minutes: number, allowTomorrow = true): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (allowTomorrow && target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/**
 * Cancel a previously scheduled notification, then clear its stored id.
 */
async function cancelAndClear(storageKey: string): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(storageKey);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(storageKey);
    }
  } catch {
    // non-critical — ignore
  }
}

/**
 * Schedule a local notification and persist its id to AsyncStorage.
 * Cancels any previously scheduled notification for that key first.
 */
async function scheduleOnce(
  storageKey: string,
  content: Notifications.NotificationContentInput,
  trigger: Date,
): Promise<void> {
  await cancelAndClear(storageKey);
  const trigger_in_future = trigger > new Date();
  if (!trigger_in_future) return;

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
  await AsyncStorage.setItem(storageKey, id);
}

// ─── Permission guard ─────────────────────────────────────────────────────────

async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ─── Today's date string ──────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Individual schedulers ────────────────────────────────────────────────────

/**
 * N1 — Anchor reminder.
 * Fires at anchor time if the user hasn't logged last night yet.
 * Only scheduled when the current night record for today is missing.
 */
async function scheduleAnchorReminder(
  profile: UserProfile,
  weekHistory: NightRecord[],
): Promise<void> {
  const today = todayStr();
  const alreadyLogged = weekHistory.some(r => r.date === today);

  if (alreadyLogged) {
    await cancelAndClear(NOTIF_KEYS.ANCHOR);
    return;
  }

  await scheduleOnce(
    NOTIF_KEYS.ANCHOR,
    {
      title: 'R90 — Good morning',
      body: 'Log last night to keep your weekly tracking on track.',
      data: { route: '/log-night' },
    },
    minuteOfDayToDate(profile.anchorTime),
  );
}

/**
 * N2 — Pre-sleep reminder.
 * Fires at preSleepStart (90 min before bedtime).
 */
async function schedulePreSleepReminder(plan: DayPlan): Promise<void> {
  await scheduleOnce(
    NOTIF_KEYS.PRE_SLEEP,
    {
      title: 'Wind-down time',
      body: 'Start stepping away from screens. Bedtime in 90 minutes.',
      data: { route: '/wind-down' },
    },
    minuteOfDayToDate(plan.cycleWindow.preSleepStart),
  );
}

/**
 * N3 — CRP window notification.
 * Fires at 13:00 when zone is Yellow or Orange.
 * Skipped on Green days.
 */
async function scheduleCRPReminder(plan: DayPlan): Promise<void> {
  if (plan.readiness.zone === 'green') {
    await cancelAndClear(NOTIF_KEYS.CRP);
    return;
  }

  const CRP_WINDOW_OPEN = 13 * 60; // 13:00
  await scheduleOnce(
    NOTIF_KEYS.CRP,
    {
      title: 'CRP window open',
      body: 'Your recovery window is open. Even 30 minutes will help.',
      data: { route: '/crp-player', type: 'crp' },
    },
    minuteOfDayToDate(CRP_WINDOW_OPEN, false),
  );
}

/**
 * N4 — Log nudge.
 * Fires at anchor + 30 min if the previous night has not been logged.
 */
async function scheduleLogNudge(
  profile: UserProfile,
  weekHistory: NightRecord[],
): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const alreadyLogged = weekHistory.some(r => r.date === yesterdayStr);

  if (alreadyLogged) {
    await cancelAndClear(NOTIF_KEYS.LOG_NUDGE);
    return;
  }

  const NUDGE_OFFSET = 30; // minutes after anchor
  const nudgeTime = (profile.anchorTime + NUDGE_OFFSET) % 1440;

  await scheduleOnce(
    NOTIF_KEYS.LOG_NUDGE,
    {
      title: 'Log last night',
      body: 'Don\'t forget to log your sleep cycles to keep your T7 accurate.',
      data: { route: '/log-night' },
    },
    minuteOfDayToDate(nudgeTime),
  );
}

/**
 * N_MRM — MRM (Micro Recovery Moment) notification.
 * Fires at the next upcoming MRM (down_period block) at least 5 min in the future.
 * Only one MRM notification scheduled at a time — rescheduled on each plan refresh.
 */
async function scheduleMRMReminder(mrmBlocks: TimeBlock[]): Promise<void> {
  await cancelAndClear(NOTIF_KEYS.MRM);

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const nextMRMMin = mrmBlocks
    .map(b => b.start)
    .filter(m => m > nowMins + 5)
    .sort((a, b) => a - b)[0];

  if (nextMRMMin === undefined) return;

  const triggerDate = minuteOfDayToDate(nextMRMMin, false);
  if (triggerDate <= now) return;

  await scheduleOnce(
    NOTIF_KEYS.MRM,
    {
      title: 'Micro reset',
      body: '2-minute breathing break. Tap to start.',
      data: { route: '/mrm-player', type: 'mrm' },
    },
    triggerDate,
  );
}

/**
 * N5 — Missed cycle reminder.
 * Fires 15 minutes after ideal bedtime if the user hasn't started wind-down.
 * Only fires if remaining cycles ≥ 3 (still worth sleeping).
 * Not fired if cyclesRemaining < 3 (too late, unhelpful).
 */
async function scheduleMissedCycleReminder(
  bedtime:    number,
  cycleCount: number,
  anchorTime: number,
): Promise<void> {
  await cancelAndClear(NOTIF_KEYS.MISSED_CYCLE);

  const MISSED_CYCLE_OFFSET = 15; // minutes after bedtime
  const triggerMin = (bedtime + MISSED_CYCLE_OFFSET) % 1440;
  const triggerDate = minuteOfDayToDate(triggerMin, false);

  if (triggerDate <= new Date()) return;

  // Compute next window time at schedule time
  const cyclesMissed = Math.ceil(MISSED_CYCLE_OFFSET / 90);
  const remaining = cycleCount - cyclesMissed;
  if (remaining < 3) return;

  const nextWindowMin = (bedtime + cyclesMissed * 90) % 1440;
  const h = Math.floor(nextWindowMin / 60);
  const m = nextWindowMin % 60;
  const nextWindowTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  await scheduleOnce(
    NOTIF_KEYS.MISSED_CYCLE,
    {
      title: 'No stress',
      body: `Your next window is at ${nextWindowTime}. ${remaining} cycles — still a great night.`,
      data: { route: '/(tabs)', type: 'missed_cycle' },
    },
    triggerDate,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule all R90 notifications for today.
 * Safe to call on every app open — idempotent.
 * Silently skips if notifications permission is not granted.
 */
export async function scheduleAllNotifications(
  profile: UserProfile,
  plan: DayPlan,
  weekHistory: NightRecord[],
): Promise<void> {
  try {
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) return;

    const mrmBlocks = (plan.blocks ?? []).filter(b => b.type === 'down_period');
    const bedtime   = plan.cycleWindow?.bedtime ?? null;

    await Promise.all([
      scheduleAnchorReminder(profile, weekHistory),
      schedulePreSleepReminder(plan),
      scheduleCRPReminder(plan),
      scheduleLogNudge(profile, weekHistory),
      scheduleMRMReminder(mrmBlocks),
      bedtime !== null
        ? scheduleMissedCycleReminder(bedtime, plan.cycleWindow.cycleCount, profile.anchorTime)
        : Promise.resolve(),
    ]);
  } catch (e) {
    console.error('[notifications] Failed to schedule notifications:', e);
  }
}

/**
 * Cancel all R90 notifications.
 * Call on profile reset or when the user disables notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Promise.allSettled([
    cancelAndClear(NOTIF_KEYS.ANCHOR),
    cancelAndClear(NOTIF_KEYS.PRE_SLEEP),
    cancelAndClear(NOTIF_KEYS.CRP),
    cancelAndClear(NOTIF_KEYS.LOG_NUDGE),
    cancelAndClear(NOTIF_KEYS.MRM),
    cancelAndClear(NOTIF_KEYS.MISSED_CYCLE),
  ]);
}

/**
 * Handle a notification tap and return the target route (if any).
 * Use in _layout.tsx with Notifications.addNotificationResponseReceivedListener.
 */
export function getRouteFromNotification(
  response: Notifications.NotificationResponse
): string | null {
  const data = response.notification.request.content.data;
  if (data && typeof data.route === 'string') return data.route;
  return null;
}
