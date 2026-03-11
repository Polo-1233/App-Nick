/**
 * Permissions helper — calendar + notifications.
 *
 * Wraps the existing requestCalendarPermission from lib/calendar and
 * expo-notifications. Persists results + a "prompt shown" flag so we
 * never show the soft modal twice.
 *
 * Storage keys are defined in lib/storage.ts (PERMISSION_KEYS) so
 * clearAllStorage() has a single source of truth.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { requestCalendarPermission } from './calendar';
import { PERMISSION_KEYS } from './storage';

export type PermissionResult = 'granted' | 'denied';

// Alias for brevity within this module
const KEYS = PERMISSION_KEYS;

// ─── Persistence helpers ──────────────────────────────────────────────────────

export async function hasShownPermissionPrompt(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.PROMPT_SHOWN);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markPermissionPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.PROMPT_SHOWN, 'true');
  } catch (error) {
    console.error('[permissions] Failed to mark prompt shown:', error);
  }
}

export async function savePermissionResult(
  type: 'calendar' | 'notifications',
  result: PermissionResult,
): Promise<void> {
  try {
    const key = type === 'calendar' ? KEYS.CALENDAR : KEYS.NOTIFICATIONS;
    await AsyncStorage.setItem(key, result);
  } catch (error) {
    console.error('[permissions] Failed to save result:', error);
  }
}

// ─── Permission requests ──────────────────────────────────────────────────────

/**
 * Request calendar access and persist result.
 * Never throws — returns 'denied' on error.
 */
export async function requestCalendar(): Promise<PermissionResult> {
  try {
    const granted = await requestCalendarPermission();
    const result: PermissionResult = granted ? 'granted' : 'denied';
    await savePermissionResult('calendar', result);
    return result;
  } catch (error) {
    console.error('[permissions] Calendar request failed:', error);
    await savePermissionResult('calendar', 'denied');
    return 'denied';
  }
}

/**
 * Request notification permission and persist result.
 * Never throws — returns 'denied' on error.
 */
export async function requestNotifications(): Promise<PermissionResult> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    const result: PermissionResult = status === 'granted' ? 'granted' : 'denied';
    await savePermissionResult('notifications', result);
    return result;
  } catch (error) {
    console.error('[permissions] Notification request failed:', error);
    await savePermissionResult('notifications', 'denied');
    return 'denied';
  }
}
