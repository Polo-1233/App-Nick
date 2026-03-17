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
  Animated, Dimensions, Image, useWindowDimensions,
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
import { Analytics }               from '../../lib/analytics';
import { getMockInsightsData }     from '../../lib/mock-insights-data';
import type { UserProfile }        from '@r90/types';
import { usePager }                from '../../lib/pager-context';
import { useTour }                 from '../../lib/tour-context';

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

const CARDS_PER_PAGE = 3;
const CARD_GAP       = 8;
const CAROUSEL_H_PAD = 14;

const ONBOARDING_START_CARDS: SmartCard[] = [
  { icon: 'arrow-forward-outline', color: '#33C8E8', label: "Let's start", prompt: 'start' },
];
const ONBOARDING_WAKE_CARDS: SmartCard[] = [
  { icon: 'sunny-outline', color: '#FACC15', label: '5–6 AM', prompt: '5:30' },
  { icon: 'sunny-outline', color: '#FACC15', label: '6–7 AM', prompt: '6:30' },
  { icon: 'sunny-outline', color: '#4DA3FF', label: '7–8 AM', prompt: '7:30' },
  { icon: 'sunny-outline', color: '#4DA3FF', label: '8–9 AM', prompt: '8:30' },
  { icon: 'moon-outline',  color: '#9B59B6', label: '9+ AM',  prompt: '9:30' },
];
const ONBOARDING_GOAL_CARDS: SmartCard[] = [
  { icon: 'flash-outline',   color: '#FACC15', label: 'Wake up with more energy',     prompt: 'Wake up with more energy' },
  { icon: 'moon-outline',    color: '#4DA3FF', label: 'Fall asleep faster',           prompt: 'Fall asleep faster' },
  { icon: 'refresh-outline', color: '#3DDC97', label: 'Fix my sleep schedule',        prompt: 'Fix my sleep schedule' },
  { icon: 'barbell-outline', color: '#F87171', label: 'Recover better from training', prompt: 'Recover better from training' },
];
const ONBOARDING_DURATION_CARDS: SmartCard[] = [
  { icon: 'time-outline', color: '#F87171', label: 'Less than 6h', prompt: 'Less than 6 hours' },
  { icon: 'time-outline', color: '#FACC15', label: '6–7 hours',    prompt: '6–7 hours' },
  { icon: 'time-outline', color: '#3DDC97', label: '7–8 hours',    prompt: '7–8 hours' },
  { icon: 'time-outline', color: '#4DA3FF', label: '8–9 hours',    prompt: '8–9 hours' },
  { icon: 'time-outline', color: '#9B59B6', label: 'More than 9h', prompt: 'More than 9 hours' },
];
const ONBOARDING_ISSUE_CARDS: SmartCard[] = [
  { icon: 'moon-outline',         color: '#9B59B6', label: 'Fall asleep late',       prompt: 'I fall asleep late' },
  { icon: 'alert-outline',        color: '#FACC15', label: 'Wake up at night',       prompt: 'I wake up during the night' },
  { icon: 'battery-dead-outline', color: '#F87171', label: 'Wake up tired',          prompt: 'I wake up tired' },
  { icon: 'shuffle-outline',      color: '#4DA3FF', label: 'Schedule changes a lot', prompt: 'My schedule changes a lot' },
];
const ONBOARDING_TRAINING_CARDS: SmartCard[] = [
  { icon: 'close-circle-outline', color: '#6B7F99', label: 'No exercise',      prompt: 'No' },
  { icon: 'walk-outline',         color: '#FACC15', label: '1–2x per week',    prompt: '1–2 times per week' },
  { icon: 'fitness-outline',      color: '#4DA3FF', label: '3–4x per week',    prompt: '3–4 times per week' },
  { icon: 'flame-outline',        color: '#F87171', label: 'Almost every day', prompt: 'Almost every day' },
];
const ONBOARDING_CHRONOTYPE_CARDS: SmartCard[] = [
  { icon: 'sunny-outline',        color: '#FACC15', label: 'Morning',    prompt: 'Morning' },
  { icon: 'cloudy-outline',       color: '#4DA3FF', label: 'Afternoon',  prompt: 'Afternoon' },
  { icon: 'partly-sunny-outline', color: '#F97316', label: 'Evening',    prompt: 'Evening' },
  { icon: 'moon-outline',         color: '#9B59B6', label: 'Late night', prompt: 'Late night' },
];
const ONBOARDING_DEVICE_CARDS: SmartCard[] = [
  { icon: 'watch-outline',   color: '#E5E7EB', label: 'Apple Watch', prompt: 'Apple Watch' },
  { icon: 'radio-outline',   color: '#3DDC97', label: 'Oura Ring',   prompt: 'Oura Ring' },
  { icon: 'pulse-outline',   color: '#F87171', label: 'Whoop',       prompt: 'Whoop' },
  { icon: 'fitness-outline', color: '#4DA3FF', label: 'Garmin',      prompt: 'Garmin' },
  { icon: 'close-outline',   color: '#6B7F99', label: 'No device',   prompt: 'No device' },
];
const ONBOARDING_SUMMARY_CARDS: SmartCard[] = [
  { icon: 'arrow-forward-outline', color: '#33C8E8', label: 'Start coaching', prompt: 'start_coaching' },
];

