/**
 * HomeScreen — Rhythm Interface
 *
 * Philosophy: "Where am I in my day? What should I do next?" in < 3 seconds.
 *
 * Sections:
 *   1. Header         — time + profile icon
 *   2. RhythmTimeline — ARP→Sleep horizontal bar, cycles, current position
 *   3. ActionCard     — single primary CTA (context-driven)
 *   4. RLoMessage     — 1-2 lines, tap → chat
 *   5. SecondaryCards — optional contextual cards (scrollable)
 *   6. SleepFooter    — "Tonight: 23:00" always visible
 *
 * Onboarding mode (phase === 'guided_chat'):
 *   Full-screen chat flow. Preserved from previous implementation.
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Animated, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect }       from 'expo-router';
import { Ionicons }                        from '@expo/vector-icons';
import { LinearGradient }                  from 'expo-linear-gradient';
import { Video, ResizeMode }              from 'expo-av';
import AsyncStorage                        from '@react-native-async-storage/async-storage';

import { useDayPlanContext }    from '../../lib/day-plan-context';
import { useOnboardingPhase }   from '../../lib/onboarding-phase-context';
import { useChat, type ChatMessage } from '../../lib/use-chat';
import { MascotImage }          from '../ui/MascotImage';
import { CircadianBackground }  from '../CircadianBackground';
import { Analytics }            from '../../lib/analytics';
import { usePager }             from '../../lib/pager-context';
import { useTour }              from '../../lib/tour-context';
import { RhythmTimeline }       from '../RhythmTimeline';
import { ActionCard }           from '../ActionCard';
import { RLoMessageBar }        from '../RLoMessageBar';
import { SleepFooter }          from '../SleepFooter';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro,
  loadOnboardingData, saveOnboardingData,
} from '../../lib/storage';
import { getUpcomingEvents, type CalendarEventResponse } from '../../lib/api';
import type { UserProfile, NextAction, TimeBlock } from '@r90/types';

// ─── Brand tokens ──────────────────────────────────────────────────────────────
const BG      = '#0a0a3a';
const CARD    = '#141466';
const SURFACE2= '#1c1c7a';
const ACCENT  = '#1c9fda';
const TEXT    = '#FFFFFF';
const SUB     = '#A8C4E0';
const MUTED   = '#6B8CAE';

function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// ─── Missed cycle detection ────────────────────────────────────────────────────
export interface MissedCycleInfo {
  missed:          boolean;
  nextWindow:      string;
  cyclesRemaining: number;
}

function getMissedCycleInfo(
  bedtime:    number | null,
  cycleCount: number,
  anchorTime: number | null,
): MissedCycleInfo | null {
  if (!bedtime || !anchorTime) return null;
  const now = nowMin();
  const bedtimeAdj = bedtime < anchorTime ? bedtime + 1440 : bedtime;
  const nowAdj     = now < anchorTime     ? now + 1440     : now;
  if (nowAdj <= bedtimeAdj) return null;
  const minutesPast  = nowAdj - bedtimeAdj;
  const cyclesMissed = Math.ceil(minutesPast / 90);
  const remaining    = cycleCount - cyclesMissed;
  if (remaining < 3) return null;
  const nextWindowMin = (bedtime + cyclesMissed * 90) % 1440;
  const h   = Math.floor(nextWindowMin / 60);
  const m   = nextWindowMin % 60;
  return { missed: true, nextWindow: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, cyclesRemaining: remaining };
}

// ─── HomeHeader (local — time + profile icon) ─────────────────────────────────
function HomeHeader({ topInset, onProfilePress }: { topInset: number; onProfilePress: () => void }) {
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  });
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: topInset + 12, paddingBottom: 10 }}>
      <Text style={{ fontSize: 17, fontWeight: '600', color: TEXT, letterSpacing: 0.3 }}>{time}</Text>
      <Pressable onPress={onProfilePress} hitSlop={12}>
        <Ionicons name="person-circle-outline" size={28} color={TEXT} />
      </Pressable>
    </View>
  );
}

// ─── ONBOARDING (guided chat) — preserved from previous implementation ──────────

function BlinkingCursor() {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 500, useNativeDriver: true }),
    ])).start();
  }, [op]);
  return <Animated.Text style={{ color: ACCENT, fontSize: 14, opacity: op }}>▋</Animated.Text>;
}

function ThinkingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const loop = (d: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(d, { toValue: 1,   duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ])).start();
    dots.forEach((d, i) => loop(d, i * 150));
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
      {dots.map((d, i) => <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SUB, opacity: d }} />)}
    </View>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[cb.wrap, isUser ? cb.wrapUser : cb.wrapBot]}>
      {!isUser && (
        <View style={cb.avatar}>
          <Text style={{ fontSize: 10, color: ACCENT, fontWeight: '800' }}>R</Text>
        </View>
      )}
      <View style={[cb.bubble, isUser ? cb.bubbleUser : cb.bubbleBot]}>
        {msg.status === 'streaming'
          ? <BlinkingCursor />
          : <Text style={[cb.text, isUser && { color: BG }]}>{msg.content}</Text>
        }
      </View>
    </View>
  );
}

const cb = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 3, paddingHorizontal: 16 },
  wrapUser:   { justifyContent: 'flex-end' },
  wrapBot:    { justifyContent: 'flex-start' },
  avatar:     { width: 24, height: 24, borderRadius: 12, backgroundColor: `${ACCENT}25`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${ACCENT}40` },
  bubble:     { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleBot:  { backgroundColor: CARD, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  text:       { fontSize: 14, color: TEXT, lineHeight: 20 },
});

function OnboardingPill({ topInset, step, data }: { topInset: number; step: string; data: any }) {
  const stepLabels: Record<string, string> = {
    greeting: 'Welcome', name: 'Your name', wake: 'Wake time',
    goal: 'Your goal', summary: 'Summary', done: 'Done',
  };
  return (
    <View style={[op2.wrap, { top: topInset + 14 }]}>
      <View style={op2.pill}>
        <Text style={op2.text}>{stepLabels[step] ?? 'Setup'}</Text>
      </View>
    </View>
  );
}
const op2 = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { backgroundColor: 'rgba(28,159,218,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: `${ACCENT}40` },
  text: { fontSize: 12, fontWeight: '700', color: ACCENT, letterSpacing: 0.5 },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { dayPlan, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { phase, advance }   = useOnboardingPhase();
  const router               = useRouter();
  const { goToPage }         = usePager();
  const insets               = useSafeAreaInsets();
  const { tourStep, startTour, advanceTour, skipTour } = useTour();
  const { messages, isStreaming, isThinking, sendMessage, fetchGreeting, injectMessage } = useChat();

  const [profile,        setProfile]       = useState<UserProfile | null>(null);
  const [userName,       setUserName]      = useState<string | null>(null);
  const [bannerEvent,    setBannerEvent]   = useState<CalendarEventResponse | null>(null);
  const [bannerDismissed,setBannerDismissed] = useState(false);
  const [chatOpen,       setChatOpen]      = useState(false);
  const [input,          setInput]         = useState('');
  const scrollRef        = useRef<ScrollView>(null);
  const hasMountedFocus  = useRef(false);
  const hasRedirected    = useRef(false);
  const hasGreeted       = useRef(false);
  const hasGreetedPhase  = useRef<string | null>(null);

  // ── Onboarding state ───────────────────────────────────────────────────────
  type OnboardingStep = 'greeting'|'name'|'wake'|'goal'|'summary'|'done';
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('done');
  const onboardingDataRef = useRef({ name: '', wakeMin: 450, wakeLabel: '7:30', goal: '' });

  const isOnboarding = phase === 'guided_chat';

  // ── Load profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, onboarding] = await Promise.all([loadProfile(), loadOnboardingData()]);
      if (onboarding?.firstName) setUserName(onboarding.firstName);
      if (p) setProfile(p);
    })();
  }, []);

  // ── Redirect if no intro ───────────────────────────────────────────────────
  useEffect(() => {
    if (!needsOnboarding || hasRedirected.current) return;
    hasCompletedIntro().then(done => {
      if (!done && !hasRedirected.current) { hasRedirected.current = true; router.replace('/onboarding'); }
    });
  }, [needsOnboarding, router]);

  // ── Focus refresh ──────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (!hasMountedFocus.current) { hasMountedFocus.current = true; return; }
    refreshPlan();
  }, [refreshPlan]));

  // ── Greeting ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'done' && phase !== 'guided_chat') return;
    if (hasGreetedPhase.current === phase) return;
    if (phase === 'guided_chat') {
      hasGreetedPhase.current = phase;
      setTimeout(() => {
        setOnboardingStep('greeting');
        injectMessage("Hi, I'm R-Lo.\nYour personal sleep coach.");
        setTimeout(() => {
          injectMessage("What's your name?");
          setOnboardingStep('name');
        }, 1200);
      }, 400);
      return;
    }
    // phase === 'done'
    hasGreetedPhase.current = phase;
    const t = setTimeout(async () => {
      const welcomed = await AsyncStorage.getItem('@r90:welcomed');
      if (!welcomed) {
        await AsyncStorage.setItem('@r90:welcomed', '1');
        injectMessage("Welcome to your sleep HQ. 🌙\n\nAsk me anything about your sleep, your plan, or how you're feeling.");
        await new Promise(r => setTimeout(r, 2000));
      }
      await fetchGreeting();
      setTimeout(() => { void startTour(); }, 2500);
    }, 600);
    return () => clearTimeout(t);
  }, [phase, fetchGreeting, injectMessage, startTour]);

  // ── Onboarding reply handler ───────────────────────────────────────────────
  const handleOnboardingReply = useCallback(async (txt: string) => {
    const d = onboardingDataRef.current;
    switch (onboardingStep) {
      case 'name': {
        d.name = txt.trim() || 'there';
        injectMessage(`Nice to meet you, ${d.name}. 🙂`);
        await new Promise(r => setTimeout(r, 800));
        injectMessage('What time do you usually wake up?');
        setOnboardingStep('wake');
        break;
      }
      case 'wake': {
        const match = txt.match(/(\d{1,2})[:h]?(\d{0,2})/);
        if (match) {
          const h = parseInt(match[1]);
          const m = parseInt(match[2] || '0');
          d.wakeMin   = h * 60 + m;
          d.wakeLabel = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        } else {
          d.wakeLabel = txt;
        }
        injectMessage(`Got it — ${d.wakeLabel} wake-up. 🌅`);
        await new Promise(r => setTimeout(r, 800));
        injectMessage('What would you like to improve most?\n\n1. More energy during the day\n2. Fall asleep faster\n3. Better recovery\n4. Manage jet lag / travel');
        setOnboardingStep('goal');
        break;
      }
      case 'goal': {
        const map: Record<string, string> = { '1': 'energy', '2': 'sleep_speed', '3': 'recovery', '4': 'travel' };
        d.goal = map[txt.trim()] ?? txt.toLowerCase().includes('energy') ? 'energy'
               : txt.toLowerCase().includes('fast') ? 'sleep_speed'
               : txt.toLowerCase().includes('recover') ? 'recovery' : 'energy';
        injectMessage(`Perfect. Building your personalised R90 plan...`);
        setOnboardingStep('summary');
        await saveOnboardingData({ firstName: d.name, wakeTimeMinutes: d.wakeMin, priority: d.goal, constraint: '' });
        await new Promise(r => setTimeout(r, 1500));
        advance('plan');
        break;
      }
    }
  }, [onboardingStep, injectMessage, advance]);

  const handleSend = useCallback(() => {
    const txt = input.trim();
    if (!txt || isStreaming) return;
    setInput('');
    if (tourStep !== null) { skipTour(); return; }
    if (isOnboarding) { injectMessage(txt, 'user'); handleOnboardingReply(txt); return; }
    Analytics.chatMessageSent();
    void sendMessage(txt);
  }, [input, isStreaming, tourStep, isOnboarding, skipTour, injectMessage, handleOnboardingReply, sendMessage]);

  // ── Calendar banner ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOnboarding) return;
    getUpcomingEvents(1).then(res => {
      if (res.ok && res.data?.events?.[0]) setBannerEvent(res.data.events[0]);
    }).catch(() => {});
  }, [isOnboarding]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const bedtime     = dayPlan?.cycleWindow?.bedtime  ?? null;
  const wakeTime    = dayPlan?.cycleWindow?.wakeTime ?? (profile?.anchorTime ?? null);
  const blocks      = dayPlan?.blocks ?? [];
  const nextAction  = dayPlan?.nextAction ?? null;
  const rloText     = dayPlan?.rloMessage?.text ?? (userName ? `Bon à te revoir, ${userName}.` : 'Ton rythme se calcule…');
  const missedCycle = getMissedCycleInfo(bedtime, dayPlan?.cycleWindow?.cycleCount ?? 5, profile?.anchorTime ?? null);

  const handleActionPress = useCallback(() => {
    if (!nextAction) return;
    if (nextAction.type === 'take_crp' || nextAction.type === 'crp_reminder') {
      // Navigate to CRP / recovery flow — Planning tab for now
      goToPage(1);
    } else if (nextAction.type === 'start_pre_sleep' || nextAction.type === 'go_to_sleep') {
      router.push('/wind-down');
    } else {
      goToPage(1);
    }
  }, [nextAction, goToPage, router]);

  // ─── ONBOARDING MODE ──────────────────────────────────────────────────────
  if (isOnboarding) {
    return (
      <View style={ms.root}>
        {Platform.OS === 'ios'
          ? <Video source={require('../../assets/animation-v2.mp4')} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted useNativeControls={false} />
          : <CircadianBackground />
        }
        <LinearGradient colors={['rgba(10,10,58,0.55)','rgba(10,10,58,0.80)']} style={StyleSheet.absoluteFill} pointerEvents="none" />

        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <OnboardingPill topInset={0} step={onboardingStep} data={onboardingDataRef.current} />

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingVertical: 60, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((m, i) => <ChatBubble key={i} msg={m} />)}
            {isThinking && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                <View style={[cb.bubble, cb.bubbleBot]}><ThinkingDots /></View>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={ms.inputRow}>
            <View style={ms.inputWrap}>
              <View style={ms.inputField}>
                <Text style={ms.inputPlaceholder} onPress={() => {}}>Type a message…</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── NORMAL MODE ──────────────────────────────────────────────────────────
  return (
    <View style={ms.root}>
      {/* Background */}
      {Platform.OS === 'ios'
        ? <Video source={require('../../assets/animation-v2.mp4')} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted useNativeControls={false} />
        : <CircadianBackground />
      }
      <LinearGradient
        colors={['rgba(10,10,58,0.45)', 'rgba(10,10,58,0.75)', 'rgba(10,10,58,0.92)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {/* 1. Header */}
          <HomeHeader topInset={0} onProfilePress={() => goToPage(3)} />

          {/* 2. Rhythm Timeline */}
          {profile && bedtime && wakeTime ? (
            <RhythmTimeline
              blocks={blocks}
              wakeTime={wakeTime}
              bedtime={bedtime}
              anchorTime={profile.anchorTime}
            />
          ) : (
            <View style={{ height: 64, marginHorizontal: 20, backgroundColor: `${ACCENT}10`, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: MUTED, fontSize: 12 }}>Setting up your rhythm…</Text>
            </View>
          )}

          {/* 3. Action Card */}
          <ActionCard action={nextAction} missedCycle={missedCycle} onPress={handleActionPress} />

          {/* 4. R-Lo Message */}
          <RLoMessageBar text={rloText} onTap={() => setChatOpen(true)} />

          {/* 5. Secondary Cards */}
          {bannerEvent && !bannerDismissed && (
            <Pressable
              onPress={() => setBannerDismissed(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#141466', borderRadius: 14, padding: 14, marginHorizontal: 20, marginTop: 10 }}
            >
              <Ionicons name="calendar-outline" size={18} color={ACCENT} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT }}>{bannerEvent.title}</Text>
                <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }} numberOfLines={1}>
                  {`${new Date(bannerEvent.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — ${bannerEvent.event_type_hint === 'travel' ? 'Travel' : 'Événement'}`}
                </Text>
              </View>
            </Pressable>
          )}

          {/* 6. Sleep Footer */}
          <View style={{ marginTop: 12 }}>
            <SleepFooter bedtime={bedtime} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ms = StyleSheet.create({
  root:               { flex: 1, backgroundColor: BG },
  inputRow:           { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
  inputWrap:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputField:         { flex: 1, backgroundColor: CARD, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: `${ACCENT}30` },
  inputPlaceholder:   { color: MUTED, fontSize: 14 },
});
