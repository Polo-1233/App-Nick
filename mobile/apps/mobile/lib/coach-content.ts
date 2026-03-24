/**
 * coach-content.ts — Static content registry for Coach Insights screen
 *
 * All content is placeholder until production assets are provided.
 * Structure: coachInsights · windDown · mrm · crp · programs
 */

export type ContentType = 'video' | 'audio' | 'text' | 'exercise';

export interface ContentItem {
  id:          string;
  title:       string;
  subtitle?:   string;
  duration:    string;       // "2 min", "20 min"
  type:        ContentType;
  thumbnail?:  string;       // local asset path or URL (optional)
  available:   boolean;      // false → "Coming soon"
  route?:      string;       // deep link route if tappable
}

export interface Program {
  id:          string;
  title:       string;
  description: string;
  totalDays:   number;
  currentDay:  number;       // 0 = not started
  accent:      string;       // card accent color
  icon:        string;       // Ionicons name
  available:   boolean;
}

// ─── Coach Insights ───────────────────────────────────────────────────────────
// Short videos / explanations from Nick — educate, guide, reinforce

export const COACH_INSIGHTS: ContentItem[] = [
  {
    id:        'ci-01',
    title:     'Why wake time matters more than bedtime',
    duration:  '2 min',
    type:      'video',
    available: false,
  },
  {
    id:        'ci-02',
    title:     'Your rhythm starts in the morning',
    duration:  '3 min',
    type:      'video',
    available: false,
  },
  {
    id:        'ci-03',
    title:     'Small resets change your day',
    duration:  '2 min',
    type:      'video',
    available: false,
  },
  {
    id:        'ci-04',
    title:     'What is a 90-minute cycle?',
    duration:  '3 min',
    type:      'video',
    available: false,
  },
  {
    id:        'ci-05',
    title:     'Sleep quality vs. sleep quantity',
    duration:  '2 min',
    type:      'video',
    available: false,
  },
];

// ─── Wind Down ────────────────────────────────────────────────────────────────

export const WIND_DOWN_CONTENT: ContentItem[] = [
  {
    id:        'wd-01',
    title:     'Evening wind-down',
    subtitle:  'Prepare your mind for sleep',
    duration:  '10 min',
    type:      'audio',
    available: true,
    route:     '/wind-down',
  },
  {
    id:        'wd-02',
    title:     'Breathing for sleep',
    subtitle:  '4-7-8 technique',
    duration:  '5 min',
    type:      'exercise',
    available: false,
  },
  {
    id:        'wd-03',
    title:     'Sleep story',
    subtitle:  'Guided relaxation',
    duration:  '15 min',
    type:      'audio',
    available: false,
  },
];

// ─── MRM Library ─────────────────────────────────────────────────────────────

export const MRM_CONTENT: ContentItem[] = [
  {
    id:        'mrm-01',
    title:     'Micro recovery reset',
    subtitle:  'Eyes closed, breathe',
    duration:  '2 min',
    type:      'audio',
    available: true,
    route:     '/mrm-player',
  },
  {
    id:        'mrm-02',
    title:     'Box breathing',
    subtitle:  '4-4-4-4 cycle',
    duration:  '3 min',
    type:      'exercise',
    available: false,
  },
  {
    id:        'mrm-03',
    title:     'Visual rest',
    subtitle:  'Soft gaze technique',
    duration:  '2 min',
    type:      'exercise',
    available: false,
  },
];

// ─── CRP Library ─────────────────────────────────────────────────────────────

export const CRP_CONTENT: ContentItem[] = [
  {
    id:        'crp-01',
    title:     'Controlled recovery period',
    subtitle:  'Full reset session',
    duration:  '20 min',
    type:      'audio',
    available: true,
    route:     '/crp-player',
  },
  {
    id:        'crp-02',
    title:     'NSDR protocol',
    subtitle:  'Non-sleep deep rest',
    duration:  '20 min',
    type:      'audio',
    available: false,
  },
  {
    id:        'crp-03',
    title:     'Body scan meditation',
    subtitle:  'Full relaxation',
    duration:  '25 min',
    type:      'audio',
    available: false,
  },
];

// ─── Programs ─────────────────────────────────────────────────────────────────

export const PROGRAMS: Program[] = [
  {
    id:          'prog-01',
    title:       '7-Day Sleep Reset',
    description: 'Build your anchor, establish your rhythm, sleep better in one week.',
    totalDays:   7,
    currentDay:  0,
    accent:      '#1c9fda',
    icon:        'moon-outline',
    available:   false,
  },
  {
    id:          'prog-02',
    title:       'Performance Week',
    description: 'Optimise your cycles for peak output. Designed for high-performance weeks.',
    totalDays:   5,
    currentDay:  0,
    accent:      '#A78BFA',
    icon:        'flash-outline',
    available:   false,
  },
];
