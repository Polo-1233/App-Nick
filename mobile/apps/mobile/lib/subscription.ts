/**
 * Subscription — MVP type definitions and default state.
 *
 * Two plans only: free | premium.
 * No payment logic here — this module owns the shape and the default.
 * Replace DEFAULT_SUBSCRIPTION with a real storage/API call when billing lands.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanType = 'free' | 'premium';

export interface SubscriptionState {
  plan:         PlanType;
  /** Set when the user is in a premium trial period. */
  trialEndsAt?: Date;
  /** false only when a paid subscription has explicitly lapsed. */
  isActive:     boolean;
}

// ─── Default ──────────────────────────────────────────────────────────────────

/** MVP default — every user starts on free until billing is wired up. */
export const DEFAULT_SUBSCRIPTION: SubscriptionState = {
  plan:     'free',
  isActive: true,
};
