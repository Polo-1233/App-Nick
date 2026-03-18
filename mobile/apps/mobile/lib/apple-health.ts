/**
 * apple-health.ts
 *
 * Apple HealthKit integration for R-Lo · Sleep Coach.
 * Reads sleep analysis, HRV, resting heart rate, and activity data,
 * then syncs to the backend for personalised coaching context.
 *
 * Only available on iOS native builds (not Expo Go).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { BASE_URL } from './api';
import { getAccessToken } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthSample {
  startDate: string;
  endDate:   string;
  value:     number;
  sourceName?: string;
}

export interface SleepSample {
  startDate: string;
  endDate:   string;
  value:     'INBED' | 'ASLEEP' | 'AWAKE' | 'DEEP' | 'CORE' | 'REM';
  sourceName?: string;
}

export interface HealthSnapshot {
  // Sleep
  sleepSamples:    SleepSample[];
  sleepDurationMin: number | null;   // total asleep minutes (last night)
  sleepEfficiency:  number | null;   // 0–1
  // Heart
  hrv:             number | null;    // ms (last night avg)
  restingHR:       number | null;    // bpm
  // Activity
  activeEnergyKcal: number | null;   // yesterday
  stepCount:        number | null;   // yesterday
  // Meta
  collectedAt:     string;
}

// ─── Storage key ──────────────────────────────────────────────────────────────

const LAST_SYNC_KEY     = '@r90:healthkit:lastSync';
const SYNC_COOLDOWN_MS  = 4 * 60 * 60 * 1000; // 4 hours

// ─── Lazy-load react-native-health ───────────────────────────────────────────

let AppleHealthKit: any = null;
let Permissions:    any = null;

function loadHealthKit(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-health');
    AppleHealthKit = mod.default ?? mod;
    Permissions    = mod.HealthKitPermissions ?? AppleHealthKit?.Constants?.Permissions;
    return !!AppleHealthKit;
  } catch {
    return false;
  }
}

// ─── Permission request ───────────────────────────────────────────────────────

export async function requestHealthKitPermissions(): Promise<boolean> {
  if (!loadHealthKit()) return false;

  const permissions = {
    permissions: {
      read: [
        Permissions?.SleepAnalysis       ?? 'SleepAnalysis',
        Permissions?.HeartRateVariability ?? 'HeartRateVariability',
        Permissions?.RestingHeartRate     ?? 'RestingHeartRate',
        Permissions?.ActiveEnergyBurned   ?? 'ActiveEnergyBurned',
        Permissions?.StepCount            ?? 'StepCount',
      ],
      write: [],
    },
  };

  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(permissions, (err: any) => {
      resolve(!err);
    });
  });
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

function yesterday(): { startDate: string; endDate: string } {
  const now   = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0); // 6 PM yesterday
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);   // noon today
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function last7Days(): { startDate: string; endDate: string } {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

async function fetchSleepSamples(): Promise<SleepSample[]> {
  const opts = { ...yesterday(), limit: 200, ascending: false };
  return new Promise((resolve) => {
    AppleHealthKit.getSleepSamples(opts, (err: any, results: any[]) => {
      resolve(err ? [] : (results ?? []));
    });
  });
}

async function fetchHRV(): Promise<number | null> {
  const opts = { ...yesterday(), limit: 20, ascending: false };
  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateVariabilitySamples(opts, (err: any, results: any[]) => {
      if (err || !results?.length) { resolve(null); return; }
      const vals = results.map((r: any) => r.value).filter(Boolean);
      resolve(vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null);
    });
  });
}

async function fetchRestingHR(): Promise<number | null> {
  const opts = { ...last7Days(), limit: 7, ascending: false };
  return new Promise((resolve) => {
    AppleHealthKit.getRestingHeartRateSamples(opts, (err: any, results: any[]) => {
      if (err || !results?.length) { resolve(null); return; }
      resolve(results[0]?.value ?? null);
    });
  });
}

async function fetchActiveEnergy(): Promise<number | null> {
  const { startDate, endDate } = yesterday();
  const opts = { startDate, endDate, includeManuallyAdded: false };
  return new Promise((resolve) => {
    AppleHealthKit.getActiveEnergyBurned(opts, (err: any, results: any[]) => {
      if (err || !results?.length) { resolve(null); return; }
      const total = results.reduce((sum: number, r: any) => sum + (r.value ?? 0), 0);
      resolve(Math.round(total));
    });
  });
}

async function fetchStepCount(): Promise<number | null> {
  const { startDate, endDate } = yesterday();
  return new Promise((resolve) => {
    AppleHealthKit.getStepCount({ startDate, endDate }, (err: any, result: any) => {
      resolve(err ? null : (result?.value ?? null));
    });
  });
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

function computeSleepStats(samples: SleepSample[]): { durationMin: number | null; efficiency: number | null } {
  const asleep = samples.filter(s => ['ASLEEP', 'DEEP', 'CORE', 'REM'].includes(s.value));
  const inBed  = samples.filter(s => s.value === 'INBED');

  if (!asleep.length) return { durationMin: null, efficiency: null };

  const asleepMs = asleep.reduce((sum, s) => {
    return sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime());
  }, 0);
  const durationMin = Math.round(asleepMs / 60000);

  let efficiency: number | null = null;
  if (inBed.length) {
    const inBedMs = inBed.reduce((sum, s) => {
      return sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime());
    }, 0);
    efficiency = inBedMs > 0 ? Math.min(1, asleepMs / inBedMs) : null;
  }

  return { durationMin, efficiency };
}

export async function collectHealthSnapshot(): Promise<HealthSnapshot | null> {
  if (!loadHealthKit()) return null;

  const [sleepSamples, hrv, restingHR, activeEnergy, stepCount] = await Promise.all([
    fetchSleepSamples(),
    fetchHRV(),
    fetchRestingHR(),
    fetchActiveEnergy(),
    fetchStepCount(),
  ]);

  const { durationMin, efficiency } = computeSleepStats(sleepSamples);

  return {
    sleepSamples,
    sleepDurationMin:  durationMin,
    sleepEfficiency:   efficiency,
    hrv,
    restingHR,
    activeEnergyKcal:  activeEnergy,
    stepCount,
    collectedAt:       new Date().toISOString(),
  };
}

// ─── Sync to backend ──────────────────────────────────────────────────────────

export async function syncHealthKitToBackend(force = false): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  if (!loadHealthKit()) return false;

  // Cooldown check
  if (!force) {
    const last = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (last && Date.now() - Number(last) < SYNC_COOLDOWN_MS) return false;
  }

  const snapshot = await collectHealthSnapshot();
  if (!snapshot) return false;

  try {
    const token = await getAccessToken();
    const res   = await fetch(`${BASE_URL}/wearables/sync`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ source: 'apple_health', data: snapshot }),
    });
    if (res.ok) {
      await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      return true;
    }
  } catch {
    // Non-critical — will retry next time
  }
  return false;
}

// ─── Public init ─────────────────────────────────────────────────────────────

/**
 * Call once at app startup (after auth).
 * Requests permissions if not yet granted, then syncs data.
 */
export async function initAppleHealth(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const granted = await requestHealthKitPermissions();
  if (granted) {
    // Register Apple Health as connected in backend
    try {
      const { getAccessToken } = await import('./supabase');
      const { BASE_URL } = await import('./api');
      const token = await getAccessToken();
      if (token) {
        await fetch(`${BASE_URL}/wearables/apple/register`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    void syncHealthKitToBackend();
  }
}
