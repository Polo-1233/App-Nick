import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Slot } from "expo-router";
import { DayPlanProvider } from "../../lib/day-plan-context";
import { ChatProvider } from "../../lib/chat-context";
import { AirloopChat } from "../../components/AirloopChat";
import { OfflineBanner } from "../../components/OfflineBanner";
import { RLoToastProvider } from "../../components/RLoToast";
import { OnboardingChatOverlay } from "../../components/OnboardingChatOverlay";
import { OnboardingPlanOverlay } from "../../components/OnboardingPlanOverlay";
import {
  hasCompletedChatOnboarding,
  hasCompletedPlanOnboarding,
} from "../../lib/storage";

/**
 * Tab group layout — wraps the pager (index.tsx) with shared providers
 * and the global Airloop Chat overlay.
 *
 * Navigation between Home / Calendar / Profile is handled entirely by the
 * Animated.ScrollView pager in index.tsx. This layout no longer uses <Tabs>.
 */

export default function TabsLayout() {
  const [chatVisible,        setChatVisible]        = useState(false);
  const [showChatOnboarding, setShowChatOnboarding] = useState(false);
  const [showPlanOnboarding, setShowPlanOnboarding] = useState(false);

  const openChat = useCallback(() => setChatVisible(true), []);

  // On mount: determine which onboarding phase (if any) is still pending
  useEffect(() => {
    async function checkOnboarding() {
      const [chatDone, planDone] = await Promise.all([
        hasCompletedChatOnboarding(),
        hasCompletedPlanOnboarding(),
      ]);
      if (!chatDone) {
        setShowChatOnboarding(true);
      } else if (!planDone) {
        setShowPlanOnboarding(true);
      }
    }
    checkOnboarding();
  }, []);

  // Chat onboarding (steps 6–9) → immediately start plan onboarding (10–12)
  const handleChatOnboardingComplete = useCallback(() => {
    setShowChatOnboarding(false);
    setShowPlanOnboarding(true);
  }, []);

  const handlePlanOnboardingComplete = useCallback(() => {
    setShowPlanOnboarding(false);
  }, []);

  return (
    <DayPlanProvider>
      <ChatProvider onOpenChat={openChat}>
        <View style={styles.root}>
          {/* Pager container renders here */}
          <Slot />

          {/* Onboarding conversation overlay — steps 6–9 (R-Lo chat) */}
          {showChatOnboarding && (
            <OnboardingChatOverlay onComplete={handleChatOnboardingComplete} />
          )}

          {/* Onboarding plan overlay — steps 10–12 (generation → reveal → calendar) */}
          {showPlanOnboarding && (
            <OnboardingPlanOverlay onComplete={handlePlanOnboardingComplete} />
          )}

          {/* Chat overlay — sits above the pager */}
          <AirloopChat
            visible={chatVisible}
            onClose={() => setChatVisible(false)}
          />

          {/* Offline banner — shows when backend is unreachable */}
          <OfflineBanner />

          {/* R-Lo toast — global in-app notifications from R-Lo */}
          <RLoToastProvider />
        </View>
      </ChatProvider>
    </DayPlanProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
});
