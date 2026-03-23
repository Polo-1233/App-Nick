/**
 * coach-insights.ts — Micro-éducation R90 via R-Lo
 *
 * 10 insights progressifs basés sur les jours depuis l'inscription.
 * Chaque insight apparaît max 1 fois, dans l'ordre chronologique.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CoachInsight {
  id:         string;
  message:    string;
  triggerDay: number;  // jour minimum depuis inscription
  category:  'method' | 'science' | 'tip';
}

export const COACH_INSIGHTS: CoachInsight[] = [
  { id: 'ci-01', triggerDay: 2,  category: 'science', message: "Sais-tu pourquoi l'heure de réveil est plus importante que l'heure de coucher ? Ton corps se synchronise avec la lumière du matin." },
  { id: 'ci-02', triggerDay: 4,  category: 'method',  message: "Les cycles de 90 minutes existent aussi le jour. C'est pour ça que les MRM sont importants — ils respectent ton rythme naturel." },
  { id: 'ci-03', triggerDay: 6,  category: 'method',  message: "Le CRP n'est pas une sieste. C'est un moment de récupération mentale. Même sans dormir, ton cerveau se repose." },
  { id: 'ci-04', triggerDay: 8,  category: 'method',  message: "Si tu rates ta fenêtre de sommeil, le prochain cycle est dans 90 minutes. C'est la flexibilité de la méthode R90." },
  { id: 'ci-05', triggerDay: 10, category: 'science', message: "La température idéale pour dormir est entre 16° et 18°C. Ton corps doit baisser sa température pour s'endormir." },
  { id: 'ci-06', triggerDay: 12, category: 'science', message: "La lumière bleue des écrans retarde la production de mélatonine de 30 à 90 minutes. D'où l'importance du wind-down." },
  { id: 'ci-07', triggerDay: 14, category: 'method',  message: "La méthode R90 ne compte pas en heures mais en cycles. 5 cycles valent mieux que 8 heures fragmentées." },
  { id: 'ci-08', triggerDay: 16, category: 'method',  message: "L'important n'est pas chaque nuit, mais l'équilibre sur 7 jours. Une mauvaise nuit n'est jamais un échec." },
  { id: 'ci-09', triggerDay: 18, category: 'science', message: "La caféine a une demi-vie de 5 à 6 heures. Un café à 14h est encore à 50% dans ton sang à 20h." },
  { id: 'ci-10', triggerDay: 20, category: 'method',  message: "Nick Littlehales a développé la méthode R90 en travaillant avec les plus grands sportifs du monde. Tu utilises les mêmes principes." },
];

const SIGNUP_KEY = '@r90:signupDate:v1';
const SHOWN_KEY  = '@r90:shownInsights:v1';

/** Enregistre la date d'inscription si pas déjà fait. */
export async function ensureSignupDate(): Promise<void> {
  const existing = await AsyncStorage.getItem(SIGNUP_KEY).catch(() => null);
  if (!existing) {
    await AsyncStorage.setItem(SIGNUP_KEY, new Date().toISOString().slice(0, 10));
  }
}

/** Retourne l'insight à afficher aujourd'hui (null si aucun). */
export async function getTodayInsight(): Promise<CoachInsight | null> {
  const signupDate = await AsyncStorage.getItem(SIGNUP_KEY).catch(() => null);
  if (!signupDate) return null;

  const msPerDay = 24 * 3_600_000;
  const daysSince = Math.floor((Date.now() - new Date(signupDate).getTime()) / msPerDay);

  const rawShown = await AsyncStorage.getItem(SHOWN_KEY).catch(() => null);
  const shown: string[] = rawShown ? JSON.parse(rawShown) : [];

  const eligible = COACH_INSIGHTS
    .filter(ci => ci.triggerDay <= daysSince && !shown.includes(ci.id))
    .sort((a, b) => a.triggerDay - b.triggerDay);

  return eligible[0] ?? null;
}

/** Marque un insight comme vu. */
export async function markInsightSeen(id: string): Promise<void> {
  const rawShown = await AsyncStorage.getItem(SHOWN_KEY).catch(() => null);
  const shown: string[] = rawShown ? JSON.parse(rawShown) : [];
  if (!shown.includes(id)) {
    await AsyncStorage.setItem(SHOWN_KEY, JSON.stringify([...shown, id]));
  }
}
