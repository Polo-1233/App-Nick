/**
 * wake-detection.ts — Layered wake-time inference system
 *
 * Sources (by priority):
 *   1. confirmed_wake      — user explicitly confirmed in morning modal
 *   2. notification_tap     — user tapped the morning notification
 *   3. first_app_open       — first app foreground in the morning window
 *   4. android_system (future, optional)
 *
 * Morning window: 03:00 – 11:00 local time (configurable).
 *
 * Each day resolves to a single "best" wake time based on source priority.
 * The morning confirmation UI prefills with the best available candidate.
 *
 * Usage:
 *   recordWakeCandidate('first_app_open')       — called on first morning foreground
 *   recordWakeCandidate('notification_tap')      — called on morning notif tap
 *   confirmWakeTime(timestamp?, mood?)           — called from morning confirmation
 *   getTodayWakeTime()                           — returns best candidate for today
 *   getWakeHistory(days)                         — returns recent wake history
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WakeSource =
  | 'confirmed_wake'
  | 'notification_tap'
  | 'first_app_open'
  | 'android_system';

export type WakeConfidence = 'confirmed' | 'high' | 'medium' | 'low';

export interface WakeCandidate {
  timestamp:  string;       // ISO 8601
  localDate:  string;       // YYYY-MM-DD
  localTime:  string;       // HH:MM
  minuteOfDay: number;      // 0–1439
  source:     WakeSource;
  confidence: WakeConfidence;
  corrected:  boolean;      // user adjusted the time
  mood?:      string;       // tired | neutral | good
}

export interface DailyWake {
  date:        string;        // YYYY-MM-DD
  best:        WakeCandidate; // highest-priority candidate
  candidates:  WakeCandidate[]; // all candidates for the day
}

// ─── Configuration ────────────────────────────────────────────────────────────

/** Morning window: only candidates within this range count. */
const MORNING_START = 3 * 60;   // 03:00
const MORNING_END   = 11 * 60;  // 11:00

/** Source priority (lower = higher priority). */
const SOURCE_PRIORITY: Record<WakeSource, number> = {
  confirmed_wake:    0,
  notification_tap:  1,
  first_app_open:    2,
  android_system:    3,
};

