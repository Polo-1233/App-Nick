/**
 * Local storage layer for R90 Digital Navigator.
 *
 * Provides AsyncStorage adapter for persisting user profile, night history, and CRP records.
 * All keys are versioned to support future migrations.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile, NightRecord } from '@r90/types';
import { defaultUsage, type UsageRecord, type PremiumFeature } from '@r90/core';

// Storage version for future migrations
export const STORAGE_VERSION = '1';

// Storage key schema — all @r90 app-data keys
export const STORAGE_KEYS = {
  VERSION:          `@r90:version`,
  PROFILE:          `@r90:profile:v${STORAGE_VERSION}`,
  WEEK_HISTORY:     `@r90:weekHistory:v${STORAGE_VERSION}`,
  CRP_RECORDS:      `@r90:crpRecords:v${STORAGE_VERSION}`,
  USAGE:            `@r90:usage:v${STORAGE_VERSION}`,
  ONBOARDING:       `@r90:onboarding:v${STORAGE_VERSION}`,
  ACQUISITION:      `@r90:acquisitionSource:v1`,
  CHAT_ONBOARDING:   `@r90:chatOnboarding:v1`,
  PLAN_ONBOARDING:   `@r90:planOnboarding:v1`,
  INTRO_COMPLETED:   `@r90:introCompleted:v1`,
  ONBOARDING_PHASE:  `@r90:onboardingPhase:v1`,
} as const;

/**
 * Permission-gate keys written by lib/permissions.ts.
 * Declared here so clearAllStorage() has a single source of truth.
 * lib/permissions.ts imports and uses these directly.
 */
export const PERMISSION_KEYS = {
  PROMPT_SHOWN:  '@r90:permissionsPromptShown:v1',
  CALENDAR:      '@r90:permissions:calendar',
  NOTIFICATIONS: '@r90:permissions:notifications',
} as const;

/**
 * Wind-down feature keys written by lib/wind-down.ts.
 * Declared here so clearAllStorage() clears them on data reset.
 */
export const WIND_DOWN_STORAGE_KEYS = {
  ENABLED:         '@r90:windDown:enabled:v1',
  MUSIC_ENABLED:   '@r90:windDown:musicEnabled:v1',
  LAST_SCHEDULED:  '@r90:windDown:lastScheduled:v1',
  NOTIFICATION_ID: '@r90:windDown:notifId:v1',
} as const;

/**
 * Flat list of every AsyncStorage key owned by this app.
 * Used by clearAllStorage() — add new keys here as the app grows.
 */
export const ALL_STORAGE_KEYS: readonly string[] = [
  ...Object.values(STORAGE_KEYS),
  ...Object.values(PERMISSION_KEYS),
  ...Object.values(WIND_DOWN_STORAGE_KEYS),
] as const;

// Re-export UsageRecord so consumers don't need to import from @r90/core directly
export type { UsageRecord } from '@r90/core';

/**
 * Extra data collected during the personalization onboarding flow.
 */
export interface OnboardingData {
  firstName: string;
  wakeTimeMinutes: number;
  priority: string;
  constraint: string;
}

/**
 * Persist onboarding personalization data.
 */
export async function saveOnboardingData(data: OnboardingData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify(data));
  } catch (error) {
    console.error('[storage] Failed to save onboarding data:', error);
    throw new Error('Failed to save onboarding data');
  }
}

/**
 * Load onboarding personalization data.
 * Returns null if not yet saved.
 */
export async function loadOnboardingData(): Promise<OnboardingData | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING);
    if (!data) return null;
    return JSON.parse(data) as OnboardingData;
  } catch (error) {
    console.error('[storage] Failed to load onboarding data:', error);
    return null;
  }
}

/**
 * CRP completion record
 */
export interface CRPRecord {
  date: string; // ISO date string (YYYY-MM-DD)
  timestamp: number; // Unix timestamp when CRP was completed
  duration: 30 | 90; // Duration in minutes
}

/**
 * Save user profile to storage
 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch (error) {
    console.error('[storage] Failed to save profile:', error);
    throw new Error('Failed to save profile');
  }
}

/**
 * Validate that a parsed object is a complete UserProfile.
 * Guards against partial saves or data from old app versions.
 */
function isValidProfile(data: unknown): data is UserProfile {
  if (!data || typeof data !== 'object') return false;
  const p = data as Record<string, unknown>;
  return (
    typeof p.anchorTime === 'number' &&
    typeof p.chronotype === 'string' &&
    ['AMer', 'PMer', 'Neither'].includes(p.chronotype as string) &&
    typeof p.idealCyclesPerNight === 'number' &&
    typeof p.weeklyTarget === 'number'
  );
}

/**
 * Validate that a parsed object is a complete NightRecord.
 * Guards against partial saves or schema drift.
 */
