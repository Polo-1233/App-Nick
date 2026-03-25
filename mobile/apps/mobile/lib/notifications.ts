/**
 * notifications.ts — R90 Navigator local notification scheduler
 *
 * SIMPLIFIED notification system (post-audit cleanup):
 *
 *   N1 — Morning:       single morning notification at ARP + 15 min (merged anchor + briefing)
 *   N3 — CRP window:    fires at 13:00 when zone is Yellow or Orange
 *   N_MRM — Micro reset: next upcoming MRM (max 3 per day)
 *   N5 — Missed cycle:  15 min after bedtime if no wind-down started
 *
 * REMOVED (redundant / anxiety-inducing):
 *   N2 — Pre-sleep:     removed — wind-down.ts handles this
 *   N4 — Log nudge:     removed — pressuring, contrary to R90 philosophy
 *   D2 — Evening prep:  removed — duplicate of wind-down notification
 *
 * Design rules:
 *   - All notifications are LOCAL (no backend required)
 *   - Target: max 4-5 notifications per day
 *   - Never fire during sleep window (bedtime → anchor)
 *   - All are idempotent — safe to call on every app open
 *   - Requires notifications permission
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayPlan, UserProfile, NightRecord, TimeBlock } from '@r90/types';
import { getFlow } from './rhythm-points';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const NOTIF_KEYS = {
  MORNING:      '@r90:notif:morning:v1',
  CRP:          '@r90:notif:crp:v1',
  MRM:          '@r90:notif:mrm:v1',
  MISSED_CYCLE: '@r90:notif:missedCycle:v1',
  MRM_COUNT:    '@r90:notif:mrmCount:v1',  // tracks how many MRM notifs sent today
} as const;

// Legacy keys — cancelled on upgrade but no longer scheduled
const LEGACY_KEYS = [
  '@r90:notif:anchor:v1',
  '@r90:notif:preSleep:v1',
  '@r90:notif:logNudge:v1',
];

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_MRM_PER_DAY = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minuteOfDayToDate(minutes: number, allowTomorrow = true): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (allowTomorrow && target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

async function cancelAndClear(storageKey: string): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(storageKey);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(storageKey);
    }
  } catch {
    // non-critical
  }
}

async function scheduleOnce(
  storageKey: string,
  content: Notifications.NotificationContentInput,
  trigger: Date,
): Promise<void> {
  await cancelAndClear(storageKey);
  if (trigger <= new Date()) return;

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
  await AsyncStorage.setItem(storageKey, id);
}

async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── N1 — Morning notification (single touchpoint) ──────────────────────────
/**
 * Fires at ARP + 15 min. The only morning notification.
 * Replaces the old separate anchor reminder + daily morning briefing.
 */
async function scheduleMorningNotification(
  profile: UserProfile,
): Promise<void> {
  const morningMin = (profile.anchorTime + 15) % 1440;

  // Include streak in notification body if active
  let body = 'Your rhythm is set. Tap to confirm your wake-up.';
  try {
    const flow = await getFlow();
    if (flow.currentStreak >= 3) {
      body = `Day ${flow.currentStreak + 1} 🔥 — Tap to confirm your wake-up.`;
    }
  } catch {}

  await scheduleOnce(
    NOTIF_KEYS.MORNING,
    {
      title: 'R90 — Good morning ☀️',
      body,
      data: { route: '/(tabs)', type: 'morning' },
    },
    minuteOfDayToDate(morningMin),
  );
}

// ─── N3 — CRP window ─────────────────────────────────────────────────────────
/**
 * Fires at 13:00 when zone is Yellow or Orange. Skipped on Green days.
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
      title: 'Recovery time',
      body: 'Your CRP window is open. 20 minutes to recharge.',
      data: { route: '/crp-player', type: 'crp' },
    },
    minuteOfDayToDate(CRP_WINDOW_OPEN, false),
  );
}

// ─── N_MRM — Micro Recovery Moment (max 3 per day) ──────────────────────────
/**
 * Schedules the next upcoming MRM notification.
 * Tracks how many MRM notifs have been sent today — stops at MAX_MRM_PER_DAY.
 * Only one scheduled at a time; rescheduled on each plan refresh.
 */
async function scheduleMRMReminder(mrmBlocks: TimeBlock[]): Promise<void> {
  await cancelAndClear(NOTIF_KEYS.MRM);

  // Check daily MRM count
  const countRaw = await AsyncStorage.getItem(NOTIF_KEYS.MRM_COUNT).catch(() => null);
  let mrmCount = 0;
  if (countRaw) {
    try {
      const parsed = JSON.parse(countRaw) as { date: string; count: number };
      if (parsed.date === todayStr()) mrmCount = parsed.count;
    } catch {}
  }

  if (mrmCount >= MAX_MRM_PER_DAY) return;

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

  // Increment daily count
  await AsyncStorage.setItem(NOTIF_KEYS.MRM_COUNT, JSON.stringify({
    date: todayStr(),
    count: mrmCount + 1,
  }));
}

// ─── N5 — Missed cycle ──────────────────────────────────────────────────────
/**
 * Fires 15 min after ideal bedtime if remaining cycles ≥ 3.
 */
async function scheduleMissedCycleReminder(
  bedtime: number,
  cycleCount: number,
): Promise<void> {
  await cancelAndClear(NOTIF_KEYS.MISSED_CYCLE);

  const MISSED_CYCLE_OFFSET = 15;
  const triggerMin = (bedtime + MISSED_CYCLE_OFFSET) % 1440;
  const triggerDate = minuteOfDayToDate(triggerMin, false);

  if (triggerDate <= new Date()) return;

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
 */
export async function scheduleAllNotifications(
  profile: UserProfile,
  plan: DayPlan,
  weekHistory: NightRecord[],
): Promise<void> {
  try {
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) return;

    // Clean up legacy notification keys from old version
    await Promise.allSettled(LEGACY_KEYS.map(k => cancelAndClear(k)));

    const mrmBlocks = (plan.blocks ?? []).filter(b => b.type === 'down_period');
    const bedtime = plan.cycleWindow?.bedtime ?? null;

    await Promise.all([
      scheduleMorningNotification(profile),
      scheduleCRPReminder(plan),
      scheduleMRMReminder(mrmBlocks),
      bedtime !== null
        ? scheduleMissedCycleReminder(bedtime, plan.cycleWindow.cycleCount)
        : Promise.resolve(),
    ]);
  } catch (e) {
    console.error('[notifications] Failed to schedule:', e);
  }
}

/**
 * Cancel all R90 notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Promise.allSettled([
    cancelAndClear(NOTIF_KEYS.MORNING),
    cancelAndClear(NOTIF_KEYS.CRP),
    cancelAndClear(NOTIF_KEYS.MRM),
    cancelAndClear(NOTIF_KEYS.MISSED_CYCLE),
    // Also clean up legacy
    ...LEGACY_KEYS.map(k => cancelAndClear(k)),
  ]);
}

/**
 * Handle a notification tap and return the target route.
 */
export function getRouteFromNotification(
  response: Notifications.NotificationResponse
): string | null {
  const data = response.notification.request.content.data;
  if (data && typeof data.route === 'string') return data.route;
  return null;
}
