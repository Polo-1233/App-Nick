/**
 * HomeScreen — R-Lo Sleep Coach
 *
 * Four vertical zones:
 *   1. R-Lo Hero  — mascot + dynamic coach message
 *   2. State strip — Energy / Cycles / Next sleep (compact, 3 chips)
 *   3. Chat area  — continuous conversation with R-Lo
 *   4. Composer   — quick-action chips + text input + send
 *
 * Empty-state: zones 1+2+suggestion chips fill the screen.
 * Active-state: compact hero bar + full chat + composer.
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
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useDayPlanContext } from "../../lib/day-plan-context";
import { loadProfile, loadWeekHistory, hasCompletedIntro } from "../../lib/storage";
import { usePremium } from "../../lib/use-premium";
import { useChat, type ChatMessage } from "../../lib/use-chat";
import { useTheme } from "../../lib/theme-context";
import { MascotImage } from "../ui/MascotImage";
import { computeInsights } from "../../lib/insights";
import type { UserProfile, NightRecord } from "@r90/types";

// ─── Palette shorthand ────────────────────────────────────────────────────────

const BG       = '#0B1220';
const CARD     = '#1A2436';
const SURFACE2 = '#243046';
const ACCENT   = '#4DA3FF';
const SUCCESS  = '#3DDC97';
const WARNING  = '#F5A623';
const TEXT     = '#E6EDF7';
const TEXT_SUB = '#9FB0C5';
const MUTED    = '#6B7F99';
const BORDER   = 'rgba(255,255,255,0.06)';

// ─── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: 'battery-dead-outline',  label: 'I feel tired',      prompt: "I feel tired today" },
  { icon: 'moon-outline',          label: 'I slept late',      prompt: "I slept later than usual last night" },
  { icon: 'calendar-outline',      label: 'Plan tonight',      prompt: "Help me plan my sleep for tonight" },
  { icon: 'sunny-outline',         label: 'Woke up early',     prompt: "I woke up earlier than my anchor time" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMin(m: number): string {
  const h = Math.floor(((m % 1440) + 1440) % 1440 / 60);
  const min = ((m % 1440) + 1440) % 1440 % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function dynamicRLoMessage(insights: ReturnType<typeof computeInsights> | null): string {
  if (!insights) return "Ready to recover today?";
  const { energyScore, sleepDebt, sleepConsistency } = insights;
  if (energyScore >= 75) return "You're in great shape today. Keep the momentum.";
  if (sleepDebt < -2)    return "You're behind on cycles this week. Let's fix tonight.";
  if (sleepConsistency < 60) return "Your rhythm is a bit irregular. Let's work on it.";
  if (energyScore >= 50) return "Building well. A consistent night will push you higher.";
  return "Let's get your recovery back on track.";
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

// ─── Blinking cursor ──────────────────────────────────────────────────────────

function BlinkingCursor() {
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
  return <Animated.Text style={{ color: ACCENT, fontSize: 14, opacity }}>▋</Animated.Text>;
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser     = message.role === "user";
  const isError    = message.status === "error";
  const isStreaming = message.status === "streaming" && message.content.length > 0;

  return (
    <View style={[b.row, isUser && b.rowUser]}>
      {!isUser && (
        <View style={b.avatarWrap}>
          <MascotImage emotion="rassurante" size="sm" style={b.avatar} />
        </View>
      )}
      <View style={[
        b.bubble,
        isUser  && b.bubbleUser,
        isError && b.bubbleError,
      ]}>
        <Text style={[b.text, isUser && b.textUser, isError && { color: '#F87171' }]}>
          {message.content || " "}
        </Text>
        {isStreaming && <BlinkingCursor />}
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '85%', marginBottom: 4 },
  rowUser:    { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatarWrap: { width: 30, height: 30, flexShrink: 0, alignSelf: 'flex-end' },
  avatar:     { width: 30, height: 30 },
  bubble:     {
    backgroundColor:        CARD,
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
  bubbleUser:  {
    backgroundColor:          ACCENT,
    borderBottomLeftRadius:   18,
    borderBottomRightRadius:  4,
  },
  bubbleError: { backgroundColor: 'rgba(248,113,113,0.10)', borderWidth: 1, borderColor: '#F87171' },
  text:        { fontSize: 15, lineHeight: 23, color: TEXT },
  textUser:    { color: '#000000' },
});

// ─── Compact hero bar (active state) ─────────────────────────────────────────

function CompactHero({ message }: { message: string }) {
  const pulse = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.0, duration: 2400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.8, duration: 2400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={h.bar}>
      <View style={h.avatarWrap}>
        <Animated.View style={[h.avatarGlow, { opacity: pulse }]} />
        <MascotImage emotion="rassurante" style={h.mascot} />
      </View>
      <View style={h.textWrap}>
        <Text style={h.name}>R-Lo</Text>
        <Text style={h.msg} numberOfLines={1}>{message}</Text>
      </View>
    </View>
  );
}

const h = StyleSheet.create({
  bar:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
  avatarGlow: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, opacity: 0.15 },
  mascot:     { width: 36, height: 36 },
  textWrap:   { flex: 1 },
  name:       { fontSize: 12, fontWeight: '700', color: ACCENT, letterSpacing: 0.5, textTransform: 'uppercase' },
  msg:        { fontSize: 14, color: TEXT_SUB, marginTop: 1 },
});

// ─── State strip (3 chips) ────────────────────────────────────────────────────

function StateStrip({ insights, bedtime }: {
  insights: ReturnType<typeof computeInsights> | null;
  bedtime:  number | null;
}) {
  const items = [
    {
      icon:  'flash-outline' as const,
      label: 'Energy',
      value: insights ? scoreLabel(insights.energyScore) : '–',
      color: insights ? (insights.energyScore >= 75 ? SUCCESS : insights.energyScore >= 50 ? WARNING : '#F87171') : MUTED,
    },
    {
      icon:  'stats-chart-outline' as const,
      label: 'Cycles',
      value: insights ? `${insights.weeklyCycles}/${insights.weeklyTarget}` : '–',
      color: ACCENT,
    },
    {
      icon:  'moon-outline' as const,
      label: 'Sleep at',
      value: bedtime !== null ? formatMin(bedtime) : '–',
      color: TEXT_SUB,
    },
  ];

  return (
    <View style={ss.strip}>
      {items.map(({ icon, label, value, color }, i) => (
        <View key={i} style={ss.chip}>
          <Ionicons name={icon} size={14} color={color} />
          <Text style={ss.chipLabel}>{label}</Text>
          <Text style={[ss.chipValue, { color }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const ss = StyleSheet.create({
  strip:     { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  chip:      { flex: 1, backgroundColor: CARD, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center', gap: 4 },
  chipLabel: { fontSize: 10, color: MUTED, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipValue: { fontSize: 15, fontWeight: '800' },
});

// ─── Hero section — R-Lo presence ────────────────────────────────────────────
// Breathing idle animation (scale + glow pulse). Blue ambient radial glow.
// Message below the character, no speech bubble card — text floats on dark bg.

const MASCOT_SIZE = 200;

function HeroSection({ message }: { message: string }) {
  const breathe = useRef(new Animated.Value(0)).current;
  const float   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing — slow scale
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 3800, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 3800, useNativeDriver: true }),
      ])
    );
    // Floating — very subtle vertical drift
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ])
    );
    breath.start();
    drift.start();
    return () => { breath.stop(); drift.stop(); };
  }, [breathe, float]);

  const scale       = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.04] });
  const translateY  = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] });
  const glowScale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.15] });

  return (
    <View style={hero.wrap}>
      {/* Radial ambient glow — blue, behind mascot */}
      <Animated.View
        style={[
          hero.glow,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />
      {/* Secondary halo — softer, wider */}
      <Animated.View
        style={[
          hero.glowOuter,
          { opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.12] }) },
        ]}
      />

      {/* R-Lo mascot — breathing + floating */}
      <Animated.View
        style={{
          transform: [{ scale }, { translateY }],
          width:  MASCOT_SIZE,
          height: MASCOT_SIZE,
        }}
      >
        <MascotImage
          emotion="encourageant"
          style={{ width: MASCOT_SIZE, height: MASCOT_SIZE }}
        />
      </Animated.View>

      {/* Coach message — floats directly on dark background */}
      <View style={hero.msgWrap}>
        <Text style={hero.msgText}>{message}</Text>
      </View>
    </View>
  );
}

