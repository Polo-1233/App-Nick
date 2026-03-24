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
  { id: 'ci-01', triggerDay: 2,  category: 'science', message: "Did you know why wake time is more important than bedtime? Your body syncs with morning light." },
  { id: 'ci-02', triggerDay: 4,  category: 'method',  message: "90-minute cycles also exist during the day. That's why MRMs matter — they respect your natural rhythm." },
  { id: 'ci-03', triggerDay: 6,  category: 'method',  message: "The CRP is not a nap. It's a mental recovery moment. Even without sleeping, your brain rests." },
  { id: 'ci-04', triggerDay: 8,  category: 'method',  message: "If you miss your sleep window, the next cycle is in 90 minutes. That's the flexibility of the R90 method." },
  { id: 'ci-05', triggerDay: 10, category: 'science', message: "The ideal sleep temperature is between 16° and 18°C. Your body needs to cool down to fall asleep." },
  { id: 'ci-06', triggerDay: 12, category: 'science', message: "Blue light from screens delays melatonin production by 30 to 90 minutes. That's why the wind-down matters." },
  { id: 'ci-07', triggerDay: 14, category: 'method',  message: "The R90 method counts cycles, not hours. 5 full cycles beat 8 fragmented hours." },
  { id: 'ci-08', triggerDay: 16, category: 'method',  message: "What matters is not each night, but the balance over 7 days. A bad night is never a failure." },
  { id: 'ci-09', triggerDay: 18, category: 'science', message: "Caffeine has a half-life of 5 to 6 hours. A coffee at 2 PM is still 50% in your blood at 8 PM." },
  { id: 'ci-10', triggerDay: 20, category: 'method',  message: "Nick Littlehales developed the R90 method working with the world's top athletes. You're using the same principles." },
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
    .filter(ci => !shown.includes(ci.id))  // show all unseen insights regardless of day
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
