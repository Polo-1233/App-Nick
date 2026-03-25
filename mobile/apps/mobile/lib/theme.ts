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
  success:    string;
  warning:    string;
  gold:       string;   // CRP, recovery, warm highlights
  purple:     string;   // sleep markers, premium accents
  error:      string;   // ONLY for technical errors (network, login) — not for rhythm/sleep
  rhythmLow:  string;   // amber — for below-target rhythm indicators (never red)

  // ── Button text ─────────────────────────────────────────────────────────
  buttonPrimaryText: string;   // text color on primary CTA buttons

  // ── System ────────────────────────────────────────────────────────────────
  statusBarStyle: 'light' | 'dark';
}

export interface Theme {
  dark:   boolean;
  colors: ThemeColors;
}

// ─── R90 Brand tokens ─────────────────────────────────────────────────────────
// Source: Nick Littlehales brand identity
//   Accent (claire)  #1c9fda — bleu clair R90
//   Deep (fore)      #141466 — bleu marine foncé
//   Text             #002060 — bleu écriture
//   Background       #ffffff — fond blanc

// ─── Dark theme — R90 navy brand ──────────────────────────────────────────────

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background:      '#0a0a3a',   // navy très foncé dérivé de #141466
    surface:         '#141466',   // bleu marine R90
    surface2:        '#1c1c7a',   // navy légèrement plus clair
    text:            '#FFFFFF',
    textSub:         '#A8C4E0',
    textMuted:       '#6B8CAE',
    textFaint:       '#1e1e70',
    border:          '#1c1c7a',
    borderSub:       '#141466',
    tabBarBg:        '#0a0a3a',
    tabBarBorder:    '#141466',
    tabBarBubble:    'rgba(28,159,218,0.18)',  // accent alpha
    tabBarIcon:      '#FFFFFF',
    accent:          '#1c9fda',   // bleu clair R90
    accentSecondary: '#4DC3F0',   // accent plus clair
    success:         '#3DDC97',
    warning:         '#F5A623',
    gold:            '#F5A623',   // CRP, recovery highlights
    purple:          '#8B5CF6',   // sleep markers, premium
    error:           '#F87171',   // technical errors only
    rhythmLow:       '#E8A020',   // warm amber — below-target rhythm (not anxiety-inducing)
    buttonPrimaryText: '#FFFFFF', // white text on accent buttons
    statusBarStyle:  'light',
  },
};

// ─── Light theme — R90 blanc/bleu ─────────────────────────────────────────────

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background:      '#FFFFFF',   // fond blanc R90
    surface:         '#F0F6FB',   // bleu très pâle
    surface2:        '#E0EEF8',
    text:            '#002060',   // bleu écriture R90
    textSub:         '#1c4a8a',
    textMuted:       '#5B7A9D',
    textFaint:       '#C8DDEF',
    border:          '#CCE3F4',
    borderSub:       '#E8F3FB',
    tabBarBg:        '#FFFFFF',
    tabBarBorder:    '#CCE3F4',
    tabBarBubble:    'rgba(28,159,218,0.12)',
    tabBarIcon:      '#002060',
    accent:          '#1c9fda',   // bleu clair R90
    accentSecondary: '#141466',   // bleu marine R90
    success:         '#16A34A',
    warning:         '#D97706',
    gold:            '#D97706',   // CRP, recovery highlights
    purple:          '#7C3AED',   // sleep markers, premium
    error:           '#DC2626',   // technical errors only
    rhythmLow:       '#C47F17',   // warm amber for below-target rhythm
    buttonPrimaryText: '#FFFFFF', // white text on accent buttons
    statusBarStyle:  'dark',
  },
};

export const THEME_STORAGE_KEY    = '@r90:themeMode:v1';
export const IMMERSIVE_STORAGE_KEY = '@r90:immersive:v1';
