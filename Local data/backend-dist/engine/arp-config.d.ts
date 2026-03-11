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
/**
 * Generate a full ARPConfig from a committed ARP wake time.
 *
 * @param arpTime  Wake time in "HH:MM" 24h format (e.g. "06:30")
 * @param now      ISO timestamp string for generated_at (defaults to new Date())
 */
export declare function generateARPConfig(arpTime: string, now?: string): ARPConfig;
/**
 * Check whether a given time string falls within the CRP window (inclusive).
 * Handles overnight wrap-around.
 */
export declare function isInCRPWindow(timeHHMM: string, config: ARPConfig): boolean;
/**
 * Compute cycles from actual sleep onset and wake time.
 * Returns null if either input is missing.
 */
export declare function cyclesFromFormula(actualSleepOnset: string | null, wakeTime: string | null): number | null;
/**
 * Convert "HH:MM" to minutes from midnight (for comparisons).
 */
export declare function timeToMinutes(hhmm: string): number;
/**
 * Compute wake variance in minutes across a list of "HH:MM" wake times.
 * Returns null if fewer than 2 times are provided.
 */
export declare function wakeVarianceMinutes(wakeTimes: (string | null)[]): number | null;
