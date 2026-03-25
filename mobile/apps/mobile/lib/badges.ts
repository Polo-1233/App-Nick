/**
 * badges.ts — R90 Achievement Badge System
 *
 * Badges are earned by meeting specific milestones.
 * Once earned, they are stored in AsyncStorage and never lost.
 *
 * Evaluation is triggered by:
 *   - evaluateBadges() — call after any relevant action
 *
 * Badge state is read with:
 *   - loadBadges() — returns all badges with earned status
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFlow }  from './rhythm-points';
import { loadCRPRecords, loadWeekHistory } from './storage';
import { getTier } from './rhythm-tiers';
import { getPoints } from './rhythm-points';

const BADGES_KEY = '@r90:badges:v1';

// ─── Badge definitions ────────────────────────────────────────────────────────

export interface BadgeDef {
  id:          string;
  title:       string;
  description: string;
  icon:        string;   // Ionicons name
  color:       string;   // accent color
  tier:        'bronze' | 'silver' | 'gold' | 'platinum';
}

export const BADGE_DEFS: BadgeDef[] = [
  {
    id:          'first_night',
    title:       'First Night',
    description: 'Logged your first night of sleep.',
    icon:        'moon',
    color:       '#9BB5CC',
    tier:        'bronze',
  },
  {
    id:          'first_week',
    title:       'First Week',
    description: 'Maintained a 7-day streak.',
    icon:        'calendar',
    color:       '#1c9fda',
    tier:        'silver',
  },
  {
    id:          'cycle_master',
    title:       'Cycle Master',
    description: 'Completed 35 cycles in a single week.',
    icon:        'repeat',
    color:       '#3DDC97',
    tier:        'gold',
  },
  {
    id:          'recovery_pro',
    title:       'Recovery Pro',
    description: 'Completed 30 CRP recovery sessions.',
    icon:        'fitness',
    color:       '#F5A623',
    tier:        'gold',
  },
  {
    id:          'wind_down_warrior',
    title:       'Wind-Down Warrior',
    description: 'Completed 30 wind-down sessions.',
    icon:        'leaf',
    color:       '#A78BFA',
    tier:        'silver',
  },
  {
    id:          'r90_certified',
    title:       'R90 Certified',
    description: 'Reached the Aligned tier.',
    icon:        'ribbon',
    color:       '#3DDC97',
    tier:        'gold',
  },
  {
    id:          'elite_rhythm',
    title:       'Elite Rhythm',
    description: 'Reached the Balanced tier.',
    icon:        'star-half',
    color:       '#F5A623',
    tier:        'gold',
  },
  {
    id:          'nicks_inner_circle',
    title:       "Nick's Inner Circle",
    description: 'Reached R90 Master — the highest tier.',
    icon:        'star',
    color:       '#A78BFA',
    tier:        'platinum',
  },
  {
    id:          'night_owl_flip',
    title:       'Night Owl to Morning Lark',
    description: 'Changed your chronotype from PMer to AMer.',
    icon:        'sunny',
    color:       '#FBBF24',
    tier:        'silver',
  },
  {
    id:          'best_streak',
    title:       'Rhythm Streak 30',
    description: 'Reached a 30-day best streak.',
    icon:        'flame',
    color:       '#F87171',
    tier:        'platinum',
  },
];

// ─── Storage ──────────────────────────────────────────────────────────────────

/** Earned badge store: { [id]: ISO timestamp when earned } */
type BadgeStore = Record<string, string>;

export async function loadBadgeStore(): Promise<BadgeStore> {
  const raw = await AsyncStorage.getItem(BADGES_KEY).catch(() => null);
  if (!raw) return {};
  try { return JSON.parse(raw) as BadgeStore; } catch { return {}; }
}

async function saveBadgeStore(store: BadgeStore): Promise<void> {
  await AsyncStorage.setItem(BADGES_KEY, JSON.stringify(store));
}

/** Grant a badge if not already earned. Returns true if newly earned. */
async function grantBadge(store: BadgeStore, id: string): Promise<boolean> {
  if (store[id]) return false;
  store[id] = new Date().toISOString();
  return true;
}

