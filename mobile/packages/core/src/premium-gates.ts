/**
 * Premium Gates — event-triggered premium architecture.
 *
 * V1: client-side only. No server validation.
 * Each premium feature has N free uses before the gate triggers.
 *
 * Hard constraint: pure TypeScript, no UI, no AsyncStorage.
 * All state lives in UsageRecord; the app layer owns persistence.
 */

export interface UsageRecord {
  firstOpenDate: string;  // ISO date string (YYYY-MM-DD)
  conflictCount: number;  // times user resolved a conflict
  recalcCount: number;    // times user recalculated the plan
  postEventCount: number; // times user used post-event protocol
}

export type PremiumFeature = 'conflict' | 'recalc' | 'post_event';

export interface PremiumTriggerResult {
  triggered: boolean;
  reason?: 'conflict_limit' | 'recalc_limit';
}

/** Number of free uses before each gate triggers. Infinity = never gated in V1. */
const FREE_USES: Record<PremiumFeature, number> = {
  conflict:   1,
  recalc:     1,
  post_event: Infinity,
};

/**
 * Evaluate whether the premium gate should trigger for a feature.
 * Call BEFORE executing the gated action.
 * If triggered=true, show the premium modal — do NOT execute the action.
 */
export function evaluatePremiumTrigger(
  usage: UsageRecord,
  feature: PremiumFeature
): PremiumTriggerResult {
  switch (feature) {
    case 'conflict':
      return usage.conflictCount >= FREE_USES.conflict
        ? { triggered: true, reason: 'conflict_limit' }
        : { triggered: false };

    case 'recalc':
      return usage.recalcCount >= FREE_USES.recalc
        ? { triggered: true, reason: 'recalc_limit' }
        : { triggered: false };

    case 'post_event':
      return { triggered: false };

    default: {
      const _exhaustive: never = feature;
      return { triggered: false };
    }
  }
}

/** Create a default (zero-use) UsageRecord for first-time users. */
export function defaultUsage(): UsageRecord {
  return {
    firstOpenDate: new Date().toISOString().slice(0, 10),
    conflictCount: 0,
    recalcCount: 0,
    postEventCount: 0,
  };
}
