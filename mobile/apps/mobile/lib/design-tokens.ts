/**
 * R90 Design Tokens — single source of truth for all visual constants.
 *
 * Rules:
 *   - Every component must use these tokens (no hardcoded values)
 *   - Theme colors are in theme.ts (not here)
 *   - These tokens are theme-independent (spacing, radius, typography, etc.)
 */

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  xxxl: 48,
  /** Standard horizontal screen padding */
  screen: 20,
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  /** Primary cards */
  card: 20,
  xl:   24,
  full: 9999,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const fontSize = {
  xs:      11,
  sm:      13,
  md:      15,
  lg:      17,
  xl:      20,
  xxl:     24,
  xxxl:    32,
  /** Large hero numbers (wake time, bedtime) */
  hero:    36,
  /** Primary display number (Rhythm Flow) */
  display: 48,
  /** Jumbo display (time adjuster) */
  jumbo:   56,
} as const;

export const fontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
  black:    '800' as const,
};

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadow = {
  /** Subtle — secondary cards, badges */
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     2,
  },
  /** Standard — primary cards */
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  8,
    elevation:     4,
  },
  /** Prominent — modals, overlays */
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius:  16,
    elevation:     8,
  },
} as const;

// ─── Opacity scale ────────────────────────────────────────────────────────────
/** Use with hex suffix: `${color}${opacity.md}` → `#1c9fda20` */
export const opacity = {
  subtle:  '08',    // 3% — barely visible backgrounds
  light:   '12',    // 7% — light tint backgrounds
  soft:    '18',    // 9% — soft backgrounds, hover states
  medium:  '25',    // 15% — badges, highlighted backgrounds
  strong:  '40',    // 25% — borders, active states
  heavy:   '60',    // 38% — prominent borders, focus rings
} as const;

// ─── Animation timing ─────────────────────────────────────────────────────────

export const duration = {
  /** Button press, micro-interactions */
  fast:    100,
  /** Standard transitions, fade */
  normal:  250,
  /** Slide transitions, modal enter */
  slow:    400,
  /** Page transitions, complex reveals */
  enter:   600,
  /** Breathing circles, ambient pulse */
  breath:  3000,
} as const;
