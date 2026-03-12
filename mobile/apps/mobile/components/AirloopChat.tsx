/**
 * AirloopChat — Streaming coaching chat for R90 Navigator
 *
 * Full rewrite: free-text input + GPT-4o streaming via SSE.
 *
 * Architecture:
 *   User types → POST /chat (nick_brain) → GPT-4o → SSE stream → renders live
 *
 * Features:
 *   - Free-text input with send button
 *   - Streaming response (text appears progressively)
 *   - Typing indicator during stream
 *   - Conversation history (session-scoped)
 *   - Suggested prompts on first open
 */

import { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useChat, type ChatMessage } from "../lib/use-chat";

// ─── Suggested prompts (shown when history is empty) ─────────────────────────

const SUGGESTED = [
  "How many cycles did I get this week?",
  "What should I do before bed tonight?",
  "Explain what CRP means",
  "Why does my wake time matter so much?",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AirloopChat({ visible, onClose }: Props) {
  const { messages, isStreaming, sendMessage, clearHistory } = useChat();
  const [input,    setInput]    = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Scroll to bottom when new content arrives
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    void sendMessage(text);
  }

  function handleSuggestion(text: string) {
    void sendMessage(text);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>A</Text>
            </View>
            <View>
              <Text style={s.headerTitle}>Airloop</Text>
              <Text style={s.headerSub}>R90 Coach · GPT-4o</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            {messages.length > 0 && (
              <Pressable style={s.clearBtn} onPress={clearHistory}>
                <Text style={s.clearBtnText}>Clear</Text>
              </Pressable>
            )}
            <Pressable style={s.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {messages.length === 0 ? (
            /* Empty state — suggested prompts */
            <View style={s.emptyContainer}>
              <Text style={s.emptyTitle}>Ask Airloop anything about your sleep.</Text>
              <View style={s.suggestions}>
                {SUGGESTED.map(prompt => (
                  <Pressable
                    key={prompt}
                    style={s.suggestion}
                    onPress={() => handleSuggestion(prompt)}
                  >
                    <Text style={s.suggestionText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              contentContainerStyle={s.listContent}
              renderItem={({ item }) => <ChatBubble message={item} />}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Streaming indicator */}
          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <View style={s.typingRow}>
              <ActivityIndicator size="small" color="#22C55E" />
              <Text style={s.typingText}>Airloop is thinking…</Text>
            </View>
          )}

          {/* Input bar */}
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              placeholder="Message Airloop…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
              editable={!isStreaming}
            />
            <Pressable
              style={[s.sendBtn, (!input.trim() || isStreaming) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming
                ? <ActivityIndicator size="small" color="#000" />
                : <Ionicons name="arrow-up" size={18} color="#000" />
              }
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.status === "error";

  return (
    <View style={[s.bubbleRow, isUser && s.bubbleRowUser]}>
      {!isUser && (
        <View style={s.bubbleAvatar}>
          <Text style={s.bubbleAvatarText}>A</Text>
        </View>
      )}
      <View style={[
        s.bubble,
        isUser  && s.bubbleUser,
        isError && s.bubbleError,
      ]}>
        <Text style={[s.bubbleText, isUser && s.bubbleTextUser]}>
          {message.content || " "}
        </Text>
        {message.status === "streaming" && message.content.length > 0 && (
          <Text style={s.cursor}>▋</Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: "#0D0D0D" },
  flex:   { flex: 1 },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: "#22C55E",
    alignItems:      "center",
    justifyContent:  "center",
  },
  avatarText:   { color: "#000", fontSize: 16, fontWeight: "700" },
  headerTitle:  { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  headerSub:    { color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 1 },
  clearBtn:     { paddingHorizontal: 10, paddingVertical: 6 },
  clearBtnText: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  closeBtn:     { padding: 4 },

  // Empty state
  emptyContainer: { flex: 1, padding: 20, justifyContent: "center" },
  emptyTitle: {
    color:        "rgba(255,255,255,0.5)",
    fontSize:     15,
    textAlign:    "center",
    marginBottom: 24,
  },
  suggestions:    { gap: 10 },
  suggestion: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius:    12,
    padding:         14,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.08)",
  },
  suggestionText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20 },

  // Messages
  listContent: { padding: 16, paddingBottom: 8, gap: 12 },
  bubbleRow:   { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "85%" },
  bubbleRowUser: { alignSelf: "flex-end", flexDirection: "row-reverse" },

  bubbleAvatar: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: "#22C55E",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  bubbleAvatarText: { color: "#000", fontSize: 12, fontWeight: "700" },

  bubble: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius:    18,
    borderBottomLeftRadius: 4,
    paddingVertical:   10,
    paddingHorizontal: 14,
    flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor:      "#22C55E",
    borderBottomLeftRadius:  18,
    borderBottomRightRadius: 4,
  },
  bubbleError: { backgroundColor: "rgba(239,68,68,0.15)" },
  bubbleText:     { color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: "#000000" },
  cursor: { color: "#22C55E", fontSize: 14 },

  // Typing
  typingRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    paddingHorizontal: 20,
    paddingVertical:    8,
  },
  typingText: { color: "rgba(255,255,255,0.4)", fontSize: 13 },

  // Input bar
  inputBar: {
    flexDirection:     "row",
    alignItems:        "flex-end",
    paddingHorizontal: 12,
    paddingVertical:   10,
    gap:               8,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    "rgba(255,255,255,0.08)",
  },
  input: {
    flex:              1,
    backgroundColor:   "rgba(255,255,255,0.07)",
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   10,
    color:             "#FFFFFF",
    fontSize:          15,
    maxHeight:         120,
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.1)",
  },
  sendBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: "#22C55E",
    alignItems:      "center",
    justifyContent:  "center",
  },
  sendBtnDisabled: { opacity: 0.35 },
});
