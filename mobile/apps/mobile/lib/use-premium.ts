/**
 * usePremium
 *
 * Hook for checking and recording premium feature usage.
 * Backed by AsyncStorage via the storage module.
 *
 * States: loading → success (usage loaded) | error (load failed, gates open)
 *
 * Usage:
 *   const { checkGate, recordUsage } = usePremium();
 *   // Before executing a gated action:
 *   if (checkGate('conflict')) { showPremiumModal(); return; }
 *   // After executing the action:
 *   await recordUsage('conflict');
 */

import { useState, useEffect, useCallback } from 'react';
import { loadUsage, incrementUsage } from './storage';
import { evaluatePremiumTrigger, type UsageRecord, type PremiumFeature } from '@r90/core';
import { hasPremiumEntitlement } from './purchases';

export function usePremium() {
  const [usage,      setUsage]      = useState<UsageRecord | null>(null);
  const [isPremium,  setIsPremium]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      loadUsage(),
      hasPremiumEntitlement(),
    ])
      .then(([u, premium]) => {
        setUsage(u);
        setIsPremium(premium);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load usage data.');
        setLoading(false);
        // On error: gates default to open (optimistic)
      });
  }, []);

  /**
   * Returns true if the gate should trigger (feature is exhausted).
   * Premium subscribers bypass all gates.
   * Returns false while loading or on error (optimistic: allow action).
   */
  const checkGate = useCallback(
    (feature: PremiumFeature): boolean => {
      if (isPremium) return false; // premium: no gates
      if (!usage) return false;    // loading/error: optimistic
      return evaluatePremiumTrigger(usage, feature).triggered;
    },
    [isPremium, usage]
  );

  /**
   * Increment the usage count for a feature and refresh local state.
   * Call AFTER executing the gated action (not before).
   */
  const recordUsage = useCallback(async (feature: PremiumFeature): Promise<void> => {
    const updated = await incrementUsage(feature);
    setUsage(updated);
  }, []);

  return { usage, isPremium, loading, error, checkGate, recordUsage };
}
