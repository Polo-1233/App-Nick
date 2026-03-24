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
import { useDayPlanContext }      from '../../lib/day-plan-context';
import { type ActionCardState, getCurrentActionState } from '../../lib/action-state';
import { nowMin as getNowMin }    from '../../lib/time-utils';
import { useOnboardingPhase } from '../../lib/onboarding-phase-context';
import { useChat }            from '../../lib/use-chat';
import { useTheme }           from '../../lib/theme-context';
import { useChatContext }     from '../../lib/chat-context';
import { usePager }           from '../../lib/pager-context';
import { useTour }            from '../../lib/tour-context';

// ─── Home sub-components (clean module) ────────────────────────────────────────
import {
  RhythmTimeline,
  ActionCard,
  RLoMessage,
  SecondaryCards,
  type SecondaryCardData,
} from '../home';

// ─── Shared components ─────────────────────────────────────────────────────────
import { AmbientBackground } from '../ui/AmbientBackground';
import { MorningConfirmation, CONFIRM_DATE_KEY } from '../MorningConfirmation';
import { OnboardingChatFlow }   from '../OnboardingChatFlow';

// ─── Utilities & data ──────────────────────────────────────────────────────────
import { getFlow }              from '../../lib/rhythm-points';
// getMissedCycleInfo now handled inside action-state.ts
import { getTodayInsight, markInsightSeen, ensureSignupDate } from '../../lib/coach-insights';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro, loadOnboardingData,
} from '../../lib/storage';
import { getUpcomingEvents } from '../../lib/api';
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
  const [actionState,        setActionState]         = useState(() =>
    getCurrentActionState(getNowMin(), 390, 5).state
  );
  const [userName,           setUserName]            = useState<string | null>(null);
  const [streak,             setStreak]              = useState(0);
  const [bannerEvent,        setBannerEvent]         = useState<{ title: string; start_time: string; event_type_hint?: string } | null>(null);
  const [bannerDismissed,    setBannerDismissed]     = useState(false);
  const [coachInsight,       setCoachInsight]        = useState<{ id: string; message: string } | null>(null);
  const [showMorningConfirm, setShowMorningConfirm]  = useState(false);

  const hasMountedFocus  = useRef(false);
  const hasRedirected    = useRef(false);
  const hasGreetedPhase  = useRef<string | null>(null);

  const isOnboarding = phase === 'guided_chat';

  // ── Load profile + streak + insights on mount ──────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, onboarding] = await Promise.all([loadProfile(), loadOnboardingData()]);
      if (onboarding?.firstName) setUserName(onboarding.firstName);
      if (p) {
        setProfile(p);
        setActionState(getCurrentActionState(getNowMin(), p.anchorTime, p.idealCyclesPerNight).state);
      }
      getFlow().then(f => setStreak(f.currentStreak)).catch(() => {});
      void ensureSignupDate();
      getTodayInsight().then(i => { if (i) setCoachInsight(i); }).catch(() => {});
    })();
    // Sync action state every 30s
    const id = setInterval(() => {
      setActionState(prev => {
        const wakeMin = profile?.anchorTime ?? 390;
        const cycles  = profile?.idealCyclesPerNight ?? 5;
        return getCurrentActionState(getNowMin(), wakeMin, cycles).state;
      });
    }, 30_000);
    return () => clearInterval(id);
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
    // DEMO: mock calendar event for Nick preview — remove before production
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 30, 0, 0);
    setBannerEvent({
      title:           'Team performance review',
      start_time:      tomorrow.toISOString(),
      event_type_hint: 'meeting',
    });
    // Production:
    // getUpcomingEvents(1).then(res => {
    //   if (res.ok && res.data?.events?.[0]) setBannerEvent(res.data.events[0]);
    // }).catch(() => {});
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

  // ── Navigation depuis ActionCard — par état R90 ───────────────────────────
  const handleActionPress = useCallback((state: ActionCardState) => {
    switch (state.state) {
      case 'mrm_active':
      case 'pre_mrm':
        router.push('/mrm-player');
        break;
      case 'crp_active':
      case 'pre_crp':
        router.push('/crp-player');
        break;
      case 'winddown':
      case 'pre_winddown':
      case 'sleep_window':
      case 'missed_sleep':
        router.push('/wind-down');
        break;
      case 'morning':
        setShowMorningConfirm(true);
        break;
      default:
        goToPage(1);
    }
  }, [router, goToPage]);

  // ── Secondary cards ────────────────────────────────────────────────────────
  const secondaryCards: SecondaryCardData[] = [];

  // Calendar — real data only
  if (bannerEvent && !bannerDismissed) {
    secondaryCards.push({
      type:      'calendar',
      title:     bannerEvent.title,
      subtitle:  `${new Date(bannerEvent.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — ${bannerEvent.event_type_hint === 'travel' ? 'Travel' : 'Event'}`,
      onDismiss: () => setBannerDismissed(true),
    });
  }

  // Coach insight — "Did you know" daily card
  const insightMsg = coachInsight?.message
    ?? '90-minute cycles also exist during the day. That\'s why MRMs matter — they respect your natural rhythm.';
  secondaryCards.push({
    type:      'insight',
    id:        coachInsight?.id ?? 'default-ci',
    message:   insightMsg,
    onDismiss: async () => {
      if (coachInsight) await markInsightSeen(coachInsight.id);
      setCoachInsight(null);
    },
  });

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
    <AmbientBackground wakeMin={profile?.anchorTime} style={s.root}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.scroll,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          {/* 2. Rhythm Timeline */}
          {/* 2. Timeline — next 3 cycles only, tap to open full clock */}
          <RhythmTimeline
            wakeMin={profile?.anchorTime ?? 390}
            idealCycles={profile?.idealCyclesPerNight ?? 5}
          />

          {/* 3. Action Card — live R90 coach */}
          <ActionCard
            wakeMin={profile?.anchorTime ?? 390}
            idealCycles={profile?.idealCyclesPerNight ?? 5}
            onPress={handleActionPress}
          />

          {/* 4. R-Lo — contextual companion */}
          <RLoMessage
            actionState={actionState}
            wakeMin={profile?.anchorTime ?? 390}
            onChatTap={openChat}
          />

          {/* 5. Secondary Cards — only rendered if data exists */}
          <SecondaryCards cards={secondaryCards} />

          {/* Sleep footer removed */}
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

    </AmbientBackground>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:                { flex: 1 },
  safe:                { flex: 1 },
  scroll:              { flexGrow: 1 },
  timelinePlaceholder: { height: 90, marginHorizontal: 20, marginTop: 10 },
});
