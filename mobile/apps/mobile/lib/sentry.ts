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

/**
 * Crashlytics is only available in native builds (EAS).
 * In Expo Go / simulator, all calls are no-ops.
 */

function getCrashlytics() {
  try {
    // Dynamic require — avoids crash if native module not linked (Expo Go / simulator)
    return require('@react-native-firebase/crashlytics').default();
  } catch {
    return null;
  }
}

export function initCrashlytics() {
  const c = getCrashlytics();
  if (!c) {
    console.log('[Crashlytics] Native module not available — skipping (Expo Go / simulator)');
    return;
  }
  c.setCrashlyticsCollectionEnabled(true);
  console.log('[Crashlytics] Initialised');
}

export function recordError(error: Error, context?: string) {
  const c = getCrashlytics();
  if (!c) return;
  if (context) c.log(context);
  c.recordError(error);
}

export function log(message: string) {
  getCrashlytics()?.log(message);
}

export function setUser(userId: string, email?: string) {
  const c = getCrashlytics();
  if (!c) return;
  void c.setUserId(userId);
  if (email) void c.setAttribute('email', email);
}

export function setAttribute(key: string, value: string) {
  getCrashlytics()?.setAttribute(key, value);
}

export const initSentry = initCrashlytics;
