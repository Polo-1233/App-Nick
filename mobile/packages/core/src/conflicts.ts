/**
 * Conflict detection — finds calendar events that overlap with recovery windows.
 *
 * Rule references: R030, R031, R032, R033
 */

import type {
  CalendarEvent,
  Conflict,
  ConflictOption,
  CycleWindow,
  UserProfile,
} from "@r90/types";
import { isTimeBetween } from "./time-utils";
import { calculateCycleWindow } from "./cycles";

/**
 * Detect conflicts between calendar events and the cycle window.
 * Rule R030: If event overlaps with pre-sleep, offer options.
 * Rule R031: Anchor time is NEVER moved.
 */
export function detectConflicts(
  cycleWindow: CycleWindow,
  events: CalendarEvent[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const event of events) {
    // Check overlap with pre-sleep window (preSleepStart → bedtime)
    if (
      overlaps(event.start, event.end, cycleWindow.preSleepStart, cycleWindow.bedtime)
    ) {
      conflicts.push({
        event,
        overlapsWith: "pre_sleep",
        severity: "minor",
        description: `"${event.title}" overlaps with your pre-sleep routine.`,
      });
    }

    // Check overlap with sleep cycles (bedtime → wakeTime)
    if (
      overlaps(event.start, event.end, cycleWindow.bedtime, cycleWindow.wakeTime)
    ) {
      conflicts.push({
        event,
        overlapsWith: "sleep_cycle",
        severity: "major",
        description: `"${event.title}" overlaps with your sleep window.`,
      });
    }

    // Down-period conflicts only checked for post-event protocol
    if (cycleWindow.downPeriodStart !== undefined) {
      if (
        overlaps(event.start, event.end, cycleWindow.downPeriodStart, cycleWindow.bedtime)
      ) {
        conflicts.push({
          event,
          overlapsWith: "down_period",
          severity: "major",
          description: `"${event.title}" overlaps with your post-event down-period.`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Generate resolution options for a conflict.
 * Rule R033: R-Lo presents options, never demands.
 */
export function generateConflictOptions(
  conflict: Conflict,
  profile: UserProfile
): ConflictOption[] {
  const options: ConflictOption[] = [];

  if (conflict.overlapsWith === "pre_sleep") {
    // Option A: Keep full schedule — the event overlaps the wind-down but cycles are preserved.
    // The plan is unchanged: 90-min pre-sleep + full cycle count.
    const fullWindow = calculateCycleWindow(profile, profile.idealCyclesPerNight);
    options.push({
      label: "Keep full schedule",
      description: `90-min wind-down + ${profile.idealCyclesPerNight} cycles — event overlaps your wind-down`,
      adjustedPlan: fullWindow,
    });

    // Option B: Drop 1 cycle — bedtime shifts later, clearing the conflict.
    const reducedWindow = calculateCycleWindow(profile, profile.idealCyclesPerNight - 1);
    options.push({
      label: "Later bedtime, fewer cycles",
      description: `90-min wind-down + ${profile.idealCyclesPerNight - 1} cycles — bedtime shifts later`,
      adjustedPlan: reducedWindow,
    });
  }

  if (conflict.overlapsWith === "sleep_cycle") {
    // Drop 1 cycle so bedtime shifts later (past the conflicting event)
    const reducedWindow = calculateCycleWindow(profile, profile.idealCyclesPerNight - 1);
    options.push({
      label: "Later bedtime",
      description: `${profile.idealCyclesPerNight - 1} cycles — sleep after the event`,
      adjustedPlan: reducedWindow,
    });
  }

  // down_period conflicts are engine-calculated post-event blocks; no adjustable options.

  return options;
}

/**
 * Check if two time ranges overlap (handles midnight wraparound).
 * Uses isTimeBetween to correctly handle ranges that cross midnight.
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
