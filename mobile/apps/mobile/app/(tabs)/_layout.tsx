import { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { Slot } from "expo-router";
import { DayPlanProvider } from "../../lib/day-plan-context";
import { ChatProvider } from "../../lib/chat-context";
import { AirloopChat } from "../../components/AirloopChat";
import { OfflineBanner } from "../../components/OfflineBanner";

/**
 * Tab group layout — wraps the pager (index.tsx) with shared providers
 * and the global Airloop Chat overlay.
 *
 * Navigation between Home / Calendar / Profile is handled entirely by the
 * Animated.ScrollView pager in index.tsx. This layout no longer uses <Tabs>.
 */

export default function TabsLayout() {
  const [chatVisible, setChatVisible] = useState(false);
  const openChat = useCallback(() => setChatVisible(true), []);

  return (
    <DayPlanProvider>
      <ChatProvider onOpenChat={openChat}>
        <View style={styles.root}>
          {/* Pager container renders here */}
          <Slot />

          {/* Chat overlay — sits above the pager */}
          <AirloopChat
            visible={chatVisible}
            onClose={() => setChatVisible(false)}
          />

          {/* Offline banner — shows when backend is unreachable */}
          <OfflineBanner />
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
