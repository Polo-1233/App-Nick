/**
 * motivation-notifications.ts — Gamification-driven notifications
 *
 * Triggers:
 *   - Streak milestone (3, 7, 14, 30 days)
 *   - Inactivity (2 days no ARP confirm)
 *   - Points milestone (100, 500, 1000)
 *
 * Rules:
 *   - Max 1 motivation notif per day (no spam)
 *   - Never between 22:00 and 08:00
 *   - Always positive, never guilt-tripping
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFlow, getPoints } from './rhythm-points';
import { isMilestone, getMilestoneMessage } from './rlo-mood';

const LAST_MOTIV_KEY  = '@r90:lastMotivNotif';
const LAST_ACTIVE_KEY = '@r90:motivLastActive';
const COOLDOWN_MS     = 20 * 60 * 60 * 1000; // max 1 per 20h

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isQuietHours(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 8;
}

async function canSendNotif(): Promise<boolean> {
  if (isQuietHours()) return false;
  const last = await AsyncStorage.getItem(LAST_MOTIV_KEY);
  if (!last) return true;
  return Date.now() - parseInt(last, 10) > COOLDOWN_MS;
}

async function send(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data ?? {} },
    trigger: null,
  });
  await AsyncStorage.setItem(LAST_MOTIV_KEY, String(Date.now()));
}

// ─── Check all triggers ───────────────────────────────────────────────────────

export async function checkMotivationNotifications(): Promise<void> {
  try {
    if (!await canSendNotif()) return;

    const [flow, points] = await Promise.all([getFlow(), getPoints()]);

    // 1. Streak milestone
    if (isMilestone(flow.currentStreak)) {
      const msg = getMilestoneMessage(flow.currentStreak);
      if (msg) {
        await send('🔥 Milestone reached', msg, { type: 'streak_milestone', streak: flow.currentStreak });
        return;
      }
    }

    // 2. Points milestone
    const POINTS_MILESTONES = [100, 500, 1000, 2500, 5000];
    const hitPoints = POINTS_MILESTONES.find(m => points.total >= m && points.total - points.today < m);
    if (hitPoints) {
      await send(
        `⭐ ${hitPoints} Rhythm Points`,
        hitPoints === 100  ? 'You\'ve crossed 100 points. Consistency is building.'
        : hitPoints === 500  ? '500 points. Your rhythm is becoming a lifestyle.'
        : hitPoints === 1000 ? '1,000 points. You\'re in the top tier of R90 practitioners.'
        : `${hitPoints} points reached. Exceptional commitment.`,
        { type: 'points_milestone', points: hitPoints }
      );
      return;
    }

    // 3. Inactivity — 2 days since last ARP confirm
    if (flow.lastActiveDate) {
      const last    = new Date(flow.lastActiveDate);
      const today   = new Date();
      const daysDiff = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 2) {
        const INACTIVITY_MESSAGES = [
          "R-Lo misses you. No pressure — just checking in.",
          "Two days off rhythm. One good night is all it takes.",
          "Your anchor time is still there. Come back when you're ready.",
        ];
        const msg = INACTIVITY_MESSAGES[flow.currentStreak % INACTIVITY_MESSAGES.length]!;
        await send('👋 How are you sleeping?', msg, { type: 'inactivity' });
        return;
      }
    }

    // 4. Gentle weekly encouragement (Sunday evening)
    const now = new Date();
    if (now.getDay() === 0 && now.getHours() === 18) {
      if (flow.weekAligned >= 5) {
        await send(
          '✨ Great week',
          `${flow.weekAligned}/7 days aligned this week. Your consistency is extraordinary.`,
          { type: 'weekly_summary' }
        );
      } else if (flow.weekAligned >= 3) {
        await send(
          '📅 Good week',
          `${flow.weekAligned}/7 days aligned. Next week, aim for one more.`,
          { type: 'weekly_summary' }
        );
      }
    }

  } catch {
    // Silent fail — never crash the app
  }
}
