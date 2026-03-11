/**
 * Time utilities for converting between formats.
 */

import type { MinuteOfDay, TimeString } from "@r90/types";

const MINUTES_IN_DAY = 1440;

/** Convert "HH:MM" to minutes since midnight. */
export function parseTime(time: TimeString): MinuteOfDay {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Convert minutes since midnight to "HH:MM". */
export function formatTime(minutes: MinuteOfDay): TimeString {
  const normalized = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Subtract minutes, wrapping around midnight. */
export function subtractMinutes(time: MinuteOfDay, minutes: number): MinuteOfDay {
  return ((time - minutes) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
}

/** Add minutes, wrapping around midnight. */
export function addMinutes(time: MinuteOfDay, minutes: number): MinuteOfDay {
  return (time + minutes) % MINUTES_IN_DAY;
}

/** Check if a time falls within a range (handles midnight wraparound). */
export function isTimeBetween(
  time: MinuteOfDay,
  start: MinuteOfDay,
  end: MinuteOfDay
): boolean {
  if (start <= end) {
    return time >= start && time <= end;
  }
  // Wraps around midnight
  return time >= start || time <= end;
}

/** Calculate duration between two times (handles midnight wraparound). */
export function duration(start: MinuteOfDay, end: MinuteOfDay): number {
  if (end >= start) return end - start;
  return MINUTES_IN_DAY - start + end;
}
