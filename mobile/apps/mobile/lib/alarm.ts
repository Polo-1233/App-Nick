/**
 * alarm.ts — "Set alarm now" helper.
 *
 * Platform behaviour:
 *   Android — ACTION_SET_ALARM intent via expo-intent-launcher.
 *             Prefills hour, minute, label; SKIP_UI=false so the user
 *             sees and confirms the alarm before it is saved.
 *             Falls back to the 'clock:' URL scheme, then returns ok=false
 *             so the caller can show an in-app manual-set modal.
 *
 *   iOS —     No public API to prefill an alarm. We try known Clock URL
 *             schemes (clock-alarm://, clock://) then return ok=false so
 *             the caller shows a modal with the suggested time.
 *
 * Privacy: we never create alarms silently. The user always confirms.
 */

import { Platform, Linking } from 'react-native';
import type { UserProfile, DayPlan } from '@r90/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlarmSuggestion {
  hour:    number;
  minute:  number;
  label?:  string;
}

export interface AlarmResult {
  ok:        boolean;
  platform:  'android' | 'ios';
  method:    string;
  reason?:   string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format AlarmSuggestion as "HH:MM" display string. */
export function formatAlarmSuggestion(s: AlarmSuggestion): string {
  return `${pad2(s.hour)}:${pad2(s.minute)}`;
}

// ─── Suggestion builder ───────────────────────────────────────────────────────

/**
 * Compute the suggested alarm time.
 * Prefers the plan's computed wake time, falls back to profile.anchorTime.
 */
export function getSuggestedAlarmTime(
  profile: UserProfile,
  plan:    DayPlan | null,
): AlarmSuggestion {
  const anchorMin = plan?.cycleWindow?.wakeTime ?? profile.anchorTime;
  return {
    hour:   Math.floor(anchorMin / 60),
    minute: anchorMin % 60,
    label:  'R90 Anchor',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Open the system alarm app prefilled with the suggested time (Android),
 * or attempt to open the Clock app (iOS), or return ok=false for the caller
 * to show an in-app manual-set prompt.
 */
export async function openAlarmApp(s: AlarmSuggestion): Promise<AlarmResult> {
  if (Platform.OS === 'android') {
    return openAlarmAndroid(s);
  }
  return openAlarmIOS(s);
}

// ─── Android ─────────────────────────────────────────────────────────────────

async function openAlarmAndroid(s: AlarmSuggestion): Promise<AlarmResult> {
  // Primary: ACTION_SET_ALARM with alarm prefill extras.
  // expo-intent-launcher is imported dynamically so iOS builds never try to
  // load this Android-only module.
  try {
    const IntentLauncher = await import('expo-intent-launcher');
    await IntentLauncher.startActivityAsync('android.intent.action.SET_ALARM', {
      extra: {
        // AlarmClock contract extras (android.intent.extra.alarm.*)
        'android.intent.extra.alarm.HOUR':    s.hour,
        'android.intent.extra.alarm.MINUTES': s.minute,
        'android.intent.extra.alarm.MESSAGE': s.label ?? 'R90 Anchor',
        // false = show the alarm-edit UI so the user confirms before saving
        'android.intent.extra.alarm.SKIP_UI': false,
      },
    });
    return { ok: true, platform: 'android', method: 'intent:SET_ALARM' };
  } catch (err) {
    console.warn('[alarm] SET_ALARM intent failed, trying clock: fallback:', err);
  }

  // Fallback: open generic clock URI (opens default clock app on most OEMs)
  try {
    const canOpen = await Linking.canOpenURL('clock:');
    if (canOpen) {
      await Linking.openURL('clock:');
      return { ok: true, platform: 'android', method: 'clock:' };
    }
  } catch (_) {
    // canOpenURL/openURL threw — unsupported scheme
  }

  return {
    ok:       false,
    platform: 'android',
    method:   'none',
    reason:   'Could not open alarm app. Please set the alarm manually.',
  };
}

// ─── iOS ─────────────────────────────────────────────────────────────────────

async function openAlarmIOS(s: AlarmSuggestion): Promise<AlarmResult> {
  // iOS has no public API for alarm prefill. We try known URL schemes that
  // open the Clock app (no prefill), then gracefully degrade to a modal.
  const iosSchemes = ['clock-alarm://', 'clock://'] as const;

  for (const scheme of iosSchemes) {
    try {
      const canOpen = await Linking.canOpenURL(scheme);
      if (canOpen) {
        await Linking.openURL(scheme);
        return { ok: true, platform: 'ios', method: scheme };
      }
    } catch (_) {
      // Scheme not supported on this device — try next
    }
  }

  // Neither scheme worked — caller should show a manual-set modal with the
  // suggested time so the user can open Clock themselves.
  return {
    ok:       false,
    platform: 'ios',
    method:   'modal',
    reason:   `Please open the Clock app and set an alarm for ${formatAlarmSuggestion(s)}.`,
  };
}
