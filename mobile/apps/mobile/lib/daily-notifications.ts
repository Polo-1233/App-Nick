/**
 * daily-notifications.ts
 *
 * SIMPLIFIED: This module previously scheduled separate morning + evening
 * notifications. After the notification audit:
 *
 *   - Morning notification → now handled by N1 in notifications.ts (single morning touchpoint)
 *   - Evening notification → REMOVED (wind-down.ts handles the evening reminder)
 *
 * This module is kept for backward compatibility:
 *   - cancelDailyNotifications() cleans up old scheduled notifications
 *   - scheduleDailyNotifications() is now a no-op (scheduling moved to notifications.ts)
 *
 * The N5 missed cycle export is also removed — it's handled in notifications.ts.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Legacy identifiers — cancelled on app open to clean up old installs
const MORNING_ID = 'r90-morning-briefing';
const EVENING_ID = 'r90-evening-prep';
const MISSED_CYCLE_ID = 'r90-missed-cycle';
const LAST_SCHED = '@r90:dailyNotifScheduled';
const MISSED_CYCLE_KEY = '@r90:notif:missedCycle:v1';

/**
 * No-op — morning notification is now handled by scheduleAllNotifications() in notifications.ts.
 * Evening notification has been removed (wind-down.ts handles that timing).
 * This function only cancels legacy scheduled notifications from old versions.
 */
export async function scheduleDailyNotifications(
  _anchorTimeMin: number,
  _preSleepMin: number,
): Promise<void> {
  try {
    // Cancel legacy notifications from old version
    await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => null);
    await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => null);
    await Notifications.cancelScheduledNotificationAsync(MISSED_CYCLE_ID).catch(() => null);
  } catch {
    // Silent
  }
}

/**
 * Cancel all legacy daily notifications.
 */
export async function cancelDailyNotifications(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => null);
  await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => null);
  await Notifications.cancelScheduledNotificationAsync(MISSED_CYCLE_ID).catch(() => null);
  await AsyncStorage.removeItem(LAST_SCHED).catch(() => null);
  await AsyncStorage.removeItem(MISSED_CYCLE_KEY).catch(() => null);
}

/**
 * @deprecated — Missed cycle is now handled by notifications.ts N5.
 * Kept as no-op for backward compatibility.
 */
export async function scheduleN5MissedCycle(
  _bedtimeMin: number,
  _nextWindowTime: string,
  _cyclesRemaining: number,
): Promise<void> {
  // No-op — handled by notifications.ts
}
