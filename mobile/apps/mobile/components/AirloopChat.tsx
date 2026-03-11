/**
 * AirloopChat
 *
 * Global slide-up chat panel. Accessible from all tabs via the FAB.
 * Chat = interface, Engine = logic, Airloop = interpretation.
 *
 * V1 constraints:
 * - Pre-built prompts only. No free-text input.
 * - Session-only history (not persisted to AsyncStorage).
 * - Every response computed by airloop-chat-handler.ts (finite switch).
 */

import { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatBubble } from "./ChatBubble";
import type { ChatMessage } from "./ChatBubble";
import {
  CHAT_PROMPTS,
  handleChatPrompt,
  type PromptId,
} from "../lib/airloop-chat-handler";
import { useDayPlanContext } from "../lib/day-plan-context";
import { usePremium } from "../lib/use-premium";
import { loadProfile } from "../lib/storage";
import { PremiumGate } from "./PremiumGate";
import type { UserProfile } from "@r90/types";

interface Props {
  visible: boolean;
  onClose: () => void;
}

let messageCounter = 0;
function nextId() {
  return String(++messageCounter);
}

export function AirloopChat({ visible, onClose }: Props) {
  const { dayPlan, refreshPlan } = useDayPlanContext();
  const { checkGate, recordUsage } = usePremium();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showPremiumGate, setShowPremiumGate] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Load profile when chat opens (needed for "What if I sleep late?")
  useEffect(() => {
    if (!visible) return;
    loadProfile().then((p) => {
      if (p) setProfile(p);
    });
  }, [visible]);

  // Slide animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when new message added
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  function handlePromptTap(promptId: PromptId, label: string) {
    if (!dayPlan) return;

    // Gate "recalculate" after 1 free use
    if (promptId === "recalculate" && checkGate("recalc")) {
      setShowPremiumGate(true);
      return;
    }

    // Add user prompt bubble
    const userMsg: ChatMessage = {
      id: nextId(),
      type: "user",
      text: label,
    };

    // Compute Airloop response synchronously (engine calls, no async)
    const result = handleChatPrompt(promptId, dayPlan, profile);

    const airloopMsg: ChatMessage = {
      id: nextId(),
      type: "airloop",
      text: result.text,
    };

    setMessages((prev) => [...prev, userMsg, airloopMsg]);

    // Record usage + trigger plan refresh when recalculating
    if (result.shouldRefresh) {
      recordUsage("recalc");
      setTimeout(() => refreshPlan(), 200);
    }
  }

  function handleClose() {
    onClose();
    // Clear chat history on close — session only, per design
    setMessages([]);
  }

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Dimmed overlay */}
      <Pressable style={styles.overlay} onPress={handleClose} />

      {/* Slide-up panel */}
      <Animated.View
        style={[styles.panel, { transform: [{ translateY }] }]}
      >
        <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Airloop</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          {/* Message history */}
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && (
              <Text style={styles.emptyHint}>
                Tap a prompt below to ask Airloop.
              </Text>
            )}
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
          </ScrollView>

          {/* Prompt buttons */}
          <View style={styles.promptsContainer}>
            <Text style={styles.promptsLabel}>ASK</Text>
            <View style={styles.prompts}>
              {CHAT_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt.id}
                  style={({ pressed }) => [
                    styles.promptBtn,
                    pressed && styles.promptBtnPressed,
                  ]}
                  onPress={() => handlePromptTap(prompt.id, prompt.label)}
                  disabled={!dayPlan}
                >
                  <Text style={styles.promptBtnText}>{prompt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      <PremiumGate
        visible={showPremiumGate}
        featureName="Plan Recalculation"
        onClose={() => setShowPremiumGate(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    // White, slightly translucent — premium glass feel
    backgroundColor: "rgba(255,255,255,0.93)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    minHeight: 420,
    maxHeight: "80%",
  },
  safeArea: {
    flex: 1,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  headerTitle: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  closeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeBtnText: {
    color: "#60A5FA",
    fontSize: 15,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  emptyHint: {
    color: "#AAAAAA",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  promptsContainer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  promptsLabel: {
    color: "#BBBBBB",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  prompts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  promptBtn: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  promptBtnPressed: {
    backgroundColor: "rgba(96,165,250,0.15)",
    borderColor: "#60A5FA",
  },
  promptBtnText: {
    color: "#1A1A1A",
    fontSize: 13,
    fontWeight: "500",
  },
});
