import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Slot, useRouter } from "expo-router";
import { DayPlanProvider }         from "../../lib/day-plan-context";
import { AudioProvider }           from "../../lib/audio-context";
import { ChatProvider }            from "../../lib/chat-context";
import { RLoChat }             from "../../components/RLoChat";
import { OfflineBanner }           from "../../components/OfflineBanner";
import { RLoToastProvider }        from "../../components/RLoToast";
import { OnboardingPlanOverlay }   from "../../components/OnboardingPlanOverlay";
import { OnboardingPhaseProvider } from "../../lib/onboarding-phase-context";
import {
  getOnboardingPhase,
  setOnboardingPhase,
  type OnboardingPhase,
} from "../../lib/storage";
import { useAuth } from "../../lib/auth-context";
import { initAppleHealth } from "../../lib/apple-health";
import { applyWeeklyDecay } from "../../lib/rhythm-depth";

export default function TabsLayout() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [chatVisible, setChatVisible] = useState(false);
  const [phase, setPhaseState]        = useState<OnboardingPhase>('done');
  const [phaseReady, setPhaseReady]   = useState(false);

  const openChat = useCallback(() => setChatVisible(true), []);

  // ── Read phase ONLY after auth has settled ────────────────────────────────
  // This prevents the race condition where isAuthenticated=false at mount
  // causes stale overlay phases to display after auth loads.
  useEffect(() => {
    if (authLoading) return; // wait for auth to settle
    getOnboardingPhase().then(p => {
      // Force 'done' for any stale onboarding phase after auth
    if (isAuthenticated && p !== 'done') {
        setOnboardingPhase('done');
        setPhaseState('done');
      } else {
        setPhaseState(p);
      }
      setPhaseReady(true);
    });
    // Sync Apple Health after auth — background, non-blocking
    if (isAuthenticated) {
      void initAppleHealth();
      void applyWeeklyDecay();
    }
  }, [authLoading, isAuthenticated]);

  // ── Phase transition ───────────────────────────────────────────────────────
  const advance = useCallback((next: OnboardingPhase) => {
    setOnboardingPhase(next);
    setPhaseState(next);
  }, []);

  // ── Plan overlay: after reveal → login ────────────────────────────────────
  // Post-login goes directly to 'done' — no permission cascade.
  // Permissions are now contextual (wind-down → notifications, Planning → calendar).
  const handlePlanToLogin = useCallback(async () => {
    await setOnboardingPhase('done');
    setPhaseState('done');
    router.replace('/login');
  }, [router]);

  // Don't render until both auth + phase are known
  if (authLoading || !phaseReady) return null;

  // Lock tabs during plan overlay (pre-login)
  const tabsLocked = phase === 'plan' && !isAuthenticated;

  return (
    <AudioProvider>
    <OnboardingPhaseProvider phase={phase} advance={advance}>
      <DayPlanProvider>
        <ChatProvider onOpenChat={openChat}>
          <View style={st.root}>
            <Slot />

            {/* Tab bar lock — blocks touch events on bottom nav during onboarding overlays */}
            {tabsLocked && (
              <View
                style={st.tabLock}
                pointerEvents="box-only"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            )}

            {/* Plan overlay — new users only, pre-login */}
            {phase === 'plan' && !isAuthenticated && (
              <OnboardingPlanOverlay
                onComplete={handlePlanToLogin}
                onCalendarDone={undefined}
              />
            )}

            {/* Calendar/wearable/notification permissions removed from onboarding.
                Now contextual: notifications after first wind-down,
                calendar on first Planning tab visit, wearables in Settings. */}

            <RLoChat
              visible={chatVisible}
              onClose={() => setChatVisible(false)}
            />
            <OfflineBanner />
            <RLoToastProvider />
          </View>
        </ChatProvider>
      </DayPlanProvider>
    </OnboardingPhaseProvider>
    </AudioProvider>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: 'transparent' },
  tabLock: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          70, // couvre uniquement la tab bar, pas l'input chat
    backgroundColor: 'transparent', // invisible mais bloque les touches
    zIndex:          9999,
  },
});
