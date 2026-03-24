/**
 * RLoChat — Chat interface R-Lo
 *
 * Design: matches reference screenshot
 *   - Header: avatar globe + "R-Lo" + × close
 *   - Bot bubbles: left, rounded, dark card bg
 *   - User bubbles: right, accent blue
 *   - Typing dots: same bubble as bot
 *   - Suggestion chips: wrap layout, pill bordered, always visible above input
 *   - Input: full pill shape + cyan send button
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
import { Ionicons }   from "@expo/vector-icons";
import { useChat, type ChatMessage } from "../lib/use-chat";
import { useTheme }   from "../lib/theme-context";

// ─── Suggestion chips (always visible above input) ───────────────────────────

const CHIPS = [
  "How to handle a late night?",
  "Explain 90-min cycles",
  "What is the CRP?",
  "I'm tired — why?",
  "Ideal wind-down?",
  "What is R90?",
  "Miss my sleep window?",
  "Jet lag tips",
  "Does caffeine affect sleep?",
  "How many cycles tonight?",
];

// ─── Typing dots ──────────────────────────────────────────────────────────────

function TypingDots({ color }: { color: string }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.2, duration: 280, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 2, paddingHorizontal: 2 }}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7, height: 7, borderRadius: 3.5,
            backgroundColor: color,
            opacity: d,
            transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Blinking cursor ──────────────────────────────────────────────────────────

function BlinkingCursor({ color }: { color: string }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 400, useNativeDriver: true }),
    ])).start();
  }, [op]);
  return <Animated.Text style={{ color, fontSize: 14, opacity: op }}>▋</Animated.Text>;
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isUser     = message.role === "user";
  const isError    = message.status === "error";
  const isStreaming = message.status === "streaming" && message.content.length > 0;

  // Bot bubble: dark surface on both themes (chat always feels premium/dark)
  const botBg    = theme.dark ? '#1a2f5a' : '#EAF4FB';
  const botText  = theme.dark ? '#FFFFFF' : '#002060';
  const userBg   = c.accent;  // #1c9fda always
  const userText = '#FFFFFF';

  return (
    <View style={[b.row, isUser && b.rowUser]}>
      {/* Bot avatar */}
      {!isUser && (
        <View style={[b.avatar, { backgroundColor: `${c.accent}30` }]}>
          <Ionicons name="planet-outline" size={14} color={c.accent} />
        </View>
      )}

      {/* Bubble */}
      <View style={[
        b.bubble,
        isUser
          ? { backgroundColor: userBg, borderBottomRightRadius: 4 }
          : { backgroundColor: botBg,  borderBottomLeftRadius:  4 },
        isError && { backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: c.error },
      ]}>
        <Text style={[
          b.text,
          { color: isUser ? userText : botText },
          isError && { color: c.error },
        ]}>
          {message.content || " "}
        </Text>
        {isStreaming && <BlinkingCursor color={isUser ? '#ffffff' : c.accent} />}
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '85%' },
  rowUser:   { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: 10, paddingHorizontal: 14,
    flexShrink: 1,
    flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'flex-end', gap: 2,
  },
  text: { fontSize: 15, lineHeight: 22 },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { visible: boolean; onClose: () => void }

export function RLoChat({ visible, onClose }: Props) {
  const { messages, isStreaming, isThinking, sendMessage, clearHistory } = useChat();
  const { theme } = useTheme();
  const c = theme.colors;
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages, isThinking]);

  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    void sendMessage(text);
  }

  const canSend = input.trim().length > 0 && !isStreaming;

  // Chip bg adapts to theme
  const chipBg    = theme.dark ? 'transparent' : 'transparent';
  const chipBorder = theme.dark ? 'rgba(28,159,218,0.4)' : 'rgba(28,159,218,0.35)';
  const chipText   = c.accent;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[s.root, { backgroundColor: c.background }]}
        edges={['top', 'left', 'right']}
      >
        {/* ── Header ── */}
        <View style={[s.header, { borderBottomColor: c.borderSub }]}>
          <View style={s.headerLeft}>
            <View style={[s.headerAvatar, { backgroundColor: `${c.accent}25` }]}>
              <Ionicons name="planet-outline" size={18} color={c.accent} />
            </View>
            <Text style={[s.headerTitle, { color: c.text }]}>R-Lo</Text>
          </View>
          <View style={s.headerRight}>
            {messages.length > 0 && (
              <Pressable onPress={clearHistory} style={s.clearBtn} hitSlop={8}>
                <Text style={[s.clearTxt, { color: c.textMuted }]}>Clear</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} style={[s.closeBtn, { backgroundColor: c.surface2 }]} hitSlop={8}>
              <Ionicons name="close" size={18} color={c.textSub} />
            </Pressable>
          </View>
        </View>

        {/* ── Messages ── */}
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {messages.length === 0 ? (
            /* Empty state */
            <View style={s.empty}>
              <View style={[s.emptyAvatar, { backgroundColor: `${c.accent}20` }]}>
                <Ionicons name="planet-outline" size={32} color={c.accent} />
              </View>
              <Text style={[s.emptyTitle, { color: c.text }]}>Ask R-Lo anything</Text>
              <Text style={[s.emptySub,   { color: c.textMuted }]}>
                About your sleep, rhythm, or recovery.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              contentContainerStyle={s.list}
              renderItem={({ item }) => <ChatBubble message={item} />}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={
                isThinking ? (
                  <View style={[s.thinkingBubble, { backgroundColor: theme.dark ? '#1a2f5a' : '#EAF4FB' }]}>
                    <TypingDots color={theme.dark ? '#FFFFFF' : '#002060'} />
                  </View>
                ) : null
              }
            />
          )}

          {/* ── Suggestion chips — always visible, wrap layout ── */}
          <View style={s.chips}>
            {CHIPS.map((chip, i) => (
              <Pressable
                key={i}
                onPress={() => setInput(chip)}
                style={[s.chip, { borderColor: chipBorder }]}
              >
                <Text style={[s.chipTxt, { color: chipText }]} numberOfLines={1}>
                  {chip}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── Input bar ── */}
          <View style={[s.bar, { borderTopColor: c.borderSub }]}>
            <TextInput
              style={[s.input, { backgroundColor: c.surface2, color: c.text }]}
              placeholder="Type a message..."
              placeholderTextColor={c.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              maxLength={500}
              editable={!isStreaming}
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              style={[s.sendBtn, { backgroundColor: canSend ? c.accent : c.surface2 }]}
            >
              <Ionicons name="arrow-up" size={18} color={canSend ? '#FFFFFF' : c.textMuted} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '700' },
  clearBtn:     { paddingHorizontal: 8, paddingVertical: 4 },
  clearTxt:     { fontSize: 13 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub:    { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Messages
  list: { padding: 16, paddingBottom: 12, gap: 14 },
  thinkingBubble: {
    alignSelf: 'flex-start',
    borderRadius: 18, borderBottomLeftRadius: 4,
    paddingVertical: 12, paddingHorizontal: 16,
    marginLeft: 36, marginTop: 2, marginBottom: 4,
  },

  // Suggestion chips — wrap
  chips: {
    flexDirection:    'row',
    flexWrap:         'wrap',
    gap:              8,
    paddingHorizontal: 14,
    paddingVertical:   10,
  },
  chip: {
    borderWidth:       1,
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:    7,
  },
  chipTxt: { fontSize: 13, fontWeight: '500' },

  // Input bar
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, height: 44, borderRadius: 22,
    paddingHorizontal: 18, fontSize: 15,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
