/**
 * content-registry.ts — Registre de contenu audio R90
 *
 * MRM  : Micro Recovery Moments (2-3 min)
 * CRP  : Controlled Recovery Period (15-20 min)
 * Wind-down : préparation au sommeil (8-30 min)
 *
 * Rotation : getNextContent() sélectionne le contenu le moins récemment joué.
 * markContentPlayed() met à jour l'historique.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type MrmVariant = 'breathing' | 'movement' | 'sensory';

export interface ContentItem {
  id:          string;
  title:       string;
  description: string;
  duration:    number;       // secondes
  category:    'mrm' | 'crp' | 'winddown';
  source:      number | null;  // require(...) or null for text-only
  premium:     boolean;
  /** MRM variant — null for CRP/winddown */
  mrmVariant?: MrmVariant;
  /** Text-only instructions (for movement/sensory MRM) */
  textGuide?:  string[];
  /** Wind-down episode number (serialized, like Netflix) */
  episode?:    number;
}

// ─── MRM Content ──────────────────────────────────────────────────────────────
// TODO: Replace placeholder files with real audio when produced

export const MRM_CONTENT: ContentItem[] = [
  {
    id:          'mrm-breathing-box',
    title:       'Box breathing',
    description: 'Inhale, hold, exhale, hold. 2 minutes.',
    duration:    120,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/breathing-box-2min.mp3'),
    premium:     false,
  },
  {
    id:          'mrm-breathing-478',
    title:       '4-7-8 Breathing',
    description: 'Quick relaxation technique. 2 minutes.',
    duration:    120,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/breathing-478-2min.mp3'),
    premium:     true,
  },
  {
    id:          'mrm-breathing-calm',
    title:       'Slow breathing',
    description: 'Progressive calm. 3 minutes.',
    duration:    180,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/breathing-calm-3min.mp3'),
    premium:     true,
  },
  {
    id:          'mrm-stretch-neck',
    title:       'Neck & shoulder stretch',
    description: 'Release upper body tension. 2 minutes.',
    duration:    120,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/stretch-neck-2min.mp3'),
    premium:     true,
  },
  {
    id:          'mrm-eyes-rest',
    title:       'Visual rest',
    description: 'Eye rest and mental relaxation. 2 minutes.',
    duration:    120,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/eyes-rest-2min.mp3'),
    premium:     true,
  },
];

// ─── MRM Movement & Sensory variants (text-only, no audio) ──────────────────

export const MRM_MOVEMENT: ContentItem[] = [
  {
    id:          'mrm-move-stretch',
    title:       'Stand & stretch',
    description: 'Get up, stretch your arms overhead, roll your neck.',
    duration:    60,
    category:    'mrm',
    source:      null,
    premium:     false,
    mrmVariant:  'movement',
    textGuide:   ['Stand up slowly', 'Stretch your arms overhead', 'Roll your neck gently', 'Fill a glass of water', 'Take a deep breath'],
  },
  {
    id:          'mrm-move-walk',
    title:       'Quick walk',
    description: 'Walk for 1 minute. No phone. Just movement.',
    duration:    60,
    category:    'mrm',
    source:      null,
    premium:     false,
    mrmVariant:  'movement',
    textGuide:   ['Put your phone down', 'Walk for 60 seconds', 'Feel your feet on the ground', 'Return refreshed'],
  },
];

export const MRM_SENSORY: ContentItem[] = [
  {
    id:          'mrm-sense-window',
    title:       'Window pause',
    description: 'Look outside. No screen. Just 2 minutes.',
    duration:    120,
    category:    'mrm',
    source:      null,
    premium:     false,
    mrmVariant:  'sensory',
    textGuide:   ['Look out the window', 'Focus on something far away', 'Notice the light and colours', 'Let your eyes rest'],
  },
  {
    id:          'mrm-sense-listen',
    title:       'Sound awareness',
    description: 'Close your eyes. Listen to what\'s around you.',
    duration:    120,
    category:    'mrm',
    source:      null,
    premium:     false,
    mrmVariant:  'sensory',
    textGuide:   ['Close your eyes', 'Listen to the nearest sound', 'Now listen to the farthest sound', 'Open your eyes slowly'],
  },
];

