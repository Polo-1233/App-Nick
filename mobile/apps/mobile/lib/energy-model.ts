/**
 * energy-model.ts — R90 energy layer
 *
 * Maps each 90-min cycle to an energy level based on:
 *   - R90 ultradian rhythm (natural energy arc across the day)
 *   - User's peak preference (morning / midday / evening)
 *
 * 3 levels only:
 *   high     → focus window, good output
 *   neutral  → normal performance
 *   low      → recovery moment, rest recommended
 *
 * Rules:
 *   - No numbers, no labels on clock (handled by UI layer)
 *   - Color variation stays subtle — user should feel it, not read it
 *   - Tooltip text replaces any complex label
 */

export type EnergyLevel = 'high' | 'neutral' | 'low';
export type PeakPreference = 'morning' | 'midday' | 'evening';

export interface CycleEnergy {
  cycleIndex: EnergyLevel;  // not used — just the map below
}

export interface EnergyInfo {
  level:   EnergyLevel;
  tooltip: string;       // shown on tap in FullClockView
}

// ─── Base R90 energy pattern ──────────────────────────────────────────────────
// Built from ultradian rhythm research (90-min cycles, natural energy arc).
// Pattern is relative to wake time. Index = cycle number (0-based).
// Pattern repeats for long days (>8 cycles).

const BASE_PATTERN: EnergyLevel[] = [
  'neutral',   // Cycle 0  — wake-up, body activating
  'high',      // Cycle 1  — peak focus window
  'high',      // Cycle 2  — strong performance
  'low',       // Cycle 3  — post-lunch dip / CRP moment
  'neutral',   // Cycle 4  — afternoon recovery
  'neutral',   // Cycle 5  — evening steady
  'low',       // Cycle 6  — wind-down begins
  'low',       // Cycle 7  — sleep window approaching
];

// ─── Peak preference shifts ───────────────────────────────────────────────────
// Shift the high-energy window forward or backward based on chronotype/preference

const SHIFT: Record<PeakPreference, number> = {
  morning: 0,    // default — peak at cycles 1-2
  midday:  1,    // shift peak 1 cycle later
  evening: 2,    // shift peak 2 cycles later
};

// ─── Tooltip copy ─────────────────────────────────────────────────────────────

const TOOLTIPS: Record<EnergyLevel, string[]> = {
  high: [
    'Good focus window',
    'Peak performance time',
    'High energy — use it well',
  ],
  neutral: [
    'Steady energy',
    'Good general performance',
    'Balanced moment',
  ],
  low: [
    'Recovery moment',
    'Energy dip — rest if you can',
    'Ideal for a CRP or MRM',
  ],
};

function pickTooltip(level: EnergyLevel, cycleIndex: number): string {
  const pool = TOOLTIPS[level];
  return pool[cycleIndex % pool.length]!;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Returns energy info for each cycle in the day.
 *
 * @param totalCycles     — number of cycles in the day (from UserProfile)
 * @param peakPreference  — user's energy peak preference
 * @returns               — array indexed by cycle number
 */
export function getEnergyMap(
  totalCycles:     number,
  peakPreference:  PeakPreference = 'morning',
): EnergyInfo[] {
  const shift = SHIFT[peakPreference];

  return Array.from({ length: totalCycles }, (_, i) => {
    // Shift the base pattern
    const patternIdx = Math.max(0, i - shift);
    const raw = BASE_PATTERN[patternIdx] ?? BASE_PATTERN[BASE_PATTERN.length - 1] ?? 'neutral';

    // Last cycle is always low (sleep window)
    const level: EnergyLevel = i === totalCycles - 1 ? 'low' : raw;

    return {
      level,
      tooltip: pickTooltip(level, i),
    };
  });
}

// ─── Color helpers ────────────────────────────────────────────────────────────
// Returns a tinted color for each energy level.
// Applied ON TOP of the base ring color — subtle overlay.

export function energyColor(level: EnergyLevel, base: string): string {
  switch (level) {
    case 'high':    return base;                           // full color
    case 'neutral': return base;                           // same (opacity handled separately)
    case 'low':     return base;                           // same
  }
}

export function energyOpacity(level: EnergyLevel, isCurrent: boolean, isPast: boolean): number {
  if (isPast)    return 0.45;
  if (isCurrent) return 1;
  switch (level) {
    case 'high':    return 0.85;
    case 'neutral': return 0.50;
    case 'low':     return 0.25;
  }
}
