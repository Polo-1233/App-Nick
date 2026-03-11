/**
 * R90 Theme tokens — light and dark.
 *
 * Dark values are the current app colors (zero visual change).
 * Light values are a clean, high-contrast light palette.
 *
 * Usage:
 *   const { theme } = useTheme();
 *   <View style={{ backgroundColor: theme.colors.background }} />
 */

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  background:  string;   // root screen background
  surface:     string;   // card / panel background
  surface2:    string;   // inner card / subtle highlight

  // ── Text ──────────────────────────────────────────────────────────────────
  text:        string;   // primary text
  textSub:     string;   // secondary / metadata text
  textMuted:   string;   // muted / hint / icon label
  textFaint:   string;   // very faint — section headers, divider labels

  // ── Borders & separators ──────────────────────────────────────────────────
  border:      string;   // main border / card outline
  borderSub:   string;   // hairline row separator

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBarBg:     string;
  tabBarBorder: string;
  tabBarBubble: string;  // active bubble bg (already includes alpha)
  tabBarIcon:   string;  // base icon tint

  // ── Brand ─────────────────────────────────────────────────────────────────
  accent:      string;   // #22C55E — same in both themes

  // ── System ────────────────────────────────────────────────────────────────
  statusBarStyle: 'light' | 'dark';
}

export interface Theme {
  dark:   boolean;
  colors: ThemeColors;
}

// ─── Dark theme (current app palette — zero regression) ───────────────────────

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background:     '#0A0A0A',
    surface:        '#111111',
    surface2:       '#1A1A1A',
    text:           '#FFFFFF',
    textSub:        '#9CA3AF',
    textMuted:      '#6B7280',
    textFaint:      '#3A3A3A',
    border:         '#1A1A1A',
    borderSub:      '#161616',
    tabBarBg:       '#0A0A0A',
    tabBarBorder:   '#1A1A1A',
    tabBarBubble:   'rgba(255,255,255,0.12)',
    tabBarIcon:     '#FFFFFF',
    accent:         '#22C55E',
    statusBarStyle: 'light',
  },
};

// ─── Light theme ──────────────────────────────────────────────────────────────

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background:     '#FFFFFF',
    surface:        '#F9FAFB',
    surface2:       '#F3F4F6',
    text:           '#111827',
    textSub:        '#6B7280',
    textMuted:      '#9CA3AF',
    textFaint:      '#D1D5DB',
    border:         '#E5E7EB',
    borderSub:      '#F3F4F6',
    tabBarBg:       '#FFFFFF',
    tabBarBorder:   '#E5E7EB',
    tabBarBubble:   'rgba(0,0,0,0.08)',
    tabBarIcon:     '#374151',
    accent:         '#22C55E',
    statusBarStyle: 'dark',
  },
};

export const THEME_STORAGE_KEY    = '@r90:themeMode:v1';
export const IMMERSIVE_STORAGE_KEY = '@r90:immersive:v1';
