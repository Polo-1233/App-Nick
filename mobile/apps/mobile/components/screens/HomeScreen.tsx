/**
 * HomeScreen — Rhythm Interface
 *
 * Philosophy: 1 screen = 1 decision. Everything serves the action.
 *
 * Structure (strict order):
 *   1. Header         — time + streak + avatar
 *   2. RhythmTimeline — current position in the day
 *   3. ActionCard     — THE dominant element, one clear action
 *   4. RLoMessage     — one calm sentence
 *   5. SecondaryCards — optional, only if useful data exists
 *   6. SleepFooter    — tonight's bedtime, subtle
 *
 * Onboarding mode (phase === 'guided_chat'):
 *   → delegates entirely to OnboardingChatFlow
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect }       from 'expo-router';
import AsyncStorage                        from '@react-native-async-storage/async-storage';

// ─── App contexts ───────────────────────────────────────────────────────────────
import { useDayPlanContext }  from '../../lib/day-plan-context';
import { useOnboardingPhase } from '../../lib/onboarding-phase-context';
import { useChat }            from '../../lib/use-chat';
import { useTheme }           from '../../lib/theme-context';
import { useChatContext }     from '../../lib/chat-context';
import { usePager }           from '../../lib/pager-context';
import { useTour }            from '../../lib/tour-context';

// ─── Home sub-components (clean module) ────────────────────────────────────────
import {
  HomeHeader,
  RhythmTimeline,
  ActionCard,
  RLoMessage,
  SecondaryCards,
  SleepFooter,
  type SecondaryCardData,
} from '../home';

// ─── Shared components ─────────────────────────────────────────────────────────
import { MorningConfirmation, CONFIRM_DATE_KEY } from '../MorningConfirmation';
import { OnboardingChatFlow }   from '../OnboardingChatFlow';
import { StreakDetail }         from '../StreakDetail';

// ─── Utilities & data ──────────────────────────────────────────────────────────
import { getFlow }              from '../../lib/rhythm-points';
import { getMissedCycleInfo }   from '../../lib/missed-cycle';
import { getTodayInsight, markInsightSeen, ensureSignupDate } from '../../lib/coach-insights';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro, loadOnboardingData,
} from '../../lib/storage';
import { getUpcomingEvents, type CalendarEventResponse } from '../../lib/api';
import type { UserProfile, ReadinessState } from '@r90/types';
import type { MascotEmotion } from '../ui/MascotImage';

// ─── Helper: R-Lo emotion from streak / readiness ──────────────────────────────
function getRLoMood(streak: number, readiness: ReadinessState | null | undefined): MascotEmotion {
  if (streak >= 7) return 'Enthousisate';
  if (streak >= 3) return 'encourageant';
  if (readiness?.zone === 'green') return 'Fiere';
  if (streak === 0) return 'rassurante';
  return 'Reflexion';
}

// ─── HomeScreen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { theme }                      = useTheme();
  const { openChat }                   = useChatContext();
  const { dayPlan, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { phase, advance }             = useOnboardingPhase();
  const router                         = useRouter();
  const { goToPage }                   = usePager();
  const insets                         = useSafeAreaInsets();
  const { startTour, skipTour, tourStep } = useTour();
  const { messages, isStreaming, isThinking, sendMessage, fetchGreeting, injectMessage } = useChat();

  // ── State ──────────────────────────────────────────────────────────────────
  const [profile,            setProfile]            = useState<UserProfile | null>(null);
  const [userName,           setUserName]            = useState<string | null>(null);
  const [streak,             setStreak]              = useState(0);
  const [bannerEvent,        setBannerEvent]         = useState<CalendarEventResponse | null>(null);
  const [bannerDismissed,    setBannerDismissed]     = useState(false);
  const [coachInsight,       setCoachInsight]        = useState<{ id: string; message: string } | null>(null);
  const [showMorningConfirm, setShowMorningConfirm]  = useState(false);
  const [showStreakDetail,   setShowStreakDetail]     = useState(false);

  const hasMountedFocus  = useRef(false);
  const hasRedirected    = useRef(false);
  const hasGreetedPhase  = useRef<string | null>(null);

  const isOnboarding = phase === 'guided_chat';

  // ── Load profile + streak + insights on mount ──────────────────────────────
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

  // ── Redirect to onboarding if intro not done ───────────────────────────────
  useEffect(() => {
    if (!needsOnboarding || hasRedirected.current) return;
    hasCompletedIntro().then(done => {
      if (!done && !hasRedirected.current) {
        hasRedirected.current = true;
        router.replace('/onboarding');
      }
    });
  }, [needsOnboarding, router]);

  // ── Refresh plan on focus (silent) ────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (!hasMountedFocus.current) { hasMountedFocus.current = true; return; }
    refreshPlan();
  }, [refreshPlan]));

  // ── Greeting (done phase only) ─────────────────────────────────────────────
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
      const now       = new Date();
      const nowMins   = now.getHours() * 60 + now.getMinutes();
      const arp       = profile.anchorTime;
      if (nowMins >= arp && nowMins <= arp + 120) setShowMorningConfirm(true);
    })();
  }, [isOnboarding, profile]);

  // ── Derived plan values ────────────────────────────────────────────────────
  const bedtime     = dayPlan?.cycleWindow?.bedtime  ?? null;
  const wakeTime    = dayPlan?.cycleWindow?.wakeTime ?? (profile?.anchorTime ?? null);
  const blocks      = dayPlan?.blocks ?? [];
  const nextAction  = dayPlan?.nextAction ?? null;
  const rloText     = dayPlan?.rloMessage?.text
    ?? (userName ? `Stay consistent today, ${userName}.` : 'Stay consistent today.');
  const missedCycle = getMissedCycleInfo(
    bedtime, dayPlan?.cycleWindow?.cycleCount ?? 5, profile?.anchorTime ?? null,
  );

  // ── Navigation from ActionCard ─────────────────────────────────────────────
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

  // ── Secondary cards ────────────────────────────────────────────────────────
  // TODO: remove mock data before production
  const secondaryCards: SecondaryCardData[] = [];

  // Calendar — real data or mock
  const calendarTitle    = bannerEvent?.title    ?? 'Team dinner';
  const calendarSubtitle = bannerEvent
    ? `${new Date(bannerEvent.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — ${bannerEvent.event_type_hint === 'travel' ? 'Travel' : 'Event'}`
    : '19:30 — Event';
  if (!bannerDismissed) {
    secondaryCards.push({
      type:      'calendar',
      title:     calendarTitle,
      subtitle:  calendarSubtitle,
      onDismiss: () => setBannerDismissed(true),
    });
  }

  // Coach insight — real data or mock
  const insightMsg = coachInsight?.message
    ?? '90-minute cycles also exist during the day. That\'s why MRMs matter — they respect your natural rhythm.';
  if (!coachInsight || coachInsight) { // always show
    secondaryCards.push({
      type:      'insight',
      id:        coachInsight?.id ?? 'mock-ci-01',
      message:   insightMsg,
      onDismiss: async () => {
        if (coachInsight) await markInsightSeen(coachInsight.id);
        setCoachInsight(null);
      },
    });
  }

  // ─── ONBOARDING: full-screen chat ─────────────────────────────────────────
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
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.scroll,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          {/* 1. Header */}
          <HomeHeader
            streak={streak}
            onAvatarPress={() => goToPage(3)}
            onStreakPress={() => setShowStreakDetail(true)}
          />

          {/* 2. Rhythm Timeline */}
          {profile && bedtime && wakeTime ? (
            <RhythmTimeline
              blocks={blocks}
              bedtime={bedtime}
              anchorTime={profile.anchorTime}
            />
          ) : (
            <View style={s.timelinePlaceholder} />
          )}

          {/* 3. Action Card — most dominant element */}
          <ActionCard
            action={nextAction}
            missedCycle={missedCycle}
            onPress={handleActionPress}
          />

          {/* 4. R-Lo Message — tap opens chat */}
          <RLoMessage
            text={rloText}
            emotion={getRLoMood(streak, dayPlan?.readiness)}
            onTap={openChat}
          />

          {/* 5. Secondary Cards — only rendered if data exists */}
          <SecondaryCards cards={secondaryCards} />

          {/* 6. Sleep Footer */}
          <SleepFooter bedtime={bedtime} />
        </ScrollView>
      </SafeAreaView>

      {/* Modals */}
      <MorningConfirmation
        visible={showMorningConfirm}
        firstName={userName}
        wakeTime={wakeTime !== null
          ? `${String(Math.floor(wakeTime / 60)).padStart(2, '0')}:${String(wakeTime % 60).padStart(2, '0')}`
          : '--:--'}
        onConfirm={() => setShowMorningConfirm(false)}
        onDismiss={() => setShowMorningConfirm(false)}
      />

      <StreakDetail
        visible={showStreakDetail}
        onClose={() => setShowStreakDetail(false)}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:                { flex: 1 },
  safe:                { flex: 1 },
  scroll:              { flexGrow: 1 },
  timelinePlaceholder: { height: 90, marginHorizontal: 20, marginTop: 10 },
});
