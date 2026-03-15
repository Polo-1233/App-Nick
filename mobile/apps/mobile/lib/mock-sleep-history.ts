/**
 * mock-sleep-history.ts — Realistic mock sleep history (10 nights)
 *
 * Usage:
 *   import { getMockSleepHistory } from './mock-sleep-history';
 *   const history = getMockSleepHistory();
 *
 * Switch logic (in screen):
 *   const data = realHistory.length > 0 ? realHistory : getMockSleepHistory();
 *
 * Bedtime values are MinuteOfDay (0–1439).
 *   23:00 = 1380  |  23:30 = 1410  |  00:00 = 0  |  00:30 = 30  |  01:00 = 60
 * All bedtimes are in the 22:00–02:00 realistic window.
 */

import type { NightRecord } from '@r90/types';

export interface EnrichedNightRecord extends NightRecord {
  /** Display label for recovery quality */
  recoveryStatus: string;
  /** Short contextual note */
  note: string;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Bedtime helpers (MinuteOfDay, wrap-safe)
const BT_2200  = 22 * 60;        // 1320 — 22:00
const BT_2300  = 23 * 60;        // 1380 — 23:00
const BT_2315  = 23 * 60 + 15;   // 1395 — 23:15
const BT_2303  = 23 * 60 + 3;    // 1383 — 23:03
const BT_2331  = 23 * 60 + 31;   // 1411 — 23:31
const BT_2342  = 23 * 60 + 42;   // 1422 — 23:42
const BT_2357  = 23 * 60 + 57;   // 1437 — 23:57
const BT_0030  = 30;              //    30 — 00:30
const BT_0100  = 60;              //    60 — 01:00

/**
 * Returns 10 nights of realistic mock data — mostly good,
 * 2 weaker nights, plausible bedtime variation.
 * anchor = 07:30 (450 min)
 * Results sorted: most recent first.
 */
export function getMockSleepHistory(): EnrichedNightRecord[] {
  return [
    // 9 nights ago — solid
    {
      date:            daysAgo(9),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  453,
      actualBedtime:   BT_2303,   // 23:03
      recoveryStatus:  'Great recovery',
      note:            'Slept through, woke naturally.',
    },
    // 8 nights ago — good but slightly late
    {
      date:            daysAgo(8),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  455,
      actualBedtime:   BT_2315,   // 23:15
      recoveryStatus:  'Stable rhythm',
      note:            'Fell asleep a little late.',
    },
    // 7 nights ago — short, late dinner
    {
      date:            daysAgo(7),
      cyclesCompleted: 3,
      anchorTime:      450,
      actualWakeTime:  448,
      actualBedtime:   BT_2357,   // 23:57
      recoveryStatus:  'Slight sleep debt',
      note:            'Late dinner pushed bedtime back.',
    },
    // 6 nights ago — recovery
    {
      date:            daysAgo(6),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  452,
      actualBedtime:   BT_2300,   // 23:00
      recoveryStatus:  'Great recovery',
      note:            'Good wind-down, slept well.',
    },
    // 5 nights ago — on target
    {
      date:            daysAgo(5),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  450,
      actualBedtime:   BT_2300,   // 23:00
      recoveryStatus:  'Stable rhythm',
      note:            'On target. Consistent timing.',
    },
    // 4 nights ago — disrupted (late event → past midnight)
    {
      date:            daysAgo(4),
      cyclesCompleted: 2,
      anchorTime:      450,
      actualWakeTime:  460,
      actualBedtime:   BT_0030,   // 00:30
      recoveryStatus:  'Irregular night',
      note:            'Late event, disrupted sleep window.',
    },
    // 3 nights ago — strong bounce back
    {
      date:            daysAgo(3),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  451,
      actualBedtime:   BT_2300,   // 23:00
      recoveryStatus:  'Great recovery',
      note:            'Back on schedule.',
    },
    // 2 nights ago — slightly late
    {
      date:            daysAgo(2),
      cyclesCompleted: 4,
      anchorTime:      450,
      actualWakeTime:  453,
      actualBedtime:   BT_2331,   // 23:31
      recoveryStatus:  'Stable rhythm',
      note:            'Minor delay but good quality.',
    },
    // Yesterday — late bedtime
    {
      date:            daysAgo(1),
      cyclesCompleted: 4,
      anchorTime:      450,
      actualWakeTime:  450,
      actualBedtime:   BT_2342,   // 23:42
      recoveryStatus:  'Late bedtime',
      note:            'Went to bed later than planned.',
    },
    // Tonight — pending
    {
      date:            daysAgo(0),
      cyclesCompleted: 0,
      anchorTime:      450,
      recoveryStatus:  '—',
      note:            'Tonight — not yet logged.',
    },
  ].reverse(); // most recent first
}

/** Color for a recovery status string */
export function recoveryColor(status: string, palette: {
  success: string; warning: string; error: string; muted: string;
}): string {
  switch (status) {
    case 'Great recovery':    return palette.success;
    case 'Stable rhythm':     return palette.success;
    case 'Slight sleep debt': return palette.warning;
    case 'Late bedtime':      return palette.warning;
    case 'Irregular night':   return palette.error;
    default:                  return palette.muted;
  }
}

/** Ionicons icon name for a recovery status string */
export function recoveryIcon(status: string): string {
  switch (status) {
    case 'Great recovery':    return 'checkmark-circle-outline';
    case 'Stable rhythm':     return 'moon-outline';
    case 'Slight sleep debt': return 'trending-down-outline';
    case 'Late bedtime':      return 'time-outline';
    case 'Irregular night':   return 'warning-outline';
    default:                  return 'ellipse-outline';
  }
}
