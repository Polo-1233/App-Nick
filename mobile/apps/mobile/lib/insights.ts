/**
 * insights.ts — R90 Navigator
 *
 * Pure calculation helpers for the Insights screen.
 * UI imports these functions; they can be improved independently.
 *
 * All values are expressed in CYCLES, not hours.
 */

import type { NightRecord, UserProfile } from '@r90/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InsightsData {
  energyScore:      number;        // 0–100
  weeklyCycles:     number;        // completed cycles this week
  weeklyTarget:     number;        // target cycles this week
  sleepConsistency: number;        // 0–100 %
  sleepDebt:        number;        // signed: negative = behind, positive = ahead
  weeklyTrend:      DayTrend[];    // one entry per day in history
}

export interface DayTrend {
  date:   string;
  cycles: number;
}

// ─── Energy Score ─────────────────────────────────────────────────────────────
/**
 * computeEnergyScore — Temporary formula, structured for future replacement.
 *
 * Weights:
 *   40% — recent cycles vs target (last 3 nights)
 *   30% — weekly progress (cycles / target)
 *   20% — consistency (regularity of anchor time)
 *   10% — no debt bonus
 *
 * Returns 0–100 (integer).
 */
export function computeEnergyScore(
  history:   NightRecord[],
  profile:   UserProfile,
): number {
  if (history.length === 0) return 0;

  const target      = profile.idealCyclesPerNight ?? 5;
  const weekTarget  = profile.weeklyTarget ?? 35;

  // Recent (last 3 nights)
  const recent      = history.slice(-3);
  const recentAvg   = recent.reduce((s, n) => s + n.cyclesCompleted, 0) / recent.length;
  const recentScore = Math.min(recentAvg / target, 1) * 100;

  // Weekly progress
  const weekDone    = history.reduce((s, n) => s + n.cyclesCompleted, 0);
  const weekPct     = Math.min(weekDone / weekTarget, 1);
  const weekScore   = weekPct * 100;

  // Consistency
  const consistencyScore = computeSleepConsistency(history, profile);

  // Debt (0 = no debt bonus, positive debt = deduct)
  const debt       = computeSleepDebt(history, profile);
  const debtPenalty = debt < 0 ? Math.min(Math.abs(debt) * 5, 20) : 0;

  const raw =
    recentScore      * 0.40 +
    weekScore        * 0.30 +
    consistencyScore * 0.20 +
    (100 - debtPenalty) * 0.10;

  return Math.round(Math.min(Math.max(raw, 0), 100));
}

// ─── Weekly Cycles ────────────────────────────────────────────────────────────

export function computeWeeklyCycles(history: NightRecord[]): number {
  return history.reduce((s, n) => s + n.cyclesCompleted, 0);
}

// ─── Sleep Consistency ────────────────────────────────────────────────────────
/**
 * computeSleepConsistency — Temporary formula.
 *
 * Measures how close each night's cycles are to the nightly target.
 * A night hitting the target = 100%. Less = proportionally lower.
 *
 * Returns 0–100 (integer).
 */
export function computeSleepConsistency(
  history: NightRecord[],
  profile: UserProfile,
): number {
  if (history.length === 0) return 0;

  const target = profile.idealCyclesPerNight ?? 5;
  const scores = history.map(n => Math.min(n.cyclesCompleted / target, 1) * 100);
  const avg    = scores.reduce((s, v) => s + v, 0) / scores.length;

  return Math.round(avg);
}

// ─── Sleep Debt ───────────────────────────────────────────────────────────────
/**
 * computeSleepDebt — expressed in cycles (not hours).
 *
 * Positive = ahead of target.
 * Negative = behind target (in debt).
 *
 * Compares total cycles completed vs what you should have done by now
 * (days elapsed × daily target).
 */
export function computeSleepDebt(
  history: NightRecord[],
  profile: UserProfile,
): number {
  if (history.length === 0) return 0;

  const target = profile.idealCyclesPerNight ?? 5;
  const days   = history.length;
  const ideal  = days * target;
  const actual = computeWeeklyCycles(history);

  return actual - ideal; // negative = in debt
}

// ─── Weekly Trend ─────────────────────────────────────────────────────────────

export function computeWeeklyTrend(history: NightRecord[]): DayTrend[] {
  return history.map(n => ({ date: n.date, cycles: n.cyclesCompleted }));
}

// ─── Full Insights ────────────────────────────────────────────────────────────

export function computeInsights(
  history: NightRecord[],
  profile: UserProfile,
): InsightsData {
  return {
    energyScore:      computeEnergyScore(history, profile),
    weeklyCycles:     computeWeeklyCycles(history),
    weeklyTarget:     profile.weeklyTarget ?? 35,
    sleepConsistency: computeSleepConsistency(history, profile),
    sleepDebt:        computeSleepDebt(history, profile),
    weeklyTrend:      computeWeeklyTrend(history),
  };
}