/** Get a random MRM of a specific variant */
export function getRandomMrmByVariant(variant: MrmVariant): ContentItem {
  const pool = variant === 'breathing' ? MRM_CONTENT
    : variant === 'movement' ? MRM_MOVEMENT
    : MRM_SENSORY;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── CRP Content ──────────────────────────────────────────────────────────────

export const CRP_CONTENT: ContentItem[] = [
  {
    id:          'crp-meditation-body',
    title:       'Guided body scan',
    description: 'Full body exploration. 20 minutes.',
    duration:    1200,
    category:    'crp',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/crp/meditation-body-20min.mp3'),
    premium:     false,
  },
  {
    id:          'crp-meditation-breath',
    title:       'Breath meditation',
    description: 'Breath-anchored meditation. 20 minutes.',
    duration:    1200,
    category:    'crp',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/crp/meditation-breath-20min.mp3'),
    premium:     true,
  },
  {
    id:          'crp-nsdr',
    title:       'NSDR · Yoga Nidra',
    description: 'Non-sleep deep rest. 20 minutes.',
    duration:    1200,
    category:    'crp',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/crp/nsdr-20min.mp3'),
    premium:     true,
  },
  {
    id:          'crp-relaxation-progressive',
    title:       'Progressive relaxation',
    description: 'Guided muscle relaxation. 15 minutes.',
    duration:    900,
    category:    'crp',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/crp/relaxation-progressive-15min.mp3'),
    premium:     true,
  },
  {
    id:          'crp-meditation-nature',
    title:       'Nature meditation',
    description: 'Nature sounds + guided voice. 20 minutes.',
    duration:    1200,
    category:    'crp',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/crp/meditation-nature-20min.mp3'),
    premium:     true,
  },
];

// ─── Wind-Down Content ────────────────────────────────────────────────────────

export const WINDDOWN_CONTENT: ContentItem[] = [
  {
    id:          'wd-story-forest',
    title:       'The Night Forest',
    description: 'A walk through ancient trees under starlight.',
    duration:    720,
    category:    'winddown',
    episode:     1,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/sleep-story-forest-12min.mp3'),
    premium:     false,
  },
  {
    id:          'wd-story-ocean',
    title:       'The Quiet Shore',
    description: 'Waves, sand, and a setting sun.',
    duration:    900,
    category:    'winddown',
    episode:     2,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/sleep-story-ocean-15min.mp3'),
    premium:     true,
  },
  {
    id:          'wd-story-train',
    title:       'The Midnight Train',
    description: 'The gentle rhythm of tracks through countryside.',
    duration:    720,
    category:    'winddown',
    episode:     3,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/sleep-story-train-12min.mp3'),
    premium:     true,
  },
  {
    id:          'wd-breathing-presleep',
    title:       'Into Sleep',
    description: 'Guided breathing to prepare your body.',
    duration:    600,
    category:    'winddown',
    episode:     4,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/breathing-presleep-10min.mp3'),
    premium:     false,
  },
  {
    id:          'wd-breathing-progressive',
    title:       'Body Release',
    description: 'Progressive muscle relaxation, head to toe.',
    duration:    480,
    category:    'winddown',
    episode:     5,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/breathing-progressive-8min.mp3'),
    premium:     true,
  },
  {
    id:          'wd-soundscape-rain',
    title:       'Rain on the Roof',
    description: 'Soft rain. No voice. Just sound.',
    duration:    1800,
    category:    'winddown',
    episode:     6,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/soundscape-rain-30min.mp3'),
    premium:     false,
  },
  {
    id:          'wd-soundscape-night',
    title:       'Still Night',
    description: 'Crickets, distant owls, soft wind.',
    duration:    1800,
    category:    'winddown',
    episode:     7,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/soundscape-night-30min.mp3'),
    premium:     true,
  },
];

// ─── Rotation ─────────────────────────────────────────────────────────────────

function getPool(category: ContentItem['category']): ContentItem[] {
  if (category === 'mrm')      return MRM_CONTENT;
  if (category === 'crp')      return CRP_CONTENT;
  return WINDDOWN_CONTENT;
}

/**
 * getNextContent — retourne le contenu le moins récemment joué.
 * Jamais joué = priorité absolue.
 */
export async function getNextContent(
  category:  ContentItem['category'],
  isPremium: boolean,
): Promise<ContentItem> {
  const pool      = getPool(category).filter(c => isPremium || !c.premium);
  const historyKey = `@r90:contentHistory:${category}:v1`;
  const raw        = await AsyncStorage.getItem(historyKey).catch(() => null);
  const history: string[] = raw ? JSON.parse(raw) : [];

  const sorted = [...pool].sort((a, b) => {
    const ai = history.lastIndexOf(a.id);
    const bi = history.lastIndexOf(b.id);
    if (ai === -1) return -1; // jamais joué → priorité
    if (bi === -1) return 1;
    return ai - bi; // plus ancien = priorité
  });

  return sorted[0] ?? pool[0];
}

/**
 * markContentPlayed — enregistre le contenu comme joué.
 * Garde les 20 derniers dans l'historique.
 */
export async function markContentPlayed(
  category:  ContentItem['category'],
  contentId: string,
): Promise<void> {
  const historyKey = `@r90:contentHistory:${category}:v1`;
  const raw        = await AsyncStorage.getItem(historyKey).catch(() => null);
  const history: string[] = raw ? JSON.parse(raw) : [];
  const updated = [...history.filter(id => id !== contentId), contentId];
  await AsyncStorage.setItem(historyKey, JSON.stringify(updated.slice(-20)));
}
