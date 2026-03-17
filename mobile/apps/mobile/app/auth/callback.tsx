/**
 * auth/callback.tsx — Deep link handler for OAuth redirects (Google, Apple)
 *
 * When the OAuth browser redirects to r90://auth/callback?code=xxx,
 * Expo Router renders this screen. expo-auth-session's maybeCompleteAuthSession()
 * (called in supabase.ts + google-calendar.ts) picks up the URL and finishes
 * the auth flow automatically.
 *
 * This screen is intentionally blank — it's only visible for a split second
 * before the auth session completes and the user is redirected.
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Complete any pending auth session (picks up the OAuth code from the URL)
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  useEffect(() => {
    // This screen should never stay visible — the auth session completion
    // in supabase.ts / google-calendar.ts will navigate away automatically.
    // If somehow we're stuck here, nothing to do.
  }, []);

  // Blank screen — same background as app
  return <View style={s.root} />;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
});