const GLOW_SIZE = 280;

const hero = StyleSheet.create({
  wrap: {
    alignItems:    'center',
    paddingTop:    28,
    paddingBottom: 20,
    paddingHorizontal: 28,
  },
  // Inner radial glow
  glow: {
    position:        'absolute',
    top:             20,
    width:           GLOW_SIZE,
    height:          GLOW_SIZE,
    borderRadius:    GLOW_SIZE / 2,
    backgroundColor: ACCENT,
  },
  // Wider soft halo
  glowOuter: {
    position:        'absolute',
    top:             0,
    width:           GLOW_SIZE * 1.6,
    height:          GLOW_SIZE * 1.6,
    borderRadius:    (GLOW_SIZE * 1.6) / 2,
    backgroundColor: ACCENT,
  },
  // Message — on dark bg, no card
  msgWrap: {
    alignItems:    'center',
    paddingTop:    16,
    paddingHorizontal: 8,
  },
  msgText: {
    fontSize:      18,
    fontWeight:    '500',
    color:         TEXT,
    textAlign:     'center',
    lineHeight:    27,
    letterSpacing: -0.2,
  },
});

// ─── Suggestion chips (empty state) ──────────────────────────────────────────

const SUGGESTIONS = [
  "How am I doing this week?",
  "What should I do before bed tonight?",
  "Help me understand my sleep cycles",
  "I've been waking up tired lately",
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { dayPlan, loading: planLoading, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { recordUsage } = usePremium();
  const router = useRouter();
  const { messages, isStreaming, sendMessage } = useChat();

  const [input,    setInput]    = useState("");
  const [profile,  setProfile]  = useState<UserProfile | null>(null);
  const [history,  setHistory]  = useState<NightRecord[]>([]);
  const [insights, setInsights] = useState<ReturnType<typeof computeInsights> | null>(null);

  const listRef         = useRef<FlatList<ChatMessage>>(null);
  const hasMountedFocus = useRef(false);
  const hasRedirected   = useRef(false);

  // ── Load profile + history + insights ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, h] = await Promise.all([loadProfile(), loadWeekHistory()]);
      setProfile(p);
      setHistory(h ?? []);
      if (p && h && h.length > 0) setInsights(computeInsights(h, p));
    })();
  }, []);

  // ── Redirect if onboarding incomplete ─────────────────────────────────────
  useEffect(() => {
    if (!needsOnboarding || hasRedirected.current) return;
    hasCompletedIntro().then(done => {
      if (!done && !hasRedirected.current) {
        hasRedirected.current = true;
        router.replace("/onboarding");
      }
    });
  }, [needsOnboarding, router]);

  // ── Refresh on focus ───────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (!hasMountedFocus.current) { hasMountedFocus.current = true; return; }
    refreshPlan();
  }, [refreshPlan]));

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages]);

  // ── Send ───────────────────────────────────────────────────────────────────
  function handleSend(text?: string) {
    const txt = (text ?? input).trim();
    if (!txt || isStreaming) return;
    setInput("");
    void sendMessage(txt);
  }

  const canSend  = input.trim().length > 0 && !isStreaming;
  const bedtime  = dayPlan?.cycleWindow?.bedtime ?? null;
  const rloMsg   = dynamicRLoMessage(insights);
  const hasChat  = messages.length > 0;

  return (
    <SafeAreaView style={[st.root, { backgroundColor: BG }]} edges={['top']}>
      <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>

        {hasChat ? (
          /* ── ACTIVE STATE ─────────────────────────────────────────────── */
          <>
            {/* Compact R-Lo bar */}
            <CompactHero message={rloMsg} />

            {/* State strip */}
            <StateStrip insights={insights} bedtime={bedtime} />

            {/* Chat messages */}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              contentContainerStyle={st.listContent}
              renderItem={({ item }) => <ChatBubble message={item} />}
              showsVerticalScrollIndicator={false}
            />
          </>
        ) : (
          /* ── EMPTY STATE ──────────────────────────────────────────────── */
          <ScrollView
            style={st.flex}
            contentContainerStyle={st.emptyScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* R-Lo hero */}
            <HeroSection message={rloMsg} />

            {/* State strip */}
            <StateStrip insights={insights} bedtime={bedtime} />

            {/* Suggestions */}
            <View style={st.suggestionsWrap}>
              <Text style={st.suggestionsTitle}>Start a conversation</Text>
              {SUGGESTIONS.map(prompt => (
                <Pressable
                  key={prompt}
                  style={({ pressed }) => [st.suggestionChip, pressed && { opacity: 0.7 }]}
                  onPress={() => handleSend(prompt)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={ACCENT} />
                  <Text style={st.suggestionText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {/* ── COMPOSER (always at bottom) ─────────────────────────────────── */}
        <View style={[st.composerWrap, { borderTopColor: BORDER }]}>

          {/* Quick action chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.quickChips}
            style={st.quickScroll}
          >
            {QUICK_ACTIONS.map(({ icon, label, prompt }) => (
              <Pressable
                key={label}
                style={({ pressed }) => [st.quickChip, pressed && { opacity: 0.7 }]}
                onPress={() => handleSend(prompt)}
                disabled={isStreaming}
              >
                <Ionicons name={icon as any} size={13} color={TEXT_SUB} />
                <Text style={st.quickChipText}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Text input + send */}
          <View style={st.inputRow}>
            <TextInput
              style={st.input}
              placeholder="Message R-Lo…"
              placeholderTextColor={MUTED}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              multiline
              maxLength={500}
              editable={!isStreaming}
            />
            <Pressable
              style={[st.sendBtn, { backgroundColor: canSend ? ACCENT : SURFACE2 }]}
              onPress={() => handleSend()}
              disabled={!canSend}
            >
              <Ionicons name="arrow-up" size={18} color={canSend ? '#000' : MUTED} />
            </Pressable>
          </View>

        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // Empty scroll
  emptyScroll: { paddingBottom: 16 },

  // Suggestions
  suggestionsWrap: { paddingHorizontal: 16, gap: 8, marginTop: 8 },
  suggestionsTitle: { fontSize: 12, fontWeight: '600', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 2 },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
  },
  suggestionText: { fontSize: 14, color: TEXT_SUB, flex: 1 },

  // Chat
  listContent: { padding: 16, paddingBottom: 8, gap: 12 },

  // Composer
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth, backgroundColor: BG, paddingBottom: 8 },

  quickScroll: { maxHeight: 44 },
  quickChips:  { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickChip:   {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SURFACE2, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  quickChipText: { fontSize: 13, color: TEXT_SUB, fontWeight: '500' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingBottom: 4, gap: 8 },
  input: {
    flex: 1, backgroundColor: CARD, borderRadius: 22,
    paddingHorizontal: 18, paddingVertical: 11, fontSize: 15,
    maxHeight: 120, color: TEXT, lineHeight: 22,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});
