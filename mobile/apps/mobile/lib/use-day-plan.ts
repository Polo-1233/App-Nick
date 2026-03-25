/**
 * Hook to build today's day plan from the core engine.
 * Loads real data from storage (profile, week history, calendar events).
 *
 * Design notes:
 * - `loading` is only true during the initial mount fetch; background refreshes are silent.
 * - `refreshPlan()` can be called by any consumer (e.g. after logging a night).
 * - `applyConflictOption(window)` rebuilds the plan with a user-chosen cycle window
 *   without re-fetching data — purely in-memory, instant update.
 * - `AppState` listener triggers a silent refresh when the app comes to the foreground.
 * - `hasFetched` ref guards against React Strict Mode double-invocation on mount.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import type { CycleWindow, DayPlan, CalendarEvent, NightRecord, UserProfile } from "@r90/types";
import { buildDayPlan, buildDayPlanFromWindow } from "@r90/core";
import { loadProfile, loadWeekHistory, PERMISSION_KEYS } from "./storage";
import { fetchAllCalendarEvents } from "./calendar-unified";
import { writeAllSleepBlocks } from "./calendar-writeback";
import { loadWindDownEnabled, scheduleWindDownForToday } from "./wind-down";
import { scheduleAllNotifications } from "./notifications";
import { nowMin as getCurrentMinute } from "./time-utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateWidgetData } from "./widget-data";
import { fmtMin } from "./time-utils";

/** Raw inputs cached after each successful plan build, used by applyConflictOption. */
interface CachedBuildInputs {
  profile: UserProfile;
  weekHistory: NightRecord[];
  calendarEvents: CalendarEvent[];
  date: string;
}

