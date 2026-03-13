/**
 * HomeScreen — R-Lo Chat Experience
 *
 * The Home screen IS the conversation with R-Lo.
 *
 * Layout:
 *   SafeArea
 *   ├── Minimal header (greeting + settings)
 *   ├── Empty state  → R-Lo mascot + tagline + suggestion chips
 *   │   OR
 *   │   Active state → FlatList of chat messages
 *   └── Input composer (text field + send button)
 *
 * Architecture:
 *   - useChat() hook for embedded streaming chat (separate from modal AirloopChat)
 *   - useDayPlanContext() for conflict detection + onboarding gate
 *   - ConflictSheet still surfaces when conflicts are detected
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { HomeSkeletonScreen } from "../SkeletonLoader";

import { useDayPlanContext } from "../../lib/day-plan-context";
import { loadProfile, hasCompletedIntro } from "../../lib/storage";
import { usePremium } from "../../lib/use-premium";
import { useChat, type ChatMessage } from "../../lib/use-chat";
import { useTheme } from "../../lib/theme-context";
import { MascotImage } from "../ui/MascotImage";
import type { UserProfile } from "@r90/types";

// ─── Suggested prompts (shown in empty state) ─────────────────────────────────

const SUGGESTIONS = [
  "How am I doing this week?",
  "What should I do before bed tonight?",
  "Help me understand my sleep cycles",
  "I've been waking up tired lately",
];

// ─── Blinking cursor (shown while R-Lo is streaming) ─────────────────────────

function BlinkingCursor({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.Text style={{ color, fontSize: 14, opacity }}>▋</Animated.Text>;
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isUser      = message.role === "user";
  const isError     = message.status === "error";
  const isStreaming  = message.status === "streaming" && message.content.length > 0;

  return (
    <View style={[st.bubbleRow, isUser && st.bubbleRowUser]}>
      {/* R-Lo avatar — mascot image for assistant messages */}
      {!isUser && (
        <MascotImage
          emotion="rassurante"
          size="sm"
          style={st.rloAvatarImg}
        />
      )}

      <View style={[
        st.bubble,
        { backgroundColor: c.surface },
        isUser  && { backgroundColor: c.accent, borderBottomRightRadius: 4, borderBottomLeftRadius: 18 },
        isError && { backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: c.error },
      ]}>
        <Text style={[
          st.bubbleText,
          { color: c.text },
          isUser  && { color: '#000000' },
          isError && { color: c.error },
        ]}>
          {message.content || " "}
        </Text>
        {isStreaming && <BlinkingCursor color={c.accent} />}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const {
    dayPlan,
    loading: localLoading,
    error: localError,
    needsOnboarding,
    refreshPlan,
    applyConflictOption,
  } = useDayPlanContext();

  const { recordUsage }                         = usePremium();
  const router                                  = useRouter();
  const { messages, isStreaming, sendMessage }  = useChat();

  const [input,         setInput]         = useState("");

  const [profile,       setProfile]       = useState<UserProfile | null>(null);

  const listRef         = useRef<FlatList<ChatMessage>>(null);
  const hasMountedFocus = useRef(false);
  const hasRedirected   = useRef(false);

  // ── Redirect if onboarding incomplete ─────────────────────────────────────
  useEffect(() => {
    if (!needsOnboarding || hasRedirected.current) return;
    hasCompletedIntro().then(introComplete => {
      if (!introComplete && !hasRedirected.current) {
        hasRedirected.current = true;
        router.replace("/onboarding");
      }
    });
  }, [needsOnboarding, router]);

  // ── Refresh day plan on screen focus ──────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedFocus.current) {
        hasMountedFocus.current = true;
        return;
      }
      refreshPlan();
    }, [refreshPlan]),
  );

  // ── Load profile (needed for PostEventSheet if surfaced elsewhere) ─────────
  useEffect(() => {
    loadProfile().then(setProfile);
  }, []);



  // ── Auto-scroll when messages update ──────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [messages]);

  // ── Send handler ──────────────────────────────────────────────────────────
  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    void sendMessage(text);
  }

  const canSend = input.trim().length > 0 && !isStreaming;

  // ── Loading skeleton (only if no chat yet) ────────────────────────────────
  if (localLoading && messages.length === 0) return <HomeSkeletonScreen />;

  // ── Date / greeting ───────────────────────────────────────────────────────
  const now      = new Date();
  const hour     = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[st.root, { backgroundColor: c.background }]} edges={['top']}>

      {/* ── Minimal header ────────────────────────────────────────────────── */}
      <View style={st.header}>
        <View style={st.headerText}>
          <Text style={[st.greeting, { color: c.text }]}>{greeting}</Text>
          <Text style={[st.date, { color: c.textMuted }]}>{todayStr}</Text>
        </View>
        <Pressable
          style={[st.settingsBtn, { backgroundColor: c.surface }]}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
        >
          <Ionicons name="settings-outline" size={18} color={c.textSub} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={st.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >

        {/* ── Content area: empty state OR messages ─────────────────────── */}
        {messages.length === 0 ? (

          /* ── Empty state — R-Lo mascot + suggestions ───────────────────── */
          <View style={st.emptyWrap}>

            {/* R-Lo mascot with soft glow */}
            <View style={st.mascotWrap}>
              <View style={[st.mascotGlow, { backgroundColor: c.accent }]} />
              <MascotImage emotion="encourageant" size="xl" />
            </View>

            {/* Welcome copy */}
            <Text style={[st.emptyTitle, { color: c.text }]}>
              How can I help?
            </Text>
            <Text style={[st.emptySub, { color: c.textMuted }]}>
              {"I'm R-Lo, your personal sleep coach.\nAsk me anything about your rest and recovery."}
            </Text>

            {/* Suggestion chips */}
            <View style={st.suggestions}>
              {SUGGESTIONS.map(prompt => (
                <Pressable
                  key={prompt}
                  style={({ pressed }) => [
                    st.chip,
                    { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => void sendMessage(prompt)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={c.accent} />
                  <Text style={[st.chipText, { color: c.textSub }]}>{prompt}</Text>
                </Pressable>
              ))}
            </View>

          </View>

        ) : (

          /* ── Active state — chat messages ──────────────────────────────── */
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={st.listContent}
            renderItem={({ item }) => <ChatBubble message={item} />}
            showsVerticalScrollIndicator={false}
          />

        )}

        {/* ── Input composer ─────────────────────────────────────────────── */}
        <View style={[st.inputBar, { backgroundColor: c.background, borderTopColor: `${c.border}55` }]}>
          <TextInput
            style={[
              st.input,
              { backgroundColor: c.surface, color: c.text, borderColor: c.border },
            ]}
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
            style={[st.sendBtn, { backgroundColor: canSend ? c.accent : c.surface2 }]}
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
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:        14,
    paddingBottom:     10,
  },
  headerText: { gap: 2 },
  greeting: {
    fontSize:      20,
    fontFamily:    'Inter-SemiBold',
    fontWeight:    '600',
    letterSpacing: -0.2,
  },
  date: { fontSize: 12 },
  settingsBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    justifyContent: 'center',
    alignItems:     'center',
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyWrap: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: 28,
    paddingTop:        8,
    paddingBottom:     8,
  },

  // Mascot + glow
  mascotWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      8,
    marginBottom:   22,
  },
  mascotGlow: {
    position:     'absolute',
    width:        260,
    height:       260,
    borderRadius: 130,
    opacity:      0.06,
  },

  // Welcome copy
  emptyTitle: {
    fontSize:      24,
    fontFamily:    'Inter-SemiBold',
    fontWeight:    '600',
    textAlign:     'center',
    letterSpacing: -0.3,
    marginBottom:  8,
  },
  emptySub: {
    fontSize:     14,
    textAlign:    'center',
    lineHeight:   21,
    marginBottom: 28,
  },

  // Suggestion chips
  suggestions: {
    width: '100%',
    gap:   10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical:   13,
    borderRadius:      14,
    borderWidth:       1,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
  },
  chipText: {
    fontSize:   14,
    lineHeight: 20,
    flex:       1,
  },

  // ── Messages ──────────────────────────────────────────────────────────────
  listContent: {
    padding:        16,
    paddingBottom:  12,
    gap:            14,
  },

  bubbleRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           8,
    maxWidth:      '85%',
  },
  bubbleRowUser: {
    alignSelf:     'flex-end',
    flexDirection: 'row-reverse',
  },

  // Mascot avatar beside R-Lo messages
  rloAvatarImg: {
    width:  34,
    height: 34,
    flexShrink: 0,
    alignSelf: 'flex-end',
  },

  bubble: {
    borderRadius:           18,
    borderBottomLeftRadius: 4,
    paddingVertical:        12,
    paddingHorizontal:      16,
    flexShrink:             1,
    flexDirection:          'row',
    flexWrap:               'wrap',
    alignItems:             'flex-end',
    gap:                    2,
  },
  bubbleText: {
    fontSize:   15,
    lineHeight: 23,
  },

  // ── Input composer ────────────────────────────────────────────────────────
  inputBar: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: 16,
    paddingVertical:   12,
    gap:               10,
    borderTopWidth:    StyleSheet.hairlineWidth,
  },
  input: {
    flex:              1,
    borderRadius:      22,
    paddingHorizontal: 18,
    paddingVertical:   11,
    fontSize:          15,
    maxHeight:         120,
    borderWidth:       1,
    lineHeight:        22,
  },
  sendBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
});