// ─── SeamlessVideo — dual-buffer crossfade to eliminate loop black frame ──────

function SeamlessVideo({ source }: { source: number }) {
  const refA    = useRef<Video>(null);
  const refB    = useRef<Video>(null);
  const opacityA = useRef(new Animated.Value(1)).current;
  const opacityB = useRef(new Animated.Value(0)).current;
  const active  = useRef<'A' | 'B'>('A');

  function crossfade() {
    const isA = active.current === 'A';
    const fadeIn  = isA ? opacityB : opacityA;
    const fadeOut = isA ? opacityA : opacityB;
    const nextRef = isA ? refB : refA;

    // Pre-load next video from start
    nextRef.current?.setPositionAsync(0).catch(() => null);
    nextRef.current?.playAsync().catch(() => null);

    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeOut, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      active.current = isA ? 'B' : 'A';
    });
  }

  function handleStatus(status: any) {
    if (!status.isLoaded) return;
    if (status.durationMillis && status.positionMillis >= status.durationMillis - 500) {
      crossfade();
    }
  }

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityA }]}>
        <Video
          ref={refA}
          source={source}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping={false}
          isMuted
          useNativeControls={false}
          onPlaybackStatusUpdate={handleStatus}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityB }]}>
        <Video
          ref={refB}
          source={source}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
          isLooping={false}
          isMuted
          useNativeControls={false}
        />
      </Animated.View>
    </>
  );
}

// ─── SmartCarousel ────────────────────────────────────────────────────────────

