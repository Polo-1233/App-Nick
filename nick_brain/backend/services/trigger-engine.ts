/**
 * Proactive trigger engine
 *
 * Checks user data for conditions that warrant proactive notifications.
 * Returns sorted triggers (highest priority first).
 */

import type { AppClient } from "../db/client.js";
import {
  fetchRecentSleepLogs,
  fetchUpcomingCalendarEvents,
  fetchRecentLifeEvents,
  fetchActiveWeeklyBalance,
  fetchWeeklySummaries,
} from "../db/queries.js";

export interface ProactiveTrigger {
  type:         'recovery_alert' | 'pre_event_coaching' | 'improvement_milestone' | 'weekly_deficit';
  priority:     number;
  title:        string;
  body:         string;
  chat_context: string;
  expires_at:   string;
}

export async function checkProactiveTriggers(
  client: AppClient,
  userId: string,
): Promise<ProactiveTrigger[]> {
  const triggers: ProactiveTrigger[] = [];

  try {
    const [sleepLogs, calendarEvents, lifeEvents, weeklyBalance, summaries] = await Promise.all([
      fetchRecentSleepLogs(client, userId, 7),
      fetchUpcomingCalendarEvents(client, userId, 24),
      fetchRecentLifeEvents(client, userId, 0, 1), // next day only
      fetchActiveWeeklyBalance(client, userId),
      fetchWeeklySummaries(client, userId, 2),
    ]);

    // 1. Recovery alert: 3+ consecutive nights with cycles_completed < 3
    if (sleepLogs.length >= 3) {
      const recent3 = sleepLogs.slice(0, 3);
      const allLow = recent3.every(l => l.cycles_completed !== null && l.cycles_completed < 3);
      if (allLow) {
        triggers.push({
          type:         'recovery_alert',
          priority:     1,
          title:        'Recovery needed',
          body:         '3 nights of low sleep. Tonight matters more than usual.',
          chat_context: "I've had 3 poor nights in a row. Help me plan tonight.",
          expires_at:   new Date(Date.now() + 24 * 3_600_000).toISOString(),
        });
      }
    }

    // 2. Pre-event coaching: travel/important event in the next 24h
    const urgentEvents = [
      ...calendarEvents.filter(e => e.event_type_hint === 'travel' || e.event_type_hint === 'important'),
      ...lifeEvents.filter(e => e.event_type === 'travel' || e.event_type === 'important_day'),
    ];
    if (urgentEvents.length > 0) {
      const firstEvent = urgentEvents[0];
      const title = 'title' in firstEvent ? firstEvent.title : '';
      triggers.push({
        type:         'pre_event_coaching',
        priority:     1,
        title:        'Big day tomorrow',
        body:         `${title} — optimize tonight's sleep.`,
        chat_context: `I have ${title} coming up. How should I prepare my sleep?`,
        expires_at:   new Date(Date.now() + 24 * 3_600_000).toISOString(),
      });
    }

    // 3. Weekly deficit: deficit > 8 cycles
    if (weeklyBalance && weeklyBalance.cycle_deficit > 8) {
      triggers.push({
        type:         'weekly_deficit',
        priority:     2,
        title:        'Sleep debt building',
        body:         `${weeklyBalance.cycle_deficit} cycles behind this week.`,
        chat_context: "I'm falling behind on my sleep cycles this week. What can I do?",
        expires_at:   new Date(Date.now() + 12 * 3_600_000).toISOString(),
      });
    }

    // 4. Improvement milestone: avg_cycles this week > last week + 0.5
    if (summaries.length >= 2) {
      const thisWeek = summaries[0];
      const lastWeek = summaries[1];
      if (
        thisWeek.avg_cycles !== null &&
        lastWeek.avg_cycles !== null &&
        thisWeek.avg_cycles > lastWeek.avg_cycles + 0.5
      ) {
        triggers.push({
          type:         'improvement_milestone',
          priority:     3,
          title:        'Great progress!',
          body:         `Your sleep improved by ${(thisWeek.avg_cycles - lastWeek.avg_cycles).toFixed(1)} cycles this week.`,
          chat_context: "My sleep is improving! What should I focus on next?",
          expires_at:   new Date(Date.now() + 48 * 3_600_000).toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("[trigger-engine] Error checking triggers:", err instanceof Error ? err.message : err);
  }

  // Sort by priority (lower = higher priority)
  return triggers.sort((a, b) => a.priority - b.priority);
}
