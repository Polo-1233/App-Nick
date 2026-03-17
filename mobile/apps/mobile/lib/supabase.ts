/**
 * supabase.ts — Supabase client for the R90 Navigator mobile app.
 *
 * Single source of truth for:
 *   - Auth (signup, login, session management, JWT retrieval)
 *   - No direct DB access from the app — all data goes through the nick_brain backend
 *
 * The app uses Supabase Auth only. All data reads/writes go via the nick_brain
 * HTTP backend (lib/api.ts), which uses the service role key server-side.
 *
 * Credentials: from .env (injected via expo-constants / app.config.js).
 * Fallback: hardcoded for dev builds — replace with environment variables before production.
 */

import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';

// Required for Expo to properly close the auth browser on iOS
WebBrowser.maybeCompleteAuthSession();

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://ullvnvtyjmaclkrruhds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHZudnR5am1hY2xrcnJ1aGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTc2MzUsImV4cCI6MjA4ODc3MzYzNX0.hThK9Dv858RWkb_59H3xhDkZJwD8kq6y4PyqwC4R-7M';

// ─── SecureStore adapter ──────────────────────────────────────────────────────

/**
 * Custom storage adapter backed by expo-secure-store.
 * Required because Supabase's default localStorage doesn't exist in React Native.
 */
const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Non-fatal — session will be lost on app restart in edge cases
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Non-fatal
    }
  },
};

// ─── Client ───────────────────────────────────────────────────────────────────

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:          SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false, // not needed in React Native
  },
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export interface AuthResult {
  ok:      boolean;
  user?:   User;
  session?: Session;
  error?:  string;
}

/**
 * Sign up a new user with email + password.
 * Returns the Supabase session on success.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { ok: false, error: error.message };
  }
  // Supabase may require email confirmation — session can be null until confirmed.
  // We treat a created user as success regardless of immediate session.
  return { ok: true, user: data.user ?? undefined, session: data.session ?? undefined };
}

/**
 * Sign in an existing user with email + password.
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return { ok: false, error: error?.message ?? 'Sign in failed' };
  }
  return { ok: true, user: data.user, session: data.session };
}

/**
 * Sign out the current user. Clears local session.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Get the current active session (restoring from SecureStore if needed).
 * Returns null if no session exists.
 */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Get the JWT access token for the current session.
 * Automatically refreshes if expired.
 * Returns null if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;

  // Check if token needs refresh (Supabase does this automatically,
  // but we force-refresh if within 60s of expiry)
  const expiresAt = data.session.expires_at ?? 0;
  const nowSec    = Math.floor(Date.now() / 1000);
  if (expiresAt - nowSec < 60) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) return null;
    return refreshed.session.access_token;
  }

  return data.session.access_token;
}

/**
 * Sign in with Google via OAuth (Supabase + expo-auth-session).
 *
 * Flow:
 *   1. Get OAuth URL from Supabase (PKCE)
 *   2. Open in system browser (WebBrowser.openAuthSessionAsync)
 *   3. Google redirects back to r90://auth/callback?code=xxx
 *   4. Exchange code for Supabase session
 *   5. Session is active → onAuthStateChange fires automatically
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  const redirectTo = makeRedirectUri({
    scheme: 'r90',
    path:   'auth/callback',
    // On Android, Expo needs the native scheme explicitly
    native: 'r90://auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return { ok: false, error: error?.message ?? 'Google Sign-In failed' };
  }

  // Open Google login in system browser
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, error: 'cancelled' };
  }
  if (result.type !== 'success') {
    return { ok: false, error: 'Google Sign-In was interrupted' };
  }

  // Extract code from callback URL (PKCE flow)
  const callbackUrl = result.url;
  const code = new URL(callbackUrl).searchParams.get('code');

  if (code) {
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    if (sessionError || !sessionData.session) {
      return { ok: false, error: sessionError?.message ?? 'Failed to complete Google Sign-In' };
    }
    return { ok: true, user: sessionData.session.user, session: sessionData.session };
  }

  // Fallback: try access_token in URL hash (implicit flow)
  const hash  = callbackUrl.split('#')[1] ?? '';
  const params = new URLSearchParams(hash);
  const accessToken  = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token:  accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError || !sessionData.session) {
      return { ok: false, error: sessionError?.message ?? 'Failed to set session' };
    }
    return { ok: true, user: sessionData.session.user, session: sessionData.session };
  }

  return { ok: false, error: 'No authentication data received from Google' };
}

/**
 * Sign in with Apple (iOS only).
 *
 * Flow:
 *   1. Native Apple authentication sheet (Face ID / Touch ID)
 *   2. Get identity token (JWT) from Apple
 *   3. Pass to Supabase signInWithIdToken → session
 *
 * Note: Apple Sign-In is only available on iOS 13+ physical devices.
 * The button should not be shown on Android or simulator (no Face ID).
 */
export async function signInWithApple(): Promise<AuthResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { ok: false, error: 'No identity token from Apple' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token:    credential.identityToken,
    });

    if (error || !data.session) {
      return { ok: false, error: error?.message ?? 'Apple Sign-In failed' };
    }

    return { ok: true, user: data.session.user, session: data.session };
  } catch (err: unknown) {
    // ERR_REQUEST_CANCELED = user dismissed the sheet
    if (
      typeof err === 'object' && err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      return { ok: false, error: 'cancelled' };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Apple Sign-In failed' };
  }
}

/**
 * Subscribe to auth state changes (login / logout / token refresh).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session)
  );
  return () => subscription.unsubscribe();
}
