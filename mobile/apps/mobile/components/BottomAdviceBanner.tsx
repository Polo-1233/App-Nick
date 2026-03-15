/**
 * BottomAdviceBanner
 *
 * Unified floating banner for Calendar and Profile tabs only.
 * NOT used on Home.
 *
 * Layout (left → right):
 *   [mascot 48×48]   [advice text flex:1]   [R-Lo chat button 40×40]
 *
 * The chat button calls openChat() from ChatContext — no prop needed.
 * Wrapped in React.memo; useChatContext returns a stable reference so
 * this component never re-renders unless `message` changes.
 */

import { memo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useChatContext } from "../lib/chat-context";

interface Props {
  message: string;
}

export const BottomAdviceBanner = memo(function BottomAdviceBanner({
  message,
}: Props) {
  const { openChat } = useChatContext();

  return (
    <View
      style={styles.container}
      pointerEvents="box-none"
    >
      <View style={styles.card}>

        {/* Mascot — contained within 48×48 */}
        <View style={styles.mascotWrapper}>
          <Image
            source={require("../assets/images/bandeau.png")}
            style={styles.mascotImage}
            resizeMode="contain"
          />
        </View>

        {/* Advice text — 2 lines max */}
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>

        {/* R-Lo chat button — replaces the floating FAB */}
        <Pressable
          style={styles.chatBtn}
          onPress={openChat}
          accessibilityRole="button"
          accessibilityLabel="Open R-Lo chat"
          hitSlop={8}
        >
          <Image
            source={require("../assets/images/rlo-hello.png")}
            style={styles.chatBtnImage}
            resizeMode="contain"
          />
        </Pressable>

      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Outer shell — absolutely positioned just above the tab bar.
  // The screen content area already ends at the top of the tab bar,
  // so bottom: 8 gives a clean 8 px gap without needing inset math.
  container: {
    position: "absolute",
    left:     16,
    right:    16,
    bottom:   8,
    zIndex:   10,
  },

  // White card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    // iOS shadow
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    // Android elevation
    elevation: 6,
  },

  // Mascot
  mascotWrapper: {
    width: 48,
    height: 48,
    flexShrink: 0,
  },
  mascotImage: {
    width: "100%",
    height: "100%",
  },

  // Advice text
  message: {
    flex: 1,
    color: "#2D2D2D",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
  },

  // Chat button — mirrors the old floating FAB
  chatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A3D2B",
    borderWidth: 1,
    borderColor: "#2D5A3F",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 6,
    elevation: 4,
  },
  chatBtnImage: {
    width: 24,
    height: 24,
  },
});
