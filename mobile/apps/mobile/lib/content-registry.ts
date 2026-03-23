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

export interface ContentItem {
  id:          string;
  title:       string;
  description: string;
  duration:    number;    // secondes
  category:    'mrm' | 'crp' | 'winddown';
  source:      number;    // require(...)
  premium:     boolean;
}

// ─── MRM Content ──────────────────────────────────────────────────────────────
// TODO: Replace placeholder files with real audio when produced

export const MRM_CONTENT: ContentItem[] = [
  {
    id:          'mrm-breathing-box',
    title:       'Respiration carrée',
    description: 'Inspire, retiens, expire, retiens. 2 minutes.',
    duration:    120,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/breathing-box-2min.mp3'),
    premium:     false,
  },
  {
    id:          'mrm-breathing-478',
    title:       'Respiration 4-7-8',
    description: 'Technique de relaxation rapide. 2 minutes.',
    duration:    120,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/breathing-478-2min.mp3'),
    premium:     true,
  },
  {
    id:          'mrm-breathing-calm',
    title:       'Respiration lente',
    description: 'Retour au calme progressif. 3 minutes.',
    duration:    180,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/breathing-calm-3min.mp3'),
    premium:     true,
  },
  {
    id:          'mrm-stretch-neck',
    title:       'Étirement cou & épaules',
    description: 'Relâche les tensions du haut du corps. 2 minutes.',
    duration:    120,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/stretch-neck-2min.mp3'),
    premium:     true,
  },
  {
    id:          'mrm-eyes-rest',
    title:       'Repos visuel',
    description: 'Repos des yeux et détente mentale. 2 minutes.',
    duration:    120,
    category:    'mrm',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/mrm/eyes-rest-2min.mp3'),
    premium:     true,
  },
];

// ─── CRP Content ──────────────────────────────────────────────────────────────

export const CRP_CONTENT: ContentItem[] = [
  {
    id:          'crp-meditation-body',
    title:       'Body scan guidé',
    description: 'Exploration corporelle complète. 20 minutes.',
    duration:    1200,
    category:    'crp',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/crp/meditation-body-20min.mp3'),
    premium:     false,
  },
  {
    id:          'crp-meditation-breath',
    title:       'Méditation respiration',
    description: 'Ancrage par la respiration. 20 minutes.',
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
    title:       'Relaxation progressive',
    description: 'Relâchement musculaire guidé. 15 minutes.',
    duration:    900,
    category:    'crp',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/crp/relaxation-progressive-15min.mp3'),
    premium:     true,
  },
  {
    id:          'crp-meditation-nature',
    title:       'Méditation nature',
    description: 'Sons naturels + guidage vocal. 20 minutes.',
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
    title:       'Forêt nocturne',
    description: 'Une promenade dans une forêt calme. 12 minutes.',
    duration:    720,
    category:    'winddown',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/sleep-story-forest-12min.mp3'),
    premium:     false,
  },
  {
    id:          'wd-story-ocean',
    title:       'Bord de mer',
    description: 'Les vagues et le sable. 15 minutes.',
    duration:    900,
    category:    'winddown',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/sleep-story-ocean-15min.mp3'),
    premium:     true,
  },
  {
    id:          'wd-story-train',
    title:       'Voyage en train',
    description: 'Le rythme apaisant du train. 12 minutes.',
    duration:    720,
    category:    'winddown',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/sleep-story-train-12min.mp3'),
    premium:     true,
  },
  {
    id:          'wd-breathing-presleep',
    title:       'Respiration pré-sommeil',
    description: 'Préparation physiologique au sommeil. 10 minutes.',
    duration:    600,
    category:    'winddown',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/breathing-presleep-10min.mp3'),
    premium:     false,
  },
  {
    id:          'wd-breathing-progressive',
    title:       'Relaxation progressive',
    description: 'Du corps vers le sommeil. 8 minutes.',
    duration:    480,
    category:    'winddown',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/breathing-progressive-8min.mp3'),
    premium:     true,
  },
  {
    id:          'wd-soundscape-rain',
    title:       'Pluie douce',
    description: 'Ambiance sonore relaxante. 30 minutes.',
    duration:    1800,
    category:    'winddown',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source:      require('../assets/audio/winddown/soundscape-rain-30min.mp3'),
    premium:     false,
  },
  {
    id:          'wd-soundscape-night',
    title:       'Nuit calme',
    description: 'Sons de la nuit. 30 minutes.',
    duration:    1800,
    category:    'winddown',
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
