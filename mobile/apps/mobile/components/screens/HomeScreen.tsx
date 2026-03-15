/**
 * HomeScreen — Recovery dashboard + R-Lo coach
 *
 * Layout:
 *   1. Recovery card   — score %, cycles, bedtime, wake
 *   2. Tonight's plan  — bedtime + wake from dayPlan
 *   3. R-Lo coaching   — small avatar + "How can I help?" + quick chips
 *   4. Chat messages   — appear above input after first message
 *   5. Chat input      — sticky at bottom
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
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView }           from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons }               from '@expo/vector-icons';

import { useDayPlanContext }       from '../../lib/day-plan-context';
import { useOnboardingPhase }      from '../../lib/onboarding-phase-context';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro,
  loadOnboardingData, saveOnboardingData,
} from '../../lib/storage';
import { usePremium }              from '../../lib/use-premium';
import { useChat, type ChatMessage } from '../../lib/use-chat';
import { MascotImage }             from '../ui/MascotImage';
import { computeInsights }         from '../../lib/insights';
import { getMockInsightsData }     from '../../lib/mock-insights-data';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMin(m: number): string {
  const mins = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
function scoreColor(n: number) {
  return n >= 75 ? SUCCESS : n >= 50 ? WARNING : '#F87171';
}
function scoreLabel(n: number) {
  return n >= 75 ? 'Great recovery' : n >= 50 ? 'Building' : 'Recovery needed';
}

// ─── Quick actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: 'stats-chart-outline', label: 'How am I doing this week?', prompt: 'How am I doing this week?' },
  { icon: 'moon-outline',        label: 'What should I do before bed?', prompt: 'What should I do before bed?' },
  { icon: 'bed-outline',         label: 'Slept late',    prompt: 'I slept later than usual last night' },
  { icon: 'calendar-outline',    label: 'Plan tonight',  prompt: 'Help me plan my sleep for tonight' },
  { icon: 'sunny-outline',       label: 'Woke early',    prompt: 'I woke up earlier than my anchor time' },
];

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
  const isUser     = msg.role === 'user';
  const isError    = msg.status === 'error';
  const isStream   = msg.status === 'streaming' && msg.content.length > 0;
  return (
    <View style={[bbl.row, isUser && bbl.rowUser]}>
      {!isUser && (
        <View style={bbl.avatarWrap}>
          <MascotImage emotion="rassurante" style={{ width: 28, height: 28 }} />
        </View>
      )}
      <View style={[bbl.bubble, isUser && bbl.bubbleUser, isError && bbl.bubbleError]}>
        <Text style={[bbl.text, isUser && bbl.textUser, isError && { color: '#F87171' }]}>
          {msg.content || ' '}
        </Text>
        {isStream && <BlinkingCursor />}
      </View>
    </View>
  );
}
const bbl = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%', marginBottom: 6 },
  rowUser:    { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatarWrap: { width: 28, height: 28, flexShrink: 0, alignSelf: 'flex-end' },
  bubble:     { backgroundColor: CARD, borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 12, paddingHorizontal: 16, flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 3 },
  bubbleUser: { backgroundColor: ACCENT, borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  bubbleError:{ backgroundColor: 'rgba(248,113,113,0.10)', borderWidth: 1, borderColor: '#F87171' },
  text:       { fontSize: 15, lineHeight: 24, color: TEXT },
  textUser:   { color: '#000' },
});

// ─── Thinking dots ────────────────────────────────────────────────────────────
function ThinkingDots() {
  const dots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];
  useEffect(() => {
    dots.forEach((v, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(v, { toValue: 1,   duration: 360, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 360, useNativeDriver: true }),
      ])).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={td.row}>
      <MascotImage emotion="Reflexion" style={{ width: 22, height: 22 }} />
      <View style={td.dots}>
        {dots.map((v, i) => <Animated.View key={i} style={[td.dot, { opacity: v }]} />)}
      </View>
    </View>
  );
}
const td = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6, gap: 8 },
  dots: { flexDirection: 'row', gap: 4 },
  dot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT },
});

// ─── 1. Recovery card ─────────────────────────────────────────────────────────
function RecoveryCard({
  score,
  cycles,
  target,
  bedtime,
  wake,
}: {
  score:   number;
  cycles:  number;
  target:  number;
  bedtime: number | null;
  wake:    number | null;
}) {
  const color = scoreColor(score);
  const label = scoreLabel(score);
  return (
    <View style={rc.card}>
      <Text style={rc.sectionLabel}>Recovery today</Text>
      <View style={rc.scoreRow}>
        <Text style={[rc.scoreNum, { color }]}>{score}</Text>
        <Text style={rc.scorePct}>%</Text>
        <Text style={[rc.scoreTag, { color, backgroundColor: `${color}18` }]}>{label}</Text>
      </View>
      {/* Progress bar */}
      <View style={rc.bar}>
        <View style={[rc.barFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
      {/* Metrics row */}
      <View style={rc.metrics}>
        <View style={rc.metric}>
          <Text style={rc.metricVal}>{cycles}<Text style={rc.metricUnit}>/{target}</Text></Text>
          <Text style={rc.metricLabel}>Cycles</Text>
        </View>
        <View style={rc.divider} />
        <View style={rc.metric}>
          <Text style={rc.metricVal}>{bedtime !== null ? formatMin(bedtime) : '—'}</Text>
          <Text style={rc.metricLabel}>Bedtime</Text>
        </View>
        <View style={rc.divider} />
        <View style={rc.metric}>
          <Text style={rc.metricVal}>{wake !== null ? formatMin(wake) : '—'}</Text>
          <Text style={rc.metricLabel}>Wake time</Text>
        </View>
      </View>
    </View>
  );
}
const rc = StyleSheet.create({
  card:        { backgroundColor: CARD, borderRadius: 20, padding: 20, marginBottom: 12, gap: 12 },
  sectionLabel:{ fontSize: 12, fontWeight: '600', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
  scoreRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  scoreNum:    { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  scorePct:    { fontSize: 24, fontWeight: '700', color: SUB, marginBottom: 4 },
  scoreTag:    { fontSize: 13, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', marginLeft: 4 },
  bar:         { height: 5, borderRadius: 3, backgroundColor: SURFACE2, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 3 },
  metrics:     { flexDirection: 'row', alignItems: 'center' },
  metric:      { flex: 1, alignItems: 'center', gap: 3 },
  metricVal:   { fontSize: 18, fontWeight: '800', color: TEXT },
  metricUnit:  { fontSize: 13, fontWeight: '600', color: MUTED },
  metricLabel: { fontSize: 11, color: MUTED, fontWeight: '500' },
  divider:     { width: 1, height: 32, backgroundColor: BORDER },
});

// ─── 2. Tonight's plan ────────────────────────────────────────────────────────
function TonightCard({ bedtime, wake }: { bedtime: number | null; wake: number | null }) {
  if (bedtime === null && wake === null) return null;
  return (
    <View style={tc.card}>
      <Text style={tc.sectionLabel}>Tonight's sleep</Text>
      <View style={tc.row}>
        <View style={tc.item}>
          <Ionicons name="moon-outline" size={16} color={ACCENT} />
          <View>
            <Text style={tc.itemTime}>{bedtime !== null ? formatMin(bedtime) : '—'}</Text>
            <Text style={tc.itemLabel}>Bedtime</Text>
          </View>
        </View>
        <View style={tc.arrow}>
          <Ionicons name="arrow-forward-outline" size={16} color={MUTED} />
        </View>
        <View style={tc.item}>
          <Ionicons name="sunny-outline" size={16} color={WARNING} />
          <View>
            <Text style={tc.itemTime}>{wake !== null ? formatMin(wake) : '—'}</Text>
            <Text style={tc.itemLabel}>Wake time</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
const tc = StyleSheet.create({
  card:        { backgroundColor: CARD, borderRadius: 20, padding: 20, marginBottom: 12 },
  sectionLabel:{ fontSize: 12, fontWeight: '600', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  item:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow:       { paddingHorizontal: 4 },
  itemTime:    { fontSize: 22, fontWeight: '800', color: TEXT },
  itemLabel:   { fontSize: 12, color: MUTED, marginTop: 1 },
});

// ─── 3. R-Lo coaching ─────────────────────────────────────────────────────────
function CoachSection({ onAction }: { onAction: (prompt: string) => void }) {
  return (
    <View style={cs.wrap}>
      {/* R-Lo header */}
      <View style={cs.header}>
        <MascotImage emotion="encourageant" style={{ width: 38, height: 38 }} />
        <View>
          <Text style={cs.name}>R-Lo</Text>
          <Text style={cs.sub}>How can I help you today?</Text>
        </View>
      </View>
      {/* Quick action chips */}
      <View style={cs.chips}>
        {QUICK_ACTIONS.map(({ icon, label, prompt }) => (
          <Pressable
            key={label}
            style={({ pressed }) => [cs.chip, pressed && { opacity: 0.7 }]}
            onPress={() => onAction(prompt)}
          >
            <Ionicons name={icon as any} size={14} color={ACCENT} />
            <Text style={cs.chipText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const cs = StyleSheet.create({
  wrap:     { backgroundColor: CARD, borderRadius: 20, padding: 20, marginBottom: 12, gap: 16 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name:     { fontSize: 15, fontWeight: '700', color: TEXT },
  sub:      { fontSize: 13, color: MUTED, marginTop: 2 },
  chips:    { gap: 8 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: SURFACE2, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  chipText: { fontSize: 14, color: SUB, flex: 1 },
});

// ─── Wake + Goal options (guided mode) ───────────────────────────────────────
const WAKE_OPTS = [
  { label: '05:00', value: 300 }, { label: '05:30', value: 330 },
  { label: '06:00', value: 360 }, { label: '06:30', value: 390 },
  { label: '07:00', value: 420 }, { label: '07:30', value: 450 },
  { label: '08:00', value: 480 }, { label: '08:30', value: 510 },
  { label: '09:00', value: 540 },
];
const GOAL_OPTS = [
  { label: 'Better recovery',     value: 'recovery'    },
  { label: 'More energy',         value: 'energy'      },
  { label: 'Fall asleep faster',  value: 'sleep_speed' },
  { label: 'Consistent schedule', value: 'consistency' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { dayPlan, loading: planLoading, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { recordUsage }  = usePremium();
  const { phase, advance } = useOnboardingPhase();
  const router           = useRouter();
  const { messages, isStreaming, sendMessage, injectMessage } = useChat();

  // Guided state machine
  const guidedStep   = useRef<'name' | 'wake' | 'goal' | 'done'>('name');
  const guidedName   = useRef('');
  const guidedWake   = useRef(390);
  const [guidedChips, setGuidedChips] = useState<'wake' | 'goal' | null>(null);
  const guidedTyping = useRef(false);

  const [input,        setInput]        = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [history,      setHistory]      = useState<NightRecord[]>([]);
  const [insights,     setInsights]     = useState<ReturnType<typeof computeInsights> | null>(null);

  const listRef         = useRef<FlatList<ChatMessage>>(null);
  const hasMountedFocus = useRef(false);
  const hasRedirected   = useRef(false);
  const hasGreeted      = useRef(false);

  // ── Load profile + history (mock fallback) ───────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, h] = await Promise.all([loadProfile(), loadWeekHistory()]);
      if (p && h && h.length > 0) {
        setProfile(p); setHistory(h);
        setInsights(computeInsights(h, p));
      } else {
        const mock = getMockInsightsData();
        setProfile(mock.profile); setHistory(mock.history);
        setInsights(computeInsights(mock.history, mock.profile));
      }
    })();
  }, []);

  // ── Guided helpers ───────────────────────────────────────────────────────
  function rloSay(text: string, delayMs = 900): Promise<void> {
    return new Promise(resolve => setTimeout(() => { injectMessage(text); resolve(); }, delayMs));
  }

  async function handleGuidedAnswer(txt: string) {
    if (guidedTyping.current) return;
    guidedTyping.current = true;
    setInput('');

    if (guidedStep.current === 'name') {
      const firstName = txt.trim().split(/\s+/)[0] ?? txt.trim();
      guidedName.current = firstName;
      guidedStep.current = 'wake';
      await rloSay(`Nice to meet you, ${firstName}! 👋\n\nI'll build your schedule around your natural 90-minute cycles.\n\nWhen do you usually wake up?`, 800);
      setGuidedChips('wake');
    } else if (guidedStep.current === 'wake') {
      const match = WAKE_OPTS.find(o => o.label === txt);
      await handleGuidedWakePick(match?.value ?? 390, txt);
    } else if (guidedStep.current === 'goal') {
      const match = GOAL_OPTS.find(o => o.label === txt);
      await handleGuidedGoalPick(match?.value ?? 'recovery', txt);
    }
    guidedTyping.current = false;
  }

  async function handleGuidedWakePick(minutes: number, label: string) {
    guidedWake.current = minutes; guidedStep.current = 'goal';
    setGuidedChips(null); injectMessage(label);
    await rloSay("Perfect.\n\nWhat's your main goal right now?", 700);
    setGuidedChips('goal'); guidedTyping.current = false;
  }

  async function handleGuidedGoalPick(value: string, label: string) {
    guidedStep.current = 'done'; setGuidedChips(null); injectMessage(label);
    await rloSay("Great. Let me build your R90 recovery rhythm.", 700);
    await saveOnboardingData({ firstName: guidedName.current, wakeTimeMinutes: guidedWake.current, priority: value, constraint: '' });
    setTimeout(() => advance('plan'), 1400);
    guidedTyping.current = false;
  }

  // ── Greeting ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasGreeted.current) return;
    const t = setTimeout(async () => {
      hasGreeted.current = true;
      if (phase === 'guided_chat') {
        injectMessage("Hi, I'm R-Lo.\nYour personal sleep coach.\n\nWhat should I call you?");
        guidedStep.current = 'name';
      } else {
        const onboarding = await loadOnboardingData();
        const name = onboarding?.firstName;
        injectMessage(name ? `Hey ${name}! I'm here when you need me.` : "Hey! I'm here when you need me.");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [phase, injectMessage]);

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

  // ── Send ─────────────────────────────────────────────────────────────────
  function send(text?: string) {
    const txt = (text ?? input).trim();
    if (!txt) return;
    if (phase === 'guided_chat') { void handleGuidedAnswer(txt); return; }
    if (isStreaming) return;
    setInput('');
    void sendMessage(txt);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const isGuidedMode = phase === 'guided_chat';
  const canSend      = input.trim().length > 0 && (!isStreaming || isGuidedMode);
  const hasChat      = messages.some(m => m.role === 'user');

  // Recovery data
  const energyScore  = insights?.energyScore  ?? 0;
  const weeklyCycles = insights?.weeklyCycles  ?? 0;
  const nightlyTarget = profile?.idealCyclesPerNight ?? 5;
  const bedtime      = dayPlan?.cycleWindow?.bedtime  ?? null;
  const wakeTime     = dayPlan?.cycleWindow?.wakeTime ?? (profile?.anchorTime ?? null);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={sc.root} edges={['top']}>
      <KeyboardAvoidingView style={sc.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ── GUIDED SETUP MODE ─────────────────────────────────────────── */}
        {isGuidedMode ? (
          <>
            <View style={sc.guidedHeader}>
              <MascotImage emotion="encourageant" style={{ width: 34, height: 34 }} />
              <View>
                <Text style={sc.guidedHeaderName}>R-Lo</Text>
                <Text style={sc.guidedHeaderSub}>Your personal sleep coach</Text>
              </View>
            </View>

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              contentContainerStyle={sc.listContent}
              renderItem={({ item }) => <ChatBubble msg={item} />}
              showsVerticalScrollIndicator={false}
            />

            {guidedChips === 'wake' && (
              <View style={sc.chipsWrap}>
                {WAKE_OPTS.map(({ label, value }) => (
                  <Pressable key={label} style={({ pressed }) => [sc.chip, pressed && { opacity: 0.7 }]}
                    onPress={() => { void handleGuidedWakePick(value, label); }}>
                    <Text style={sc.chipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {guidedChips === 'goal' && (
              <View style={sc.chipsWrap}>
                {GOAL_OPTS.map(({ label, value }) => (
                  <Pressable key={label} style={({ pressed }) => [sc.chip, sc.chipWide, pressed && { opacity: 0.7 }]}
                    onPress={() => { void handleGuidedGoalPick(value, label); }}>
                    <Text style={sc.chipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {guidedStep.current === 'name' && !guidedChips && (
              <View style={[sc.composer, { borderTopColor: BORDER }]}>
                <View style={sc.inputRow}>
                  <View style={[sc.inputWrap, inputFocused && { borderColor: `${ACCENT}55`, borderWidth: 1 }]}>
                    <TextInput
                      style={sc.input}
                      placeholder="Your name…"
                      placeholderTextColor={MUTED}
                      value={input}
                      onChangeText={setInput}
                      onSubmitEditing={() => send()}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      returnKeyType="send"
                      autoFocus
                      autoCapitalize="words"
                    />
                  </View>
                  <Pressable style={[sc.sendBtn, { backgroundColor: canSend ? ACCENT : SURFACE2 }]} onPress={() => send()} disabled={!canSend}>
                    <Ionicons name="arrow-up" size={18} color={canSend ? '#000' : MUTED} />
                  </Pressable>
                </View>
              </View>
            )}
          </>
        ) : (
          /* ── NORMAL DASHBOARD MODE ──────────────────────────────────────── */
          <>
            <ScrollView
              style={sc.flex}
              contentContainerStyle={sc.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. Recovery card */}
              <RecoveryCard
                score={energyScore}
                cycles={weeklyCycles}
                target={nightlyTarget * 7}
                bedtime={bedtime}
                wake={wakeTime}
              />

              {/* 2. Tonight's plan */}
              <TonightCard bedtime={bedtime} wake={wakeTime} />

              {/* 3. R-Lo coaching — hidden once chat is active */}
              {!hasChat && <CoachSection onAction={send} />}

              {/* 4. Chat messages */}
              {messages.length > 0 && (
                <View style={sc.chatSection}>
                  {hasChat && (
                    <View style={sc.chatHeader}>
                      <MascotImage emotion="rassurante" style={{ width: 24, height: 24 }} />
                      <Text style={sc.chatHeaderText}>R-Lo</Text>
                    </View>
                  )}
                  {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
                  {isStreaming && <ThinkingDots />}
                </View>
              )}

              {/* Re-show quick chips after chat started */}
              {hasChat && (
                <View style={sc.rechipsWrap}>
                  {QUICK_ACTIONS.map(({ icon, label, prompt }) => (
                    <Pressable key={label} style={({ pressed }) => [sc.reChip, pressed && { opacity: 0.7 }]}
                      onPress={() => send(prompt)} disabled={isStreaming}>
                      <Ionicons name={icon as any} size={13} color={ACCENT} />
                      <Text style={sc.reChipText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* ── Chat input ──────────────────────────────────────────────── */}
            <View style={[sc.composer, { borderTopColor: BORDER }]}>
              <View style={sc.inputRow}>
                <View style={[sc.inputWrap, inputFocused && { borderColor: `${ACCENT}55`, borderWidth: 1 }]}>
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
                <Pressable style={[sc.sendBtn, { backgroundColor: canSend ? ACCENT : SURFACE2 }]} onPress={() => send()} disabled={!canSend}>
                  <Ionicons name="arrow-up" size={18} color={canSend ? '#000' : MUTED} />
                </Pressable>
              </View>
            </View>
          </>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  flex:    { flex: 1 },
  scroll:  { paddingHorizontal: 16, paddingTop: 16 },

  // Chat section inside scroll
  chatSection:    { marginBottom: 8, gap: 6 },
  chatHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  chatHeaderText: { fontSize: 13, fontWeight: '600', color: MUTED },

  // Re-show chips after chat
  rechipsWrap: { gap: 6, marginBottom: 4 },
  reChip:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SURFACE2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  reChipText:  { fontSize: 13, color: SUB, flex: 1 },

  listContent: { padding: 16, paddingBottom: 8, gap: 14 },

  // Composer (sticky bottom)
  composer: { borderTopWidth: StyleSheet.hairlineWidth, backgroundColor: BG, paddingBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8 },
  inputWrap:{ flex: 1, backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: 'transparent' },
  input:    { paddingHorizontal: 18, paddingVertical: 11, fontSize: 15, maxHeight: 120, color: TEXT, lineHeight: 22 },
  sendBtn:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Guided mode
  guidedHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  guidedHeaderName:{ fontSize: 16, fontWeight: '700', color: TEXT },
  guidedHeaderSub: { fontSize: 12, color: MUTED },
  chipsWrap:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip:            { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: `${ACCENT}40` },
  chipWide:        { flexGrow: 1 },
  chipText:        { fontSize: 14, color: TEXT, fontWeight: '500', textAlign: 'center' },
});