export function useDayPlan() {
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  // Cached inputs for conflict resolution — no re-fetch needed when applying options
  const cachedInputs = useRef<CachedBuildInputs | null>(null);
  // Guard against React Strict Mode double-invocation on initial mount
  const hasFetched = useRef(false);

  /**
   * Core plan loading logic.
   * @param isInitial    - manages the `loading` state; silent refreshes pass false.
   * @param isBackground - when true (AppState foreground), skips permission request
   *                       so we never trigger the OS dialog outside onboarding.
   */
  const loadPlan = useCallback(async (isInitial: boolean, isBackground = false) => {
    try {
      if (isInitial) {
        setLoading(true);
        setError(null);
      }

      const profile = await loadProfile();
      const weekHistory = await loadWeekHistory();

      if (!profile) {
        setNeedsOnboarding(true);
        if (isInitial) setLoading(false);
        return;
      }

      const now = getCurrentMinute();
      const today = new Date().toISOString().split("T")[0];

      // Background refreshes must NOT request permission (OS dialog risk).
      // fetchTodayEvents() checks permission internally and returns [] if denied.
      const calendarEvents = await fetchAllCalendarEvents({ silent: isBackground });

      // Cache inputs so applyConflictOption can rebuild without re-fetching
      cachedInputs.current = { profile, weekHistory, calendarEvents, date: today };

      const plan = buildDayPlan(profile, today, now, weekHistory, calendarEvents);

      setDayPlan(plan);
      if (isInitial) setLoading(false);

      // Update iOS widget data (best-effort, never throws).
      void (async () => {
        try {
          // ── Derived metrics ──────────────────────────────────────────────
          // Streak: consecutive days where cyclesCompleted >= idealCyclesPerNight
          const sorted = [...weekHistory].sort((a, b) => b.date.localeCompare(a.date));
          let streak = 0;
          for (const night of sorted) {
            if (night.cyclesCompleted >= profile.idealCyclesPerNight) streak++;
            else break;
          }

          // Rhythm score: (weeklyTotal / weeklyTarget) * 100, capped at 100
          const rawScore = plan.readiness.weeklyTarget > 0
            ? (plan.readiness.weeklyTotal / plan.readiness.weeklyTarget) * 100
            : 0;
          const rhythmScore = Math.min(100, Math.round(rawScore));

          // Level label + color based on readiness zone
          const levelMap: Record<string, { label: string; color: string }> = {
            green:  { label: 'Attuned',    color: '#3DDC97' },
            yellow: { label: 'Building',   color: '#FBBF24' },
            orange: { label: 'Recovering', color: '#F5A623' },
          };
          const level = levelMap[plan.readiness.zone] ?? levelMap.yellow;

          // Next event from nextAction (if it has a scheduled time)
          let nextEvent: string | null = null;
          let nextEventType: string | null = null;
          let nextEventMin: number | null = null;
          if (plan.nextAction.scheduledAt != null) {
            nextEventMin = plan.nextAction.scheduledAt - now;
            if (nextEventMin > 0) {
              const hrs = Math.floor(nextEventMin / 60);
              const mins = nextEventMin % 60;
              nextEvent = hrs > 0
                ? `${plan.nextAction.title} in ${hrs}h ${mins}m`
                : `${plan.nextAction.title} in ${mins}m`;
              nextEventType = plan.nextAction.type;
            }
          }

          await updateWidgetData({
            streak,
            rhythmScore,
            nextEvent,
            nextEventType,
            nextEventMin,
            sleepWindow: fmtMin(plan.cycleWindow.bedtime),
            wakeTime:    fmtMin(plan.cycleWindow.wakeTime),
            currentCycle: plan.readiness.weeklyTotal,
            totalCycles:  plan.readiness.weeklyTarget,
            rloMessage:   plan.rloMessage.text,
            levelLabel:   level.label,
            levelColor:   level.color,
            updatedAt:    new Date().toISOString(),
          });
        } catch (e) {
          if (__DEV__) console.warn('[useDayPlan] updateWidgetData failed:', e);
        }
      })();

      // Write sleep blocks to calendar (best-effort, once per day, non-blocking).
      void writeAllSleepBlocks(plan);

      // Schedule notifications (best-effort, never throws).
      // Includes wind-down reminder + anchor / pre-sleep / CRP / log nudge.
      void (async () => {
        try {
          const [enabled, permResult] = await Promise.all([
            loadWindDownEnabled(),
            AsyncStorage.getItem(PERMISSION_KEYS.NOTIFICATIONS),
          ]);
          if (permResult === 'granted') {
            // All R90 notifications (idempotent, safe on every refresh)
            await scheduleAllNotifications(profile, plan, weekHistory);
            // Wind-down notification (separate scheduler, idempotent)
            if (enabled) await scheduleWindDownForToday({ profile, plan });
          }
        } catch (e) {
          console.warn('[useDayPlan] notification scheduling skipped:', e);
        }
      })();
    } catch (err) {
      console.error('[useDayPlan] Failed to load plan:', err);
      if (isInitial) {
        setError('Could not load your sleep plan. Please try again.');
        setLoading(false);
      }
    }
  }, []); // stable — only uses state setters and pure imports

  // Initial load (guarded against double-invoke)
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadPlan(true);
  }, [loadPlan]);

  // Silent refresh when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") loadPlan(false, true);
    });
    return () => sub.remove();
  }, [loadPlan]);

  /** Manually trigger a silent plan refresh (e.g. after logging a night). */
  const refreshPlan = useCallback(() => {
    loadPlan(false);
  }, [loadPlan]);

  /**
   * Apply a conflict resolution option.
   * Instantly rebuilds the day plan around the chosen CycleWindow
   * without re-fetching any data. Engine sovereignty is preserved —
   * the adjusted window was computed by generateConflictOptions().
   */
  const applyConflictOption = useCallback((adjustedWindow: CycleWindow) => {
    const inputs = cachedInputs.current;
    if (!inputs) {
      console.warn('[useDayPlan] applyConflictOption called before plan was loaded');
      return;
    }
    const now = getCurrentMinute();
    const newPlan = buildDayPlanFromWindow(
      adjustedWindow,
      inputs.profile,
      inputs.date,
      now,
      inputs.weekHistory,
      inputs.calendarEvents
    );
    setDayPlan(newPlan);
  }, []);

  return { dayPlan, loading, error, needsOnboarding, refreshPlan, applyConflictOption };
}
