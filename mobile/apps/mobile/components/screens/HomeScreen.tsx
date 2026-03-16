/**
 * HomeScreen — Coach-first layout
 *
 * GUIDED MODE (phase = 'guided_chat'):
 *   Setup conversation: wake → goal → bedtime habit
 *
 * COACH MODE (phase = 'done'):
 *   1. Header (38%)    — mountain image + sleep plan label (top-left) + R-Lo + greeting
 *   2. Chat area       — R-Lo bubble + conversation messages
 *   3. Input bar       — sticky, always visible
 *   4. Toggle          — [Suggestions] [Modes] compact pill buttons
 *   5. Expandable panel— slides up when tapped, horizontal carousel inside
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Modal,
  Animated, Dimensions, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect }        from 'expo-router';
import { Ionicons }                         from '@expo/vector-icons';
import { LinearGradient }                   from 'expo-linear-gradient';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDayPlanContext }       from '../../lib/day-plan-context';
import { getUpcomingEvents, getLatestWeeklyReport, type CalendarEventResponse } from '../../lib/api';
import { useOnboardingPhase }      from '../../lib/onboarding-phase-context';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro,
  loadOnboardingData, saveOnboardingData,
} from '../../lib/storage';
import { useChat, type ChatMessage } from '../../lib/use-chat';
import { MascotImage }             from '../ui/MascotImage';
import { Video, ResizeMode }        from 'expo-av';
import { computeInsights }         from '../../lib/insights';
import { getMockInsightsData }     from '../../lib/mock-insights-data';
import type { UserProfile }        from '@r90/types';
import { usePager }                from '../../lib/pager-context';

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
const HEADER_H   = Math.round(SCREEN_H * 0.38);
// (panel removed — replaced by SmartCarousel)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMin(m: number): string {
  const safe = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function coachGreeting(name: string | null, score: number) {
  const h = new Date().getHours();
  const period = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return {
    line1: name ? `Good ${period}, ${name}` : `Good ${period}`,
    line2: score >= 80 ? 'Your recovery looks strong today.'
         : score >= 65 ? 'Your rhythm is building nicely.'
         : score >= 50 ? 'Stay consistent — tonight matters.'
         : "Let's plan tonight carefully.",
  };
}

// ─── Smart cards data ────────────────────────────────────────────────────────

type SmartCard = { icon: string; color: string; label: string; prompt: string };

const CARDS_MORNING: SmartCard[] = [
  { icon: 'partly-sunny-outline', color: '#FACC15', label: 'How did you sleep?',  prompt: 'How did I sleep last night based on my data?' },
  { icon: 'stats-chart-outline',  color: '#4DA3FF', label: 'See your score',      prompt: 'What is my sleep score today and what does it mean?' },
  { icon: 'hourglass-outline',    color: '#F87171', label: 'Sleep debt update',   prompt: 'How much sleep debt do I have and how can I recover?' },
  { icon: 'flash-outline',        color: '#3DDC97', label: 'Energy forecast',     prompt: 'How will my energy levels look throughout the day?' },
  { icon: 'cafe-outline',         color: '#F5A623', label: 'Caffeine window',     prompt: 'What is the best time for caffeine today based on my schedule?' },
];

const CARDS_EVENING: SmartCard[] = [
  { icon: 'moon-outline',         color: '#9B59B6', label: 'Prepare tonight',     prompt: 'Help me prepare for tonight\'s sleep' },
  { icon: 'leaf-outline',         color: '#3DDC97', label: 'Wind-down routine',   prompt: 'What should my wind-down routine look like tonight?' },
  { icon: 'time-outline',         color: '#4DA3FF', label: 'Adjust bedtime',      prompt: 'Should I adjust my bedtime tonight?' },
  { icon: 'phone-portrait-outline',color: '#F5A623', label: 'Screen cutoff',      prompt: 'When should I stop using screens tonight?' },
  { icon: 'thermometer-outline',  color: '#F87171', label: 'Room setup',          prompt: 'How should I set up my room for optimal sleep tonight?' },
];

const CARDS_BAD_NIGHT: SmartCard[] = [
  { icon: 'medkit-outline',       color: '#F87171', label: 'Recovery plan',       prompt: 'I had a bad night. What is the best recovery plan for today?' },
  { icon: 'bed-outline',          color: '#F5A623', label: 'I slept late',        prompt: 'I slept much later than usual last night. How do I adjust?' },
  { icon: 'sunny-outline',        color: '#FACC15', label: 'Nap calculator',      prompt: 'Should I nap today? If so, when and for how long?' },
  { icon: 'trending-up-outline',  color: '#4DA3FF', label: 'Get back on track',   prompt: 'How do I get back on my sleep schedule after a bad night?' },
  { icon: 'cafe-outline',         color: '#9B59B6', label: 'Manage fatigue',      prompt: 'How do I manage fatigue today after a rough night?' },
];

const CARDS_DEFAULT: SmartCard[] = [
  { icon: 'stats-chart-outline',  color: '#4DA3FF', label: 'My week in review',   prompt: 'How am I doing this week overall?' },
  { icon: 'moon-outline',         color: '#9B59B6', label: 'Prepare tonight',     prompt: 'Help me plan my sleep for tonight' },
  { icon: 'airplane-outline',     color: '#3DDC97', label: 'Jet lag recovery',    prompt: 'Help me recover from jet lag' },
  { icon: 'refresh-outline',      color: '#F5A623', label: 'Adjust my rhythm',    prompt: 'Help me recalibrate my sleep rhythm' },
  { icon: 'flash-outline',        color: '#F87171', label: 'Improve recovery',    prompt: 'How can I improve my recovery?' },
  { icon: 'book-outline',         color: '#6B7F99', label: 'Optimize for focus',  prompt: 'How can I optimize my sleep for better focus and learning?' },
];

function getSmartCards(hour: number, lastCycles: number | null): SmartCard[] {
  if (lastCycles !== null && lastCycles < 3) return CARDS_BAD_NIGHT;
  if (hour >= 5 && hour < 13)              return CARDS_MORNING;
  if (hour >= 19)                          return CARDS_EVENING;
  return CARDS_DEFAULT;
}

// ─── SmartCarousel ────────────────────────────────────────────────────────────

function SmartCarousel({ onPress, disabled, lastCycles }: {
  onPress:    (prompt: string) => void;
  disabled?:  boolean;
  lastCycles: number | null;
}) {
  const hour  = new Date().getHours();
  const cards = getSmartCards(hour, lastCycles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={sm.scroll}
      decelerationRate="fast"
    >
      {cards.map(card => (
        <Pressable
          key={card.label}
          style={({ pressed }) => [sm.card, (pressed || disabled) && { opacity: 0.65 }]}
          onPress={() => onPress(card.prompt)}
          disabled={disabled}
        >
          <View style={[sm.iconWrap, { backgroundColor: `${card.color}18`, borderColor: `${card.color}30` }]}>
            <Ionicons name={card.icon as any} size={16} color={card.color} />
          </View>
          <Text style={sm.label} numberOfLines={2}>{card.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const sm = StyleSheet.create({
  scroll:   { paddingHorizontal: 14, paddingVertical: 8, gap: 8, alignItems: 'flex-start' },
  card:     {
    width:             104,
    backgroundColor:   CARD,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.08)',
    paddingVertical:   8,
    paddingHorizontal: 9,
    gap:               5,
    alignItems:        'flex-start',
    alignSelf:         'flex-start',
  },
  iconWrap: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label:    { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.88)', lineHeight: 14 },
});

// Guided
const WAKE_OPTS = [
  { label: '06:00', value: 360 }, { label: '06:30', value: 390 },
  { label: '07:00', value: 420 }, { label: '07:30', value: 450 },
  { label: '08:00', value: 480 }, { label: 'Custom', value: -1 },
];
const GOAL_OPTS = [
  { label: 'Better recovery',       value: 'recovery' },
  { label: 'More energy',           value: 'energy' },
  { label: 'Fix my sleep schedule', value: 'sleep_speed' },
  { label: 'Reduce fatigue',        value: 'consistency' },
];
const BEDTIME_OPTS = [
  { label: 'Usually',   value: 'before_midnight' },
  { label: 'Sometimes', value: 'sometimes' },
  { label: 'Rarely',    value: 'rarely' },
];
type GuidedStep = 'wake' | 'goal' | 'bedtime' | 'done';

// ─── Sub-components ───────────────────────────────────────────────────────────

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
        <View style={{ width: 26, height: 26, flexShrink: 0, alignSelf: 'flex-end' }}>
          <MascotImage emotion="rassurante" style={{ width: 26, height: 26 }} />
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
  row:         { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%', marginBottom: 4 },
  rowUser:     { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubble:      { backgroundColor: CARD, borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 11, paddingHorizontal: 15, flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 3 },
  bubbleUser:  { backgroundColor: ACCENT, borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  bubbleError: { backgroundColor: 'rgba(248,113,113,0.10)', borderWidth: 1, borderColor: '#F87171' },
  text:        { fontSize: 15, lineHeight: 23, color: TEXT },
  textUser:    { color: '#000' },
});

// ─── Top info bar (transparent, overlays the full-page video) ────────────────
function TopInfoBar({
  topInset, bedtime, wake, cycles, onPress,
}: {
  topInset: number;
  bedtime:  number | null;
  wake:     number | null;
  cycles:   number;
  onPress:  () => void;
}) {
  const hasPlan = bedtime !== null || wake !== null;
  if (!hasPlan) return null;

  return (
    <View style={[ih.topRow, { top: topInset + 14 }]}>
      <Pressable style={ih.pill} onPress={onPress}>
        {/* "Tonight" label */}
        <Text style={ih.pillSection}>Tonight</Text>
        <View style={ih.divider} />
        {/* Bed */}
        <Ionicons name="moon-outline" size={11} color="rgba(255,255,255,0.6)" />
        <Text style={ih.pillTime}>{bedtime !== null ? formatMin(bedtime) : '—'}</Text>
        <View style={ih.divider} />
        {/* Wake */}
        <Ionicons name="sunny-outline" size={12} color="rgba(255,255,255,0.6)" />
        <Text style={ih.pillTime}>{wake !== null ? formatMin(wake) : '—'}</Text>
        <View style={ih.divider} />
        {/* Cycles */}
        <Text style={ih.pillCycles}>{cycles} cycles</Text>
        {/* Chevron */}
        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.35)" style={{ marginLeft: 2 }} />
      </Pressable>
    </View>
  );
}
const ih = StyleSheet.create({
  topRow: {
    position:       'absolute',
    left:           16,
    right:          16,
    flexDirection:  'row',
    justifyContent: 'center',
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    backgroundColor:   'rgba(11,18,32,0.60)',
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.12)',
    gap:               7,
  },
  pillSection: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.4 },
  pillTime:    { fontSize: 13, fontWeight: '700', color: '#FFF' },
  pillCycles:  { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  divider:     { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
});

