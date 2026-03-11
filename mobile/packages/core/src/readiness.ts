/**
 * Readiness zone computation.
 *
 * Rule references: R050, R051, R052, R053
 * TODO_NICK: All zone thresholds need validation (Q01, Q05).
 */

import type { NightRecord, ReadinessState, ReadinessZone } from "@r90/types";

/**
 * Compute readiness state from recent night history.
 *
 * Rule R050: Green = last 3 nights avg >= 4.5 cycles
 * Rule R051: Yellow = last 3 nights avg 3-4.5 cycles
 * Rule R052: Orange = last 3 nights avg < 3 cycles
 * Rule R053: NEVER shown as a number.
 */
export function computeReadiness(
  weekHistory: NightRecord[],
  weeklyTarget: number
): ReadinessState {
  const recentNights = weekHistory.slice(-3);
  const recentCycles = recentNights.map((n) => n.cyclesCompleted);
  const weeklyTotal = weekHistory.reduce((sum, n) => sum + n.cyclesCompleted, 0);

  const zone = determineZone(recentCycles);

  return {
    zone,
    recentCycles,
    weeklyTotal,
    weeklyTarget,
  };
}

function determineZone(recentCycles: number[]): ReadinessZone {
  if (recentCycles.length === 0) return "green"; // No data yet, assume fresh start

  const avg = recentCycles.reduce((a, b) => a + b, 0) / recentCycles.length;

  // TODO_NICK: Q05 — Confirm these thresholds
  if (avg >= 4.5) return "green";
  if (avg >= 3) return "yellow";
  return "orange";
}
