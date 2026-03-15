import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Keyboard, Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import { hasCompletedIntro } from '../lib/storage';
import { ThemeProvider, useTheme } from '../lib/theme-context';
import { configurePurchases } from '../lib/purchases';
import { AppSplash } from '../components/AppSplash';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { syncCalendarToBackend } from '../lib/calendar-sync';
import { initProactiveNotifications } from '../lib/proactive-notifications';

// ─── Keep native splash alive until AppSplash takes over ─────────────────────
SplashScreen.preventAutoHideAsync().catch(() => {});

// ─── Error Boundary ───────────────────────────────────────────────────────────

interface EBState { hasError: boolean }

class RootErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('[RootErrorBoundary]', error); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>Something went wrong</Text>
          <Text style={eb.body}>Please restart the app to continue.</Text>
          <Pressable style={eb.btn} onPress={() => this.setState({ hasError: false })}>
            <Text style={eb.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', padding: 32 },
  title:     { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  body:      { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  btn:       { backgroundColor: '#22C55E', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText:   { color: '#000000', fontWeight: '600', fontSize: 15 },
});

// ─── Android nav-bar hook ──────────────────────────────────────────────────────
// Controls Android system navigation bar visibility and style.
// immersiveMode ON  → bar is hidden; swipes from the edge reveal it briefly.
// immersiveMode OFF → bar is visible and styled to match the current theme.
// Re-applies automatically when the app returns to the foreground (Android clears
// the immersive flag when the app is backgrounded).
// Temporarily shows the bar when the keyboard is open so the user can dismiss it.

function useAndroidNavBar(immersiveMode: boolean, bg: string, isDark: boolean) {
  const applyNavBar = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    if (immersiveMode) {
      await NavigationBar.setVisibilityAsync('hidden');
      try {
        // Android 15+ (API 35) enforces edge-to-edge and rejects setBehaviorAsync;
        // wrap in try/catch so the visibility call still takes effect.
        await NavigationBar.setBehaviorAsync('inset-swipe');
      } catch { /* edge-to-edge mode active — behavior override not allowed */ }
    } else {
      await NavigationBar.setVisibilityAsync('visible');
      await NavigationBar.setBackgroundColorAsync(bg);
      await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
    }
  }, [immersiveMode, bg, isDark]);

  // Apply on mount and whenever immersive/theme settings change
  useEffect(() => {
    void applyNavBar();
  }, [applyNavBar]);

  // Re-apply when app returns to foreground (Android resets immersive on minimize)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void applyNavBar();
    });
    return () => sub.remove();
  }, [applyNavBar]);

  // Show nav bar while keyboard is visible so users can dismiss it, then restore
  useEffect(() => {
    if (Platform.OS !== 'android' || !immersiveMode) return;
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      void NavigationBar.setVisibilityAsync('visible');
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      void NavigationBar.setVisibilityAsync('hidden');
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [immersiveMode]);
}

// ─── Root layout ──────────────────────────────────────────────────────────────

function RootLayoutInner() {
  const router = useRouter();
  const { theme, immersiveMode } = useTheme();

  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [dataReady,  setDataReady]  = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [hasIntro,  setHasIntro]  = useState(false);
  const hasRedirected = useRef(false);

  // Hook must be called before any early returns (React rules)
  useAndroidNavBar(immersiveMode, theme.colors.background, theme.dark);

  useEffect(() => {
    hasCompletedIntro().then(completed => {
      setHasIntro(completed);
      setDataReady(true);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!dataReady || !splashDone || authLoading || hasRedirected.current) return;
    hasRedirected.current = true;
    if (!hasIntro) {
      // Not done onboarding yet — send to onboarding regardless of auth state.
      // Login is collected INSIDE the onboarding flow (step 11.5 in OnboardingPlanOverlay),
      // just before the calendar access request.
      router.replace('/onboarding');
    } else if (!isAuthenticated) {
      // Completed onboarding but not logged in (e.g. after sign-out).
      router.replace('/login');
    }
  }, [dataReady, splashDone, authLoading, isAuthenticated, hasIntro, router]);

  // Sync calendar events and init proactive notifications after auth
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    void syncCalendarToBackend();
    initProactiveNotifications();
  }, [isAuthenticated, authLoading]);

  // Deep-link into the app when the user taps a local notification.
  // Currently used by wind-down reminders (data.route = '/wind-down').
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const route = typeof data?.route === 'string' ? data.route : null;
      if (route) router.push(route as `/${string}`);
    });
    return () => sub.remove();
  }, [router]);

  // During splash: always light status bar (splash background is always dark).
  if (!dataReady || !splashDone) {
    return (
      <>
        <StatusBar style="light" />
        <AppSplash />
      </>
    );
  }

  return (
    <>
      <StatusBar style={theme.colors.statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown:  false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)"        options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"   options={{ headerShown: false }} />
        <Stack.Screen name="log-night"    options={{ headerShown: false }} />
        <Stack.Screen name="wind-down"   options={{ headerShown: false }} />
        <Stack.Screen name="login"       options={{ headerShown: false }} />
        <Stack.Screen name="checkin"     options={{ headerShown: false }} />
        <Stack.Screen name="subscription"     options={{ headerShown: false }} />
        <Stack.Screen name="sleep-history"    options={{ headerShown: false }} />

        <Stack.Screen name="support"          options={{ headerShown: false }} />
        <Stack.Screen name="account"          options={{ headerShown: false }} />
        <Stack.Screen name="premium"          options={{ headerShown: false }} />
        <Stack.Screen name="lifestyle"        options={{ headerShown: false }} />
        <Stack.Screen name="life-events"      options={{ headerShown: false }} />
        <Stack.Screen name="permissions"      options={{ headerShown: false, gestureEnabled: false }} />

      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular':  require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium':   require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold':     require('../assets/fonts/Inter-Bold.ttf'),
  });

  // Configure RevenueCat inside a component so any native module error is
  // catchable by RootErrorBoundary and doesn't crash the process outright.
  useEffect(() => {
    try {
      configurePurchases();
    } catch (e) {
      console.error('[RootLayout] configurePurchases failed:', e);
    }
  }, []);

  return (
    <GestureHandlerRootView style={ghrv.root}>
      <ThemeProvider>
        <AuthProvider>
          <RootErrorBoundary>
            <RootLayoutInner />
          </RootErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const ghrv = StyleSheet.create({
  root: { flex: 1 },
});
