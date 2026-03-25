/**
 * rhythm-depth.ts — Cycle Mastery System
 *
 * 5 levels of Rhythm Depth. Hidden signals, visible quality.
 *
 * Axes (all hidden from user):
 *   - Consistency  : ARP confirms, same wake time over days
 *   - Recovery     : MRM, CRP, wind-down completed
 *   - Engagement   : app opens at key moments, Coach content
 *
 * Levels (visible):
 *   Aware → Attuned → Calibrated → Embodied → Integrated
 *
 * Rules:
 *   - Level never shown as a number
 *   - Score is hidden — only level name is displayed
 *   - Soft decay over 3 weeks (never resets to 0)
 *   - No penalty, no punishment
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEPTH_KEY = '@r90:rhythmDepth:v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DepthLevel = 'aware' | 'attuned' | 'calibrated' | 'embodied' | 'integrated';

export interface DepthLevelInfo {
  id:          DepthLevel;
  label:       string;
  tagline:     string;       // shown under the level name
  color:       string;
  minSignal:   number;       // internal threshold
  unlocks:     DepthUnlock[];
}

export interface DepthUnlock {
  id:          string;
  title:       string;
  description: string;
  type:        'content' | 'feature' | 'insight';
}

export interface RhythmDepthState {
  signal:          number;    // hidden cumulative score
  level:           DepthLevel;
  lastDecayDate:   string;    // ISO date of last weekly decay check
  signalThisWeek:  number;    // resets every Monday
  totalDaysActive: number;    // all-time days with at least 1 action
}

// ─── Signal weights (hidden from user) ───────────────────────────────────────

export const SIGNAL = {
  ARP_CONFIRM:       8,   // strongest signal — the foundation of R90
  WINDDOWN_START:    5,
  WINDDOWN_COMPLETE: 5,
  CRP_COMPLETE:      6,
  MRM_COMPLETE:      3,
  COACH_CONTENT:     2,
  COACH_VIDEO:       2,
  APP_RHYTHM_OPEN:   1,   // opened app within 30min of MRM/CRP window
} as const;

// ─── Level definitions ────────────────────────────────────────────────────────

export const DEPTH_LEVELS: DepthLevelInfo[] = [
  {
    // ── AWARE (Day 1–7) — The basics ─────────────────────────────────────
    id:        'aware',
    label:     'Aware',
    tagline:   'You\'re beginning to listen to your rhythm.',
    color:     '#9BB5CC',
    minSignal: 0,
    unlocks:   [
      {
        id:          'nick-insight-1',
        title:       'Nick: Why the "8 hours" rule is a myth',
        description: 'The most important misconception about sleep — and what actually matters.',
        type:        'insight',
      },
      {
        id:          'intro-cycle-guide',
        title:       'Understanding your 90-min cycle',
        description: 'A clear, simple guide to why 90 minutes changes everything.',
        type:        'insight',
      },
      {
        id:          'intro-sleep-stories',
        title:       '3 introductory sleep stories',
        description: 'The Night Forest, Into Sleep, Rain on the Roof.',
        type:        'content',
      },
      {
        id:          'basic-crp',
        title:       '2 basic CRP sessions',
        description: 'Guided body scan and breath meditation for recovery.',
        type:        'content',
      },
    ],
  },
  {
    // ── ATTUNED (Day 7–14) — Going deeper ────────────────────────────────
    id:        'attuned',
    label:     'Attuned',
    tagline:   'Your rhythm is becoming readable.',
    color:     '#1c9fda',
    minSignal: 80,
    unlocks:   [
      {
        id:          'nick-insight-2',
        title:       'Nick: How Man United used strategic naps',
        description: 'How the treble-winning squad built recovery into every match day.',
        type:        'insight',
      },
      {
        id:          'stories-5',
        title:       '5 new sleep stories',
        description: 'The Quiet Shore, The Midnight Train, and more.',
        type:        'content',
      },
      {
        id:          'crp-nsdr',
        title:       'NSDR Recovery Protocol',
        description: '20-min non-sleep deep rest. The most powerful daytime reset.',
        type:        'content',
      },
      {
        id:          'mrm-variety',
        title:       'MRM variety pack',
        description: 'Movement pauses, sensory resets, and guided breathing.',
        type:        'content',
      },
      {
        id:          'weekly-plan-custom',
        title:       'Personalised week planning',
        description: 'Adjust cycle targets per day based on your schedule.',
        type:        'feature',
      },
    ],
  },
  {
    // ── CALIBRATED (Day 14–30) — Patterns emerging ───────────────────────
    id:        'calibrated',
    label:     'Calibrated',
    tagline:   'Your anchor is solid. Patterns are emerging.',
    color:     '#3DDC97',
    minSignal: 220,
    unlocks:   [
      {
        id:          'nick-insight-3',
        title:       'Nick: Optimise your bedroom like an athlete hotel',
        description: 'Light, temperature, sound — the full R90 environment protocol.',
        type:        'insight',
      },
      {
        id:          'stories-8',
        title:       '8 new sleep stories',
        description: 'Premium narratives and ambient soundscapes.',
        type:        'content',
      },
      {
        id:          'recovery-deep-protocol',
        title:       'Recovery Deep Protocol',
        description: 'A 3-session progressive CRP series for peak recovery.',
        type:        'content',
      },
      {
        id:          'history-extended',
        title:       '30-day rhythm history',
        description: 'Extended view — track your long-term patterns.',
        type:        'feature',
      },
    ],
  },
  {
    // ── EMBODIED (Day 30–60) — Rhythm becomes automatic ──────────────────
    id:        'embodied',
    label:     'Embodied',
    tagline:   'The rhythm is becoming automatic.',
    color:     '#F5A623',
    minSignal: 450,
    unlocks:   [
      {
        id:          'nick-insight-4',
        title:       'Nick: Managing jet lag like Premier League teams',
        description: 'Travel protocols used by elite squads crossing time zones.',
        type:        'insight',
      },
      {
        id:          'program-7day-reset',
        title:       '7-Day Sleep Reset Program',
        description: 'Nick\'s structured journey to transform your sleep in one week.',
        type:        'content',
      },
      {
        id:          'travel-routines',
        title:       'Travel & weekend routines',
        description: 'Special protocols for holidays, weekends, and irregular schedules.',
        type:        'content',
      },
      {
        id:          'rlo-advanced',
        title:       'Advanced R-Lo coaching',
        description: 'R-Lo gains deeper context — more personalised responses.',
        type:        'feature',
      },
    ],
  },
  {
    // ── INTEGRATED (Day 60+) — Rhythm is identity ────────────────────────
    id:        'integrated',
    label:     'Integrated',
    tagline:   'Your rhythm is part of who you are.',
    color:     '#A78BFA',
    minSignal: 800,
    unlocks:   [
      {
        id:          'nick-insight-5',
        title:       'Nick: Living in rhythm without the app',
        description: 'The ultimate goal — internalising R90 so deeply you don\'t need tools.',
        type:        'insight',
      },
      {
        id:          'full-library',
        title:       'Full content library',
        description: 'All Coach Insights, programs, and protocols unlocked.',
        type:        'content',
      },
      {
        id:          'advanced-analytics',
        title:       'Advanced rhythm analytics',
        description: 'Deeper patterns, chronotype trends, and energy mapping.',
        type:        'feature',
      },
      {
        id:          'monthly-nick',
        title:       'Monthly exclusive from Nick',
        description: 'Fresh content every month — you\'re among the first to experience it.',
        type:        'content',
      },
      {
        id:          'profile-export',
        title:       'R90 Profile export',
        description: 'Export your rhythm profile as a personalised R90 report.',
        type:        'feature',
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getLevelBySignal(signal: number): DepthLevelInfo {
  return [...DEPTH_LEVELS]
    .reverse()
    .find(l => signal >= l.minSignal) ?? DEPTH_LEVELS[0]!;
}

export function getProgressToNext(signal: number): {
  level:       DepthLevelInfo;
  next:        DepthLevelInfo | null;
  pct:         number;   // 0–1
  signalLeft:  number;
} {
  const level = getLevelBySignal(signal);
  const idx   = DEPTH_LEVELS.indexOf(level);
  const next  = idx < DEPTH_LEVELS.length - 1 ? DEPTH_LEVELS[idx + 1]! : null;

  if (!next) return { level, next: null, pct: 1, signalLeft: 0 };

  const range      = next.minSignal - level.minSignal;
  const earned     = signal - level.minSignal;
  const pct        = Math.min(1, earned / range);
  const signalLeft = next.minSignal - signal;

  return { level, next, pct, signalLeft };
}

export function getUnlockedContent(signal: number): DepthUnlock[] {
  return DEPTH_LEVELS
    .filter(l => signal >= l.minSignal)
    .flatMap(l => l.unlocks);
}

export function isContentUnlocked(contentId: string, signal: number): boolean {
  return getUnlockedContent(signal).some(u => u.id === contentId);
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export async function getDepth(): Promise<RhythmDepthState> {
  const raw = await AsyncStorage.getItem(DEPTH_KEY).catch(() => null);
  if (!raw) return {
    signal:          0,
    level:           'aware',
    lastDecayDate:   '',
    signalThisWeek:  0,
    totalDaysActive: 0,
  };
  return JSON.parse(raw) as RhythmDepthState;
}

export async function addSignal(amount: number): Promise<{
  newLevel: DepthLevel;
  prevLevel: DepthLevel;
  levelUp: boolean;
}> {
  const state = await getDepth();
  const prevLevel = state.level;

  const today = new Date().toISOString().slice(0, 10);

  // Soft decay: once per week, reduce signal slightly if low activity
  const newState: RhythmDepthState = {
    ...state,
    signal:          state.signal + amount,
    signalThisWeek:  state.signalThisWeek + amount,
    lastDecayDate:   today,
    totalDaysActive: state.totalDaysActive + (state.lastDecayDate === today ? 0 : 1),
    level:           getLevelBySignal(state.signal + amount).id,
  };

  await AsyncStorage.setItem(DEPTH_KEY, JSON.stringify(newState));

  return {
    newLevel:  newState.level,
    prevLevel,
    levelUp:   newState.level !== prevLevel,
  };
}

// ─── Weekly soft decay ────────────────────────────────────────────────────────
// Call once on app open (Monday check)

export async function applyWeeklyDecay(): Promise<void> {
  const state = await getDepth();
  const today = new Date();
  if (today.getDay() !== 1) return; // Monday only

  const lastDecay = new Date(state.lastDecayDate || '2020-01-01');
  const daysSince = Math.floor((today.getTime() - lastDecay.getTime()) / 86_400_000);
  if (daysSince < 7) return;

  // If low activity last week (< 20 signal), apply a soft decay of 5%
  // Never below current level's minSignal (you never lose your level)
  const currentLevel = getLevelBySignal(state.signal);
  const floor = currentLevel.minSignal;

  const decayed = state.signalThisWeek < 20
    ? Math.max(floor, Math.floor(state.signal * 0.95))
    : state.signal;

  await AsyncStorage.setItem(DEPTH_KEY, JSON.stringify({
    ...state,
    signal:         decayed,
    signalThisWeek: 0,
    lastDecayDate:  today.toISOString().slice(0, 10),
    level:          getLevelBySignal(decayed).id,
  }));
}
