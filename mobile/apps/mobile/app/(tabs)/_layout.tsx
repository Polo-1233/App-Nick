import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Slot, useRouter } from "expo-router";
import { DayPlanProvider }         from "../../lib/day-plan-context";
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

export default function TabsLayout() {
  const router                    = useRouter();
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
      // Allow 'calendar' phase through — it's the post-login permission flow
    // Only force 'done' for phases that shouldn't persist after auth (plan, guided_chat)
    if (isAuthenticated && p !== 'done' && p !== 'calendar') {
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
    }
  }, [authLoading, isAuthenticated]);

  // ── Phase transition ───────────────────────────────────────────────────────
  const advance = useCallback((next: OnboardingPhase) => {
    setOnboardingPhase(next);
    setPhaseState(next);
  }, []);

  // ── Plan overlay: after reveal → login ────────────────────────────────────
  // Must await the AsyncStorage write before navigating — otherwise the phase
  // effect re-reads the old value when isAuthenticated changes post-login.
  const handlePlanToLogin = useCallback(async () => {
    await setOnboardingPhase('calendar');
    setPhaseState('calendar');
    router.replace('/login');
  }, [router]);

  // ── Calendar step done → full app ─────────────────────────────────────────
  const handleCalendarDone = useCallback(() => {
    advance('done');
  }, [advance]);

  // Don't render until both auth + phase are known
  if (authLoading || !phaseReady) return null;

  const tabsLocked = phase === 'guided_chat';

  return (
    <OnboardingPhaseProvider phase={phase} advance={advance}>
      <DayPlanProvider>
        <ChatProvider onOpenChat={openChat}>
          <View style={st.root}>
            <Slot />

            {/* Tab bar lock — blocks ALL touch events on bottom nav during onboarding */}
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

            {/* Calendar step — permission flow (calendar → wearables → notifications) */}
            {phase === 'calendar' && (
              <OnboardingPlanOverlay
                onComplete={handleCalendarDone}
                calendarOnly
              />
            )}

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
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0A0A0A' },
  tabLock: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          120, // covers tab bar + safe area + swipe zone
    backgroundColor: 'rgba(11,18,32,0.92)',
    zIndex:          9999,
  },
});
