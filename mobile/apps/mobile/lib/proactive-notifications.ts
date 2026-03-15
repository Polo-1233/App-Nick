/**
 * Proactive notifications
 *
 * Polls the backend for proactive triggers when the app comes to foreground.
 * Throttled to once every 2 hours. Creates local notifications via expo-notifications.
 * Also checks for weekly report availability.
 */

import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getProactiveTrigger, getLatestWeeklyReport } from './api';

const CHECK_KEY       = '@r90:lastProactiveCheck';
const REPORT_KEY      = '@r90:weeklyReportNotified';
const COOLDOWN_MS     = 2 * 60 * 60 * 1000; // 2 hours

export function initProactiveNotifications(): void {
  // Check on foreground transitions
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void checkAndNotify();
    }
  });

  // Also check once on init
  void checkAndNotify();

  // Store the subscription reference for cleanup if needed
  // (In practice this lives for the app lifetime)
  void subscription;
}

async function checkAndNotify(): Promise<void> {
  try {
    // Check cooldown
    const lastCheck = await AsyncStorage.getItem(CHECK_KEY);
    if (lastCheck && Date.now() - parseInt(lastCheck, 10) < COOLDOWN_MS) return;

    await AsyncStorage.setItem(CHECK_KEY, String(Date.now()));

    // Check proactive triggers
    const res = await getProactiveTrigger();
    if (res.ok && res.data?.trigger) {
      const trigger = res.data.trigger;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: trigger.title,
          body:  trigger.body,
          data:  {
            trigger_type: trigger.type,
            chat_context: trigger.chat_context,
          },
        },
        trigger: null, // immediate
      });

      // Store pending chat context for when the user taps
      await AsyncStorage.setItem('@r90:pendingChatContext', trigger.chat_context);
    }

    // Check for weekly report notification
    await checkWeeklyReportNotification();
  } catch {
    // Silent failure
  }
}

async function checkWeeklyReportNotification(): Promise<void> {
  try {
    // Only notify once per week
    const lastNotified = await AsyncStorage.getItem(REPORT_KEY);
    if (lastNotified) {
      const lastDate = parseInt(lastNotified, 10);
      if (Date.now() - lastDate < 7 * 24 * 60 * 60 * 1000) return;
    }

    const res = await getLatestWeeklyReport();
    if (!res.ok || !res.data?.report) return;

    const reportAge = Date.now() - new Date(res.data.report.generated_at).getTime();
    if (reportAge > 24 * 60 * 60 * 1000) return; // Only notify for fresh reports

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your weekly sleep report is ready',
        body:  'R-Lo has analyzed your past week. Tap to read.',
        data:  { route: '/(tabs)' },
      },
      trigger: null,
    });

    await AsyncStorage.setItem(REPORT_KEY, String(Date.now()));
  } catch {
    // Silent failure
  }
}
