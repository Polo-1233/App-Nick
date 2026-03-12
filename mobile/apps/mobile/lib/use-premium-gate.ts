/**
 * use-premium-gate.ts — Unified premium entitlement check.
 *
 * Single source of truth for premium status.
 * Checks RevenueCat entitlement; falls back to false on any error.
 *
 * Features gated behind premium:
 *   - Advanced analytics / insights
 *   - LLM coaching (future)
 *   - Full chat history
 *   - Calendar conflict resolution
 *
 * Features always free:
 *   - Onboarding
 *   - Home screen (basic)
 *   - Sleep log
 *   - Day plan (basic)
 *   - Check-in
 *   - ARP setup
 */

import { useState, useEffect, useCallback } from 'react';
import { hasPremiumEntitlement } from './purchases';

export interface UsePremiumGateResult {
  isPremium:  boolean;
  isLoading:  boolean;
  refresh:    () => Promise<void>;
}

export function usePremiumGate(): UsePremiumGateResult {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    const active = await hasPremiumEntitlement();
    setIsPremium(active);
    setIsLoading(false);
  }, []);

  useEffect(() => { void check(); }, [check]);

  const refresh = useCallback(async () => { await check(); }, [check]);

  return { isPremium, isLoading, refresh };
}

// ─── Feature gate map ─────────────────────────────────────────────────────────

export type PremiumFeature =
  | 'insights'          // readiness analytics, weekly trends
  | 'conflict'          // conflict resolution options
  | 'chat_history'      // full conversation history
  | 'llm_coaching'      // AI coaching (future)
  | 'calendar_advanced' // multi-source calendar
  | 'export';           // data export

/** Features that are always free (never gated). */
const FREE_FEATURES = new Set<PremiumFeature>([]);

/**
 * Check if a feature is accessible given the current premium status.
 */
export function canAccess(feature: PremiumFeature, isPremium: boolean): boolean {
  if (FREE_FEATURES.has(feature)) return true;
  return isPremium;
}
