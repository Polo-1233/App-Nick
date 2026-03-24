/**
 * time-utils.ts — Shared time utility functions.
 *
 * Single source of truth for time calculations used across the app.
 */

/** Returns the current time as minutes since midnight (0–1439). */
export function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Formats minutes since midnight as "HH:MM". Handles wrap-around (>1440 or negative). */
export function fmtMin(m: number): string {
  const normalized = ((m % 1440) + 1440) % 1440;
  const h   = Math.floor(normalized / 60);
  const min = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
