/**
 * R90 Engine — ARP Config Generator
 *
 * Pure function. No I/O. No side effects.
 *
 * Formula (from R90_RULE_ENGINE_SPEC.md):
 *   C_n = ARP + (n − 1) × 90 min   for n = 1..16
 *   sleep_onset_N = ARP − (N × 90 min)
 *   CRP window = C6..C9
 *   Phase boundaries: P1=C1, P2=C5, P3=C9, P4=C13
 *   MRM times = waking cycle boundaries C1..C9 (Phase 1 through Phase 3)
 */

import type { ARPConfig } from "./types.js";

/** Parse "HH:MM" → total minutes from midnight */
function parseTime(hhmm: string): number {
  const parts = hhmm.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

/** Format total minutes from midnight → "HH:MM" (24h, wraps at 24h) */
function formatTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Generate a full ARPConfig from a committed ARP wake time.
 *
 * @param arpTime  Wake time in "HH:MM" 24h format (e.g. "06:30")
 * @param now      ISO timestamp string for generated_at (defaults to new Date())
 */
export function generateARPConfig(arpTime: string, now?: string): ARPConfig {
  const arpMinutes = parseTime(arpTime);

  // C1..C16: C_n = ARP + (n−1) × 90
  const cycleTimes: string[] = [];
  for (let n = 1; n <= 16; n++) {
    cycleTimes.push(formatTime(arpMinutes + (n - 1) * 90));
  }

  // Phase boundaries (0-indexed → C1=index 0, C5=index 4, C9=index 8, C13=index 12)
  // Array always has 16 elements; non-null assertions are safe here.
  const phase1Start = cycleTimes[0]!;  // C1 = ARP
  const phase2Start = cycleTimes[4]!;  // C5
  const phase3Start = cycleTimes[8]!;  // C9
  const phase4Start = cycleTimes[12]!; // C13

  // CRP window: C6 open, C9 close (inclusive)
  const crpWindowOpen  = cycleTimes[5]!; // C6
  const crpWindowClose = cycleTimes[8]!; // C9

  // Sleep onset options: ARP − (N × 90 min)
  const sleepOnset6Cycle = formatTime(arpMinutes - 6 * 90);
  const sleepOnset5Cycle = formatTime(arpMinutes - 5 * 90);
  const sleepOnset4Cycle = formatTime(arpMinutes - 4 * 90);
  const sleepOnset3Cycle = formatTime(arpMinutes - 3 * 90);

  // MRM times: C1..C9 (waking phases — Phase 1 through Phase 3 start)
  // C10 and beyond are nighttime/sleep phase boundaries, not MRM triggers
  const mrmTimes = cycleTimes.slice(0, 9); // C1..C9

  return {
    arp_time: arpTime,
    cycle_times: cycleTimes,
    crp_window_open: crpWindowOpen,
    crp_window_close: crpWindowClose,
    sleep_onset_6cycle: sleepOnset6Cycle,
    sleep_onset_5cycle: sleepOnset5Cycle,
    sleep_onset_4cycle: sleepOnset4Cycle,
    sleep_onset_3cycle: sleepOnset3Cycle,
    mrm_times: mrmTimes,
    phase_1_start: phase1Start,
    phase_2_start: phase2Start,
    phase_3_start: phase3Start,
    phase_4_start: phase4Start,
    generated_at: now ?? new Date().toISOString(),
  };
}

/**
 * Check whether a given time string falls within the CRP window (inclusive).
 * Handles overnight wrap-around.
 */
export function isInCRPWindow(
  timeHHMM: string,
  config: ARPConfig
): boolean {
  const t = parseTime(timeHHMM);
  const open = parseTime(config.crp_window_open);
  const close = parseTime(config.crp_window_close);

  if (open <= close) {
    return t >= open && t <= close;
  }
  // Window wraps midnight
  return t >= open || t <= close;
}

/**
 * Compute cycles from actual sleep onset and wake time.
 * Returns null if either input is missing.
 */
export function cyclesFromFormula(
  actualSleepOnset: string | null,
  wakeTime: string | null
): number | null {
  if (!actualSleepOnset || !wakeTime) return null;
  const onset = parseTime(actualSleepOnset);
  let wake = parseTime(wakeTime);
  // Handle overnight: if wake < onset, add 24h
  if (wake < onset) wake += 1440;
  return Math.floor((wake - onset) / 90);
}

/**
 * Convert "HH:MM" to minutes from midnight (for comparisons).
 */
export function timeToMinutes(hhmm: string): number {
  return parseTime(hhmm);
}

/**
 * Compute wake variance in minutes across a list of "HH:MM" wake times.
 * Returns null if fewer than 2 times are provided.
 */
export function wakeVarianceMinutes(wakeTimes: (string | null)[]): number | null {
  const valid = wakeTimes
    .filter((t): t is string => t != null)
    .map(parseTime);
  if (valid.length < 2) return null;
  return Math.max(...valid) - Math.min(...valid);
}
