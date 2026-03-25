/**
 * onboarding-guide.ts — Two-layer onboarding system
 *
 * LAYER 1: Quick orientation (3 steps on Home, shown once after first login)
 * LAYER 2: Progressive discovery (contextual tooltips, shown once per feature)
 *
 * All state is persisted per-user in AsyncStorage.
 * Each guide item is shown exactly once, then permanently dismissed.
 *
 * Adding a new tooltip:
 *   1. Add a key to GUIDE_KEYS
 *   2. Call `shouldShowGuide('your_key')` before rendering
 *   3. Call `markGuideSeen('your_key')` when dismissed
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Keys ─────────────────────────────────────────────────────────────────────

const PREFIX = '@r90:guide:';

/**
 * All guide items. Add new ones here.
 * Layer 1 = home_* (quick orientation)
 * Layer 2 = feat_* (progressive discovery)
 */
export const GUIDE_KEYS = {
  // Layer 1 — Home orientation (3 steps)
  HOME_RHYTHM:    'home_rhythm',     // "This is your day"
  HOME_ACTION:    'home_action',     // "This is what matters now"
  HOME_RLO:       'home_rlo',        // "I'll guide you through it"

  // Layer 2 — Feature discovery (shown contextually)
  FEAT_MRM:       'feat_mrm',        // First MRM player open
  FEAT_CRP:       'feat_crp',        // First CRP player open
  FEAT_WINDDOWN:  'feat_winddown',   // First wind-down start
  FEAT_INSIGHTS:  'feat_insights',   // First Insights tab visit
  FEAT_PLANNING:  'feat_planning',   // First Planning tab visit
  FEAT_STREAK:    'feat_streak',     // First streak badge tap
  FEAT_PROFILE:   'feat_profile',    // First Profile tab visit
  FEAT_CHALLENGE: 'feat_challenge',  // First weekly challenge seen
} as const;

export type GuideKey = typeof GUIDE_KEYS[keyof typeof GUIDE_KEYS];

// ─── Persistence ──────────────────────────────────────────────────────────────

function storageKey(key: GuideKey): string {
  return `${PREFIX}${key}`;
}

/**
 * Check if a guide item should be shown (not yet seen).
 */
export async function shouldShowGuide(key: GuideKey): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(storageKey(key));
    return val !== 'seen';
  } catch {
    return false;
  }
}

/**
 * Mark a guide item as seen (permanently dismissed).
 */
export async function markGuideSeen(key: GuideKey): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(key), 'seen');
  } catch {
    // non-critical
  }
}

/**
 * Check if all Layer 1 home orientation steps have been seen.
 */
export async function hasCompletedHomeOrientation(): Promise<boolean> {
  try {
    const keys = [GUIDE_KEYS.HOME_RHYTHM, GUIDE_KEYS.HOME_ACTION, GUIDE_KEYS.HOME_RLO];
    const results = await AsyncStorage.multiGet(keys.map(storageKey));
    return results.every(([_, val]) => val === 'seen');
  } catch {
    return true; // fail safe: don't show
  }
}

/**
 * Check if Layer 1 should start (none of the home steps seen yet).
 */
export async function shouldStartHomeOrientation(): Promise<boolean> {
  try {
    // If the first step has been seen, the orientation was already started
    const first = await AsyncStorage.getItem(storageKey(GUIDE_KEYS.HOME_RHYTHM));
    return first !== 'seen';
  } catch {
    return false;
  }
}

/**
 * Mark all Layer 1 steps as seen at once (used by "skip").
 */
export async function skipHomeOrientation(): Promise<void> {
  const keys = [GUIDE_KEYS.HOME_RHYTHM, GUIDE_KEYS.HOME_ACTION, GUIDE_KEYS.HOME_RLO];
  const pairs: [string, string][] = keys.map(k => [storageKey(k), 'seen']);
  await AsyncStorage.multiSet(pairs);
}

// ─── Legacy cleanup ───────────────────────────────────────────────────────────

/**
 * Migrate from old tour system. Call once on app init.
 * If @r90:tourDone is 'true', mark all Layer 1 as seen.
 */
export async function migrateFromLegacyTour(): Promise<void> {
  try {
    const oldDone = await AsyncStorage.getItem('@r90:tourDone');
    if (oldDone === 'true') {
      await skipHomeOrientation();
    }
  } catch {
    // non-critical
  }
}
