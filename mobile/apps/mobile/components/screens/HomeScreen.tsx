/**
 * HomeScreen — R-Lo Sleep Coach (premium UX)
 *
 * Zones:
 *   1. Hero     — R-Lo alive (breathing + float + glow pulse)
 *   2. Message  — dynamic personalised coach message
 *   3. State    — Energy / Cycles / Sleep window (3 chips)
 *   4. Empty    — 3 conversation starters + proactive R-Lo greeting
 *   5. Chat     — continuous conversation, dominant visual
 *   6. Composer — 3 quick chips + input with focus glow + send
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useDayPlanContext }          from '../../lib/day-plan-context';
import { loadProfile, loadWeekHistory, hasCompletedIntro, loadOnboardingData } from '../../lib/storage';
import { usePremium }                 from '../../lib/use-premium';
import { useChat, type ChatMessage }  from '../../lib/use-chat';
import { MascotImage }                from '../ui/MascotImage';
import { computeInsights }            from '../../lib/insights';
import type { UserProfile, NightRecord } from '@r90/types';

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG      = '#0B1220';
const CARD    = '#1A2436';
const SURFACE2= '#243046';
const ACCENT  = '#4DA3FF';
const SUCCESS = '#3DDC97';
const WARNING = '#F5A623';
const TEXT    = '#E6EDF7';
const SUB     = '#9FB0C5';
const MUTED   = '#6B7F99';
const BORDER  = 'rgba(255,255,255,0.06)';

// ─── Config ───────────────────────────────────────────────────────────────────
const MASCOT_SIZE = 196;

// 3 suggestions max
const SUGGESTIONS = [
  { icon: 'stats-chart-outline',  text: 'How am I doing this week?' },
  { icon: 'moon-outline',         text: 'What should I do before bed?' },
  { icon: 'help-circle-outline',  text: 'Help me understand my sleep cycles' },
];

// 3 quick actions max
const QUICK_ACTIONS = [
  { icon: 'moon-outline',     label: 'Slept late',    prompt: 'I slept later than usual last night' },
  { icon: 'calendar-outline', label: 'Plan tonight',  prompt: 'Help me plan my sleep for tonight' },
  { icon: 'sunny-outline',    label: 'Woke early',    prompt: 'I woke up earlier than my anchor time' },
];

// ─── Dynamic message ──────────────────────────────────────────────────────────
function buildCoachMessage(
  insights: ReturnType<typeof computeInsights> | null,
  history:  NightRecord[],
): string {
  if (!insights || history.length === 0) {
    const h = new Date().getHours();
    if (h < 6)  return 'Still dark out. Your body needs rest — let\'s protect tonight.';
    if (h < 12) return 'Good morning. Let\'s make the most of your recovery today.';
    if (h < 18) return 'Afternoon energy dip is normal. Protect your sleep window tonight.';
    return 'Evening is here. Let\'s make sure tonight counts.';
  }
  const last = history[history.length - 1];
  const { energyScore, sleepDebt, sleepConsistency, weeklyCycles, weeklyTarget } = insights;

  if (last && last.cyclesCompleted <= 2)
    return `You only got ${last.cyclesCompleted} cycles last night. Let's aim for a stronger recovery tonight.`;
  if (sleepDebt < -3)
    return `You're ${Math.abs(sleepDebt)} cycles behind target this week. Tonight matters.`;
  if (energyScore >= 78)
    return `Your rhythm is solid this week. Keep the momentum going tonight.`;
  if (sleepConsistency < 60)
    return 'Your rhythm is a bit irregular. A consistent anchor time will help.';
  if (weeklyCycles >= weeklyTarget * 0.85)
    return `You're close to your weekly goal — ${weeklyCycles} of ${weeklyTarget} cycles. Strong finish.`;
  return 'Consistency is everything. Let\'s build on last night.';
}

// Proactive greeting when Home opens
function buildProactiveGreeting(insights: ReturnType<typeof computeInsights> | null): string {
  const h = new Date().getHours();
  if (!insights) {
    if (h < 12) return 'Good morning! I\'m here whenever you\'re ready to talk about your sleep.';
    if (h < 18) return 'Hey — how are you feeling after last night?';
    return 'Good evening. Your sleep window is coming up. Ready to plan?';
  }
  const { energyScore } = insights;
  if (h >= 20) return `Good evening. Energy level: ${energyScore}/100. Let's make tonight count.`;
  if (h < 12)  return `Good morning! Your energy score is ${energyScore}/100. Let's talk recovery.`;
  return `Hey — your energy is at ${energyScore}/100 today. How are you feeling?`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatMin(m: number): string {
  const mins = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
function scoreLabel(n: number) {
  return n >= 75 ? 'High' : n >= 50 ? 'Medium' : 'Low';
}
function scoreColor(n: number) {
  return n >= 75 ? SUCCESS : n >= 50 ? WARNING : '#F87171';
}

// ─── Blinking cursor ─────────────────────────────────────────────────────────
function BlinkingCursor() {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0, duration: 420, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 420, useNativeDriver: true }),
    ])).start();
  }, [op]);
  return <Animated.Text style={{ color: ACCENT, fontSize: 14, opacity: op }}>▋</Animated.Text>;
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser      = msg.role === 'user';
  const isError     = msg.status === 'error';
  const isStreaming  = msg.status === 'streaming' && msg.content.length > 0;
  return (
    <View style={[bbl.row, isUser && bbl.rowUser]}>
      {!isUser && (
        <View style={bbl.avatarWrap}>
          <MascotImage emotion="rassurante" style={{ width: 32, height: 32 }} />
        </View>
      )}
      <View style={[bbl.bubble, isUser && bbl.bubbleUser, isError && bbl.bubbleError]}>
        <Text style={[bbl.text, isUser && bbl.textUser, isError && { color: '#F87171' }]}>
          {msg.content || ' '}
        </Text>
        {isStreaming && <BlinkingCursor />}
      </View>
    </View>
  );
}
const bbl = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%', marginBottom: 6 },
  rowUser:     { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatarWrap:  { width: 32, height: 32, flexShrink: 0, alignSelf: 'flex-end' },
  bubble:      { backgroundColor: CARD, borderRadius: 20, borderBottomLeftRadius: 5, paddingVertical: 14, paddingHorizontal: 18, flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 3 },
  bubbleUser:  { backgroundColor: ACCENT, borderBottomLeftRadius: 20, borderBottomRightRadius: 5 },
  bubbleError: { backgroundColor: 'rgba(248,113,113,0.10)', borderWidth: 1, borderColor: '#F87171' },
  text:        { fontSize: 15, lineHeight: 24, color: TEXT },
  textUser:    { color: '#000' },
});

// ─── R-Lo thinking indicator ─────────────────────────────────────────────────
function ThinkingBar() {
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;
  const d3 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    function pulse(v: Animated.Value, delay: number) {
      return Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1,   duration: 380, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 380, useNativeDriver: true }),
      ]));
    }
    const a = pulse(d1, 0); const b = pulse(d2, 160); const c = pulse(d3, 320);
    a.start(); b.start(); c.start();
    return () => { a.stop(); b.stop(); c.stop(); };
  }, [d1, d2, d3]);
  return (
    <View style={tk.row}>
      <MascotImage emotion="Reflexion" style={{ width: 24, height: 24 }} />
      <View style={tk.dots}>
        {[d1, d2, d3].map((v, i) => <Animated.View key={i} style={[tk.dot, { opacity: v }]} />)}
      </View>
      <Text style={tk.label}>R-Lo is thinking…</Text>
    </View>
  );
}
const tk = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  dots:  { flexDirection: 'row', gap: 4 },
  dot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT },
  label: { fontSize: 12, color: MUTED, fontStyle: 'italic' },
});

// ─── Compact hero bar (active state) ─────────────────────────────────────────
function CompactHero({ msg }: { msg: string }) {
  const glow = useRef(new Animated.Value(0.12)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.28, duration: 2600, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.12, duration: 2600, useNativeDriver: true }),
    ])).start();
  }, [glow]);
  return (
    <View style={ch.bar}>
      <View style={ch.avatarWrap}>
        <Animated.View style={[ch.glow, { opacity: glow }]} />
        <MascotImage emotion="rassurante" style={{ width: 38, height: 38 }} />
      </View>
      <View style={ch.txt}>
        <Text style={ch.name}>R-LO</Text>
        <Text style={ch.msg} numberOfLines={1}>{msg}</Text>
      </View>
    </View>
  );
}
const ch = StyleSheet.create({
  bar:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  avatarWrap:{ alignItems: 'center', justifyContent: 'center', width: 42, height: 42 },
  glow:      { position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: ACCENT },
  txt:       { flex: 1 },
  name:      { fontSize: 11, fontWeight: '800', color: ACCENT, letterSpacing: 1.2, textTransform: 'uppercase' },
  msg:       { fontSize: 13, color: SUB, marginTop: 1 },
});

// ─── State strip ─────────────────────────────────────────────────────────────
function StateStrip({ insights, bedtime }: {
  insights: ReturnType<typeof computeInsights> | null;
  bedtime:  number | null;
}) {
  const energy = insights ? { label: scoreLabel(insights.energyScore), color: scoreColor(insights.energyScore) } : null;
  const items = [
    { icon: 'flash-outline',      label: 'Energy',   value: energy?.label ?? '–',                       color: energy?.color ?? MUTED },
    { icon: 'stats-chart-outline',label: 'Cycles',   value: insights ? `${insights.weeklyCycles}/${insights.weeklyTarget}` : '–', color: ACCENT },
    { icon: 'moon-outline',       label: 'Sleep at', value: bedtime !== null ? formatMin(bedtime) : '–', color: SUB },
  ] as const;
  return (
    <View style={ss.strip}>
      {items.map(({ icon, label, value, color }) => (
        <View key={label} style={ss.chip}>
          <Ionicons name={icon as any} size={13} color={color} />
          <Text style={ss.chipLabel}>{label}</Text>
          <Text style={[ss.chipVal, { color }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}
const ss = StyleSheet.create({
  strip:    { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 10 },
  chip:     { flex: 1, backgroundColor: CARD, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center', gap: 3 },
  chipLabel:{ fontSize: 10, color: MUTED, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipVal:  { fontSize: 15, fontWeight: '800' },
});

// ─── Hero (empty state) ───────────────────────────────────────────────────────
const GLOW = 270;
function HeroSection({ coachMsg }: { coachMsg: string }) {
  const breathe = useRef(new Animated.Value(0)).current;
  const floatY  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 3800, useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 3800, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: 1, duration: 2900, useNativeDriver: true }),
      Animated.timing(floatY, { toValue: 0, duration: 2900, useNativeDriver: true }),
    ])).start();
  }, [breathe, floatY]);
  const scale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.04] });
  const glowOp  = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.13, 0.30] });
  const glowSc  = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.14] });
  const outerOp = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.13] });
  const ty      = floatY.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  return (
    <View style={hr.wrap}>
      <Animated.View style={[hr.glowOuter, { opacity: outerOp }]} />
      <Animated.View style={[hr.glow, { opacity: glowOp, transform: [{ scale: glowSc }] }]} />
      <Animated.View style={{ transform: [{ scale }, { translateY: ty }], width: MASCOT_SIZE, height: MASCOT_SIZE }}>
        <MascotImage emotion="encourageant" style={{ width: MASCOT_SIZE, height: MASCOT_SIZE }} />
      </Animated.View>
      <Text style={hr.msg}>{coachMsg}</Text>
    </View>
  );
}
const hr = StyleSheet.create({
  wrap:      { alignItems: 'center', paddingTop: 24, paddingBottom: 16, paddingHorizontal: 28 },
  glow:      { position: 'absolute', top: 18, width: GLOW, height: GLOW, borderRadius: GLOW / 2, backgroundColor: ACCENT },
  glowOuter: { position: 'absolute', top: 0, width: GLOW * 1.6, height: GLOW * 1.6, borderRadius: (GLOW * 1.6) / 2, backgroundColor: ACCENT },
  msg:       { fontSize: 17, fontWeight: '500', color: TEXT, textAlign: 'center', lineHeight: 26, letterSpacing: -0.2, paddingTop: 18 },
});



// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { dayPlan, loading: planLoading, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { recordUsage } = usePremium();
  const router = useRouter();
  const { messages, isStreaming, sendMessage, injectMessage } = useChat();

  const [input,        setInput]        = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [history,      setHistory]      = useState<NightRecord[]>([]);
  const [insights,     setInsights]     = useState<ReturnType<typeof computeInsights> | null>(null);

  const listRef              = useRef<FlatList<ChatMessage>>(null);
  const hasMountedFocus      = useRef(false);
  const hasRedirected        = useRef(false);
  const hasGreeted           = useRef(false);

  useEffect(() => {
    (async () => {
      const [p, h] = await Promise.all([loadProfile(), loadWeekHistory()]);
      setProfile(p); setHistory(h ?? []);
      if (p && h?.length) setInsights(computeInsights(h, p));
    })();
  }, []);

  // Auto-greeting: name already collected in /onboarding-chat
  useEffect(() => {
    if (hasGreeted.current) return;
    const t = setTimeout(async () => {
      hasGreeted.current = true;
      const onboarding = await loadOnboardingData();
      const name = onboarding?.firstName;
      const greeting = name
        ? `Hey ${name}. ${buildProactiveGreeting(insights)}`
        : buildProactiveGreeting(insights);
      injectMessage(greeting);
    }, 600);
    return () => clearTimeout(t);
  }, [insights, injectMessage]);

  useEffect(() => {
    if (!needsOnboarding || hasRedirected.current) return;
    hasCompletedIntro().then(done => {
      if (!done && !hasRedirected.current) { hasRedirected.current = true; router.replace('/onboarding'); }
    });
  }, [needsOnboarding, router]);

  useFocusEffect(useCallback(() => {
    if (!hasMountedFocus.current) { hasMountedFocus.current = true; return; }
    refreshPlan();
  }, [refreshPlan]));

  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages]);

  function send(text?: string) {
    const txt = (text ?? input).trim();
    if (!txt || isStreaming) return;
    setInput('');
    void sendMessage(txt);
  }

  const canSend    = input.trim().length > 0 && !isStreaming;
  const bedtime    = dayPlan?.cycleWindow?.bedtime ?? null;
  const coachMsg   = buildCoachMessage(insights, history);
  // hasChat = true only when user has sent at least one message (switches to full chat layout)
  const hasChat    = messages.some(m => m.role === 'user');

  return (
    <SafeAreaView style={[sc.root, { backgroundColor: BG }]} edges={['top']}>
      <KeyboardAvoidingView style={sc.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {hasChat ? (
          /* ── ACTIVE STATE ───────────────────────────────────────────────── */
          <>
            <CompactHero msg={coachMsg} />
            <StateStrip insights={insights} bedtime={bedtime} />

            {isStreaming && <ThinkingBar />}

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              contentContainerStyle={sc.listContent}
              renderItem={({ item }) => <ChatBubble msg={item} />}
              showsVerticalScrollIndicator={false}
            />
          </>
        ) : (
          /* ── EMPTY STATE (no user message yet, R-Lo greeting visible) ─── */
          <ScrollView
            style={sc.flex}
            contentContainerStyle={sc.emptyScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <HeroSection coachMsg={coachMsg} />
            <StateStrip insights={insights} bedtime={bedtime} />

            {/* Show R-Lo greeting bubble if already injected */}
            {messages.length > 0 && (
              <View style={sc.greetingWrap}>
                {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
              </View>
            )}

            {/* 3 conversation starters */}
            <View style={sc.sugWrap}>
              <Text style={sc.sugTitle}>Start a conversation</Text>
              {SUGGESTIONS.map(({ icon, text }) => (
                <Pressable
                  key={text}
                  style={({ pressed }) => [sc.sugChip, pressed && { opacity: 0.7 }]}
                  onPress={() => send(text)}
                >
                  <Ionicons name={icon as any} size={15} color={ACCENT} />
                  <Text style={sc.sugText}>{text}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {/* ── COMPOSER ──────────────────────────────────────────────────────── */}
        <View style={[sc.composer, { borderTopColor: BORDER }]}>

          {/* 3 quick chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={sc.quickRow} style={sc.quickScroll}>
            {QUICK_ACTIONS.map(({ icon, label, prompt }) => (
              <Pressable
                key={label}
                style={({ pressed }) => [sc.quickChip, pressed && { opacity: 0.7 }]}
                onPress={() => send(prompt)}
                disabled={isStreaming}
              >
                <Ionicons name={icon as any} size={13} color={SUB} />
                <Text style={sc.quickLabel}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Input row */}
          <View style={sc.inputRow}>
            <View style={[
              sc.inputWrap,
              inputFocused && { borderColor: `${ACCENT}55`, borderWidth: 1 },
            ]}>
              <TextInput
                style={sc.input}
                placeholder="Message R-Lo…"
                placeholderTextColor={MUTED}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => send()}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                returnKeyType="send"
                multiline
                maxLength={500}
                editable={!isStreaming}
              />
            </View>
            <Pressable
              style={[sc.sendBtn, { backgroundColor: canSend ? ACCENT : SURFACE2 }]}
              onPress={() => send()}
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
const sc = StyleSheet.create({
  root:       { flex: 1 },
  flex:       { flex: 1 },
  emptyScroll:{ paddingBottom: 8 },

  listContent:  { padding: 16, paddingBottom: 8, gap: 14 },
  greetingWrap: { paddingHorizontal: 16, paddingBottom: 8 },

  sugWrap:  { paddingHorizontal: 16, gap: 8, marginTop: 4 },
  sugTitle: { fontSize: 11, fontWeight: '600', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 2 },
  sugChip:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  sugText:  { fontSize: 14, color: SUB, flex: 1 },

  composer:   { borderTopWidth: StyleSheet.hairlineWidth, backgroundColor: BG, paddingBottom: 6 },
  quickScroll:{ maxHeight: 42 },
  quickRow:   { paddingHorizontal: 12, paddingVertical: 7, gap: 8 },
  quickChip:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: SURFACE2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  quickLabel: { fontSize: 13, color: SUB, fontWeight: '500' },

  inputRow:   { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingBottom: 4, gap: 8 },
  inputWrap:  { flex: 1, backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: 'transparent' },
  input:      { paddingHorizontal: 18, paddingVertical: 11, fontSize: 15, maxHeight: 120, color: TEXT, lineHeight: 22 },
  sendBtn:    { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
