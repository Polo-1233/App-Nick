/**
 * analytics.ts — PostHog event tracking
 *
 * Usage:
 *   import { track } from '../lib/analytics';
 *   track('onboarding_step_completed', { step: 'wake' });
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PostHog = require('posthog-react-native').default as new (key: string, opts: object) => {
  identify(id: string, props?: object): void;
  capture(event: string, props?: object): void;
  reset(): void;
};

// PostHog project API key — replace with real key from posthog.com
const POSTHOG_API_KEY = process.env['EXPO_PUBLIC_POSTHOG_KEY'] ?? 'phc_placeholder';
const POSTHOG_HOST    = 'https://app.posthog.com';

type PostHogInstance = InstanceType<typeof PostHog>;
let _client: PostHogInstance | null = null;

export function initAnalytics(): void {
  if (_client) return;
  _client = new PostHog(POSTHOG_API_KEY, {
    host:              POSTHOG_HOST,
    sendFeatureFlagEvent: false,
    preloadFeatureFlags:  false,
  });
}

export function identifyUser(userId: string, props?: Record<string, unknown>): void {
  _client?.identify(userId, props);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function track(event: string, properties?: Record<string, any>): void {
  _client?.capture(event, properties);
}

export function resetAnalytics(): void {
  _client?.reset();
}

// ─── Typed event helpers ──────────────────────────────────────────────────────

export const Analytics = {
  // Onboarding
  onboardingStarted:        ()                                 => track('onboarding_started'),
  onboardingStepCompleted:  (step: string, data?: object)     => track('onboarding_step_completed', { step, ...data }),
  onboardingCompleted:      ()                                 => track('onboarding_completed'),

  // Paywall
  paywallViewed:            (source?: string)                  => track('paywall_viewed', { source }),
  purchaseStarted:          (plan: string)                     => track('purchase_started', { plan }),
  purchaseCompleted:        (plan: string)                     => track('purchase_completed', { plan }),
  purchaseCancelled:        ()                                 => track('purchase_cancelled'),

  // Navigation
  screenViewed:             (screen: string)                   => track('screen_viewed', { screen }),

  // Chat
  chatMessageSent:          ()                                 => track('chat_message_sent'),
  chatMessageReceived:      ()                                 => track('chat_message_received'),

  // Wearables
  wearableConnected:        (type: string)                     => track('wearable_connected', { type }),
  healthkitConnected:       ()                                 => track('wearable_connected', { type: 'apple_health' }),
  ouraConnected:            ()                                 => track('wearable_connected', { type: 'oura' }),

  // Permissions
  permissionGranted:        (type: string)                     => track('permission_granted', { type }),
  permissionDenied:         (type: string)                     => track('permission_denied', { type }),

  // Features
  windDownStarted:          ()                                 => track('wind_down_started'),
  planViewed:               ()                                 => track('plan_viewed'),
  insightsViewed:           ()                                 => track('insights_viewed'),
};
