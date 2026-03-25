/**
 * challenges.ts — R90 Weekly Challenges
 *
 * Each Monday, the user gets a new challenge aligned with R90 KSPIs.
 * Challenges rotate on a 4-week cycle.
 *
 * Completing a challenge awards bonus Rhythm Points and
 * triggers a celebration message from R-Lo.
 *
 * Architecture:
 *   - Challenges are defined statically (no backend needed)
 *   - Progress is tracked in AsyncStorage
 *   - The HomeScreen shows the active challenge as a SecondaryCard
 *   - Completion is checked when relevant actions are performed
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CHALLENGE_KEY  = '@r90:challenge:v1';
const CHALLENGE_WEEK = '@r90:challenge:week:v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Challenge {
  id:          string;
  title:       string;
  description: string;
  icon:        string;      // Ionicons name
  color:       string;      // accent color for the challenge
  target:      number;      // e.g. 7 (ARP confirms), 5 (CRP completions)
  metric:      ChallengeMetric;
  bonusPoints: number;      // awarded on completion
}

export type ChallengeMetric =
  | 'arp_confirms'     // morning confirmations this week
  | 'crp_completions'  // CRP sessions this week
  | 'winddown_completions' // wind-downs this week
  | 'total_cycles';    // total sleep cycles this week

export interface ChallengeProgress {
  challengeId: string;
  weekStart:   string;    // ISO date of Monday
  current:     number;    // current progress toward target
  completed:   boolean;
  completedAt?: string;   // ISO date when completed
}

// ─── Challenge pool (4-week rotation) ─────────────────────────────────────────

export const CHALLENGE_POOL: Challenge[] = [
  {
    id:          'rhythm-week',
    title:       'Rhythm Week',
    description: 'Confirm your wake time 7 days in a row',
    icon:        'sunny-outline',
    color:       '#F2A623',
    target:      7,
    metric:      'arp_confirms',
    bonusPoints: 25,
  },
  {
    id:          'recovery-week',
    title:       'Recovery Week',
    description: 'Complete 5 CRP sessions this week',
    icon:        'fitness-outline',
    color:       '#3DDC97',
    target:      5,
    metric:      'crp_completions',
    bonusPoints: 30,
  },
  {
    id:          'winddown-week',
    title:       'Wind-Down Week',
    description: 'Complete 5 wind-downs with audio content',
    icon:        'moon-outline',
    color:       '#A78BFA',
    target:      5,
    metric:      'winddown_completions',
    bonusPoints: 30,
  },
  {
    id:          'perfect-cycle',
    title:       'Perfect Cycle Week',
    description: 'Reach 35 cycles this week',
    icon:        'trophy-outline',
    color:       '#1c9fda',
    target:      35,
    metric:      'total_cycles',
    bonusPoints: 50,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOfThisWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get this week's active challenge.
 * Rotates through the pool based on week number.
 */
export function getActiveChallenge(): Challenge {
  const weekNum = getWeekNumber();
  return CHALLENGE_POOL[weekNum % CHALLENGE_POOL.length];
}

/**
 * Get the current progress for this week's challenge.
 */
export async function getChallengeProgress(): Promise<ChallengeProgress> {
  const challenge = getActiveChallenge();
  const monday    = getMondayOfThisWeek();

  const raw = await AsyncStorage.getItem(CHALLENGE_KEY).catch(() => null);
  if (raw) {
    const progress = JSON.parse(raw) as ChallengeProgress;
    // Same week and same challenge? Return it
    if (progress.weekStart === monday && progress.challengeId === challenge.id) {
      return progress;
    }
  }

  // New week or different challenge → reset
  const fresh: ChallengeProgress = {
    challengeId: challenge.id,
    weekStart:   monday,
    current:     0,
    completed:   false,
  };
  await AsyncStorage.setItem(CHALLENGE_KEY, JSON.stringify(fresh));
  return fresh;
}

/**
 * Increment progress for a specific metric.
 * Call this from the relevant action handlers (morning confirm, CRP complete, etc.)
 *
 * Returns true if the challenge was just completed (for celebration).
 */
export async function incrementChallengeProgress(
  metric: ChallengeMetric,
  amount = 1,
): Promise<{ justCompleted: boolean }> {
  const challenge = getActiveChallenge();
  if (challenge.metric !== metric) return { justCompleted: false };

  const progress = await getChallengeProgress();
  if (progress.completed) return { justCompleted: false };

  const newCurrent = progress.current + amount;
  const justCompleted = newCurrent >= challenge.target;

  const updated: ChallengeProgress = {
    ...progress,
    current:     Math.min(newCurrent, challenge.target),
    completed:   justCompleted,
    completedAt: justCompleted ? new Date().toISOString() : undefined,
  };

  await AsyncStorage.setItem(CHALLENGE_KEY, JSON.stringify(updated));
  return { justCompleted };
}
