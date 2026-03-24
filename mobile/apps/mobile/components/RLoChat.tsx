/**
 * RLoChat — Streaming coaching chat for R90 Navigator
 *
 * Full rewrite: free-text input + GPT-4o streaming via SSE.
 *
 * Architecture:
 *   User types → POST /chat (nick_brain) → GPT-4o → SSE stream → renders live
 *
 * Features:
 *   - Free-text input with send button
 *   - Streaming response (text appears progressively)
 *   - Animated cursor during streaming
 *   - Conversation history (session-scoped)
 *   - Suggested prompts on first open
 *
 * Branding: shown as "R-Lo" in all user-facing text.
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
  Modal,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useChat, type ChatMessage } from "../lib/use-chat";
import { useTheme } from "../lib/theme-context";

// ─── Suggested prompts (shown when history is empty) ─────────────────────────

const SUGGESTED = [
  "How to handle a late night?",
  "Explain 90-minute cycles",
  "I have trouble falling asleep",
  "What is the CRP?",
];

// ─── Scrolling suggestion chips ──────────────────────────────────────────────

const ALL_SUGGESTIONS = [
  "Reset in 12 min — what should I do?",
  "How to handle a late night?",
  "Explain 90-minute cycles",
  "I have trouble falling asleep",
  "What is the CRP?",
  "How many cycles do I need tonight?",
  "I feel tired, what's wrong?",
  "How do I prepare for a long trip?",
  "What happens if I miss my sleep window?",
  "Is a nap good or bad?",
  "How does MRM help my focus?",
  "My sleep quality is low — why?",
  "Can I catch up on sleep on weekends?",
  "What's the ideal wake time?",
  "How do I manage jet lag?",
  "Is coffee affecting my sleep?",
  "What does my rhythm score mean?",
  "How to fall asleep faster?",
  "What is R90 exactly?",
  "How long is a perfect wind-down?",
];

function ScrollingSuggestions({
  onSelect,
  accent,
  surface,
  text,
  border,
}: {
  onSelect:  (s: string) => void;
  accent:    string;
  surface:   string;
  text:      string;
  border:    string;
}) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  // Duplicate list for seamless loop
  const items = [...ALL_SUGGESTIONS, ...ALL_SUGGESTIONS];

  useEffect(() => {
    let offset = 0;
    const SPEED = 0.6; // px per frame
    const ITEM_W = 180;
    const TOTAL_W = ALL_SUGGESTIONS.length * (ITEM_W + 10);

    const id = setInterval(() => {
      offset += SPEED;
      if (offset >= TOTAL_W) offset = 0;
      scrollRef.current?.scrollTo({ x: offset, animated: false });
    }, 16);
    return () => clearInterval(id);
  }, []);

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={true}
      style={sq.wrap}
      contentContainerStyle={sq.content}
    >
      {items.map((s, i) => (
        <Pressable
          key={i}
          onPress={() => onSelect(s)}
          style={[sq.chip, { backgroundColor: surface, borderColor: border }]}
        >
          <Text style={[sq.chipText, { color: text }]} numberOfLines={1}>{s}</Text>
        </Pressable>
      ))}
    </Animated.ScrollView>
  );
}

const sq = StyleSheet.create({
  wrap:    { height: 38, flexShrink: 0 },
  content: { paddingHorizontal: 14, gap: 8, alignItems: 'center' },
  chip: {
    height:          32,
    borderRadius:    16,
    borderWidth:     1,
    paddingHorizontal: 14,
    justifyContent:  'center',
  },
  chipText: {
    fontSize:   12,
    fontWeight: '500',
    maxWidth:   170,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Typing dots (3 dots animés pendant que R-Lo réfléchit) ──────────────────

function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={td.row}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            td.dot,
            { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

const td = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FFFFFF' },
});

// ─── Animated cursor ──────────────────────────────────────────────────────────

function BlinkingCursor({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.Text style={{ color, fontSize: 14, opacity }}>▋</Animated.Text>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RLoChat({ visible, onClose }: Props) {
  const { messages, isStreaming, isThinking, sendMessage, clearHistory } = useChat();
  const { theme } = useTheme();
  const c = theme.colors;
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

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

  const canSend = input.trim().length > 0 && !isStreaming;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[s.safe, { backgroundColor: c.background }]}>

        {/* Header */}
        <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.borderSub }]}>
          <View style={s.headerLeft}>
            <View style={[s.avatar, { backgroundColor: `${c.accent}33` }]}>
              <Text style={[s.avatarText, { color: c.accent }]}>R</Text>
            </View>
            <View>
              <Text style={[s.headerTitle, { color: c.text }]}>R-Lo</Text>
              <Text style={[s.headerSub, { color: c.textMuted }]}>
                Sleep Coach
              </Text>
            </View>
          </View>
          <View style={s.headerRight}>
            {messages.length > 0 && (
              <Pressable style={s.clearBtn} onPress={clearHistory}>
                <Text style={[s.clearBtnText, { color: c.textMuted }]}>Clear</Text>
              </Pressable>
            )}
            <Pressable
              style={[s.closeBtn, { backgroundColor: c.surface2 }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={c.textSub} />
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
            <View style={s.emptyContainer}>
              <Text style={[s.emptyTitle, { color: c.textSub }]}>
                Ask R-Lo anything about your sleep.
              </Text>
              <View style={s.suggestions}>
                {SUGGESTED.map(prompt => (
                  <Pressable
                    key={prompt}
                    style={[s.suggestion, { backgroundColor: c.surface, borderColor: c.border }]}
                    onPress={() => handleSuggestion(prompt)}
                  >
                    <Ionicons name="chatbubble-outline" size={15} color={c.textMuted} />
                    <Text style={[s.suggestionText, { color: c.text }]}>{prompt}</Text>
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
              ListFooterComponent={
                isThinking ? (
                  <View style={s.thinkingBubble}>
                    <TypingDots />
                  </View>
                ) : null
              }
            />
          )}

          {/* Scrolling suggestion chips */}
          <ScrollingSuggestions
            onSelect={text => { setInput(text); }}
            accent={c.accent}
            surface={c.surface2}
            text={c.textSub}
            border={c.border}
          />

          {/* Input bar */}
          <View style={[s.inputBar, { backgroundColor: c.surface, borderTopColor: c.borderSub }]}>
            <TextInput
              style={[s.input, { backgroundColor: c.surface2, color: c.text, borderColor: c.border }]}
              placeholder="Message R-Lo…"
              placeholderTextColor={c.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
              editable={!isStreaming}
            />
            <Pressable
              style={[
                s.sendBtn,
                { backgroundColor: canSend ? c.accent : c.surface2 },
              ]}
              onPress={handleSend}
              disabled={!canSend}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={canSend ? '#000000' : c.textMuted}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isUser  = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming" && message.content.length > 0;

  return (
    <View style={[s.bubbleRow, isUser && s.bubbleRowUser]}>
      {!isUser && (
        <View style={[s.bubbleAvatar, { backgroundColor: `${c.accent}33` }]}>
          <Text style={[s.bubbleAvatarText, { color: c.accent }]}>R</Text>
        </View>
      )}
      <View style={[
        s.bubble,
        { backgroundColor: c.surface2 },
        isUser  && { backgroundColor: c.accent, borderBottomRightRadius: 4, borderBottomLeftRadius: 18 },
        isError && { backgroundColor: 'rgba(248,113,113,0.15)', borderWidth: 1, borderColor: c.error },
      ]}>
        <Text style={[
          s.bubbleText,
          { color: c.text },
          isUser && { color: '#000000' },
          isError && { color: c.error },
        ]}>
          {message.content || " "}
        </Text>
        {isStreaming && <BlinkingCursor color={c.accent} />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },
  avatarText:   { fontSize: 16, fontWeight: "700" },
  headerTitle:  { fontSize: 15, fontWeight: "700" },
  headerSub:    { fontSize: 11, marginTop: 1 },
  clearBtn:     { paddingHorizontal: 10, paddingVertical: 6 },
  clearBtnText: { fontSize: 13 },
  closeBtn:     { padding: 6, borderRadius: 20 },

  // Empty state
  emptyContainer: { flex: 1, padding: 20, justifyContent: "center" },
  emptyTitle: {
    fontSize:     15,
    textAlign:    "center",
    marginBottom: 24,
  },
  suggestions: { gap: 10 },
  suggestion: {
    borderRadius:  12,
    padding:       14,
    borderWidth:   1,
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  suggestionText: { fontSize: 14, lineHeight: 20, flex: 1 },

  // Messages
  listContent:     { padding: 16, paddingBottom: 8, gap: 12 },
  thinkingBubble:  {
    alignSelf:       'flex-start',
    backgroundColor: '#141466',
    borderRadius:    18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical:   12,
    marginLeft:        36, // aligns with bot bubbles
    marginTop:         4,
    marginBottom:      8,
  },
  bubbleRow:     { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "85%" },
  bubbleRowUser: { alignSelf: "flex-end", flexDirection: "row-reverse" },

  bubbleAvatar: {
    width:           28,
    height:          28,
    borderRadius:    14,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  bubbleAvatarText: { fontSize: 12, fontWeight: "700" },

  bubble: {
    borderRadius:           18,
    borderBottomLeftRadius: 4,
    paddingVertical:        10,
    paddingHorizontal:      14,
    flexShrink:             1,
    flexDirection:          "row",
    flexWrap:               "wrap",
    alignItems:             "flex-end",
    gap:                    2,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },

  // Input bar
  inputBar: {
    flexDirection:     "row",
    alignItems:        "flex-end",
    paddingHorizontal: 12,
    paddingVertical:   10,
    gap:               8,
    borderTopWidth:    StyleSheet.hairlineWidth,
  },
  input: {
    flex:              1,
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   10,
    fontSize:          15,
    maxHeight:         120,
    borderWidth:       1,
  },
  sendBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    alignItems:      "center",
    justifyContent:  "center",
  },
});
