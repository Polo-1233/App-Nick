/**
 * HomeScreen — AI sleep coach conversation
 *
 * Structure:
 *   1. Coach header   — R-Lo avatar + personalised greeting
 *   2. Tonight widget — bedtime → wake (only essential)
 *   3. R-Lo message   — "How can I help you today?"
 *   4. Quick actions  — 5 conversation starters
 *   5. Chat           — user + R-Lo messages
 *   6. Input          — sticky at bottom
 *
 * Metrics (cycles, recovery score, debt) → Insights screen only.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons }                  from '@expo/vector-icons';

import { useDayPlanContext }         from '../../lib/day-plan-context';
import { useOnboardingPhase }        from '../../lib/onboarding-phase-context';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro,
  loadOnboardingData, saveOnboardingData,
} from '../../lib/storage';
import { usePremium }                from '../../lib/use-premium';
import { useChat, type ChatMessage } from '../../lib/use-chat';
import { MascotImage }               from '../ui/MascotImage';
import { computeInsights }           from '../../lib/insights';
import { getMockInsightsData }       from '../../lib/mock-insights-data';
import type { UserProfile }          from '@r90/types';

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG      = '#0B1220';
const CARD    = '#1A2436';
const SURFACE2= '#243046';
const ACCENT  = '#4DA3FF';
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

function coachGreeting(name: string | null, score: number): { line1: string; line2: string } {
  const h = new Date().getHours();
  const salutation = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const line1 = name ? `${salutation}, ${name}.` : `${salutation}.`;
  let line2: string;
  if (score >= 80)      line2 = 'Your recovery looks strong today.';
  else if (score >= 65) line2 = 'Your rhythm is building nicely.';
  else if (score >= 50) line2 = 'Stay consistent — tonight matters.';
  else                  line2 = "Your body needs rest. Let's plan tonight well.";
  return { line1, line2 };
}

// ─── Quick actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: 'stats-chart-outline', label: 'How am I doing this week?',    prompt: 'How am I doing this week?' },
  { icon: 'moon-outline',        label: 'What should I do before bed?', prompt: 'What should I do before bed?' },
  { icon: 'bed-outline',         label: 'Slept late',                   prompt: 'I slept later than usual last night' },
  { icon: 'calendar-outline',    label: 'Plan tonight',                 prompt: 'Help me plan my sleep for tonight' },
  { icon: 'sunny-outline',       label: 'Woke early',                   prompt: 'I woke up earlier than my anchor time' },
];

// ─── Guided mode ─────────────────────────────────────────────────────────────
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

// ─── Blinking cursor ──────────────────────────────────────────────────────────
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
  const isUser  = msg.role === 'user';
  const isError = msg.status === 'error';
  const isStream= msg.status === 'streaming' && msg.content.length > 0;
  return (
    <View style={[bbl.row, isUser && bbl.rowUser]}>
      {!isUser && (
        <View style={{ width: 28, height: 28, flexShrink: 0, alignSelf: 'flex-end' }}>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
      <MascotImage emotion="Reflexion" style={{ width: 22, height: 22 }} />
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {dots.map((v, i) => (
          <Animated.View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT, opacity: v }} />
        ))}
      </View>
    </View>
  );
}

// ─── 1. Coach header ──────────────────────────────────────────────────────────
function CoachHeader({ name, score }: { name: string | null; score: number }) {
  const { line1, line2 } = coachGreeting(name, score);
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 3200, useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 3200, useNativeDriver: true }),
    ])).start();
  }, [breathe]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.03] });

  return (
    <View style={hd.wrap}>
      <Animated.View style={{ transform: [{ scale }], width: 60, height: 60 }}>
        <MascotImage emotion="encourageant" style={{ width: 60, height: 60 }} />
      </Animated.View>
      <View style={hd.text}>
        <Text style={hd.line1}>{line1}</Text>
        <Text style={hd.line2}>{line2}</Text>
      </View>
    </View>
  );
}
const hd = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  text:  { flex: 1 },
  line1: { fontSize: 18, fontWeight: '700', color: TEXT, lineHeight: 24 },
  line2: { fontSize: 14, color: SUB, marginTop: 4, lineHeight: 20 },
});

// ─── 2. Tonight widget ────────────────────────────────────────────────────────
function TonightWidget({ bedtime, wake }: { bedtime: number | null; wake: number | null }) {
  if (bedtime === null && wake === null) return null;
  return (
    <View style={tw.card}>
      <Text style={tw.label}>Tonight</Text>
      <View style={tw.row}>
        <View style={tw.item}>
          <Ionicons name="moon-outline" size={18} color={ACCENT} />
          <View>
            <Text style={tw.time}>{bedtime !== null ? formatMin(bedtime) : '—'}</Text>
            <Text style={tw.sub}>Bedtime</Text>
          </View>
        </View>
        <View style={tw.arrow}>
          <Ionicons name="arrow-forward-outline" size={16} color={MUTED} />
        </View>
        <View style={tw.item}>
          <Ionicons name="sunny-outline" size={18} color={WARNING} />
          <View>
            <Text style={tw.time}>{wake !== null ? formatMin(wake) : '—'}</Text>
            <Text style={tw.sub}>Wake time</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
const tw = StyleSheet.create({
  card:  { backgroundColor: CARD, borderRadius: 18, padding: 18, marginHorizontal: 16, marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '600', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  row:   { flexDirection: 'row', alignItems: 'center' },
  item:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  arrow: { paddingHorizontal: 8 },
  time:  { fontSize: 22, fontWeight: '800', color: TEXT },
  sub:   { fontSize: 12, color: MUTED, marginTop: 2 },
});

// ─── 4. Quick actions ─────────────────────────────────────────────────────────
function QuickActions({ onPress, disabled }: { onPress: (p: string) => void; disabled?: boolean }) {
  return (
    <View style={qa.wrap}>
      {QUICK_ACTIONS.map(({ icon, label, prompt }) => (
        <Pressable
          key={label}
          style={({ pressed }) => [qa.chip, (pressed || disabled) && { opacity: 0.6 }]}
          onPress={() => onPress(prompt)}
          disabled={disabled}
        >
          <Ionicons name={icon as any} size={14} color={ACCENT} />
          <Text style={qa.text}>{label}</Text>
          <Ionicons name="chevron-forward" size={12} color={MUTED} />
        </Pressable>
      ))}
    </View>
  );
}
const qa = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  text: { fontSize: 14, color: SUB, flex: 1 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { dayPlan, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { phase, advance }    = useOnboardingPhase();
  const router                = useRouter();
  const { messages, isStreaming, sendMessage, injectMessage } = useChat();

  const [input,        setInput]        = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [energyScore,  setEnergyScore]  = useState(0);
  const [userName,     setUserName]     = useState<string | null>(null);

  // Guided mode refs
  const guidedStep   = useRef<'name' | 'wake' | 'goal' | 'done'>('name');
  const guidedName   = useRef('');
  const guidedWake   = useRef(390);
  const [guidedChips, setGuidedChips] = useState<'wake' | 'goal' | null>(null);
  const guidedTyping = useRef(false);

  const scrollRef       = useRef<ScrollView>(null);
  const hasMountedFocus = useRef(false);
  const hasRedirected   = useRef(false);
  const hasGreeted      = useRef(false);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, h, onboarding] = await Promise.all([loadProfile(), loadWeekHistory(), loadOnboardingData()]);
      if (onboarding?.firstName) setUserName(onboarding.firstName);
      if (p && h && h.length > 0) {
        setProfile(p);
        setEnergyScore(computeInsights(h, p).energyScore);
      } else {
        const { history, profile: mp } = getMockInsightsData();
        setProfile(mp);
        setEnergyScore(computeInsights(history, mp).energyScore);
      }
    })();
  }, []);

  // ── Guided helpers ───────────────────────────────────────────────────────
  function rloSay(text: string, ms = 900): Promise<void> {
    return new Promise(r => setTimeout(() => { injectMessage(text); r(); }, ms));
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
      const m = WAKE_OPTS.find(o => o.label === txt);
      await handleGuidedWakePick(m?.value ?? 390, txt);
    } else if (guidedStep.current === 'goal') {
      const m = GOAL_OPTS.find(o => o.label === txt);
      await handleGuidedGoalPick(m?.value ?? 'recovery', txt);
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
    const t = setTimeout(() => {
      hasGreeted.current = true;
      if (phase === 'guided_chat') {
        injectMessage("Hi, I'm R-Lo.\nYour personal sleep coach.\n\nWhat should I call you?");
        guidedStep.current = 'name';
      } else {
        injectMessage("How can I help you today?");
      }
    }, 500);
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
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
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
  const hasUserChat  = messages.some(m => m.role === 'user');
  const bedtime      = dayPlan?.cycleWindow?.bedtime  ?? null;
  const wakeTime     = dayPlan?.cycleWindow?.wakeTime ?? (profile?.anchorTime ?? null);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={sc.root} edges={['top']}>
      <KeyboardAvoidingView style={sc.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ── GUIDED SETUP ──────────────────────────────────────────────── */}
        {isGuidedMode ? (
          <>
            <View style={sc.guidedHeader}>
              <MascotImage emotion="encourageant" style={{ width: 34, height: 34 }} />
              <View>
                <Text style={sc.guidedName}>R-Lo</Text>
                <Text style={sc.guidedSub}>Your personal sleep coach</Text>
              </View>
            </View>

            <ScrollView ref={scrollRef} style={sc.flex} contentContainerStyle={sc.guidedList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
            </ScrollView>

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
              <View style={sc.composer}>
                <View style={sc.inputRow}>
                  <View style={[sc.inputWrap, inputFocused && { borderColor: `${ACCENT}55`, borderWidth: 1 }]}>
                    <TextInput style={sc.input} placeholder="Your name…" placeholderTextColor={MUTED}
                      value={input} onChangeText={setInput} onSubmitEditing={() => send()}
                      onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
                      returnKeyType="send" autoFocus autoCapitalize="words" />
                  </View>
                  <Pressable style={[sc.sendBtn, { backgroundColor: canSend ? ACCENT : SURFACE2 }]} onPress={() => send()} disabled={!canSend}>
                    <Ionicons name="arrow-up" size={18} color={canSend ? '#000' : MUTED} />
                  </Pressable>
                </View>
              </View>
            )}
          </>
        ) : (
          /* ── COACH MODE ─────────────────────────────────────────────────── */
          <>
            <ScrollView
              ref={scrollRef}
              style={sc.flex}
              contentContainerStyle={sc.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. Coach header */}
              <CoachHeader name={userName} score={energyScore} />

              {/* 2. Tonight widget */}
              <TonightWidget bedtime={bedtime} wake={wakeTime} />

              {/* 3. Chat messages (R-Lo greeting + conversation) */}
              <View style={sc.chatArea}>
                {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
                {isStreaming && <ThinkingDots />}
              </View>

              {/* 4. Quick actions — always visible when not streaming */}
              {!isStreaming && (
                <View style={sc.qaWrap}>
                  <QuickActions onPress={send} disabled={isStreaming} />
                </View>
              )}

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* 5. Chat input */}
            <View style={sc.composer}>
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
  root:   { flex: 1, backgroundColor: BG },
  flex:   { flex: 1 },
  scroll: { paddingBottom: 8 },

  chatArea: { paddingHorizontal: 16, gap: 6 },
  qaWrap:   { paddingTop: 16, paddingBottom: 4 },

  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER, backgroundColor: BG, paddingBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8 },
  inputWrap:{ flex: 1, backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: 'transparent' },
  input:    { paddingHorizontal: 18, paddingVertical: 11, fontSize: 15, maxHeight: 120, color: TEXT, lineHeight: 22 },
  sendBtn:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Guided mode
  guidedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  guidedName:   { fontSize: 16, fontWeight: '700', color: TEXT },
  guidedSub:    { fontSize: 12, color: MUTED },
  guidedList:   { padding: 16, gap: 10 },
  chipsWrap:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip:         { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: `${ACCENT}40` },
  chipWide:     { flexGrow: 1 },
  chipText:     { fontSize: 14, color: TEXT, fontWeight: '500', textAlign: 'center' },
});
