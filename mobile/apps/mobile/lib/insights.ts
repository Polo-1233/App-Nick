/**
 * insights.ts — R90 Navigator
 *
 * Pure calculation helpers for the Insights screen.
 * UI imports these functions; they can be improved independently.
 *
 * All values are expressed in CYCLES, not hours.
 * Language: positive, actionable — never anxiogenic.
 */

import type { NightRecord, UserProfile } from '@r90/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InsightsData {
  rhythmStrength:   number;        // 0–100 (internal — not shown as raw number in UI)
  weeklyCycles:     number;        // completed cycles this week
  weeklyTarget:     number;        // target cycles this week
  sleepConsistency: number;        // 0–100 %
  rhythmBalance:    number;        // signed: negative = building, positive = ahead
  weeklyTrend:      DayTrend[];    // one entry per day in history
}

export interface DayTrend {
  date:   string;
  cycles: number;
}

// ─── Rhythm Strength (internal score) ────────────────────────────────────────
/**
 * computeRhythmStrength — Internal score (was: computeEnergyScore).
 * NOT exposed as a raw number in the UI — use getRhythmInsightMessage() instead.
 *
 * Weights:
 *   40% — recent cycles vs target (last 3 nights)
 *   30% — weekly progress (cycles / target)
 *   20% — consistency (regularity of anchor time)
 *   10% — balance bonus
 */
export function computeRhythmStrength(
  history: NightRecord[],
  profile: UserProfile,
): number {
  if (history.length === 0) return 0;

  const target     = profile.idealCyclesPerNight ?? 5;
  const weekTarget = profile.weeklyTarget ?? 35;

  const recent     = history.slice(-3);
  const recentAvg  = recent.reduce((s, n) => s + n.cyclesCompleted, 0) / recent.length;
  const recentScore = Math.min(recentAvg / target, 1) * 100;

  const weekDone   = history.reduce((s, n) => s + n.cyclesCompleted, 0);
  const weekScore  = Math.min(weekDone / weekTarget, 1) * 100;

  const consistencyScore = computeSleepConsistency(history, profile);

  const balance    = computeRhythmBalance(history, profile);
  const balancePenalty = balance < 0 ? Math.min(Math.abs(balance) * 5, 20) : 0;

  const raw =
    recentScore      * 0.40 +
    weekScore        * 0.30 +
    consistencyScore * 0.20 +
    (100 - balancePenalty) * 0.10;

  return Math.round(Math.min(Math.max(raw, 0), 100));
}

/**
 * getRhythmInsightMessage — Human-readable message from internal score.
 * This is what the UI displays instead of the raw number.
 */
export function getRhythmInsightMessage(score: number): string {
  if (score >= 75) return 'Ton rythme est solide. Continue comme ça.';
  if (score >= 50) return 'Ton rythme se construit. Chaque cycle compte.';
  return 'Semaine chargée. R-Lo est là pour t\'aider.';
}

// ─── Weekly Cycles ────────────────────────────────────────────────────────────

export function computeWeeklyCycles(history: NightRecord[]): number {
  return history.reduce((s, n) => s + n.cyclesCompleted, 0);
}

// ─── Sleep Consistency ────────────────────────────────────────────────────────

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

/**
 * consistencyLabel — positive, constructive language only.
 */
export function consistencyLabel(pct: number): string {
  if (pct >= 90) return 'Excellent consistency';
  if (pct >= 80) return 'Strong rhythm';
  if (pct >= 65) return 'En progression';
  if (pct >= 50) return 'En construction';
  return 'En construction';
}

// ─── Rhythm Balance (was: Sleep Debt) ────────────────────────────────────────
/**
 * computeRhythmBalance — expressed in cycles.
 *
 * Positive = ahead of target.
 * Negative = building (was: "in debt" — never use that language).
 */
export function computeRhythmBalance(
  history: NightRecord[],
  profile: UserProfile,
): number {
  if (history.length === 0) return 0;
  const target = profile.idealCyclesPerNight ?? 5;
  const days   = history.length;
  const ideal  = days * target;
  const actual = computeWeeklyCycles(history);
  return actual - ideal;
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
    rhythmStrength:   computeRhythmStrength(history, profile),
    weeklyCycles:     computeWeeklyCycles(history),
    weeklyTarget:     profile.weeklyTarget ?? 35,
    sleepConsistency: computeSleepConsistency(history, profile),
    rhythmBalance:    computeRhythmBalance(history, profile),
    weeklyTrend:      computeWeeklyTrend(history),
  };
}