const CONFIDENCE_MAP: Record<WakeSource, WakeConfidence> = {
  confirmed_wake:    'confirmed',
  notification_tap:  'high',
  first_app_open:    'medium',
  android_system:    'medium',
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const CANDIDATES_KEY = '@r90:wake:candidates:v1';
const HISTORY_KEY    = '@r90:wake:history:v1';
const FIRST_OPEN_KEY = '@r90:wake:firstOpen:v1'; // tracks today's first-open

// Max days of history to keep
const MAX_HISTORY_DAYS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowMinuteOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isInMorningWindow(minuteOfDay: number): boolean {
  return minuteOfDay >= MORNING_START && minuteOfDay < MORNING_END;
}

function formatTime(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minuteFromDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// ─── Candidate storage ────────────────────────────────────────────────────────

async function loadCandidates(): Promise<Record<string, WakeCandidate[]>> {
  try {
    const raw = await AsyncStorage.getItem(CANDIDATES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveCandidates(data: Record<string, WakeCandidate[]>): Promise<void> {
  // Prune old dates (keep last MAX_HISTORY_DAYS)
  const dates = Object.keys(data).sort();
  if (dates.length > MAX_HISTORY_DAYS) {
    const cutoff = dates.length - MAX_HISTORY_DAYS;
    for (let i = 0; i < cutoff; i++) delete data[dates[i]];
  }
  await AsyncStorage.setItem(CANDIDATES_KEY, JSON.stringify(data));
}

// ─── Resolve best candidate ───────────────────────────────────────────────────

function resolveBest(candidates: WakeCandidate[]): WakeCandidate {
  return [...candidates].sort(
    (a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source]
  )[0];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a wake candidate for today.
 * Deduplicates by source — only keeps the first candidate per source per day.
 */
export async function recordWakeCandidate(
  source: WakeSource,
  timestampOverride?: Date,
): Promise<void> {
  const now     = timestampOverride ?? new Date();
  const minute  = minuteFromDate(now);

  // Only record within morning window
  if (!isInMorningWindow(minute)) return;

  const date = now.toISOString().slice(0, 10);
  const all  = await loadCandidates();
  const dayCandidates = all[date] ?? [];

  // Don't duplicate the same source
  if (dayCandidates.some(c => c.source === source)) return;

  const candidate: WakeCandidate = {
    timestamp:   now.toISOString(),
    localDate:   date,
    localTime:   formatTime(minute),
    minuteOfDay: minute,
    source,
    confidence:  CONFIDENCE_MAP[source],
    corrected:   false,
  };

  dayCandidates.push(candidate);
  all[date] = dayCandidates;
  await saveCandidates(all);
}

/**
 * Confirm wake time explicitly (from morning confirmation UI).
 * This is the highest-confidence source.
 *
 * @param minuteOfDay — confirmed wake time in minutes (e.g. 392 = 06:32)
 *                       If null, uses the current time.
 * @param corrected   — true if the user adjusted the time from the suggestion
 * @param mood        — optional mood selection
 */
export async function confirmWakeTime(
  minuteOfDay?: number | null,
  corrected = false,
  mood?: string,
): Promise<void> {
  const now    = new Date();
  const minute = minuteOfDay ?? minuteFromDate(now);
  const date   = now.toISOString().slice(0, 10);
  const all    = await loadCandidates();
  const dayCandidates = all[date] ?? [];

  // Remove any existing confirmed_wake for today (replace it)
  const filtered = dayCandidates.filter(c => c.source !== 'confirmed_wake');

  const candidate: WakeCandidate = {
    timestamp:   now.toISOString(),
    localDate:   date,
    localTime:   formatTime(minute),
    minuteOfDay: minute,
    source:      'confirmed_wake',
    confidence:  'confirmed',
    corrected,
    mood,
  };

  filtered.push(candidate);
  all[date] = filtered;
  await saveCandidates(all);
}

/**
 * Get today's best wake time candidate.
 * Returns null if no candidate exists yet.
 */
export async function getTodayWakeTime(): Promise<DailyWake | null> {
  const date = todayStr();
  const all  = await loadCandidates();
  const dayCandidates = all[date];
  if (!dayCandidates || dayCandidates.length === 0) return null;

  return {
    date,
    best:       resolveBest(dayCandidates),
    candidates: dayCandidates,
  };
}

/**
 * Get wake history for the last N days.
 * Returns only days with at least one candidate.
 */
export async function getWakeHistory(days = 14): Promise<DailyWake[]> {
  const all    = await loadCandidates();
  const today  = new Date();
  const result: DailyWake[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const candidates = all[date];
    if (candidates && candidates.length > 0) {
      result.push({ date, best: resolveBest(candidates), candidates });
    }
  }

  return result;
}

/**
 * Record "first app open" for today.
 * Called once per day when the app becomes active in the morning window.
 * Uses a separate key to ensure exactly-once per day.
 */
export async function recordFirstAppOpen(): Promise<void> {
  const today = todayStr();

  // Check if already recorded today
  const lastDate = await AsyncStorage.getItem(FIRST_OPEN_KEY).catch(() => null);
  if (lastDate === today) return;

  const minute = nowMinuteOfDay();
  if (!isInMorningWindow(minute)) return;

  // Mark as recorded for today
  await AsyncStorage.setItem(FIRST_OPEN_KEY, today);

  // Record the candidate
  await recordWakeCandidate('first_app_open');
}

/**
 * Record notification tap as wake signal.
 * Called from the notification response handler in _layout.tsx.
 */
export async function recordNotificationTapWake(): Promise<void> {
  await recordWakeCandidate('notification_tap');
}

/**
 * Get suggested wake time for the morning confirmation UI.
 * Returns the best available candidate's time, or null if none.
 */
export async function getSuggestedWakeTime(): Promise<{
  time: string;      // "06:32"
  minuteOfDay: number;
  source: WakeSource;
  confidence: WakeConfidence;
} | null> {
  const daily = await getTodayWakeTime();
  if (!daily) return null;
  return {
    time:        daily.best.localTime,
    minuteOfDay: daily.best.minuteOfDay,
    source:      daily.best.source,
    confidence:  daily.best.confidence,
  };
}

/**
 * Check if wake time has been confirmed today.
 */
export async function isWakeConfirmedToday(): Promise<boolean> {
  const daily = await getTodayWakeTime();
  if (!daily) return false;
  return daily.candidates.some(c => c.source === 'confirmed_wake');
}
