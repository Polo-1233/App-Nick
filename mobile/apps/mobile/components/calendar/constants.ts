/**
 * Shared constants for the Calendar grid UI.
 * All layout math derives from HOUR_HEIGHT so changing one value rescales everything.
 */

import type { BlockType, ReadinessZone } from '@r90/types';

/** Pixels for one hour on the vertical grid. */
export const HOUR_HEIGHT = 64;
/** Width of the time-label column on the left edge. */
export const TIME_COL_W = 44;
/** Minimum rendered pixel height for any block (ensures tappability). */
export const MIN_BLOCK_H = 18;
/** Total grid canvas height (24 h). */
export const TOTAL_H = HOUR_HEIGHT * 24; // 1536 px

/** Convert minutes-of-day → pixel offset within the grid. */
export function minToPx(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT;
}

// ─── Zone colours ─────────────────────────────────────────────────────────────

export const ZONE_COLOR: Record<ReadinessZone, string> = {
  green:  '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
};

// ─── Block visual styles ──────────────────────────────────────────────────────

export type BlockStyle = { bg: string; border: string; text: string };

/** Dark-theme block styles: muted bg + accent border + readable text. */
export const BLOCK_STYLE: Record<BlockType, BlockStyle> = {
  sleep_cycle:    { bg: '#091B36', border: '#1E40AF', text: '#93C5FD' },
  pre_sleep:      { bg: '#0A2010', border: '#16A34A', text: '#86EFAC' },
  crp:            { bg: '#1C1500', border: '#A16207', text: '#FDE047' },
  down_period:    { bg: '#1A0B30', border: '#6D28D9', text: '#C4B5FD' },
  wake:           { bg: '#071A0D', border: '#166534', text: '#4ADE80' },
  calendar_event: { bg: '#0E1028', border: '#3730A3', text: '#A5B4FC' },
  free:           { bg: 'transparent', border: 'transparent', text: '#404040' },
};

/** Human-readable label for each block type. */
export const BLOCK_LABEL: Record<BlockType, string> = {
  sleep_cycle:    'Sleep',
  pre_sleep:      'Wind-down',
  crp:            'Nap Window',
  down_period:    'Rest Break',
  wake:           'Wake Up',
  calendar_event: 'Event',
  free:           '',
};

// ─── Conflict styling ─────────────────────────────────────────────────────────

/** Semi-transparent red tint overlaid on conflicting calendar events. */
export const CONFLICT_TINT   = 'rgba(239,68,68,0.18)';
/** Border colour for conflicting events. */
export const CONFLICT_BORDER = '#EF4444';
