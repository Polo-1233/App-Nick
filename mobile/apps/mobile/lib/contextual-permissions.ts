/**
 * contextual-permissions.ts — Contextual permission prompts
 *
 * Instead of asking all permissions at once after login, each permission
 * is requested at the moment the user encounters the relevant feature:
 *
 *   - Notifications → after first wind-down completion
 *   - Calendar      → on first visit to Planning tab
 *   - Wearables     → opt-in from Settings (no prompt)
 *
 * Each prompt can be dismissed with "Not now" and will re-appear
 * after REPROPOSE_DAYS days.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const KEYS = {
  NOTIF_PROMPT_DISMISSED:    '@r90:ctx:notifDismissed',
  NOTIF_PROMPT_GRANTED:      '@r90:ctx:notifGranted',
  CALENDAR_PROMPT_DISMISSED: '@r90:ctx:calendarDismissed',
  CALENDAR_PROMPT_GRANTED:   '@r90:ctx:calendarGranted',
} as const;

/** Days to wait before re-proposing a dismissed permission */
const REPROPOSE_DAYS = 3;

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * Should we show the notification permission prompt?
 * Returns true if:
 *   - Permission not yet granted
 *   - Not dismissed recently (within REPROPOSE_DAYS)
 */
export async function shouldShowNotifPrompt(): Promise<boolean> {
  try {
    // Already granted?
    const granted = await AsyncStorage.getItem(KEYS.NOTIF_PROMPT_GRANTED);
    if (granted === 'true') return false;

    // Also check system-level
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      await AsyncStorage.setItem(KEYS.NOTIF_PROMPT_GRANTED, 'true');
      return false;
    }

    // Dismissed recently?
    const dismissed = await AsyncStorage.getItem(KEYS.NOTIF_PROMPT_DISMISSED);
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSince = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < REPROPOSE_DAYS) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Mark notification prompt as dismissed (user tapped "Not now").
 * Will be re-proposed after REPROPOSE_DAYS.
 */
export async function dismissNotifPrompt(): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIF_PROMPT_DISMISSED, new Date().toISOString());
}

/**
 * Mark notification prompt as granted (user accepted).
 */
export async function markNotifGranted(): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIF_PROMPT_GRANTED, 'true');
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

/**
 * Should we show the calendar connect card on the Planning screen?
 */
export async function shouldShowCalendarPrompt(): Promise<boolean> {
  try {
    const granted = await AsyncStorage.getItem(KEYS.CALENDAR_PROMPT_GRANTED);
    if (granted === 'true') return false;

    const dismissed = await AsyncStorage.getItem(KEYS.CALENDAR_PROMPT_DISMISSED);
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSince = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < REPROPOSE_DAYS) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function dismissCalendarPrompt(): Promise<void> {
  await AsyncStorage.setItem(KEYS.CALENDAR_PROMPT_DISMISSED, new Date().toISOString());
}

export async function markCalendarGranted(): Promise<void> {
  await AsyncStorage.setItem(KEYS.CALENDAR_PROMPT_GRANTED, 'true');
}