function SmartCarousel({ onPress, disabled, lastCycles, onboardingStep, isTour }: {
  onPress:        (prompt: string) => void;
  disabled?:      boolean;
  lastCycles:     number | null;
  onboardingStep: string;
  isTour?:        boolean;
}) {
  const { width: screenW }         = useWindowDimensions();
  const { setScrollLocked }        = usePager();
  const cardW  = Math.floor((screenW - CAROUSEL_H_PAD * 2 - CARD_GAP * (CARDS_PER_PAGE - 1)) / CARDS_PER_PAGE);
  const snapW  = cardW + CARD_GAP;

  // Hooks TOUJOURS en premier (règle des hooks React)
  const scrollRef       = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  // greeting + name steps → no cards (après les hooks)
  if (onboardingStep === 'greeting' || onboardingStep === 'name') return null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void ONBOARDING_START_CARDS; // référence pour éviter l'erreur unused

  let cards: SmartCard[];
  if      (onboardingStep === 'wake')           cards = ONBOARDING_WAKE_CARDS;
  else if (onboardingStep === 'goal')           cards = ONBOARDING_GOAL_CARDS;
  else if (onboardingStep === 'sleep_duration') cards = ONBOARDING_DURATION_CARDS;
  else if (onboardingStep === 'sleep_issue')    cards = ONBOARDING_ISSUE_CARDS;
  else if (onboardingStep === 'training')       cards = ONBOARDING_TRAINING_CARDS;
  else if (onboardingStep === 'chronotype')     cards = ONBOARDING_CHRONOTYPE_CARDS;
  else if (onboardingStep === 'device')         cards = ONBOARDING_DEVICE_CARDS;
  else if (onboardingStep === 'summary')        cards = ONBOARDING_SUMMARY_CARDS;
  else if (isTour) {
    // Tour mode: single "Got it" card to skip the tour
    cards = [{ icon: 'checkmark-circle-outline', color: '#4DA3FF', label: 'Got it!', prompt: '__TOUR_SKIP__' }];
  }
  else {
    const hour = new Date().getHours();
    cards = getSmartCards(hour, lastCycles);
  }
  const total  = cards.length;
  const pages  = Math.ceil(total / CARDS_PER_PAGE);

  function handleScroll(e: { nativeEvent: { contentOffset: { x: number } } }) {
    const x       = e.nativeEvent.contentOffset.x;
    const newPage = Math.round(x / (snapW * CARDS_PER_PAGE));
    setPage(Math.max(0, Math.min(newPage, pages - 1)));
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[sm.scroll, { paddingHorizontal: CAROUSEL_H_PAD }]}
        decelerationRate="fast"
        snapToInterval={snapW * CARDS_PER_PAGE}
        snapToAlignment="start"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        directionalLockEnabled={true}
        onScrollBeginDrag={() => setScrollLocked(true)}
        onScrollEndDrag={() => setScrollLocked(false)}
        onMomentumScrollEnd={() => setScrollLocked(false)}
      >
        {cards.map((card, i) => (
          <Pressable
            key={card.label}
            style={({ pressed }) => [
              sm.card,
              { width: cardW, marginRight: i < total - 1 ? CARD_GAP : 0 },
              (pressed || disabled) && { opacity: 0.65 },
            ]}
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

      {pages > 1 && (
        <View style={sm.dots}>
          {Array.from({ length: pages }).map((_, i) => (
            <View key={i} style={[sm.dot, i === page && sm.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const sm = StyleSheet.create({
  scroll:    { paddingTop: 8, paddingBottom: 2, gap: 0 },
  card:      {
    backgroundColor:   CARD,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.08)',
    paddingVertical:   8,
    paddingHorizontal: 9,
    gap:               5,
    alignItems:        'flex-start',
  },
  iconWrap:  { width: 26, height: 26, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label:     { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.88)', lineHeight: 14 },
  dots:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: 4 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotActive: { backgroundColor: 'rgba(255,255,255,0.65)', width: 14, borderRadius: 3 },
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
// ─── Header pill helpers ──────────────────────────────────────────────────────

const ZONE_COLOR: Record<string, string> = {
  green:  '#4ADE80',
  yellow: '#FACC15',
  orange: '#F97171',
};
const ZONE_LABEL: Record<string, string> = {
  green:  'Rested',
  yellow: 'Getting there',
  orange: 'Tired',
};

function nextAction(bedtime: number | null, wake: number | null, nowMin: number): string {
  const preSleep = bedtime !== null ? ((bedtime - 90) + 1440) % 1440 : null;

  // Morning: up to 4h after wake → "Wake up on time ✓"
  if (wake !== null) {
    const mornEnd = (wake + 240) % 1440;
    if (nowMin >= wake && nowMin < mornEnd) return 'Wake up on time ✓';
  }

  // Bedtime very soon (< 30 min)
  if (bedtime !== null) {
    const diff = ((bedtime - nowMin) + 1440) % 1440;
    if (diff <= 30 && diff > 0) return `Lights out in ${diff}m`;
  }

  // Wind-down now / soon (within 3h before pre-sleep)
  if (preSleep !== null) {
    const diff = ((preSleep - nowMin) + 1440) % 1440;
    if (diff > 1350) return 'Start wind-down';
    if (diff === 0)  return 'Start wind-down';
    if (diff <= 180) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return h > 0
        ? `Wind-down in ${h}h${m > 0 ? ` ${m}m` : ''}`
        : `Wind-down in ${m}m`;
    }
  }

  // Bedtime approaching (90 min window)
  if (bedtime !== null) {
    const diff = ((bedtime - nowMin) + 1440) % 1440;
    if (diff <= 90) {
      return `Bedtime in ${diff}m`;
    }
  }

  // Afternoon
  const h = Math.floor(nowMin / 60);
  if (h >= 13 && h < 17) return 'Afternoon — nap window';

  return bedtime !== null ? `Bed at ${formatMin(bedtime)}` : 'View plan';
}

// ─── Mock fallback (dev / no backend) ────────────────────────────────────────
// ─── Onboarding header pill ───────────────────────────────────────────────────

const ONBOARDING_STEPS = ['name', 'wake', 'goal'];

function OnboardingPill({
  topInset,
  step,
  data,
}: {
  topInset: number;
  step:     string;
  data:     { name: string; wakeLabel: string; goal: string; sleep_duration: string };
}) {
    // Step progress — greeting/name = 0 dots filled, rest = incremental
  const stepIdx = ONBOARDING_STEPS.indexOf(step);
  const progress = (step === 'greeting' || step === 'name') ? 0
                 : stepIdx >= 0 ? stepIdx + 1 : ONBOARDING_STEPS.length;
  const total    = ONBOARDING_STEPS.length;

  // Build a dynamic summary of what's been collected so far
  const parts: string[] = [];
  if (data.name)           parts.push(data.name);
  if (data.wakeLabel && step !== 'wake') parts.push(`Wake ${data.wakeLabel}`);
  if (data.goal && !['wake','goal'].includes(step)) {
    const goalLabel: Record<string, string> = {
      energy:      'More energy',
      sleep_speed: 'Fall asleep faster',
      consistency: 'Better schedule',
      recovery:    'Better recovery',
    };
    parts.push(goalLabel[data.goal] ?? data.goal);
  }

  const label = (step === 'greeting' || step === 'name')
    ? 'Let\'s get started'
    : parts.length > 0
      ? parts.join(' · ')
      : 'Building your sleep plan';

  return (
    <View style={[ih.topRow, { top: topInset + 14 }]}>
      <View style={ih.pill}>
        {/* Progress dots */}
        <View style={op.dotsRow}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[op.dot, i < progress && op.dotFilled]}
            />
          ))}
        </View>
        <View style={ih.divider} />
        <Text style={ih.pillAction} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

const op = StyleSheet.create({
  dotsRow:   { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotFilled: { backgroundColor: '#4DA3FF' },
});

const MOCK_PILL = {
  zone:         'green' as const,
  recentCycles: [5, 4, 5],
  targetCycles: 5,
  bedtime:      1410, // 23:30
  wake:         450,  // 07:30
};

function TopInfoBar({
  topInset, zone, recentCycles, targetCycles, bedtime, wake, onPress,
}: {
  topInset:      number;
  zone:          string | null;
  recentCycles:  number[];
  targetCycles:  number;
  bedtime:       number | null;
  wake:          number | null;
  onPress:       () => void;
}) {
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const action = nextAction(bedtime, wake, nowMin);

  const zColor = zone ? (ZONE_COLOR[zone] ?? '#9CA3AF') : '#9CA3AF';
  const zLabel = zone ? (ZONE_LABEL[zone] ?? zone) : '—';

  // Convert avg cycles → hours (1 cycle = 90 min)
  const avgCycles = recentCycles.length > 0
    ? recentCycles.reduce((a, b) => a + b, 0) / recentCycles.length
    : null;
  const avgHours = avgCycles !== null
    ? `~${(avgCycles * 1.5).toFixed(1)}h avg`
    : null;

  return (
    <View style={[ih.topRow, { top: topInset + 14 }]}>
      <Pressable style={ih.pill} onPress={onPress}>
        {/* Zone dot + label */}
        <View style={[ih.zoneDot, { backgroundColor: zColor }]} />
        <Text style={[ih.zoneLabel, { color: zColor }]}>{zLabel}</Text>

        <View style={ih.divider} />

        {/* Avg sleep hours */}
        {avgHours !== null ? (
          <Text style={ih.pillAction}>{avgHours}</Text>
        ) : (
          <Text style={ih.pillMuted}>Log your sleep</Text>
        )}

        <View style={ih.divider} />

        {/* Dynamic next action */}
        <Text style={ih.pillAction}>{action}</Text>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.30)" style={{ marginLeft: 1 }} />
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
    backgroundColor:   'rgba(11,18,32,0.65)',
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.12)',
    gap:               7,
  },
  zoneDot:    { width: 7, height: 7, borderRadius: 4 },
  zoneLabel:  { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  pillSection:{ fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  pillBold:   { fontSize: 13, fontWeight: '800', color: '#FFF' },
  pillMuted:  { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  pillAction: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.80)' },
  divider:    { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
});

// ─── Expandable panel (Suggestions / Modes) ───────────────────────────────────




// ─── Guided sub-components ────────────────────────────────────────────────────

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { dayPlan, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { phase, advance }    = useOnboardingPhase();
  const router                = useRouter();
  const { goToPage }          = usePager();
  const insets                = useSafeAreaInsets();
  const { tourStep, startTour, advanceTour, skipTour } = useTour();
  const { messages, isStreaming, isThinking, sendMessage, fetchGreeting, injectMessage } = useChat();

  const [input,          setInput]         = useState('');
  const [inputFocused,   setInputFocused]  = useState(false);
  const [chatExpanded,   setChatExpanded]  = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<
    'greeting'|'name'|'wake'|'goal'|'sleep_duration'|'sleep_issue'|'training'|'chronotype'|'device'|'summary'|'done'
  >('done');
  const onboardingDataRef = useRef({
    name:           '',
    wakeMin:        450,
    wakeLabel:      '7:30',
    goal:           '',
    sleep_duration: '',
    sleep_issue:    '',
    training:       '',
    chronotype:     '',
    device:         '',
  });
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

  const scrollRef       = useRef<ScrollView>(null);
  const hasMountedFocus = useRef(false);
  const hasRedirected   = useRef(false);
  const hasGreeted      = useRef(false);
  const hasGreetedPhase = useRef<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, h, onboarding] = await Promise.all([loadProfile(), loadWeekHistory(), loadOnboardingData()]);
      if (onboarding?.firstName) setUserName(onboarding.firstName);
      if (p && h && h.length > 0) { setProfile(p); setEnergyScore(computeInsights(h, p).energyScore); }
      else { const { history: mh, profile: mp } = getMockInsightsData(); setProfile(mp); setEnergyScore(computeInsights(mh, mp).energyScore); }
    })();
  }, []);

  // ── Product tour messages ────────────────────────────────────────────────
  const hasTourInjected = useRef<number | null>(null);
  useEffect(() => {
    if (tourStep === null || hasTourInjected.current === tourStep) return;
    hasTourInjected.current = tourStep;

    const messages: Record<number, string> = {
      1: "Tap **Planning** to see tonight's sleep timeline — wind-down, ideal bedtime, latest bedtime and wake time.\n\nEverything is calculated around your anchor wake time.",
      2: "**Insights** tracks your weekly cycles and recovery trends.\n\nThe more data I have, the sharper the coaching gets.",
      3: "**Profile** stores your sleep plan, connected wearables and preferences.\n\nYou can update your anchor time or goals anytime.",
      4: "That's everything — you're all set. 🎯\n\nI'll be here whenever you need me. Tonight's wind-down starts at ${windDownTime}. Ready when you are.",
    };

    const windDownTime = profile
      ? (() => {
          const wake = profile.anchorTime;
          const cycles = profile.idealCyclesPerNight;
          const bedtime = ((wake - cycles * 90) + 1440) % 1440;
          const wd = ((bedtime - 90) + 1440) % 1440;
          const h = Math.floor(wd / 60);
          const m = wd % 60;
          return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        })()
      : 'your usual time';

    const text = (messages[tourStep] ?? '').replace('${windDownTime}', windDownTime);
    if (text) injectMessage(text);

    // Auto-advance (steps 1-3 highlight tabs for 4s; step 4 ends tour)
    if (tourStep >= 1 && tourStep <= 3) {
      const t = setTimeout(() => advanceTour(), 4000);
      return () => clearTimeout(t);
    }
    if (tourStep === 4) {
      const t = setTimeout(() => advanceTour(), 3000);
      return () => clearTimeout(t);
    }
  }, [tourStep, injectMessage, advanceTour, profile]);

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

  // Greeting — onboarding or personalized
  useEffect(() => {
    if (phase !== 'done' && phase !== 'guided_chat') return;
    // Allow re-greeting when phase changes (guided_chat → done after login)
    if (hasGreeted.current && hasGreetedPhase.current === phase) return;
    hasGreeted.current = true;
    hasGreetedPhase.current = phase;
    if (phase === 'guided_chat') {
      Analytics.onboardingStarted();
      setOnboardingStep('greeting');
      const t = setTimeout(() => {
        injectMessage("Hi, I'm R-Lo.\nYour personal sleep coach.");
        setTimeout(() => {
          setTimeout(() => {
            setOnboardingStep('name');
            injectMessage("What's your name?");
          }, 1200);
        }, 1000);
      }, 600);
      return () => clearTimeout(t);
    }
    // Greeting then tour
    const t = setTimeout(async () => {
      // First-time welcome message (once only, after onboarding complete)
      const welcomed = await AsyncStorage.getItem('@r90:welcomed');
      if (!welcomed) {
        await AsyncStorage.setItem('@r90:welcomed', '1');
        injectMessage("Welcome to your sleep HQ. 🌙\n\nThis is where we talk — ask me anything about your sleep, your plan, or how you're feeling. I'll check in with you here every day.");
        await new Promise(r => setTimeout(r, 2000));
      }
      await fetchGreeting();
      // Start tour after greeting loads (2.5s delay to let greeting finish streaming)
      setTimeout(() => { void startTour(); }, 2500);
    }, 600);
    return () => clearTimeout(t);
  }, [phase, fetchGreeting, injectMessage, startTour]);



  // ── Onboarding reply handler ─────────────────────────────────────────────
  function handleOnboardingReply(txt: string) {
    const step = onboardingStep;
    const d    = onboardingDataRef.current;

    if (step === 'name') {
      const name = txt.trim().split(' ')[0] || txt.trim();
      d.name = name;
      setUserName(name);
      Analytics.onboardingStepCompleted('name');
      setOnboardingStep('wake');
      setTimeout(() => {
        injectMessage(`Nice to meet you, ${name}.`);
        setTimeout(() => injectMessage("What time do you usually wake up?"), 1200);
      }, 400);

    } else if (step === 'wake') {
      const match = txt.match(/(\d{1,2})[h:.]?(\d{0,2})/);
      const h     = parseInt(match?.[1] ?? '7', 10);
      const m     = parseInt(match?.[2] || '0', 10);
      d.wakeMin   = h * 60 + (isNaN(m) ? 0 : m);
      d.wakeLabel = `${String(h).padStart(2, '0')}:${String(isNaN(m) ? 0 : m).padStart(2, '0')}`;
      Analytics.onboardingStepCompleted('wake', { wakeMin: d.wakeMin });
      setOnboardingStep('goal');
      setTimeout(() => injectMessage("What would you like to improve the most?"), 400);

    } else if (step === 'goal') {
      const lower = txt.toLowerCase();
      d.goal = lower.includes('energy')                          ? 'energy'
             : lower.includes('fall') || lower.includes('fast') ? 'sleep_speed'
             : lower.includes('fix')  || lower.includes('sch')  ? 'consistency'
             : 'recovery';
      Analytics.onboardingStepCompleted('goal', { goal: d.goal });
      setOnboardingStep('done');
      void saveOnboardingData({
        firstName:       d.name,
        wakeTimeMinutes: d.wakeMin,
        priority:        d.goal,
        constraint:      'before_midnight',
      }).then(() => {
        Analytics.onboardingCompleted();
        setTimeout(() => advance('plan'), 2000);
      });
    }
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
    // Tour skip card
    if (txt === '__TOUR_SKIP__') {
      skipTour();
      return;
    }
    if (isOnboarding) {
      injectMessage(txt, 'user'); // affiche le message de l'user dans le chat
      handleOnboardingReply(txt);
      return;
    }
    Analytics.chatMessageSent();
    void sendMessage(txt);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isOnboarding = phase === 'guided_chat';
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
        <View style={sc.flex}>

            {/* Full-page background image */}
            <Image
              source={require('../../assets/rlo-lac.png')}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            {/* Gradient overlay — pointerEvents none so header stays tappable */}
            <LinearGradient
              colors={['rgba(11,18,32,0.10)', 'rgba(11,18,32,0.25)', 'rgba(11,18,32,0.55)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Top info bar — different during onboarding */}
            {isOnboarding ? (
              <OnboardingPill
                topInset={insets.top}
                step={onboardingStep}
                data={onboardingDataRef.current}
              />
            ) : (
              <TopInfoBar
                topInset={insets.top}
                zone={dayPlan?.readiness?.zone ?? MOCK_PILL.zone}
                recentCycles={dayPlan?.readiness?.recentCycles ?? MOCK_PILL.recentCycles}
                targetCycles={profile?.idealCyclesPerNight ?? MOCK_PILL.targetCycles}
                bedtime={bedtime ?? MOCK_PILL.bedtime}
                wake={wakeTime ?? MOCK_PILL.wake}
                onPress={() => goToPage(2)}
              />
            )}

            {/* Calendar event banner — masqué pendant l'onboarding */}
            {!isOnboarding && bannerEvent && !bannerDismissed && (
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

            {/* Weekly report banner — masqué pendant l'onboarding */}
            {!isOnboarding && reportContent && !reportBannerDismissed && (
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
              scrollEnabled={true}
              onScroll={e => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                const fromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
                // Expand when user scrolls up
                if (fromBottom > 30 && !chatExpanded) {
                  setChatExpanded(true);
                }
                // Collapse when scrolled back to bottom
                if (fromBottom <= 10 && chatExpanded) {
                  setChatExpanded(false);
                }
              }}
              scrollEventThrottle={16}
            >

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

            {/* Bottom zone: carousel + input, glued together */}
            <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER }}>
              <SmartCarousel
                onPress={send}
                disabled={isStreaming}
                lastCycles={dayPlan?.readiness?.recentCycles?.[0] ?? null}
                onboardingStep={onboardingStep}
                isTour={tourStep !== null}
              />

            {/* 3. Input bar */}
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
            </View>{/* end bottom zone */}

        </View>
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
