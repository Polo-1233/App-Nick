/**
 * rhythm-tiers.ts — User progression tiers based on total Rhythm Points
 *
 * 5 levels. No penalty. Pure positive progression.
 */

export interface RhythmTier {
  id:         string;
  label:      string;
  icon:       string;    // Ionicons name
  minPoints:  number;
  maxPoints:  number;    // -1 = no cap
  color:      string;
  message:    string;    // shown in StreakDetail
}

export const TIERS: RhythmTier[] = [
  {
    id:        'beginner',
    label:     'Beginner',
    icon:      'moon-outline',
    minPoints: 0,
    maxPoints: 49,
    color:     '#9BB5CC',
    message:   'Your rhythm journey starts here.',
  },
  {
    id:        'consistent',
    label:     'Consistent',
    icon:      'repeat-outline',
    minPoints: 50,
    maxPoints: 199,
    color:     '#1c9fda',
    message:   'Building a real habit. Keep showing up.',
  },
  {
    id:        'aligned',
    label:     'Aligned',
    icon:      'checkmark-circle-outline',
    minPoints: 200,
    maxPoints: 499,
    color:     '#3DDC97',
    message:   'Your body and schedule are in sync.',
  },
  {
    id:        'balanced',
    label:     'Balanced',
    icon:      'ribbon-outline',
    minPoints: 500,
    maxPoints: 999,
    color:     '#F5A623',
    message:   'You\'ve mastered the basics. Elite performance.',
  },
  {
    id:        'master',
    label:     'R90 Master',
    icon:      'star',
    minPoints: 1000,
    maxPoints: -1,
    color:     '#A78BFA',
    message:   'You are R90. This is who you are.',
  },
];

export function getTier(totalPoints: number): RhythmTier {
  return [...TIERS].reverse().find(t => totalPoints >= t.minPoints) ?? TIERS[0]!;
}

export function getProgressToNextTier(totalPoints: number): {
  tier:       RhythmTier;
  next:       RhythmTier | null;
  pct:        number;     // 0–1
  pointsLeft: number;
} {
  const tier = getTier(totalPoints);
  const idx  = TIERS.indexOf(tier);
  const next = idx < TIERS.length - 1 ? TIERS[idx + 1]! : null;

  if (!next || tier.maxPoints === -1) {
    return { tier, next: null, pct: 1, pointsLeft: 0 };
  }

  const range     = tier.maxPoints - tier.minPoints + 1;
  const earned    = totalPoints - tier.minPoints;
  const pct       = Math.min(1, earned / range);
  const pointsLeft = tier.maxPoints - totalPoints + 1;

  return { tier, next, pct, pointsLeft };
}