// ─── Wind-down counter (lightweight — incremented externally) ─────────────────

const WINDDOWN_COUNT_KEY = '@r90:windDownCount:v1';

export async function incrementWindDownCount(): Promise<number> {
  const raw   = await AsyncStorage.getItem(WINDDOWN_COUNT_KEY).catch(() => null);
  const count = raw ? parseInt(raw, 10) : 0;
  const next  = count + 1;
  await AsyncStorage.setItem(WINDDOWN_COUNT_KEY, String(next));
  return next;
}

export async function getWindDownCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(WINDDOWN_COUNT_KEY).catch(() => null);
  return raw ? parseInt(raw, 10) : 0;
}

// ─── Chronotype change detector ───────────────────────────────────────────────

const INITIAL_CHRONOTYPE_KEY = '@r90:initialChronotype:v1';

export async function recordInitialChronotype(chronotype: string): Promise<void> {
  const existing = await AsyncStorage.getItem(INITIAL_CHRONOTYPE_KEY).catch(() => null);
  if (!existing) {
    await AsyncStorage.setItem(INITIAL_CHRONOTYPE_KEY, chronotype);
  }
}

export async function getInitialChronotype(): Promise<string | null> {
  return AsyncStorage.getItem(INITIAL_CHRONOTYPE_KEY).catch(() => null);
}

// ─── Badge evaluation ─────────────────────────────────────────────────────────

/**
 * Evaluate all badges against current data.
 * Call this after any action that could trigger a badge.
 *
 * Returns array of newly earned badge IDs (for celebration UI).
 */
export async function evaluateBadges(opts?: {
  currentChronotype?: string;
}): Promise<string[]> {
  const [store, flow, crpRecords, weekHistory, pointsState, windDownCount] = await Promise.all([
    loadBadgeStore(),
    getFlow(),
    loadCRPRecords(),
    loadWeekHistory(),
    getPoints(),
    getWindDownCount(),
  ]);

  const tier       = getTier(pointsState.total);
  const newlyEarned: string[] = [];

  async function check(id: string, condition: boolean) {
    if (condition) {
      const isNew = await grantBadge(store, id);
      if (isNew) newlyEarned.push(id);
    }
  }

  // first_night — at least one night logged
  await check('first_night', weekHistory.length > 0);

  // first_week — 7-day streak
  await check('first_week', flow.bestStreak >= 7);

  // cycle_master — 35 cycles in last 7 nights
  const last7CycleTotal = weekHistory
    .slice(-7)
    .reduce((sum, n) => sum + n.cyclesCompleted, 0);
  await check('cycle_master', last7CycleTotal >= 35);

  // recovery_pro — 30 CRP sessions total
  await check('recovery_pro', crpRecords.length >= 30);

  // wind_down_warrior — 30 wind-down sessions
  await check('wind_down_warrior', windDownCount >= 30);

  // r90_certified — Aligned tier (200+ pts)
  await check('r90_certified', ['aligned', 'balanced', 'master'].includes(tier.id));

  // elite_rhythm — Balanced tier (500+ pts)
  await check('elite_rhythm', ['balanced', 'master'].includes(tier.id));

  // nicks_inner_circle — R90 Master (1000+ pts)
  await check('nicks_inner_circle', tier.id === 'master');

  // night_owl_flip — chronotype changed from PMer to AMer
  if (opts?.currentChronotype === 'AMer') {
    const initial = await getInitialChronotype();
    await check('night_owl_flip', initial === 'PMer');
  }

  // best_streak — 30-day streak
  await check('best_streak', flow.bestStreak >= 30);

  if (newlyEarned.length > 0) {
    await saveBadgeStore(store);
  }

  return newlyEarned;
}

// ─── Public read API ──────────────────────────────────────────────────────────

export interface BadgeStatus extends BadgeDef {
  earned:    boolean;
  earnedAt?: string; // ISO timestamp
}

export async function loadBadges(): Promise<BadgeStatus[]> {
  const store = await loadBadgeStore();
  return BADGE_DEFS.map(def => ({
    ...def,
    earned:   !!store[def.id],
    earnedAt: store[def.id],
  }));
}
