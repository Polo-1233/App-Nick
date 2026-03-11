/**
 * calendar-writeback.ts — Unified write-back layer
 *
 * Writes R90 sleep blocks (pre-sleep + sleep window) to the appropriate
 * calendar source based on user configuration:
 *
 *   1. If Google Calendar is connected → write to Google Calendar (primary)
 *   2. Otherwise → write to the native calendar (user's preferred or default)
 *
 * This module is the single entry point for write-back.
 * Source-specific logic lives in calendar.ts and google-calendar.ts.
 *
 * Idempotency: once-per-day enforcement is delegated to each source's write function.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayPlan } from '@r90/types';
import { writeSleepBlocksToCalendar } from './calendar';
import { getGoogleConnectionState, writeGoogleSleepBlocks } from './google-calendar';

const WRITEBACK_UNIFIED_KEY = '@r90:calendar:lastWritten:v1';

/**
 * Write sleep blocks to the best available calendar source.
 * Idempotent — only writes once per calendar day.
 */
export async function writeAllSleepBlocks(plan: DayPlan): Promise<void> {
  const today       = new Date().toISOString().split('T')[0];
  const lastWritten = await AsyncStorage.getItem(WRITEBACK_UNIFIED_KEY).catch(() => null);
  if (lastWritten === today) return;

  const { preSleepStart, bedtime, wakeTime, cycleCount } = plan.cycleWindow;

  const { connected: googleConnected } = await getGoogleConnectionState();

  if (googleConnected) {
    // Write to Google Calendar
    await writeGoogleSleepBlocks(preSleepStart, bedtime, wakeTime, cycleCount);
  } else {
    // Write to native calendar (honours user's preferred calendar from WriteBackCalendarPicker)
    await writeSleepBlocksToCalendar(plan);
    // Note: writeSleepBlocksToCalendar handles its own idempotency;
    // we still set the unified key so we don't try Google next time.
  }

  await AsyncStorage.setItem(WRITEBACK_UNIFIED_KEY, today).catch(() => {/* non-critical */});
}
