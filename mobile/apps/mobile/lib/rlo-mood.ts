/**
 * rlo-mood.ts — R-LO emotional state engine
 *
 * Maps user's rhythm data → R-LO emotion.
 * Priority: readiness zone override > streak.
 *
 * Rules:
 *   - zone orange  → 'inquiet'     (recovery needed)
 *   - zone yellow  → 'Reflexion'   (attentive, neutral)
 *   - streak 0     → 'rassurante'  (calm, welcoming)
 *   - streak 1-2   → 'encourageant'
 *   - streak 3-6   → 'Fiere'
 *   - streak 7-13  → 'Enthousisate'
 *   - streak ≥ 14  → 'celebration'
 */

import type { MascotEmotion } from '../components/ui/MascotImage';

export type ReadinessZone = 'green' | 'yellow' | 'orange' | null;

export interface MoodInput {
  streak:       number;
  zone?:        ReadinessZone;
  weekAligned?: number;  // 0–7
}

export function getRLoMood({ streak, zone }: MoodInput): MascotEmotion {
  // Zone override — readiness takes priority over streak
  if (zone === 'orange') return 'inquiet';
  if (zone === 'yellow') return 'Reflexion';

  // Streak-based
  if (streak >= 14) return 'celebration';
  if (streak >= 7)  return 'Enthousisate';
  if (streak >= 3)  return 'Fiere';
  if (streak >= 1)  return 'encourageant';
  return 'rassurante';
}

// ─── Milestone detection ──────────────────────────────────────────────────────

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export function isMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}

export function getMilestoneMessage(streak: number): string | null {
  switch (streak) {
    case 3:   return `3 days aligned. Your rhythm is building.`;
    case 7:   return `A full week of rhythm. That's rare — and it shows.`;
    case 14:  return `Two weeks consistent. R-Lo is genuinely impressed.`;
    case 30:  return `30 days. Your body knows what it's doing now.`;
    case 60:  return `60 days of rhythm. This is who you are now.`;
    case 100: return `100 days. You've mastered the R90 method.`;
    default:  return null;
  }
}

// ─── R-LO mood message (short, contextual) ────────────────────────────────────

export function getMoodMessage(input: MoodInput): string {
  const { streak, zone, weekAligned = 0 } = input;

  if (zone === 'orange') {
    return 'Your body is asking for recovery. Prioritise sleep tonight.';
  }
  if (zone === 'yellow') {
    return 'Steady rhythm. A focused wind-down will help tonight.';
  }
  if (streak >= 14) {
    return `${streak} days of consistent rhythm. You're exceptional.`;
  }
  if (streak >= 7) {
    return `${streak}-day flow. Your rhythm is locked in.`;
  }
  if (streak >= 3) {
    return `${streak} days aligned — momentum is building.`;
  }
  if (streak === 1 || streak === 2) {
    return 'Good start. Keep the wake time consistent tomorrow.';
  }
  if (weekAligned >= 4) {
    return `${weekAligned}/7 days this week. Solid consistency.`;
  }
  return 'Every day is a fresh start. Your rhythm begins with waking up.';
}
