/**
 * Cycle calculation engine.
 *
 * Core principle: All cycles calculate BACKWARD from the anchor (wake) time.
 * Rule references: R001, R002, R003, R004, R005, R010, R011
 */

import type { CycleWindow, MinuteOfDay, UserProfile } from "@r90/types";
import { subtractMinutes } from "./time-utils";

const CYCLE_DURATION = 90; // minutes — CONFIRMED (book ch. 3)
const PRE_SLEEP_DURATION = 90; // minutes — CONFIRMED (book ch. 4: single 90-min pre-sleep routine)
const DOWN_PERIOD_DURATION = 90; // minutes — TODO_NICK: adrenaline clearance (post-event only)

/**
 * Calculate the ideal cycle window for a night.
 * Rule R001: Bedtime = Anchor - (cycles × 90)
 * Rule R010: Pre-sleep routine = 90 min before bedtime (CONFIRMED from book ch. 4)
 */
export function calculateCycleWindow(
  profile: UserProfile,
  targetCycles?: number
): CycleWindow {
  const cycles = targetCycles ?? profile.idealCyclesPerNight;
  const sleepDuration = cycles * CYCLE_DURATION;

  const bedtime = subtractMinutes(profile.anchorTime, sleepDuration);
  const preSleepStart = subtractMinutes(bedtime, PRE_SLEEP_DURATION);

  return {
    bedtime,
    wakeTime: profile.anchorTime,
    cycleCount: cycles,
    preSleepStart,
    // downPeriodStart omitted for normal nights — only used in post-event protocol
  };
}

/**
 * Recalculate when the ideal bedtime has been missed.
 * Rule R004: Drop 1 cycle and recalculate to next available start.
 * Rule R005: Never fewer than 2 cycles. (TODO_NICK: Q02)
 */
export function recalculateFromMissedBedtime(
  profile: UserProfile,
  currentTime: MinuteOfDay,
  minimumCycles: number = 2
): CycleWindow | null {
  for (let cycles = profile.idealCyclesPerNight - 1; cycles >= minimumCycles; cycles--) {
    const window = calculateCycleWindow(profile, cycles);
    // Check if this bedtime is still in the future relative to currentTime
    if (isBedtimeReachable(currentTime, window.bedtime, profile.anchorTime)) {
      return window;
    }
  }
  return null; // Cannot fit minimum cycles before anchor
}

/**
 * Calculate bedtime for a late event scenario.
 * Rule R013: Adrenaline clearance = 90 min after event ends.
 * Rule R014: Accept delayed start, don't force early sleep.
 */
export function calculatePostEventWindow(
  profile: UserProfile,
  eventEndTime: MinuteOfDay,
  minimumCycles: number = 2
): CycleWindow | null {
  const earliestBedtime = (eventEndTime + DOWN_PERIOD_DURATION) % 1440;

  for (let cycles = profile.idealCyclesPerNight; cycles >= minimumCycles; cycles--) {
    const requiredSleep = cycles * CYCLE_DURATION;
    const bedtime = subtractMinutes(profile.anchorTime, requiredSleep);

    // The bedtime must be at or after earliestBedtime
    if (isBedtimeReachable(earliestBedtime, bedtime, profile.anchorTime)) {
      return {
        bedtime,
        wakeTime: profile.anchorTime,
        cycleCount: cycles,
        downPeriodStart: eventEndTime,
        preSleepStart: eventEndTime, // Pre-sleep happens during down-period in this case
      };
    }
  }
  return null;
}

/**
 * Check if a bedtime is reachable given current time and anchor.
 * Handles midnight wraparound.
 */
function isBedtimeReachable(
  currentTime: MinuteOfDay,
  bedtime: MinuteOfDay,
  anchorTime: MinuteOfDay
): boolean {
  // Normalize: think of the timeline as starting from anchorTime
  const normalizedCurrent = (currentTime - anchorTime + 1440) % 1440;
  const normalizedBedtime = (bedtime - anchorTime + 1440) % 1440;
  return normalizedBedtime >= normalizedCurrent;
}

export { CYCLE_DURATION, PRE_SLEEP_DURATION, DOWN_PERIOD_DURATION };
