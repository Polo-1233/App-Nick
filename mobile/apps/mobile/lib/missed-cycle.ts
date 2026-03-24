/**
 * missed-cycle.ts — Shared utility for missed sleep window detection.
 *
 * Extracted from HomeScreen.tsx for shared use in notifications and UI.
 */

export interface MissedCycleInfo {
  missed:          boolean;
  nextWindow:      string;   // "00:30"
  cyclesRemaining: number;
}

/**
 * Returns info about a missed sleep window, or null if still within window.
 *
 * @param bedtime    - Ideal bedtime in minutes since midnight
 * @param cycleCount - Total cycles planned for the night
 * @param anchorTime - Anchor (wake) time in minutes since midnight
 */
export function getMissedCycleInfo(
  bedtime:    number | null,
  cycleCount: number,
  anchorTime: number | null,
): MissedCycleInfo | null {
  if (!bedtime || !anchorTime) return null;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const bedtimeAdj = bedtime < anchorTime ? bedtime + 1440 : bedtime;
  const nowAdj     = nowMin < anchorTime  ? nowMin + 1440  : nowMin;

  if (nowAdj <= bedtimeAdj) return null;

  const minutesPast  = nowAdj - bedtimeAdj;
  const cyclesMissed = Math.ceil(minutesPast / 90);
  const remaining    = cycleCount - cyclesMissed;

  if (remaining < 3) return null;

  const nextWindowMin = (bedtime + cyclesMissed * 90) % 1440;
  const h = Math.floor(nextWindowMin / 60);
  const m = nextWindowMin % 60;

  return {
    missed:          true,
    nextWindow:      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    cyclesRemaining: remaining,
  };
}