function isValidNightRecord(data: unknown): data is NightRecord {
  if (!data || typeof data !== 'object') return false;
  const n = data as Record<string, unknown>;
  return (
    typeof n.date === 'string' &&
    n.date.length === 10 && // YYYY-MM-DD
    typeof n.cyclesCompleted === 'number' &&
    n.cyclesCompleted >= 0 &&
    typeof n.anchorTime === 'number'
  );
}

/**
 * Validate that a parsed object is a complete CRPRecord.
 * Guards against partial saves or schema drift.
 */
function isValidCRPRecord(data: unknown): data is CRPRecord {
  if (!data || typeof data !== 'object') return false;
  const c = data as Record<string, unknown>;
  return (
    typeof c.date === 'string' &&
    c.date.length === 10 &&
    typeof c.timestamp === 'number' &&
    (c.duration === 30 || c.duration === 90)
  );
}

/**
 * Load user profile from storage.
 * Returns null if no profile exists or if stored data is invalid.
 */
export async function loadProfile(): Promise<UserProfile | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (!isValidProfile(parsed)) {
      console.warn('[profile] invalid data in storage → treating as not onboarded', parsed);
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('[storage] Failed to load profile:', error);
    return null;
  }
}

/**
 * Save a single night record to storage
 * Updates the week history array with the new record
 */
export async function saveNightRecord(record: NightRecord): Promise<void> {
  try {
    const history = await loadWeekHistory();

    // Remove existing record for same date if present
    const filtered = history.filter((r) => r.date !== record.date);

    // Add new record and sort by date (newest first)
    const updated = [...filtered, record].sort((a, b) => b.date.localeCompare(a.date));

    // Keep only last 7 records
    const trimmed = updated.slice(0, 7);

    await AsyncStorage.setItem(STORAGE_KEYS.WEEK_HISTORY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('[storage] Failed to save night record:', error);
    throw new Error('Failed to save night record');
  }
}

/**
 * Load week history from storage.
 * Returns empty array if no history exists or if any record fails validation.
 * Invalid records are silently dropped — a corrupt entry must not poison the whole array.
 */
export async function loadWeekHistory(): Promise<NightRecord[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.WEEK_HISTORY);
    if (!data) return [];
    const parsed: unknown[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidNightRecord);
  } catch (error) {
    console.error('[storage] Failed to load week history:', error);
    return [];
  }
}

/**
 * Save a CRP completion record
 */
export async function saveCRPRecord(record: CRPRecord): Promise<void> {
  try {
    const records = await loadCRPRecords();

    // Add new record
    const updated = [...records, record];

    // Keep only last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const trimmed = updated.filter((r) => r.timestamp >= thirtyDaysAgo);

    await AsyncStorage.setItem(STORAGE_KEYS.CRP_RECORDS, JSON.stringify(trimmed));
  } catch (error) {
    console.error('[storage] Failed to save CRP record:', error);
    throw new Error('Failed to save CRP record');
  }
}

/**
 * Load CRP records from storage.
 * Returns empty array if no records exist or if any record fails validation.
 * Invalid records are silently dropped — a corrupt entry must not block CRP history.
 */
export async function loadCRPRecords(): Promise<CRPRecord[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CRP_RECORDS);
    if (!data) return [];
    const parsed: unknown[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCRPRecord);
  } catch (error) {
    console.error('[storage] Failed to load CRP records:', error);
    return [];
  }
}

/**
 * Clear all storage (useful for testing/reset)
 */
export async function clearAllStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...ALL_STORAGE_KEYS]);
  } catch (error) {
    console.error('[storage] Failed to clear storage:', error);
    throw new Error('Failed to clear storage');
  }
}

/**
 * Load usage tracking record.
 * Returns default (zero) usage if no record exists.
 */
export async function loadUsage(): Promise<UsageRecord> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USAGE);
    if (!data) return defaultUsage();
    return JSON.parse(data) as UsageRecord;
  } catch (error) {
    console.error('[storage] Failed to load usage:', error);
    return defaultUsage();
  }
}

/**
 * Save usage tracking record.
 */
export async function saveUsage(usage: UsageRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USAGE, JSON.stringify(usage));
  } catch (error) {
    console.error('[storage] Failed to save usage:', error);
  }
}

/**
 * Increment usage count for a premium feature and persist.
 * Returns the updated UsageRecord.
 */
export async function incrementUsage(feature: PremiumFeature): Promise<UsageRecord> {
  const usage = await loadUsage();
  const updated: UsageRecord = { ...usage };

  switch (feature) {
    case 'conflict':    updated.conflictCount += 1;   break;
    case 'recalc':      updated.recalcCount += 1;     break;
    case 'post_event':  updated.postEventCount += 1;  break;
  }

  await saveUsage(updated);
  return updated;
}

/**
 * Export all user data as a plain object.
 * Used by the future data export feature (Week 8).
 */
