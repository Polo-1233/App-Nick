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
  accent:          string;   // primary brand accent
  accentSecondary: string;   // secondary brand accent (blue)

  // ── Semantic ──────────────────────────────────────────────────────────────
  success: string;
  warning: string;
  error:   string;

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
    background:      '#0B1220',
    surface:         '#1A2436',
    surface2:        '#243046',
    text:            '#E6EDF7',
    textSub:         '#9FB0C5',
    textMuted:       '#6B7F99',
    textFaint:       '#2A3A50',
    border:          '#243046',
    borderSub:       '#1E2D42',
    tabBarBg:        '#0B1220',
    tabBarBorder:    '#1A2436',
    tabBarBubble:    'rgba(51,200,232,0.15)',
    tabBarIcon:      '#E6EDF7',
    accent:          '#33C8E8',
    accentSecondary: '#4DA3FF',
    success:         '#3DDC97',
    warning:         '#F5A623',
    error:           '#F87171',
    statusBarStyle:  'light',
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
    accent:          '#22C55E',
    accentSecondary: '#2563EB',
    success:         '#16A34A',
    warning:         '#D97706',
    error:           '#DC2626',
    statusBarStyle:  'dark',
  },
};

export const THEME_STORAGE_KEY    = '@r90:themeMode:v1';
export const IMMERSIVE_STORAGE_KEY = '@r90:immersive:v1';
