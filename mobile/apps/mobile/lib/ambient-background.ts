/**
 * ambient-background.ts — Dynamic background system based on R90 time-of-day
 *
 * Philosophy: background is almost invisible. 95% white, 2–5% color.
 * States follow the R90 rhythm: morning · day · evening · night
 *
 * Rules:
 *   - No patterns, no heavy gradients
 *   - Opacity 2–5% max color presence
 *   - Smooth transitions via Animated interpolation
 */

export type AmbientState = 'morning' | 'day' | 'evening' | 'night';

export interface AmbientColors {
  top:    string;   // gradient top stop
  bottom: string;   // gradient bottom stop
}

// ─── State definition ─────────────────────────────────────────────────────────
// All colors are extremely low opacity — barely perceptible
// Light mode only. Dark mode keeps its existing navy palette.

export const AMBIENT: Record<AmbientState, AmbientColors> = {
  morning: {
    // Cool blue-white — fresh, crisp, alert
    top:    'rgba(240,248,255,1)',        // almost pure white, tiny cool tint
    bottom: 'rgba(213,237,255,0.55)',     // very pale sky blue
  },
  day: {
    // Clean white, neutral — productive clarity
    top:    'rgba(255,255,255,1)',        // pure white
    bottom: 'rgba(224,238,248,0.45)',     // extremely subtle blue
  },
  evening: {
    // Slightly warmer, softer blue — wind-down signal
    top:    'rgba(255,253,250,1)',        // warm white
    bottom: 'rgba(210,228,245,0.55)',     // soft blue-lavender
  },
  night: {
    // Desaturated blue-grey — still very bright, NOT dark
    top:    'rgba(248,250,253,1)',        // near-white with cool cast
    bottom: 'rgba(205,220,240,0.60)',     // pale blue-grey
  },
};

// ─── State resolver ───────────────────────────────────────────────────────────

/**
 * Returns the ambient state for the given time, relative to the user's wake time.
 *
 * @param nowMinutes  - current time in minutes since midnight
 * @param wakeMin     - anchor rising point in minutes since midnight (default 390 = 06:30)
 */
export function getAmbientState(nowMinutes: number, wakeMin: number = 390): AmbientState {
  // Normalise to minutes since wake
  const sinceWake = ((nowMinutes - wakeMin) + 1440) % 1440;

  if (sinceWake < 240)  return 'morning';   // wake → +4h
  if (sinceWake < 600)  return 'day';        // +4h → +10h
  if (sinceWake < 840)  return 'evening';    // +10h → +14h
  return                        'night';     // +14h onwards → sleep window
}
