/**
 * mock-sleep-history.ts — Realistic mock sleep history (10 nights)
 *
 * Usage:
 *   import { getMockSleepHistory } from './mock-sleep-history';
 *   const history = getMockSleepHistory();
 *
 * Switch logic (in screen):
 *   const data = realHistory.length > 0 ? realHistory : getMockSleepHistory();
 */

import type { NightRecord } from '@r90/types';

export interface EnrichedNightRecord extends NightRecord {
  /** Display label for recovery quality */
  recoveryStatus: string;
  /** Short contextual note */
  note: string;
}

// Build date string relative to today
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns 10 nights of realistic mock data — mostly good,
 * 2 weaker nights, small bedtime variation.
 *
 * anchor = 07:30 (450 min)
 */
export function getMockSleepHistory(): EnrichedNightRecord[] {
  return [
    // 9 nights ago — solid night
    {
      date:            daysAgo(9),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  453,
      actualBedtime:   783,   // 23:03
      recoveryStatus:  'Great recovery',
      note:            'Slept through, woke naturally.',
    },
    // 8 nights ago — good but slightly late
    {
      date:            daysAgo(8),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  455,
      actualBedtime:   795,   // 23:15
      recoveryStatus:  'Stable rhythm',
      note:            'Fell asleep a little late.',
    },
    // 7 nights ago — short night, early commitment
    {
      date:            daysAgo(7),
      cyclesCompleted: 3,
      anchorTime:      450,
      actualWakeTime:  448,
      actualBedtime:   837,   // 23:57
      recoveryStatus:  'Slight sleep debt',
      note:            'Late dinner pushed bedtime back.',
    },
    // 6 nights ago — recovery night
    {
      date:            daysAgo(6),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  452,
      actualBedtime:   780,   // 23:00
      recoveryStatus:  'Great recovery',
      note:            'Good wind-down, slept well.',
    },
    // 5 nights ago — solid
    {
      date:            daysAgo(5),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  450,
      actualBedtime:   780,   // 23:00
      recoveryStatus:  'Stable rhythm',
      note:            'On target. Consistent timing.',
    },
    // 4 nights ago — disrupted
    {
      date:            daysAgo(4),
      cyclesCompleted: 2,
      anchorTime:      450,
      actualWakeTime:  460,
      actualBedtime:   870,   // 00:30
      recoveryStatus:  'Irregular night',
      note:            'Late event, disrupted sleep window.',
    },
    // 3 nights ago — strong bounce back
    {
      date:            daysAgo(3),
      cyclesCompleted: 5,
      anchorTime:      450,
      actualWakeTime:  451,
      actualBedtime:   780,   // 23:00
      recoveryStatus:  'Great recovery',
      note:            'Back on schedule.',
    },
    // 2 nights ago — slightly late
    {
      date:            daysAgo(2),
      cyclesCompleted: 4,
      anchorTime:      450,
      actualWakeTime:  453,
      actualBedtime:   811,   // 23:31
      recoveryStatus:  'Stable rhythm',
      note:            'Minor delay but good quality.',
    },
    // Yesterday — late bedtime
    {
      date:            daysAgo(1),
      cyclesCompleted: 4,
      anchorTime:      450,
      actualWakeTime:  450,
      actualBedtime:   822,   // 23:42
      recoveryStatus:  'Late bedtime',
      note:            'Went to bed later than planned.',
    },
    // Tonight / today — no data yet (shows as pending)
    {
      date:            daysAgo(0),
      cyclesCompleted: 0,
      anchorTime:      450,
      recoveryStatus:  '—',
      note:            'Tonight — not yet logged.',
    },
  ].reverse(); // most recent first
}

/** Map recovery status string to a display color */
export function recoveryColor(status: string, palette: {
  success: string; warning: string; error: string; muted: string;
}): string {
  switch (status) {
    case 'Great recovery':   return palette.success;
    case 'Stable rhythm':    return palette.success;
    case 'Slight sleep debt':return palette.warning;
    case 'Late bedtime':     return palette.warning;
    case 'Irregular night':  return palette.error;
    default:                 return palette.muted;
  }
}
