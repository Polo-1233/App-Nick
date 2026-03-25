/**
 * rlo-message.ts — R-Lo contextual message generator (v2)
 *
 * Answers: "What should R-Lo say right now?"
 *
 * V2 additions:
 *   - Behavioral awareness (streak, depth, wind-down history)
 *   - Social proof from Nick (contextual authority references)
 *   - Pseudo-pattern detection (basic rule-based insights)
 *
 * Priority:
 *   1. Behavioral — reacting to the user's real behavior (most impactful)
 *   2. Reminder   — event approaching (MRM, CRP, wind-down)
 *   3. Social proof — contextual Nick references
 *   4. Encouragement — on track, positive
 *   5. Insight    — occasional method explanation
 *
 * Rules:
 *   - 1 message at a time, max ~100 chars
 *   - Never repeats the Action Card content
 *   - Warm, short, never clinical
 *   - Behavioral messages take priority when available
 */

import type { ActionState } from './action-state';
import { getLevelIdentityMessage } from './rlo-mood';

export type RLoCategory = 'reminder' | 'advice' | 'encouragement' | 'insight' | 'behavioral' | 'social_proof';

export interface RLoMessage {
  category: RLoCategory;
  message:  string;
  hasCta:   boolean;
}

// ─── Behavioral context (passed from HomeScreen) ──────────────────────────────

export interface BehaviorContext {
  streak:              number;
  bestStreak:          number;
  weekAligned:         number;   // 0–7
  depthLevel:          string;   // "Aware", "Attuned", etc.
  totalDaysActive:     number;
  winddownsThisWeek:  number;  // 0–7
  crpsThisWeek:       number;  // 0–7
  missedMornings:     number;  // consecutive missed morning confirmations
  eveningMood?:       string;  // last evening mood (calm, stressed, etc.)
}

// ─── Message pools ────────────────────────────────────────────────────────────

// Generic pools (kept from v1)
const ENCOURAGEMENT = [
  "You're on rhythm today.",
  "Good pace. Keep it steady.",
  "Consistent wake time — the whole system benefits.",
  "Small steps, every day. That's the method.",
  "Your rhythm is holding. Well done.",
];

const REMINDER_MRM = [
  "A short reset is coming up soon.",
  "Your next micro reset is almost here.",
  "Take two minutes soon — your brain will thank you.",
  "A small pause is the next step.",
];

const REMINDER_CRP = [
  "Your recovery window opens soon.",
  "A good CRP is coming — protect that slot.",
  "Recovery period soon. Even 10 minutes helps.",
  "Block your next hour — recovery is on its way.",
];

const REMINDER_WINDDOWN = [
  "Wind-down is coming. Start easing off screens.",
  "Soft light, slower pace. Wind-down is near.",
  "Your sleep window is approaching. Begin your routine.",
  "Almost time to close the day.",
];

const ADVICE_MISSED = [
  "Missing one cycle is fine — the next one still works.",
  "No stress — the method has built-in flexibility.",
  "Adapt without guilt. That's exactly what R90 is for.",
];

const INSIGHT = [
  "Your wake time anchors the whole system.",
  "90 minutes is your natural focus unit.",
  "Consistency beats perfection — every time.",
  "R90 works across a week, not just one night.",
];

// ─── NEW: Behavioral messages (react to real user data) ──────────────────────