export async function exportAllData(): Promise<{
  profile: UserProfile | null;
  weekHistory: NightRecord[];
  crpRecords: CRPRecord[];
  exportedAt: string;
}> {
  const [profile, weekHistory, crpRecords] = await Promise.all([
    loadProfile(),
    loadWeekHistory(),
    loadCRPRecords(),
  ]);
  return {
    profile,
    weekHistory,
    crpRecords,
    exportedAt: new Date().toISOString(),
  };
}

// ─── Acquisition source ───────────────────────────────────────────────────────

export interface AcquisitionSourceRecord {
  /** One of the source IDs, or 'skipped'. */
  source:    string;
  /** Non-empty only when source === 'other'. */
  otherText: string;
  createdAt: string; // ISO 8601
}

export async function saveAcquisitionSource(record: AcquisitionSourceRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACQUISITION, JSON.stringify(record));
  } catch (error) {
    console.error('[storage] Failed to save acquisition source:', error);
  }
}

export async function loadAcquisitionSource(): Promise<AcquisitionSourceRecord | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ACQUISITION);
    if (!data) return null;
    return JSON.parse(data) as AcquisitionSourceRecord;
  } catch {
    return null;
  }
}

// ─── Onboarding gate ─────────────────────────────────────────────────────────

/**
 * Check if user has completed onboarding (profile exists)
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const profile = await loadProfile();
  return profile !== null;
}

// ─── Chat onboarding (steps 6–9, in-app conversation) ────────────────────────

/**
 * Data collected during the in-app R-Lo conversation (steps 6–9).
 */
export interface ChatOnboardingData {
  name:               string;
  wakeTime:           string;  // e.g. "06:30" or "Other"
  mainIssue:          string;  // e.g. "I feel tired"
  chronotypeEstimate: string;  // e.g. "7–8"
  completedAt:        string;  // ISO 8601
}

/**
 * Persist chat onboarding answers and mark the flow as complete.
 */
export async function saveChatOnboardingData(data: ChatOnboardingData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_ONBOARDING, JSON.stringify(data));
  } catch (error) {
    console.error('[storage] Failed to save chat onboarding data:', error);
  }
}

/**
 * Load chat onboarding answers saved during steps 6–9.
 * Returns null if not yet saved.
 */
export async function loadChatOnboardingData(): Promise<ChatOnboardingData | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_ONBOARDING);
    if (!data) return null;
    return JSON.parse(data) as ChatOnboardingData;
  } catch {
    return null;
  }
}

/**
 * Returns true when the user has already completed steps 6–9.
 */
export async function hasCompletedChatOnboarding(): Promise<boolean> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_ONBOARDING);
    return data !== null;
  } catch {
    return false;
  }
}

// ─── Plan onboarding (steps 10–12, generation + reveal + calendar) ─────────────

/**
 * Mark steps 10–12 as complete.
 */
export async function markPlanOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PLAN_ONBOARDING, new Date().toISOString());
  } catch (error) {
    console.error('[storage] Failed to mark plan onboarding complete:', error);
  }
}

/**
 * Returns true when the user has already completed steps 10–12.
 */
export async function hasCompletedPlanOnboarding(): Promise<boolean> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAN_ONBOARDING);
    return data !== null;
  } catch {
    return false;
  }
}

// ─── Intro gate (replaces profile-based routing gate) ────────────────────────

/**
 * Mark the intro pager (slides 0–4) as complete.
 * Called at the end of onboarding.tsx before navigating to /(tabs).
 */
export async function markIntroComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.INTRO_COMPLETED, new Date().toISOString());
  } catch (error) {
    console.error('[storage] Failed to mark intro complete:', error);
  }
}

/**
 * Returns true when the intro pager is done.
 * Also returns true for existing users who completed the old onboarding
 * (they have a profile in AsyncStorage), ensuring backward compatibility.
 */
export async function hasCompletedIntro(): Promise<boolean> {
  try {
    const [introData, profileData] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.INTRO_COMPLETED),
      AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
    ]);
    return introData !== null || profileData !== null;
  } catch {
    return false;
  }
}

// ─── Onboarding phase ──────────────────────────────────────────────────────────
// Controls which step of the full onboarding flow the user is in.
// 'guided_chat' → questions in Home chat (tabs locked)
// 'plan'        → plan generation + reveal overlay (post-questions)
// 'calendar'    → calendar + notifications access (post-login)
// 'done'        → full app (no onboarding remaining)

export type OnboardingPhase = 'guided_chat' | 'plan' | 'calendar' | 'done';

export async function getOnboardingPhase(): Promise<OnboardingPhase> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_PHASE);
    if (v === 'guided_chat' || v === 'plan' || v === 'calendar') return v;
    return 'done';
  } catch { return 'done'; }
}

export async function setOnboardingPhase(phase: OnboardingPhase): Promise<void> {
  try {
    if (phase === 'done') {
      await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_PHASE);
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_PHASE, phase);
    }
  } catch { /* silent */ }
}
