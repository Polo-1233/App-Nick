/**
 * mock-insights-data.ts
 *
 * Realistic 7-day sleep dataset for UI testing and UX analysis.
 * Simulates Thomas's recovery profile:
 *   • Mostly consistent sleep around 07:30 wake
 *   • One slightly bad night (Tuesday — 3 cycles only)
 *   • One strong recovery night (Friday — 6 cycles)
 *   • Natural bedtime variability ±30min
 *
 * Usage:
 *   const { history, profile } = getMockInsightsData();
 *   const insights = computeInsights(history, profile);
 *
 * To switch to real backend data: remove the mock fallback in InsightsScreen.
 * The UI consumes InsightsData — no refactor needed.
 */

import type { NightRecord, UserProfile } from '@r90/types';

// ─── Mock profile ─────────────────────────────────────────────────────────────
export const MOCK_PROFILE: UserProfile = {
  anchorTime:          450,   // 07:30
  chronotype:          'Neither',
  idealCyclesPerNight: 5,
  weeklyTarget:        35,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function toMinutes(hh: number, mm: number): number {
  return hh * 60 + mm;
}

// ─── 7-day history ────────────────────────────────────────────────────────────
// Index 0 = 6 days ago (oldest), index 6 = today
//
//  Day     bedtime  wake     cycles  notes
//  ──────  ───────  ───────  ──────  ──────────────────────────────
//  Sun     23:48    07:30    5       Solid start to the week
//  Mon     23:52    07:28    5       Consistent, on target
//  Tue     00:32    07:15    3       Late night — short sleep
//  Wed     23:40    07:38    5       Recovery, slightly better wake
//  Thu     23:55    07:32    5       Back on track
//  Fri     22:58    07:25    6       Early night — best night of week
//  Sat     00:05    07:48    4       Weekend, slight drift
//
export const MOCK_HISTORY: NightRecord[] = [
  {
    date:            dateString(6),
    cyclesCompleted: 5,
    anchorTime:      toMinutes(7, 30),
    actualBedtime:   toMinutes(23, 48),
    actualWakeTime:  toMinutes(7, 30),
  },
  {
    date:            dateString(5),
    cyclesCompleted: 5,
    anchorTime:      toMinutes(7, 30),
    actualBedtime:   toMinutes(23, 52),
    actualWakeTime:  toMinutes(7, 28),
  },
  {
    date:            dateString(4),
    cyclesCompleted: 3,              // bad night
    anchorTime:      toMinutes(7, 30),
    actualBedtime:   toMinutes(0, 32),
    actualWakeTime:  toMinutes(7, 15),
  },
  {
    date:            dateString(3),
    cyclesCompleted: 5,
    anchorTime:      toMinutes(7, 30),
    actualBedtime:   toMinutes(23, 40),
    actualWakeTime:  toMinutes(7, 38),
  },
  {
    date:            dateString(2),
    cyclesCompleted: 5,
    anchorTime:      toMinutes(7, 30),
    actualBedtime:   toMinutes(23, 55),
    actualWakeTime:  toMinutes(7, 32),
  },
  {
    date:            dateString(1),
    cyclesCompleted: 6,              // best night
    anchorTime:      toMinutes(7, 30),
    actualBedtime:   toMinutes(22, 58),
    actualWakeTime:  toMinutes(7, 25),
  },
  {
    date:            dateString(0),
    cyclesCompleted: 4,              // weekend drift
    anchorTime:      toMinutes(7, 30),
    actualBedtime:   toMinutes(0, 5),
    actualWakeTime:  toMinutes(7, 48),
  },
];

// ─── Convenience getter ───────────────────────────────────────────────────────
export function getMockInsightsData(): { history: NightRecord[]; profile: UserProfile } {
  return { history: MOCK_HISTORY, profile: MOCK_PROFILE };
}
