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

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect }       from 'expo-router';
import { Ionicons }                        from '@expo/vector-icons';
import AsyncStorage                        from '@react-native-async-storage/async-storage';

import { useDayPlanContext }    from '../../lib/day-plan-context';
import { useOnboardingPhase }   from '../../lib/onboarding-phase-context';
import { useChat }              from '../../lib/use-chat';
import { Analytics }            from '../../lib/analytics';
import { useTheme }             from '../../lib/theme-context';
import { usePager }             from '../../lib/pager-context';
import { useTour }              from '../../lib/tour-context';
import { RhythmTimeline }       from '../RhythmTimeline';
import { ActionCard }           from '../ActionCard';
import { RLoMessageBar }        from '../RLoMessageBar';
import { SleepFooter }          from '../SleepFooter';
import { MorningConfirmation, CONFIRM_DATE_KEY } from '../MorningConfirmation';
import { OnboardingChatFlow }   from '../OnboardingChatFlow';
import { getFlow }              from '../../lib/rhythm-points';
import { getTodayInsight, markInsightSeen, ensureSignupDate } from '../../lib/coach-insights';
import { getMissedCycleInfo }   from '../../lib/missed-cycle';
import { StreakDetail }         from '../StreakDetail';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro,
  loadOnboardingData,
} from '../../lib/storage';
import { getUpcomingEvents, type CalendarEventResponse } from '../../lib/api';
import type { UserProfile, NextAction, ReadinessState } from '@r90/types';
import type { MascotEmotion }   from '../ui/MascotImage';

function getRLoMood(streak: number, readiness: ReadinessState | null | undefined): MascotEmotion {
  if (streak >= 7) return 'Enthousisate';
  if (streak >= 3) return 'encourageant';
  if (readiness?.zone === 'green') return 'Fiere';
  if (streak === 0) return 'rassurante';
  return 'Reflexion';
}

// ─── HomeHeader (spec pixel-perfect) ─────────────────────────────────────────
// height: 60px | left: heure | center: streak | right: avatar

const H_TEXT   = '#002060';
const H_ACCENT = '#1c9fda';

function HomeHeader({
  topInset, onProfilePress, streak,
}: { topInset: number; onProfilePress: () => void; streak: number }) {
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  });
  const [showStreakDetail, setShowStreakDetail] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <View style={[hdr.wrap, { paddingTop: topInset + 10 }]}>
        {/* Left — heure */}
        <Text style={hdr.time}>{time}</Text>

        {/* Center — streak (optionnel) */}
        {streak > 0 ? (
          <Pressable onPress={() => setShowStreakDetail(true)} hitSlop={8} style={hdr.streakPill}>
            <Text style={hdr.streakEmoji}>🔥</Text>
            <Text style={hdr.streakNum}>{streak}</Text>
          </Pressable>
        ) : (
          <View />
        )}

        {/* Right — avatar */}
        <Pressable onPress={onProfilePress} hitSlop={12} style={hdr.avatarBtn}>
          <Ionicons name="person-outline" size={17} color={H_TEXT} />
        </Pressable>
      </View>

      <StreakDetail visible={showStreakDetail} onClose={() => setShowStreakDetail(false)} />
    </>
  );
}