function getBehavioralMessage(b: BehaviorContext, seed: number): RLoMessage | null {
  // Priority order: most impactful behavioral signals first

  // Missed mornings — gentle, no pressure
  if (b.missedMornings >= 2) {
    return {
      category: 'behavioral',
      message:  "No pressure. Even elite athletes have rest days. Your rhythm picks up tomorrow.",
      hasCta:   false,
    };
  }

  // Streak milestones
  if (b.streak === 7) {
    return {
      category: 'behavioral',
      message:  "7 days. You're now using the same protocols as Premier League players.",
      hasCta:   false,
    };
  }
  if (b.streak === 14) {
    return {
      category: 'behavioral',
      message:  "14 days of rhythm. Your body is starting to anticipate the cycles.",
      hasCta:   false,
    };
  }
  if (b.streak === 30) {
    return {
      category: 'behavioral',
      message:  "30 days. The rhythm is becoming part of who you are.",
      hasCta:   false,
    };
  }

  // Level identity reinforcement — every 5th day for non-Aware users
  if (b.depthLevel !== 'Aware' && b.totalDaysActive > 0 && b.totalDaysActive % 5 === 0) {
    return {
      category: 'behavioral',
      message:  getLevelIdentityMessage(b.depthLevel),
      hasCta:   false,
    };
  }

  // Wind-down consistency
  if (b.winddownsThisWeek >= 5) {
    return {
      category: 'behavioral',
      message:  "Your evening ritual is becoming automatic. That's exactly how it works.",
      hasCta:   false,
    };
  }

  // CRP consistency
  if (b.crpsThisWeek >= 3) {
    return {
      category: 'behavioral',
      message:  "3+ CRPs this week. Your recovery is building real momentum.",
      hasCta:   false,
    };
  }

  // Week alignment
  if (b.weekAligned >= 5) {
    return {
      category: 'behavioral',
      message:  `${b.weekAligned}/7 days aligned. Strong week — your rhythm is solid.`,
      hasCta:   false,
    };
  }

  // Evening mood reaction (if stressed yesterday, supportive morning)
  if (b.eveningMood === 'stressed') {
    return {
      category: 'behavioral',
      message:  "Yesterday was tense. Today's rhythm will help your body reset.",
      hasCta:   false,
    };
  }
  if (b.eveningMood === 'calm') {
    return {
      category: 'behavioral',
      message:  "You went to bed calm last night. That's the R90 effect.",
      hasCta:   false,
    };
  }

  // High total activity — long-term recognition
  if (b.totalDaysActive >= 30 && seed % 5 === 0) {
    return {
      category: 'behavioral',
      message:  `${b.totalDaysActive} days with R-Lo. Your rhythm runs deeper than most.`,
      hasCta:   false,
    };
  }

  return null; // no behavioral message — fall through to standard
}

// ─── NEW: Social proof messages (Nick authority, contextual) ─────────────────

function getSocialProofMessage(actionState: ActionState, seed: number): RLoMessage | null {
  // Only show social proof occasionally (every 4th seed)
  if (seed % 4 !== 0) return null;

  const SOCIAL_PROOF: Record<string, string[]> = {
    morning: [
      "Nick says: the moment you confirm your wake time, you take control of your day.",
      "The same anchor time — that's how elite athletes protect their rhythm.",
    ],
    crp_active: [
      "Team Sky cyclists did this exact CRP between training sessions.",
      "This recovery window is what separates amateurs from professionals.",
    ],
    post_mrm: [
      "Nick built micro-resets into every match day at Manchester United.",
      "Premier League physios use these exact 2-minute resets.",
    ],
    winddown: [
      "Nick's wind-down protocol: screens off, lights dim, temperature down.",
      "The same routine Nick designed for Ronaldo's pre-match nights.",
    ],
    on_track: [
      "Nick says: rhythm is not about one perfect night. It's about the pattern.",
      "The R90 method was built on one principle — consistency over perfection.",
    ],
  };

  const pool = SOCIAL_PROOF[actionState];
  if (!pool) return null;

  return {
    category: 'social_proof',
    message:  pool[seed % pool.length],
    hasCta:   true,
  };
}

// ─── Deterministic pick ─────────────────────────────────────────────────────

function pick(pool: string[], seed: number): string {
  return pool[seed % pool.length];
}

// ─── Main function ────────────────────────────────────────────────────────────

interface RLoInput {
  actionState:    ActionState;
  wakeMin:        number;
  hourOfDay:      number;
  dayOfWeek:      number;
  insightSeed?:   number;
  behavior?:      BehaviorContext;   // NEW: behavioral data
}

