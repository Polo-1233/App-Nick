/**
 * rlo-message.ts — R-Lo contextual message generator
 *
 * Answers: "What should R-Lo say right now?"
 *
 * Priority:
 *   1. Reminder   — event approaching (MRM, CRP, wind-down)
 *   2. Advice     — missed something, gentle nudge
 *   3. Encouragement — on track, positive
 *   4. Insight    — occasional method explanation
 *
 * Rules:
 *   - 1 message at a time, max ~90 chars
 *   - Never repeats the Action Card content
 *   - Warm, short, never clinical
 */

import type { ActionState } from './action-state';

export type RLoCategory = 'reminder' | 'advice' | 'encouragement' | 'insight';

export interface RLoMessage {
  category: RLoCategory;
  message:  string;
  hasCta:   boolean;   // show "Chat →" button
}

// ─── Message pools ────────────────────────────────────────────────────────────

const ENCOURAGEMENT = [
  "You're on rhythm today.",
  "Good pace. Keep it steady.",
  "Consistent wake time — the whole system benefits.",
  "You're still aligned. Stay the course.",
  "Small steps, every day. That's the method.",
  "Your rhythm is holding. Well done.",
];

const REMINDER_MRM = [
  "A short reset is coming up soon.",
  "Your next micro reset is almost here.",
  "Almost time to pause and breathe.",
  "Take two minutes soon — your brain will thank you.",
  "A small pause is the next step.",
  "Your MRM window is opening soon.",
];

const REMINDER_CRP = [
  "Your recovery window opens soon.",
  "A good CRP is coming — protect that slot.",
  "Your CRP is approaching. Keep the time free.",
  "Recovery period soon. Even 10 minutes helps.",
  "Your body will appreciate the CRP coming up.",
  "Block your next hour — recovery is on its way.",
];

const REMINDER_WINDDOWN = [
  "Wind-down is coming. Start easing off screens.",
  "Not long before your sleep window. Prepare gently.",
  "Start winding down — your next cycle depends on it.",
  "Soft light, slower pace. Wind-down is near.",
  "Your sleep window is approaching. Begin your routine.",
  "Almost time to close the day.",
];

const ADVICE_MISSED = [
  "Missing one cycle is fine — the next one still works.",
  "You're still in range. The next window is valid.",
  "No stress — the method has built-in flexibility.",
  "One shifted cycle doesn't break the pattern.",
  "Adapt without guilt. That's exactly what R90 is for.",
  "Next cycle is just as good. Rest when it opens.",
];

const ADVICE_GENERAL = [
  "Keep tonight's sleep window protected.",
  "A short reset will help your focus.",
  "Your CRP will be a good recovery point today.",
  "The goal is rhythm across days, not perfection tonight.",
  "Even a partial reset moves you forward.",
  "Protect your wind-down — it shapes tomorrow.",
];

const INSIGHT = [
  "Your wake time anchors the whole system.",
  "A reset every cycle helps your nervous system recover.",
  "The goal is rhythm across days, not perfection tonight.",
  "90 minutes is your natural focus unit.",
  "Consistency beats perfection — every time.",
  "R90 works across a week, not just one night.",
];

// ─── Deterministic pick (avoids random flicker on re-render) ─────────────────

function pick(pool: string[], seed: number): string {
  return pool[seed % pool.length];
}

// ─── Main function ────────────────────────────────────────────────────────────

interface RLoInput {
  actionState:    ActionState;
  wakeMin:        number;
  hourOfDay:      number;   // 0–23
  dayOfWeek:      number;   // 0 = Sunday
  insightSeed?:   number;   // rotate insights over time (e.g. day of year)
}

export function getRLoMessage({
  actionState,
  wakeMin,
  hourOfDay,
  dayOfWeek,
  insightSeed = 0,
}: RLoInput): RLoMessage {

  // ── 1. Reminder — event is approaching ────────────────────────────────────

  if (actionState === 'pre_mrm') {
    return {
      category: 'reminder',
      message:  pick(REMINDER_MRM, hourOfDay),
      hasCta:   false,
    };
  }

  if (actionState === 'pre_crp') {
    return {
      category: 'reminder',
      message:  pick(REMINDER_CRP, hourOfDay),
      hasCta:   false,
    };
  }

  if (actionState === 'pre_winddown') {
    return {
      category: 'reminder',
      message:  pick(REMINDER_WINDDOWN, hourOfDay),
      hasCta:   false,
    };
  }

  // ── 2. Advice — active event or missed ────────────────────────────────────

  if (actionState === 'missed_sleep') {
    return {
      category: 'advice',
      message:  pick(ADVICE_MISSED, dayOfWeek),
      hasCta:   true,
    };
  }

  if (actionState === 'mrm_active') {
    return {
      category: 'reminder',
      message:  'Two minutes is all it takes. Clear your head.',
      hasCta:   false,
    };
  }

  if (actionState === 'crp_active') {
    return {
      category: 'reminder',
      message:  'Use this window well — it counts for your week.',
      hasCta:   false,
    };
  }

  if (actionState === 'winddown') {
    return {
      category: 'advice',
      message:  'Dim the lights. Slow the pace. You know what to do.',
      hasCta:   false,
    };
  }

  if (actionState === 'sleep_window') {
    return {
      category: 'encouragement',
      message:  'Your window is open. Rest well.',
      hasCta:   false,
    };
  }

  if (actionState === 'night') {
    return {
      category: 'encouragement',
      message:  `Wake at ${String(Math.floor(wakeMin / 60)).padStart(2, '0')}:${String(wakeMin % 60).padStart(2, '0')} to anchor your rhythm.`,
      hasCta:   false,
    };
  }

  if (actionState === 'morning') {
    return {
      category: 'encouragement',
      message:  "Good morning. Your rhythm starts now.",
      hasCta:   false,
    };
  }

  if (actionState === 'post_mrm') {
    return {
      category: 'encouragement',
      message:  "Reset done. Back to full focus.",
      hasCta:   false,
    };
  }

  // ── 3. Encouragement — on track ──────────────────────────────────────────

  // Show insight every 3rd day to keep it occasional
  const showInsight = dayOfWeek % 3 === 0;

  if (actionState === 'on_track') {
    if (showInsight) {
      return {
        category: 'insight',
        message:  pick(INSIGHT, insightSeed),
        hasCta:   true,
      };
    }
    return {
      category: 'encouragement',
      message:  pick(ENCOURAGEMENT, hourOfDay + dayOfWeek),
      hasCta:   false,
    };
  }

  // ── 4. Default fallback ───────────────────────────────────────────────────

  return {
    category: 'encouragement',
    message:  pick(ADVICE_GENERAL, insightSeed % ADVICE_GENERAL.length),
    hasCta:   true,
  };
}
