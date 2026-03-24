/**
 * rhythm-clock.ts — Shared data computation for timeline + full clock
 *
 * Single source of truth used by both:
 *   - RhythmTimeline (home, linear, next 3 cycles)
 *   - FullClockView (modal, circular, full day)
 */

export const CYCLE = 90; // minutes

export interface RhythmSegment {
  index:     number;
  startMin:  number;   // absolute minutes since midnight
  endMin:    number;
  label:     string;   // "Cycle 3"
  isCurrent: boolean;
  isPast:    boolean;
  hasMRM:    boolean;  // MRM dot at ~80 min into this cycle
  isCRP:     boolean;  // CRP window
  isSleep:   boolean;  // sleep window
}

export interface RhythmData {
  segments:      RhythmSegment[];
  totalCycles:   number;
  currentIdx:    number;   // -1 if before day start
  wakeMin:       number;
  bedtimeMin:    number;   // tonight
  crpMin:        number;   // wake + 7h
  nowMin:        number;
  cursorPct:     number;   // 0–1 position in full day
}

function wrap(m: number): number {
  return ((m % 1440) + 1440) % 1440;
}

export function fmtMin(m: number): string {
  const n = wrap(m);
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

export function computeRhythmData(
  nowMinutes:   number,
  wakeMin:      number,
  idealCycles:  number = 5,
): RhythmData {
  const bedtimeMin  = wrap(wakeMin + idealCycles * CYCLE);
  const crpMin      = wrap(wakeMin + 7 * 60);
  const spanStart   = wakeMin;
  const spanEnd     = bedtimeMin <= wakeMin ? bedtimeMin + 1440 : bedtimeMin;
  const spanTotal   = Math.max(spanEnd - spanStart, 1);
  const totalCycles = idealCycles;

  // Adjust now for day span
  let nowAdj = nowMinutes;
  if (nowAdj < spanStart) nowAdj += 1440;

  const cursorPct = Math.max(0, Math.min(1, (nowAdj - spanStart) / spanTotal));
  const currentIdx = nowAdj >= spanStart && nowAdj < spanEnd
    ? Math.min(Math.floor((nowAdj - spanStart) / CYCLE), totalCycles - 1)
    : nowAdj < spanStart ? -1 : totalCycles;

  const segments: RhythmSegment[] = Array.from({ length: totalCycles }, (_, i) => {
    const startMin = wrap(wakeMin + i * CYCLE);
    const endMin   = wrap(wakeMin + (i + 1) * CYCLE);
    const mrmMin   = wrap(wakeMin + i * CYCLE + 80);
    const isCRPSeg = Math.abs(wrap(crpMin) - startMin) < CYCLE;

    return {
      index:     i,
      startMin,
      endMin,
      label:     `Cycle ${i + 1}`,
      isCurrent: i === currentIdx,
      isPast:    i < currentIdx,
      hasMRM:    i < totalCycles - 1, // last cycle has no MRM
      isCRP:     isCRPSeg,
      isSleep:   i === totalCycles - 1,
    };
  });

  return {
    segments,
    totalCycles,
    currentIdx,
    wakeMin,
    bedtimeMin,
    crpMin,
    nowMin: nowMinutes,
    cursorPct,
  };
}
