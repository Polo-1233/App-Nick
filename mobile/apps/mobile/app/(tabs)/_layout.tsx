import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Slot, useRouter } from "expo-router";
import { DayPlanProvider }         from "../../lib/day-plan-context";
import { ChatProvider }            from "../../lib/chat-context";
import { AirloopChat }             from "../../components/AirloopChat";
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

/**
 * Tab group layout — orchestrates the full post-onboarding flow.
 *
 * Phase machine (stored in AsyncStorage):
 *   guided_chat → questions in Home chat (tabs locked)
 *   plan        → plan generation + reveal overlay
 *   calendar    → calendar + notif access (post-login)
 *   done        → full app
 */

export default function TabsLayout() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [chatVisible, setChatVisible] = useState(false);
  const [phase, setPhaseState]        = useState<OnboardingPhase>('done');
  const [phaseReady, setPhaseReady]   = useState(false);

  const openChat = useCallback(() => setChatVisible(true), []);

  // ── Read phase from storage on mount ──────────────────────────────────────
  useEffect(() => {
    getOnboardingPhase().then(p => {
      // Authenticated users who already have an account should never be
      // blocked by onboarding overlays. Reset any stale phase to 'done'.
      if (isAuthenticated && (p === 'plan' || p === 'calendar' || p === 'guided_chat')) {
        setOnboardingPhase('done');
        setPhaseState('done');
      } else {
        setPhaseState(p);
      }
      setPhaseReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dev safety: reset stale phase on demand ───────────────────────────────
  // If phase is stuck, call advance('done') from ProfileScreen settings.

  // ── Phase transition ───────────────────────────────────────────────────────
  const advance = useCallback((next: OnboardingPhase) => {
    setOnboardingPhase(next);
    setPhaseState(next);
  }, []);

  // ── Plan overlay: after reveal → login ────────────────────────────────────
  const handlePlanToLogin = useCallback(() => {
    advance('calendar');
    router.replace('/login');
  }, [advance, router]);

  // ── Calendar step done → full app ─────────────────────────────────────────
  const handleCalendarDone = useCallback(() => {
    advance('done');
  }, [advance]);

  // ── Tab bar lock (guided_chat phase) ──────────────────────────────────────
  const tabsLocked = phase === 'guided_chat';

  if (!phaseReady) return null;

  return (
    <OnboardingPhaseProvider phase={phase} advance={advance}>
      <DayPlanProvider>
        <ChatProvider onOpenChat={openChat}>
          <View style={st.root}>
            <Slot />

            {/* Tab bar lock overlay — visible but non-interactive */}
            {tabsLocked && (
              <View style={st.tabLock} pointerEvents="box-only" />
            )}

            {/* Plan overlay — phase 'plan' (only for new users, pre-login) */}
            {phase === 'plan' && !isAuthenticated && (
              <OnboardingPlanOverlay
                onComplete={handlePlanToLogin}
                onCalendarDone={undefined}
              />
            )}

            {/* Calendar step — phase 'calendar' (post-login) */}
            {phase === 'calendar' && isAuthenticated && (
              <OnboardingPlanOverlay
                onComplete={handleCalendarDone}
                calendarOnly
              />
            )}

            {/* Global chat overlay */}
            <AirloopChat
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
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    height:   84,   // covers tab bar area
    // semi-transparent to signal "locked" without hiding tabs
    backgroundColor: 'rgba(11,18,32,0.55)',
  },
});