const hdr = StyleSheet.create({
  wrap: {
    height:          60,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 20,
    paddingBottom:   10,
  },
  time: {
    fontSize:   18,
    fontWeight: '500',
    color:      H_TEXT,
    letterSpacing: 0.2,
  },
  streakPill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
  },
  streakEmoji: { fontSize: 14 },
  streakNum: {
    fontSize:   14,
    fontWeight: '600',
    color:      H_ACCENT,
  },
  avatarBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: '#EAF4FB',
    alignItems:      'center',
    justifyContent:  'center',
  },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { theme } = useTheme();
  const { dayPlan, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { phase, advance }   = useOnboardingPhase();
  const router               = useRouter();
  const { goToPage }         = usePager();
  const insets               = useSafeAreaInsets();
  const { tourStep, startTour, skipTour } = useTour();
  const { messages, isStreaming, isThinking, sendMessage, fetchGreeting, injectMessage } = useChat();

  const [profile,            setProfile]            = useState<UserProfile | null>(null);
  const [userName,           setUserName]            = useState<string | null>(null);
  const [bannerEvent,        setBannerEvent]         = useState<CalendarEventResponse | null>(null);
  const [bannerDismissed,    setBannerDismissed]     = useState(false);
  const [chatOpen,           setChatOpen]            = useState(false);
  const [showMorningConfirm, setShowMorningConfirm]  = useState(false);
  const [streak,             setStreak]              = useState(0);
  const [coachInsight,       setCoachInsight]        = useState<{ id: string; message: string } | null>(null);
  const hasMountedFocus  = useRef(false);
  const hasRedirected    = useRef(false);
  const hasGreetedPhase  = useRef<string | null>(null);

  const isOnboarding = phase === 'guided_chat';

  // ── Load profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, onboarding] = await Promise.all([loadProfile(), loadOnboardingData()]);
      if (onboarding?.firstName) setUserName(onboarding.firstName);
      if (p) setProfile(p);
      getFlow().then(f => setStreak(f.currentStreak)).catch(() => {});
      void ensureSignupDate();
      getTodayInsight().then(i => { if (i) setCoachInsight(i); }).catch(() => {});
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

  // ── Greeting (done phase) ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'done') return;
    if (hasGreetedPhase.current === phase) return;
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

  // ── Calendar banner ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOnboarding) return;
    getUpcomingEvents(1).then(res => {
      if (res.ok && res.data?.events?.[0]) setBannerEvent(res.data.events[0]);
    }).catch(() => {});
  }, [isOnboarding]);

  // ── Morning confirmation ───────────────────────────────────────────────────
  useEffect(() => {
    if (isOnboarding || !profile) return;
    (async () => {
      const lastConfirm = await AsyncStorage.getItem(CONFIRM_DATE_KEY);
      const today       = new Date().toISOString().slice(0, 10);
      if (lastConfirm === today) return;
      const now     = new Date();
      const nowMin  = now.getHours() * 60 + now.getMinutes();
      const arp     = profile.anchorTime;
      const isMorning = nowMin >= arp && nowMin <= arp + 120;
      if (isMorning) setShowMorningConfirm(true);
    })();
  }, [isOnboarding, profile]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const bedtime     = dayPlan?.cycleWindow?.bedtime  ?? null;
  const wakeTime    = dayPlan?.cycleWindow?.wakeTime ?? (profile?.anchorTime ?? null);
  const blocks      = dayPlan?.blocks ?? [];
  const nextAction  = dayPlan?.nextAction ?? null;
  const rloText     = dayPlan?.rloMessage?.text ?? (userName ? `Welcome back, ${userName}.` : 'Your rhythm is being calculated…');
  const missedCycle = getMissedCycleInfo(bedtime, dayPlan?.cycleWindow?.cycleCount ?? 5, profile?.anchorTime ?? null);

  const handleActionPress = useCallback(() => {
    if (!nextAction) return;
    switch (nextAction.type) {
      case 'take_crp':
      case 'crp_reminder':
        router.push('/crp-player');
        break;
      case 'take_mrm':
      case 'mrm_reminder':
        router.push('/mrm-player');
        break;
      case 'start_pre_sleep':
      case 'go_to_sleep':
        router.push('/wind-down');
        break;
      default:
        goToPage(1);
    }
  }, [nextAction, goToPage, router]);

  // ─── ONBOARDING MODE ──────────────────────────────────────────────────────
  if (isOnboarding) {
    return (
      <OnboardingChatFlow
        messages={messages}
        isThinking={isThinking}
        isStreaming={isStreaming}
        injectMessage={injectMessage}
        advance={advance}
      />
    );
  }

  // ─── NORMAL MODE ──────────────────────────────────────────────────────────
  return (
    <View style={[ms.root, { backgroundColor: theme.colors.background }]}>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, flexGrow: 1 }}
        >
          {/* 1. Header */}
          <HomeHeader topInset={0} onProfilePress={() => goToPage(3)} streak={streak} />

          {/* 2. Timeline */}
          {profile && bedtime && wakeTime ? (
            <RhythmTimeline
              blocks={blocks}
              wakeTime={wakeTime}
              bedtime={bedtime}
              anchorTime={profile.anchorTime}
            />
          ) : (
            <View style={{ height: 90, marginHorizontal: 20, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#B0C4D8', fontSize: 13 }}>Setting up your rhythm…</Text>
            </View>
          )}

          {/* 3. Action Card */}
          <ActionCard action={nextAction} missedCycle={missedCycle} onPress={handleActionPress} />

          {/* 4. R-Lo Message */}
          <RLoMessageBar
            text={rloText}
            onTap={() => setChatOpen(true)}
            emotion={getRLoMood(streak, dayPlan?.readiness)}
          />

          {/* 5. Secondary cards — seulement si utile */}
          {bannerEvent && !bannerDismissed && (
            <Pressable
              onPress={() => setBannerDismissed(true)}
              style={sc.card}
            >
              <Ionicons name="calendar-outline" size={16} color="#1c9fda" />
              <View style={{ flex: 1 }}>
                <Text style={sc.cardTitle} numberOfLines={1}>{bannerEvent.title}</Text>
                <Text style={sc.cardSub} numberOfLines={1}>
                  {`${new Date(bannerEvent.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — ${bannerEvent.event_type_hint === 'travel' ? 'Travel' : 'Event'}`}
                </Text>
              </View>
            </Pressable>
          )}

          {coachInsight && (
            <View style={sc.card}>
              <Text style={sc.cardLabel}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={sc.cardTitle}>{coachInsight.message}</Text>
              </View>
              <Pressable
                onPress={async () => { await markInsightSeen(coachInsight.id); setCoachInsight(null); }}
                hitSlop={8}
              >
                <Text style={sc.cardDismiss}>✓</Text>
              </Pressable>
            </View>
          )}

          {/* Weekly report — dimanche soir / lundi matin uniquement */}
          {(()=>{
            const d=new Date(), dow=d.getDay(), h=d.getHours();
            if(!((dow===0&&h>=18)||(dow===1&&h<12))) return null;
            return (
              <View style={sc.card}>
                <Text style={sc.cardLabel}>📊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={sc.cardTitle}>Weekly report</Text>
                  <Text style={sc.cardSub}>{streak > 0 ? `${streak} days rhythm flow` : 'Check your Insights'}</Text>
                </View>
              </View>
            );
          })()}

          {/* 6. Sleep Footer */}
          <View style={{ marginTop: 12 }}>
            <SleepFooter bedtime={bedtime} />
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Morning confirmation modal */}
      <MorningConfirmation
        visible={showMorningConfirm}
        firstName={userName}
        wakeTime={wakeTime !== null ? `${String(Math.floor(wakeTime / 60)).padStart(2,'0')}:${String(wakeTime % 60).padStart(2,'0')}` : '--:--'}
        onConfirm={() => setShowMorningConfirm(false)}
        onDismiss={() => setShowMorningConfirm(false)}
      />
    </View>
  );
}

const ms = StyleSheet.create({
  root: { flex: 1 },
});

// Secondary cards — spec: height 60, bg #F7FAFD, radius 14, padding 12
const sc = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    height:          60,
    backgroundColor: '#F7FAFD',
    borderRadius:    14,
    paddingHorizontal: 12,
    marginHorizontal:  20,
    marginTop:         10,
  },
  cardLabel:   { fontSize: 16 },
  cardTitle:   { fontSize: 13, fontWeight: '500', color: '#002060', lineHeight: 18 },
  cardSub:     { fontSize: 12, color: '#6B7A90', marginTop: 1 },
  cardDismiss: { fontSize: 14, color: '#1c9fda', fontWeight: '600' },
});
