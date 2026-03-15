/**
 * HomeScreen — Coach-centric layout
 *
 * GUIDED MODE (phase = 'guided_chat'):
 *   Setup conversation embedded in Home: wake → goal → bedtime habit
 *
 * COACH MODE (phase = 'done'):
 *   1. Header image    — montagne.png (30%) + R-Lo + greeting
 *   2. Body            — Segmented (Suggestions | Modes) when no chat
 *                        Chat messages when conversation is active
 *   3. Tonight widget  — compact, pinned just above input
 *   4. Chat input      — sticky at bottom
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
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect }        from 'expo-router';
import { Ionicons }                         from '@expo/vector-icons';
import { LinearGradient }                   from 'expo-linear-gradient';

import { useDayPlanContext }       from '../../lib/day-plan-context';
import { useOnboardingPhase }      from '../../lib/onboarding-phase-context';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro,
  loadOnboardingData, saveOnboardingData,
} from '../../lib/storage';
import { useChat, type ChatMessage } from '../../lib/use-chat';
import { MascotImage }             from '../ui/MascotImage';
import { computeInsights }         from '../../lib/insights';
import { getMockInsightsData }     from '../../lib/mock-insights-data';
import type { UserProfile }        from '@r90/types';

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG      = '#0B1220';
const CARD    = '#1A2436';
const SURFACE2= '#243046';
const ACCENT  = '#4DA3FF';
const WARNING = '#F5A623';
const SUCCESS = '#3DDC97';
const TEXT    = '#E6EDF7';
const SUB     = '#9FB0C5';
const MUTED   = '#6B7F99';
const BORDER  = 'rgba(255,255,255,0.06)';

const { height: SCREEN_H } = Dimensions.get('window');
const HEADER_H = Math.round(SCREEN_H * 0.30);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMin(m: number): string {
  const safe = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function coachGreeting(name: string | null, score: number) {
  const h = new Date().getHours();
  const time = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return {
    line1: name ? `Good ${time}, ${name}` : `Good ${time}`,
    line2: score >= 80 ? 'Your recovery looks strong today.'
         : score >= 65 ? 'Your rhythm is building nicely.'
         : score >= 50 ? 'Stay consistent — tonight matters.'
         : "Your body needs rest. Let's plan tonight well.",
  };
}

// ─── Suggestions ─────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: 'stats-chart-outline', color: '#4DA3FF', label: 'Analyze my week',        sub: 'See your recovery trend',        prompt: 'How am I doing this week?' },
  { icon: 'moon-outline',        color: '#9B59B6', label: 'Prepare tonight',        sub: "Plan tonight's sleep window",    prompt: 'Help me plan my sleep for tonight' },
  { icon: 'bed-outline',         color: '#F5A623', label: 'I slept late',           sub: 'Adjust for a late night',        prompt: 'I slept later than usual last night' },
  { icon: 'refresh-outline',     color: '#3DDC97', label: 'Adjust my rhythm',       sub: 'Recalibrate your schedule',      prompt: 'Help me adjust my sleep rhythm' },
  { icon: 'flash-outline',       color: '#F87171', label: 'Improve recovery',       sub: 'Faster bounce-back tips',        prompt: 'How can I improve my recovery?' },
];

// ─── Modes ────────────────────────────────────────────────────────────────────
const MODES = [
  { icon: 'airplane-outline', color: '#4DA3FF', label: 'Jet lag recovery',           sub: 'Reset after time zones',         prompt: 'Help me recover from jet lag' },
  { icon: 'book-outline',     color: '#9B59B6', label: 'Learning mode',              sub: 'Sleep for memory & focus',       prompt: 'Optimize my sleep for learning and memory' },
  { icon: 'globe-outline',    color: '#3DDC97', label: 'Travel recovery',            sub: 'Maintain rhythm while travelling',prompt: 'I am travelling soon, help me plan my sleep' },
  { icon: 'home-outline',     color: '#F5A623', label: 'Sleep environment',          sub: 'Optimize your room setup',       prompt: 'How can I improve my sleep environment?' },
  { icon: 'flash-outline',    color: '#F87171', label: 'Fatigue reset',              sub: 'Recover when exhausted',         prompt: 'I am exhausted, help me recover fast' },
  { icon: 'moon-outline',     color: '#6B7F99', label: 'Night shift',                sub: 'Adjust for irregular hours',     prompt: 'I work night shifts, help me adjust my sleep' },
];

// ─── Guided mode options ──────────────────────────────────────────────────────
const WAKE_OPTS  = [
  { label: '06:00', value: 360 }, { label: '06:30', value: 390 },
  { label: '07:00', value: 420 }, { label: '07:30', value: 450 },
  { label: '08:00', value: 480 }, { label: 'Custom', value: -1 },
];
const GOAL_OPTS  = [
  { label: 'Better recovery',       value: 'recovery'    },
  { label: 'More energy',           value: 'energy'      },
  { label: 'Fix my sleep schedule', value: 'sleep_speed' },
  { label: 'Reduce fatigue',        value: 'consistency' },
];
const BEDTIME_OPTS = [
  { label: 'Usually',   value: 'before_midnight' },
  { label: 'Sometimes', value: 'sometimes'       },
  { label: 'Rarely',    value: 'rarely'          },
];
type GuidedStep = 'wake' | 'goal' | 'bedtime' | 'done';

// ─── Small components ─────────────────────────────────────────────────────────
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

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser   = msg.role === 'user';
  const isError  = msg.status === 'error';
  const isStream = msg.status === 'streaming' && msg.content.length > 0;
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

// ─── 1. Immersive header ──────────────────────────────────────────────────────
function ImmersiveHeader({ name, score, topInset }: { name: string | null; score: number; topInset: number }) {
  const { line1, line2 } = coachGreeting(name, score);
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 3400, useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 3400, useNativeDriver: true }),
    ])).start();
  }, [breathe]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.04] });

  return (
    <View style={[ih.container, { height: HEADER_H + topInset }]}>
      <Image source={require('../../assets/montagne.png')} style={ih.image} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(11,18,32,0.15)', 'rgba(11,18,32,0.50)', 'rgba(11,18,32,0.90)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[ih.content, { paddingTop: topInset + 12 }]}>
        <Animated.View style={{ transform: [{ scale }], width: 64, height: 64, marginBottom: 10 }}>
          <MascotImage emotion="encourageant" style={{ width: 64, height: 64 }} />
        </Animated.View>
        <Text style={ih.line1}>{line1}</Text>
        <Text style={ih.line2}>{line2}</Text>
      </View>
    </View>
  );
}
const ih = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
  image:     { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  content:   { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 18 },
  line1:     { fontSize: 24, fontWeight: '800', color: '#FFF', lineHeight: 30, marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  line2:     { fontSize: 14, color: 'rgba(255,255,255,0.80)', lineHeight: 20, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
});

// ─── 2. Segmented control ─────────────────────────────────────────────────────
function SegmentedControl({ active, onChange }: { active: 'suggestions' | 'modes'; onChange: (v: 'suggestions' | 'modes') => void }) {
  return (
    <View style={seg.wrap}>
      {(['suggestions', 'modes'] as const).map(tab => (
        <Pressable
          key={tab}
          style={[seg.tab, active === tab && seg.tabActive]}
          onPress={() => onChange(tab)}
        >
          <Text style={[seg.label, active === tab && seg.labelActive]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const seg = StyleSheet.create({
  wrap:        { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, marginBottom: 4, backgroundColor: CARD, borderRadius: 14, padding: 4 },
  tab:         { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  tabActive:   { backgroundColor: SURFACE2 },
  label:       { fontSize: 14, fontWeight: '600', color: MUTED },
  labelActive: { color: TEXT },
});

// ─── 3 & 4. Shared horizontal carousel ───────────────────────────────────────
type CarouselItem = { icon: string; color: string; label: string; sub: string; prompt: string };

function CoachCardCarousel({ items, onPress, disabled }: {
  items:    CarouselItem[];
  onPress:  (p: string) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={cc.scroll}
      style={cc.scroller}
      decelerationRate="fast"
      snapToInterval={154}   // card width + gap
      snapToAlignment="start"
    >
      {items.map(({ icon, color, label, sub, prompt }) => (
        <Pressable
          key={label}
          style={({ pressed }) => [cc.card, (pressed || disabled) && { opacity: 0.7 }]}
          onPress={() => onPress(prompt)}
          disabled={disabled}
        >
          <View style={[cc.iconCircle, { backgroundColor: `${color}15`, borderColor: `${color}28` }]}>
            <Ionicons name={icon as any} size={22} color={color} />
          </View>
          <Text style={cc.title}>{label}</Text>
          <Text style={cc.sub} numberOfLines={2}>{sub}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const cc = StyleSheet.create({
  scroller: { marginTop: 12 },
  scroll:   { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  card:     { width: 144, backgroundColor: CARD, borderRadius: 18, padding: 18, gap: 10, alignItems: 'flex-start' },
  iconCircle:{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 14, fontWeight: '700', color: TEXT, lineHeight: 20 },
  sub:      { fontSize: 12, color: MUTED, lineHeight: 17 },
});

// ─── 5. Tonight widget (pinned above input) ───────────────────────────────────
function TonightWidget({ bedtime, wake, cycles }: { bedtime: number | null; wake: number | null; cycles?: number }) {
  if (bedtime === null && wake === null) return null;
  return (
    <View style={tw.bar}>
      <Text style={tw.label}>Tonight</Text>
      <View style={tw.times}>
        <Ionicons name="moon-outline" size={13} color={ACCENT} />
        <Text style={tw.time}>{bedtime !== null ? formatMin(bedtime) : '—'}</Text>
        <Text style={tw.arrow}>→</Text>
        <Ionicons name="sunny-outline" size={13} color={WARNING} />
        <Text style={tw.time}>{wake !== null ? formatMin(wake) : '—'}</Text>
      </View>
      {cycles !== undefined && cycles > 0 && (
        <Text style={tw.cycles}>{cycles} cycles</Text>
      )}
    </View>
  );
}
const tw = StyleSheet.create({
  bar:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER, backgroundColor: BG },
  label:  { fontSize: 12, fontWeight: '700', color: MUTED },
  times:  { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  time:   { fontSize: 14, fontWeight: '700', color: TEXT },
  arrow:  { fontSize: 13, color: MUTED, marginHorizontal: 1 },
  cycles: { fontSize: 12, color: MUTED, fontWeight: '500' },
});

// ─── Guided OptionCard ────────────────────────────────────────────────────────
function OptionCard({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [oc.card, selected && oc.selected, pressed && !selected && { opacity: 0.75 }]}
      onPress={onPress}
    >
      <Text style={[oc.label, selected && oc.labelSel]}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={18} color="#000" />}
    </Pressable>
  );
}
const oc = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 18, borderWidth: 1.5, borderColor: 'transparent' },
  selected: { backgroundColor: ACCENT, borderColor: ACCENT },
  label:    { flex: 1, fontSize: 15, fontWeight: '600', color: TEXT },
  labelSel: { color: '#000' },
});

// ─── Guided SetupQuestion ─────────────────────────────────────────────────────
function SetupQuestion({ question, options, onSelect, selectedValue, customChild }: {
  question: string;
  options: { label: string; value: string | number }[];
  onSelect: (l: string, v: string | number) => void;
  selectedValue?: string | number;
  customChild?: React.ReactNode;
}) {
  return (
    <View style={sq.wrap}>
      <View style={sq.bubbleRow}>
        <View style={{ width: 32, height: 32, flexShrink: 0 }}>
          <MascotImage emotion="encourageant" style={{ width: 32, height: 32 }} />
        </View>
        <View style={sq.bubble}><Text style={sq.text}>{question}</Text></View>
      </View>
      <View style={sq.options}>
        {options.map(opt => (
          <OptionCard key={opt.label} label={opt.label}
            selected={selectedValue === opt.value || (opt.value === -1 && selectedValue === 'custom')}
            onPress={() => onSelect(opt.label, opt.value)} />
        ))}
        {customChild}
      </View>
    </View>
  );
}
const sq = StyleSheet.create({
  wrap:      { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, gap: 16 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  bubble:    { flex: 1, backgroundColor: CARD, borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 14, paddingHorizontal: 16 },
  text:      { fontSize: 16, color: TEXT, lineHeight: 24, fontWeight: '500' },
  options:   { gap: 10 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { dayPlan, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { phase, advance }    = useOnboardingPhase();
  const router                = useRouter();
  const insets                = useSafeAreaInsets();
  const { messages, isStreaming, sendMessage, injectMessage } = useChat();

  const [input,         setInput]        = useState('');
  const [inputFocused,  setInputFocused] = useState(false);
  const [activeTab,     setActiveTab]    = useState<'suggestions' | 'modes'>('suggestions');
  const [profile,       setProfile]      = useState<UserProfile | null>(null);
  const [energyScore,   setEnergyScore]  = useState(0);
  const [userName,      setUserName]     = useState<string | null>(null);

  // Guided
  const [guidedStep,      setGuidedStep]      = useState<GuidedStep>('wake');
  const [selectedWake,    setSelectedWake]    = useState<number | null>(null);
  const [selectedGoal,    setSelectedGoal]    = useState<string | null>(null);
  const [selectedBedtime, setSelectedBedtime] = useState<string | null>(null);
  const [customWake,      setCustomWake]      = useState('');
  const [showCustomWake,  setShowCustomWake]  = useState(false);
  const [isFinishing,     setIsFinishing]     = useState(false);

  const scrollRef       = useRef<ScrollView>(null);
  const hasMountedFocus = useRef(false);
  const hasRedirected   = useRef(false);
  const hasGreeted      = useRef(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, h, onboarding] = await Promise.all([loadProfile(), loadWeekHistory(), loadOnboardingData()]);
      if (onboarding?.firstName) setUserName(onboarding.firstName);
      if (p && h && h.length > 0) { setProfile(p); setEnergyScore(computeInsights(h, p).energyScore); }
      else { const { history: mh, profile: mp } = getMockInsightsData(); setProfile(mp); setEnergyScore(computeInsights(mh, mp).energyScore); }
    })();
  }, []);

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

  // Greeting (coach mode)
  useEffect(() => {
    if (phase !== 'done' || hasGreeted.current) return;
    const t = setTimeout(() => { hasGreeted.current = true; injectMessage('How can I help you today?'); }, 500);
    return () => clearTimeout(t);
  }, [phase, injectMessage]);

  // ── Guided handlers ──────────────────────────────────────────────────────
  function handleWakePick(label: string, value: number | string) {
    if (value === -1) { setShowCustomWake(true); setSelectedWake(-1); return; }
    setShowCustomWake(false); setSelectedWake(value as number);
    setTimeout(() => setGuidedStep('goal'), 420);
    scrollRef.current?.scrollToEnd({ animated: true });
  }
  function confirmCustomWake() {
    const [hStr, mStr] = customWake.split(':');
    const h = parseInt(hStr ?? '7', 10); const m = parseInt(mStr ?? '0', 10);
    if (isNaN(h) || isNaN(m)) return;
    setSelectedWake(h * 60 + m); setShowCustomWake(false);
    setTimeout(() => setGuidedStep('goal'), 420);
  }
  function handleGoalPick(_l: string, value: number | string) {
    setSelectedGoal(value as string);
    setTimeout(() => setGuidedStep('bedtime'), 420);
    scrollRef.current?.scrollToEnd({ animated: true });
  }
  async function handleBedtimePick(_l: string, value: number | string) {
    setSelectedBedtime(value as string); setIsFinishing(true);
    scrollRef.current?.scrollToEnd({ animated: true });
    await saveOnboardingData({ firstName: userName ?? '', wakeTimeMinutes: selectedWake ?? 450, priority: selectedGoal ?? 'recovery', constraint: value as string });
    setTimeout(() => advance('plan'), 1000);
  }

  // ── Coach send ────────────────────────────────────────────────────────────
  function send(text?: string) {
    const txt = (text ?? input).trim();
    if (!txt || isStreaming) return;
    setInput('');
    void sendMessage(txt);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const isGuidedMode  = phase === 'guided_chat';
  const canSend       = input.trim().length > 0 && !isStreaming;
  const bedtime       = dayPlan?.cycleWindow?.bedtime  ?? null;
  const wakeTime      = dayPlan?.cycleWindow?.wakeTime ?? (profile?.anchorTime ?? null);
  const cycles        = profile?.idealCyclesPerNight;
  // Show segmented when chat has no user message yet
  const hasUserChat   = messages.some(m => m.role === 'user');
  const showSegmented = !hasUserChat && !isStreaming;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={sc.root}>
      <KeyboardAvoidingView style={sc.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ═══ GUIDED MODE ═══════════════════════════════════════════════════ */}
        {isGuidedMode ? (
          <SafeAreaView style={sc.flex} edges={['top', 'bottom']}>
            <ScrollView ref={scrollRef} style={sc.flex} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Intro */}
              <View style={sc.introSection}>
                <MascotImage emotion="encourageant" style={{ width: 68, height: 68, marginBottom: 16 }} />
                <Text style={sc.introTitle}>Hi! I'm R-Lo.</Text>
                <Text style={sc.introSub}>{"I'm your personal recovery coach.\nBefore we start, I need a few things\nto build your sleep rhythm."}</Text>
              </View>
              {/* Step 1 */}
              <SetupQuestion question="What time do you usually wake up?" options={WAKE_OPTS} onSelect={handleWakePick} selectedValue={selectedWake ?? undefined}
                customChild={showCustomWake ? (
                  <View style={sc.customRow}>
                    <TextInput style={sc.customInput} placeholder="HH:MM (e.g. 06:45)" placeholderTextColor={MUTED} value={customWake} onChangeText={setCustomWake} keyboardType="numbers-and-punctuation" autoFocus returnKeyType="done" onSubmitEditing={confirmCustomWake} />
                    <Pressable style={sc.customConfirm} onPress={confirmCustomWake}><Ionicons name="checkmark" size={18} color="#000" /></Pressable>
                  </View>
                ) : undefined} />
              {/* Step 2 */}
              {(guidedStep === 'goal' || guidedStep === 'bedtime' || guidedStep === 'done') && (
                <SetupQuestion question="What is your main goal?" options={GOAL_OPTS} onSelect={handleGoalPick} selectedValue={selectedGoal ?? undefined} />
              )}
              {/* Step 3 */}
              {(guidedStep === 'bedtime' || guidedStep === 'done') && (
                <SetupQuestion question="Do you usually go to sleep before midnight?" options={BEDTIME_OPTS} onSelect={handleBedtimePick} selectedValue={selectedBedtime ?? undefined} />
              )}
              {isFinishing && (
                <View style={sc.finishingWrap}>
                  <MascotImage emotion="celebration" style={{ width: 56, height: 56 }} />
                  <Text style={sc.finishingText}>Building your sleep rhythm…</Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>

        ) : (
        /* ═══ COACH MODE ════════════════════════════════════════════════════ */
          <>
            <ScrollView ref={scrollRef} style={sc.flex} contentContainerStyle={sc.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* 1. Immersive header */}
              <ImmersiveHeader name={userName} score={energyScore} topInset={insets.top} />

              {/* 2a. Segmented control + tabs (before chat) */}
              {showSegmented && (
                <>
                  <SegmentedControl active={activeTab} onChange={setActiveTab} />
                  <CoachCardCarousel
                    items={activeTab === 'suggestions' ? SUGGESTIONS : MODES}
                    onPress={send}
                    disabled={isStreaming}
                  />
                </>
              )}

              {/* 2b. Chat messages (after first user message) */}
              {!showSegmented && (
                <View style={sc.chatArea}>
                  {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
                  {isStreaming && <ThinkingDots />}
                </View>
              )}

              {/* Initial R-Lo bubble always visible */}
              {showSegmented && messages.length > 0 && (
                <View style={[sc.chatArea, { marginTop: 16 }]}>
                  {messages.slice(0, 1).map(m => <ChatBubble key={m.id} msg={m} />)}
                </View>
              )}

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* 3. Tonight widget — pinned above input */}
            <TonightWidget bedtime={bedtime} wake={wakeTime} cycles={cycles} />

            {/* 4. Chat input */}
            <View style={sc.composer}>
              <View style={sc.inputRow}>
                <View style={[sc.inputWrap, inputFocused && { borderColor: `${ACCENT}55`, borderWidth: 1 }]}>
                  <TextInput style={sc.input} placeholder="Message R-Lo…" placeholderTextColor={MUTED} value={input} onChangeText={setInput} onSubmitEditing={() => send()} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} returnKeyType="send" multiline maxLength={500} editable={!isStreaming} />
                </View>
                <Pressable style={[sc.sendBtn, { backgroundColor: canSend ? ACCENT : SURFACE2 }]} onPress={() => send()} disabled={!canSend}>
                  <Ionicons name="arrow-up" size={18} color={canSend ? '#000' : MUTED} />
                </Pressable>
              </View>
              <View style={{ height: insets.bottom }} />
            </View>
          </>
        )}

      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:  { flex: 1, backgroundColor: BG },
  flex:  { flex: 1 },
  scroll:{ paddingBottom: 8 },

  chatArea: { paddingHorizontal: 16, paddingTop: 8, gap: 6 },

  composer:  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER, backgroundColor: BG },
  inputRow:  { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8 },
  inputWrap: { flex: 1, backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: 'transparent' },
  input:     { paddingHorizontal: 18, paddingVertical: 11, fontSize: 15, maxHeight: 120, color: TEXT, lineHeight: 22 },
  sendBtn:   { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Guided
  introSection:  { alignItems: 'center', paddingTop: 40, paddingBottom: 32, paddingHorizontal: 24 },
  introTitle:    { fontSize: 28, fontWeight: '800', color: TEXT, marginBottom: 12, textAlign: 'center' },
  introSub:      { fontSize: 16, color: SUB, lineHeight: 26, textAlign: 'center' },
  customRow:     { flexDirection: 'row', gap: 10, alignItems: 'center' },
  customInput:   { flex: 1, backgroundColor: SURFACE2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: TEXT, borderWidth: 1, borderColor: `${ACCENT}50` },
  customConfirm: { width: 48, height: 48, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  finishingWrap: { alignItems: 'center', paddingVertical: 28, gap: 14 },
  finishingText: { fontSize: 16, fontWeight: '600', color: SUCCESS },
});
