/**
 * Day planner — creates a timeline of blocks for the day.
 *
 * Converts a CycleWindow + calendar events into an ordered list of TimeBlocks.
 */

import type {
  CalendarEvent,
  CycleWindow,
  DayPlan,
  DateString,
  NightRecord,
  ReadinessState,
  TimeBlock,
  UserProfile,
} from "@r90/types";
import { calculateCycleWindow } from "./cycles";
import { detectConflicts } from "./conflicts";
import { selectNextAction } from "./actions";
import { generateRLoMessage } from "./rlo-messages";
import { computeReadiness } from "./readiness";
import { addMinutes, isTimeBetween } from "./time-utils";
import { CYCLE_DURATION } from "./cycles";

/**
 * Build the full day plan from inputs.
 * Computes the cycle window from the profile.
 */
export function buildDayPlan(
  profile: UserProfile,
  date: DateString,
  now: number,
  weekHistory: NightRecord[],
  calendarEvents: CalendarEvent[]
): DayPlan {
  const cycleWindow = calculateCycleWindow(profile);
  return assembleDayPlan(cycleWindow, profile, date, now, weekHistory, calendarEvents);
}

/**
 * Build a day plan using an explicitly provided CycleWindow.
 * Used when applying a conflict resolution option — the user has chosen
 * an adjusted schedule and we rebuild the plan around it without
 * overriding the engine's output with new calculations.
 */
export function buildDayPlanFromWindow(
  cycleWindow: CycleWindow,
  profile: UserProfile,
  date: DateString,
  now: number,
  weekHistory: NightRecord[],
  calendarEvents: CalendarEvent[]
): DayPlan {
  return assembleDayPlan(cycleWindow, profile, date, now, weekHistory, calendarEvents);
}

/**
 * Shared assembly logic for both buildDayPlan and buildDayPlanFromWindow.
 */
function assembleDayPlan(
  cycleWindow: CycleWindow,
  profile: UserProfile,
  date: DateString,
  now: number,
  weekHistory: NightRecord[],
  calendarEvents: CalendarEvent[]
): DayPlan {
  const readiness = computeReadiness(weekHistory, profile.weeklyTarget);
  const blocks = buildBlocks(cycleWindow, calendarEvents, readiness);
  const conflicts = detectConflicts(cycleWindow, calendarEvents);

  const ruleContext = {
    now,
    profile,
    todayPlan: cycleWindow,
    weekHistory,
    calendarEvents,
    readiness,
  };

  const nextAction = selectNextAction(ruleContext);
  const rloMessage = generateRLoMessage(ruleContext);

  return {
    date,
    blocks,
    nextAction,
    rloMessage,
    readiness,
    cycleWindow,
    conflicts,
    zoneStatus: "experimental", // TODO: Set to "confirmed" after Nick validates R050-R052 thresholds
  };
}

/**
 * Convert a CycleWindow into ordered TimeBlocks.
 * Includes CRP blocks when readiness zone is yellow/orange.
 */
function buildBlocks(
  cycleWindow: CycleWindow,
  calendarEvents: CalendarEvent[],
  readiness: ReadinessState
): TimeBlock[] {
  const blocks: TimeBlock[] = [];

  // Wake block
  blocks.push({
    start: cycleWindow.wakeTime,
    end: addMinutes(cycleWindow.wakeTime, 60),
    type: "wake",
    label: "Wake + Morning Routine",
  });

  // Calendar events
  for (const event of calendarEvents) {
    blocks.push({
      start: event.start,
      end: event.end,
      type: "calendar_event",
      label: event.title,
    });
  }

  // CRP blocks (when zone is yellow or orange)
  if (readiness.zone === "yellow" || readiness.zone === "orange") {
    // Midday CRP window: 13:00-15:00 (book-confirmed)
    const middayCRPStart = 780; // 13:00
    const middayCRPEnd = 900; // 15:00

    // Check if midday window is blocked by calendar events
    const middayBlocked = calendarEvents.some(event =>
      overlaps(event.start, event.end, middayCRPStart, middayCRPEnd)
    );

    if (!middayBlocked) {
      // Recommend 30-min CRP for yellow, 90-min for orange
      const crpDuration = readiness.zone === "orange" ? 90 : 30;
      blocks.push({
        start: middayCRPStart,
        end: addMinutes(middayCRPStart, crpDuration),
        type: "crp",
        label: `CRP — ${crpDuration} min`,
      });
    } else {
      // Fallback to evening CRP window: 17:00-19:00, 30 min only
      const eveningCRPStart = 1020; // 17:00
      const eveningCRPEnd = 1140; // 19:00

      const eveningBlocked = calendarEvents.some(event =>
        overlaps(event.start, event.end, eveningCRPStart, eveningCRPEnd)
      );

      if (!eveningBlocked) {
        blocks.push({
          start: eveningCRPStart,
          end: addMinutes(eveningCRPStart, 30), // Evening CRP is always 30 min
          type: "crp",
          label: "CRP — 30 min",
        });
      }
    }
  }

  // Pre-sleep routine (90 minutes before bedtime)
  blocks.push({
    start: cycleWindow.preSleepStart,
    end: cycleWindow.bedtime,
    type: "pre_sleep",
    label: "Pre-Sleep Routine",
  });

  // Down-period only appears for post-event protocol (not normal nights)
  if (cycleWindow.downPeriodStart !== undefined) {
    blocks.push({
      start: cycleWindow.downPeriodStart,
      end: cycleWindow.bedtime,
      type: "down_period",
      label: "Down Period — Adrenaline Clearance",
    });
  }

  // Sleep cycles
  for (let i = 0; i < cycleWindow.cycleCount; i++) {
    const start = addMinutes(cycleWindow.bedtime, i * CYCLE_DURATION);
    const end = addMinutes(start, CYCLE_DURATION);
    blocks.push({
      start,
      end,
      type: "sleep_cycle",
      label: `Sleep Cycle ${i + 1}`,
    });
  }

  // Sort blocks relative to anchor time (day starts at anchor, not midnight)
  // Blocks after anchor sort before blocks before anchor
  const anchorTime = cycleWindow.wakeTime;
  blocks.sort((a, b) => {
    const aRelative = (a.start - anchorTime + 1440) % 1440;
    const bRelative = (b.start - anchorTime + 1440) % 1440;
    return aRelative - bRelative;
  });

  return blocks;
}

/**
 * Check if two time ranges overlap (handles midnight wraparound).
 */
function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  // Check if either endpoint of range A falls within range B
  if (isTimeBetween(aStart, bStart, bEnd)) return true;
  if (isTimeBetween(aEnd, bStart, bEnd)) return true;

  // Check if either endpoint of range B falls within range A
  if (isTimeBetween(bStart, aStart, aEnd)) return true;
  if (isTimeBetween(bEnd, aStart, aEnd)) return true;

  return false;
}
