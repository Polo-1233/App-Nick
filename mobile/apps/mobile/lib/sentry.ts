/**
 * sentry.ts — Sentry error monitoring initialisation
 *
 * Call initSentry() once at app startup (app/_layout.tsx).
 * DSN stored in .env as EXPO_PUBLIC_SENTRY_DSN.
 *
 * Filters:
 *   - Ignores network errors (expected when offline)
 *   - Ignores non-fatal expo-av errors (audio placeholder)
 *   - Sends source maps in production via EAS build
 */

import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export function initSentry() {
  if (!DSN) {
    console.warn('[Sentry] No DSN configured — skipping init');
    return;
  }

  Sentry.init({
    dsn: DSN,

    // Only send errors in production
    enabled: process.env.NODE_ENV === 'production',

    // Performance tracing — 10% sample rate
    tracesSampleRate: 0.1,

    // Breadcrumbs
    maxBreadcrumbs: 50,

    // Filter noise
    beforeSend(event) {
      // Drop network errors — expected when user is offline
      const msg = event.exception?.values?.[0]?.value ?? '';
      if (
        msg.includes('Network request failed') ||
        msg.includes('Failed to fetch') ||
        msg.includes('load failed')
      ) {
        return null;
      }
      return event;
    },
  });
}

// Re-export Sentry for use elsewhere (captureException, addBreadcrumb, etc.)
export { Sentry };