// ─── Expandable panel (Suggestions / Modes) ───────────────────────────────────




// ─── Guided sub-components ────────────────────────────────────────────────────
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

function SetupQuestion({ question, options, onSelect, selectedValue, customChild }: {
  question:      string;
  options:       { label: string; value: string | number }[];
  onSelect:      (l: string, v: string | number) => void;
  selectedValue?: string | number;
  customChild?:  React.ReactNode;
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
  const { goToPage }          = usePager();
  const insets                = useSafeAreaInsets();
  const { messages, isStreaming, isThinking, sendMessage, fetchGreeting, injectMessage } = useChat();

  const [input,          setInput]         = useState('');
  const [inputFocused,   setInputFocused]  = useState(false);
  const [chatExpanded,   setChatExpanded]  = useState(false);
  const [profile,        setProfile]       = useState<UserProfile | null>(null);
  const [energyScore,    setEnergyScore]   = useState(72);
  const [userName,       setUserName]      = useState<string | null>(null);

  // Calendar banner
  const [bannerEvent,    setBannerEvent]   = useState<CalendarEventResponse | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Weekly report banner
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportBannerDismissed, setReportBannerDismissed] = useState(false);

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

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, h, onboarding] = await Promise.all([loadProfile(), loadWeekHistory(), loadOnboardingData()]);
      if (onboarding?.firstName) setUserName(onboarding.firstName);
      if (p && h && h.length > 0) { setProfile(p); setEnergyScore(computeInsights(h, p).energyScore); }
      else { const { history: mh, profile: mp } = getMockInsightsData(); setProfile(mp); setEnergyScore(computeInsights(mh, mp).energyScore); }
    })();
  }, []);

  // Fetch upcoming calendar events for contextual banner
  useEffect(() => {
    if (phase !== 'done') return;
    (async () => {
      try {
        const res = await getUpcomingEvents(24);
        if (!res.ok || !res.data?.events) return;
        const dismissed = await AsyncStorage.getItem('@r90:dismissedBanners');
        const dismissedIds: string[] = dismissed ? JSON.parse(dismissed) : [];
        // Priority: travel > important
        const priority = res.data.events
          .filter(e => (e.event_type_hint === 'travel' || e.event_type_hint === 'important') && !dismissedIds.includes(e.id));
        const travel = priority.find(e => e.event_type_hint === 'travel');
        const important = priority.find(e => e.event_type_hint === 'important');
        setBannerEvent(travel ?? important ?? null);
      } catch {
        // Non-critical
      }
    })();
  }, [phase]);

  // Fetch weekly report banner (Monday only)
  useEffect(() => {
    if (phase !== 'done') return;
    const isMonday = new Date().getDay() === 1;
    if (!isMonday) return;
    (async () => {
      try {
        const res = await getLatestWeeklyReport();
        if (res.ok && res.data?.report) {
          const reportAge = Date.now() - new Date(res.data.report.generated_at).getTime();
          if (reportAge < 24 * 60 * 60 * 1000) {
            setReportContent(res.data.report.content);
          }
        }
      } catch {
        // Non-critical
      }
    })();
  }, [phase]);

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
    setChatExpanded(false); // collapse when new message arrives
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages]);

  // Check for pending chat context from proactive notification tap
  useEffect(() => {
    if (phase !== 'done') return;
    (async () => {
      try {
        const pending = await AsyncStorage.getItem('@r90:pendingChatContext');
        if (pending) {
          await AsyncStorage.removeItem('@r90:pendingChatContext');
          setInput(pending);
        }
      } catch {
        // Non-critical
      }
    })();
  }, [phase]);

  // Personalized greeting — R-Lo takes initiative
  useEffect(() => {
    if (phase !== 'done' || hasGreeted.current) return;
    hasGreeted.current = true;
    const t = setTimeout(() => { void fetchGreeting(); }, 600);
    return () => clearTimeout(t);
  }, [phase, fetchGreeting]);



  // ── Guided handlers ───────────────────────────────────────────────────────
  function handleWakePick(_l: string, value: number | string) {
    if (value === -1) { setShowCustomWake(true); setSelectedWake(-1); return; }
    setShowCustomWake(false); setSelectedWake(value as number);
    setTimeout(() => setGuidedStep('goal'), 420);
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
  }
  async function handleBedtimePick(_l: string, value: number | string) {
    setSelectedBedtime(value as string); setIsFinishing(true);
    await saveOnboardingData({ firstName: userName ?? '', wakeTimeMinutes: selectedWake ?? 450, priority: selectedGoal ?? 'recovery', constraint: value as string });
    setTimeout(() => advance('plan'), 1000);
  }

  // ── Banner dismiss ──────────────────────────────────────────────────────
  async function dismissBanner() {
    if (!bannerEvent) return;
    setBannerDismissed(true);
    try {
      const raw = await AsyncStorage.getItem('@r90:dismissedBanners');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      ids.push(bannerEvent.id);
      await AsyncStorage.setItem('@r90:dismissedBanners', JSON.stringify(ids));
    } catch {
      // Non-critical
    }
  }

  function handleBannerTap() {
    if (!bannerEvent) return;
    const prompt = bannerEvent.event_type_hint === 'travel'
      ? `J'ai ${bannerEvent.title} demain, comment optimiser ma nuit ?`
      : `J'ai ${bannerEvent.title} bientôt, comment me préparer ?`;
    setInput(prompt);
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  function send(text?: string) {
    const txt = (text ?? input).trim();
    if (!txt || isStreaming) return;
    setInput('');
    void sendMessage(txt);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isGuidedMode = phase === 'guided_chat';
  const canSend      = input.trim().length > 0 && !isStreaming;
  const bedtime      = dayPlan?.cycleWindow?.bedtime  ?? null;
  const wakeTime     = dayPlan?.cycleWindow?.wakeTime ?? (profile?.anchorTime ?? null);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={sc.root}>
      <KeyboardAvoidingView
        style={sc.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >

        {/* ══ GUIDED MODE ══════════════════════════════════════════════════ */}
        {isGuidedMode ? (
          <SafeAreaView style={sc.flex} edges={['top', 'bottom']}>
            <ScrollView
              ref={scrollRef}
              style={sc.flex}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={sc.introSection}>
                <MascotImage emotion="encourageant" style={{ width: 68, height: 68, marginBottom: 16 }} />
                <Text style={sc.introTitle}>Hi! I'm R-Lo.</Text>
                <Text style={sc.introSub}>{"I'm your personal recovery coach.\nBefore we start, I need a few things\nto build your sleep rhythm."}</Text>
              </View>
              <SetupQuestion question="What time do you usually wake up?" options={WAKE_OPTS} onSelect={handleWakePick} selectedValue={selectedWake ?? undefined}
                customChild={showCustomWake ? (
                  <View style={sc.customRow}>
                    <TextInput style={sc.customInput} placeholder="HH:MM (e.g. 06:45)" placeholderTextColor={MUTED} value={customWake} onChangeText={setCustomWake} keyboardType="numbers-and-punctuation" autoFocus returnKeyType="done" onSubmitEditing={confirmCustomWake} />
                    <Pressable style={sc.customConfirm} onPress={confirmCustomWake}><Ionicons name="checkmark" size={18} color="#000" /></Pressable>
                  </View>
                ) : undefined} />
              {(guidedStep === 'goal' || guidedStep === 'bedtime' || guidedStep === 'done') && (
                <SetupQuestion question="What is your main goal?" options={GOAL_OPTS} onSelect={handleGoalPick} selectedValue={selectedGoal ?? undefined} />
              )}
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
        /* ══ COACH MODE ══════════════════════════════════════════════════════ */
          <View style={sc.flex}>

            {/* Full-page background video */}
            <Video
              source={require('../../assets/header-animation.mp4')}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
              useNativeControls={false}
            />
            {/* Gradient overlay — subtle, keeps text readable without killing the video */}
            <LinearGradient
              colors={['rgba(11,18,32,0.10)', 'rgba(11,18,32,0.25)', 'rgba(11,18,32,0.55)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* Top info bar */}
            <TopInfoBar
              topInset={insets.top}
              bedtime={bedtime}
              wake={wakeTime}
              cycles={profile?.idealCyclesPerNight ?? 5}
              onPress={() => goToPage(2)}
            />

            {/* Calendar event banner */}
            {bannerEvent && !bannerDismissed && (
              <Pressable style={bn.wrap} onPress={handleBannerTap}>
                <View style={bn.content}>
                  <Text style={bn.text}>
                    {bannerEvent.event_type_hint === 'travel'
                      ? `✈️ ${bannerEvent.title} — ${new Date(bannerEvent.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Your bedtime tonight is critical.`
                      : `⭐ ${bannerEvent.title} — ${new Date(bannerEvent.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. R-Lo has advice for you.`
                    }
                  </Text>
                  <Pressable onPress={dismissBanner} hitSlop={8}>
                    <Ionicons name="close" size={16} color={MUTED} />
                  </Pressable>
                </View>
              </Pressable>
            )}

            {/* Weekly report banner */}
            {reportContent && !reportBannerDismissed && (
              <Pressable style={bn.wrap} onPress={() => setShowReportModal(true)}>
                <View style={bn.content}>
                  <Text style={bn.text}>{'📊 Your weekly sleep report is ready. Tap to read.'}</Text>
                  <Pressable onPress={() => setReportBannerDismissed(true)} hitSlop={8}>
                    <Ionicons name="close" size={16} color={MUTED} />
                  </Pressable>
                </View>
              </Pressable>
            )}

            {/* Weekly report modal */}
            <Modal visible={showReportModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowReportModal(false)}>
              <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: TEXT }}>Weekly Report</Text>
                  <Pressable onPress={() => setShowReportModal(false)} style={{ padding: 6, borderRadius: 20, backgroundColor: SURFACE2 }}>
                    <Ionicons name="close" size={20} color={SUB} />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                  <Text style={{ fontSize: 15, color: TEXT, lineHeight: 24 }}>{reportContent}</Text>
                </ScrollView>
              </SafeAreaView>
            </Modal>

            {/* 2. Chat area */}
            <ScrollView
              ref={scrollRef}
              style={sc.flex}
              contentContainerStyle={sc.chatContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={chatExpanded}
              onScrollEndDrag={e => {
                // auto-collapse when scrolled back to bottom
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 20) {
                  setChatExpanded(false);
                }
              }}
            >
              {/* Fade overlay tap zone (collapsed mode) */}
              {!chatExpanded && messages.length > 2 && (
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setChatExpanded(true)}
                />
              )}

              {messages.map((m, i) => {
                const fromEnd = messages.length - 1 - i;
                let opacity = 1;
                if (!chatExpanded) {
                  if (fromEnd <= 1)      opacity = 1.0;
                  else if (fromEnd === 2) opacity = 0.45;
                  else if (fromEnd === 3) opacity = 0.20;
                  else                   opacity = 0.07;
                }
                return (
                  <Animated.View key={m.id} style={{ opacity }}>
                    <ChatBubble msg={m} />
                  </Animated.View>
                );
              })}

              {isThinking && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%', marginBottom: 4 }}>
                  <View style={{ width: 26, height: 26, flexShrink: 0, alignSelf: 'flex-end' }}>
                    <MascotImage emotion="Reflexion" style={{ width: 26, height: 26 }} />
                  </View>
                  <View style={{ backgroundColor: SURFACE2, borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 11, paddingHorizontal: 15 }}>
                    <Text style={{ fontSize: 13, color: MUTED }}>R-Lo is checking your data…</Text>
                    <ThinkingDots />
                  </View>
                </View>
              )}
              {isStreaming && !isThinking && messages[messages.length - 1]?.role === 'user' && <ThinkingDots />}
            </ScrollView>

            {/* Expand / collapse indicator */}
            {messages.length > 2 && (
              <Pressable
                style={sc.chatToggle}
                onPress={() => setChatExpanded(v => !v)}
              >
                <Ionicons
                  name={chatExpanded ? 'chevron-down' : 'chevron-up'}
                  size={14}
                  color="rgba(255,255,255,0.4)"
                />
              </Pressable>
            )}

            {/* Smart cards carousel — always visible above input */}
            <SmartCarousel
              onPress={send}
              disabled={isStreaming}
              lastCycles={dayPlan?.readiness?.recentCycles?.[0] ?? null}
            />

            {/* 3. Input bar */}
            <View style={[sc.composer, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER }]}>
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
                <Pressable
                  style={[sc.sendBtn, { backgroundColor: canSend ? ACCENT : SURFACE2 }]}
                  onPress={() => send()}
                  disabled={!canSend}
                >
                  <Ionicons name="arrow-up" size={18} color={canSend ? '#000' : MUTED} />
                </Pressable>
              </View>
              <View style={{ height: insets.bottom || 8 }} />
            </View>

          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  coachRoot:   { flex: 1 },
  flex:        { flex: 1 },
  chatContent: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 4 },
  chatToggle:  { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 16, marginBottom: 2 },

  composer:    { backgroundColor: 'transparent' },
  inputRow:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8 },
  inputWrap:   { flex: 1, backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: 'transparent' },
  input:       { paddingHorizontal: 18, paddingVertical: 11, fontSize: 15, maxHeight: 120, color: TEXT, lineHeight: 22 },
  sendBtn:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

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

const bn = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop:        8,
    backgroundColor:  CARD,
    borderRadius:     12,
    borderLeftWidth:  3,
    borderLeftColor:  ACCENT,
    padding:          12,
  },
  content: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
  },
  text: {
    flex:       1,
    fontSize:   13,
    color:      TEXT,
    lineHeight: 19,
  },
});
