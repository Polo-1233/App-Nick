/**
 * crashlytics.ts — Firebase Crashlytics error monitoring
 *
 * Gratuit, intégré à Firebase.
 * Call initCrashlytics() once at app startup (app/_layout.tsx).
 *
 * Usage:
 *   import { recordError, log } from '../lib/sentry';
 *   recordError(new Error('something went wrong'));
 *   log('User reached checkout');
 */

import crashlytics from '@react-native-firebase/crashlytics';

export function initCrashlytics() {
  // Enable crash reporting
  crashlytics().setCrashlyticsCollectionEnabled(true);
  console.log('[Crashlytics] Initialised');
}

/** Record a JS error (non-fatal) */
export function recordError(error: Error, context?: string) {
  if (context) crashlytics().log(context);
  crashlytics().recordError(error);
}

/** Log a breadcrumb message */
export function log(message: string) {
  crashlytics().log(message);
}

/** Set user identifier (call after login) */
export function setUser(userId: string, email?: string) {
  void crashlytics().setUserId(userId);
  if (email) void crashlytics().setAttribute('email', email);
}

/** Set custom key-value attribute */
export function setAttribute(key: string, value: string) {
  void crashlytics().setAttribute(key, value);
}

// Legacy compat — keep initSentry name so existing call in _layout still works
export const initSentry = initCrashlytics;