export function getRLoMessage({
  actionState,
  wakeMin,
  hourOfDay,
  dayOfWeek,
  insightSeed = 0,
  behavior,
}: RLoInput): RLoMessage {

  // ── 0. Behavioral — reacts to REAL user data (highest priority) ─────────
  if (behavior) {
    const behavMsg = getBehavioralMessage(behavior, insightSeed);
    if (behavMsg) return behavMsg;
  }

  // ── 1. Reminder — event approaching ─────────────────────────────────────

  if (actionState === 'pre_mrm') {
    return { category: 'reminder', message: pick(REMINDER_MRM, hourOfDay), hasCta: false };
  }
  if (actionState === 'pre_crp') {
    return { category: 'reminder', message: pick(REMINDER_CRP, hourOfDay), hasCta: false };
  }
  if (actionState === 'pre_winddown') {
    return { category: 'reminder', message: pick(REMINDER_WINDDOWN, hourOfDay), hasCta: false };
  }

  // ── 2. Active events ────────────────────────────────────────────────────

  if (actionState === 'missed_sleep') {
    return { category: 'advice', message: pick(ADVICE_MISSED, dayOfWeek), hasCta: true };
  }
  if (actionState === 'mrm_active') {
    return { category: 'reminder', message: 'Two minutes is all it takes. Clear your head.', hasCta: false };
  }
  if (actionState === 'crp_active') {
    // Social proof opportunity
    const sp = getSocialProofMessage('crp_active', insightSeed);
    if (sp) return sp;
    return { category: 'reminder', message: 'Use this window well — it counts for your week.', hasCta: false };
  }
  if (actionState === 'winddown') {
    return { category: 'advice', message: 'Dim the lights. Slow the pace. You know what to do.', hasCta: false };
  }
  if (actionState === 'sleep_window') {
    return { category: 'encouragement', message: 'Your window is open. Rest well.', hasCta: false };
  }
  if (actionState === 'night') {
    const t = `${String(Math.floor(wakeMin / 60)).padStart(2, '0')}:${String(wakeMin % 60).padStart(2, '0')}`;
    return { category: 'encouragement', message: `Wake at ${t} to anchor your rhythm.`, hasCta: false };
  }
  if (actionState === 'morning') {
    // Social proof on mornings
    const sp = getSocialProofMessage('morning', insightSeed);
    if (sp) return sp;
    return { category: 'encouragement', message: 'Good morning. Your rhythm starts now.', hasCta: false };
  }
  if (actionState === 'post_mrm') {
    const sp = getSocialProofMessage('post_mrm', insightSeed);
    if (sp) return sp;
    return { category: 'encouragement', message: 'Reset done. Back to full focus.', hasCta: false };
  }

  // ── 3. On track — social proof or encouragement ─────────────────────────

  if (actionState === 'on_track') {
    // Afternoon anticipation — tease tonight's wind-down episode
    if (hourOfDay >= 14 && hourOfDay <= 19 && insightSeed % 3 === 0) {
      const EPISODE_TEASERS = [
        "Tonight's episode is waiting for you. A calm end to the day.",
        "A new wind-down episode tonight. Something to look forward to.",
        "Your evening ritual is ready. Tonight's episode will be worth it.",
      ];
      return {
        category: 'encouragement',
        message:  EPISODE_TEASERS[insightSeed % EPISODE_TEASERS.length],
        hasCta:   false,
      };
    }

    // Try social proof
    const sp = getSocialProofMessage('on_track', insightSeed);
    if (sp) return sp;

    // Insight every 3rd day
    if (dayOfWeek % 3 === 0) {
      return { category: 'insight', message: pick(INSIGHT, insightSeed), hasCta: true };
    }
    return { category: 'encouragement', message: pick(ENCOURAGEMENT, hourOfDay + dayOfWeek), hasCta: false };
  }

  // ── 4. Default fallback ────────────────────────────────────────────────

  return {
    category: 'encouragement',
    message:  pick(ENCOURAGEMENT, insightSeed),
    hasCta:   true,
  };
}
