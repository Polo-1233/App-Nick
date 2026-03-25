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
 * Note: guided_chat onboarding was removed.
 * Data collection now happens in the onboarding pager (onboarding.tsx).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
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
// useTour removed — replaced by onboarding-guide system
import { RLoSpotlight }       from '../RLoGuide';
import {
  GUIDE_KEYS,
  shouldStartHomeOrientation,
  markGuideSeen,
  skipHomeOrientation,
  migrateFromLegacyTour,
} from '../../lib/onboarding-guide';

// ─── Home sub-components (clean module) ────────────────────────────────────────
import {
  RhythmTimeline,
  ActionCard,
  RLoMessage,
  SecondaryCards,
  type SecondaryCardData,
} from '../home';

// ─── Shared components ─────────────────────────────────────────────────────────
import { Ionicons }          from '@expo/vector-icons';
import { AmbientBackground } from '../ui/AmbientBackground';
import { MorningConfirmation, CONFIRM_DATE_KEY } from '../MorningConfirmation';
import { StreakDetail }          from '../StreakDetail';
import { RhythmPointsToast }     from '../RhythmPointsToast';
// OnboardingChatFlow removed — data collection moved to onboarding pager

// ─── Utilities & data ──────────────────────────────────────────────────────────
import { getFlow }              from '../../lib/rhythm-points';
import { isMilestone, getMilestoneMessage } from '../../lib/rlo-mood';
// getMissedCycleInfo now handled inside action-state.ts
import { getTodayInsight, markInsightSeen, ensureSignupDate } from '../../lib/coach-insights';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro, loadOnboardingData,
} from '../../lib/storage';
import { getUpcomingEvents } from '../../lib/api';
import type { UserProfile, ReadinessState } from '@r90/types';



// ─── HomeScreen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { theme }                      = useTheme();
  const { openChat }                   = useChatContext();
  const { dayPlan, needsOnboarding, refreshPlan } = useDayPlanContext();
  const { phase, advance }             = useOnboardingPhase();
  const router                         = useRouter();
  const { goToPage }                   = usePager();
  const insets                         = useSafeAreaInsets();
  // Old tour system removed — using onboarding-guide instead
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
  const [showStreakDetail,   setShowStreakDetail]     = useState(false);
  const [toastPoints,        setToastPoints]          = useState(0);
  const [showToast,          setShowToast]            = useState(false);

  // Layer 1 — Home orientation guide (3 steps, shown once)
  const [guideStep, setGuideStep] = useState<0 | 1 | 2 | null>(null);

  const hasMountedFocus  = useRef(false);
  const hasRedirected    = useRef(false);
  const hasGreetedPhase  = useRef<string | null>(null);

  // guided_chat phase removed — data collection now happens in onboarding pager
  const isOnboarding = false;

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
      // Start Layer 1 home orientation (replaces old tour)
      await migrateFromLegacyTour();
      const shouldStart = await shouldStartHomeOrientation();
      if (shouldStart) {
        setTimeout(() => setGuideStep(0), 1500);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [phase, fetchGreeting, injectMessage]);

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

  // ── Morning confirmation (uses wake detection) ────────────────────────────
  useEffect(() => {
    if (isOnboarding || !profile) return;
    (async () => {
      // Already confirmed today?
      const lastConfirm = await AsyncStorage.getItem(CONFIRM_DATE_KEY);
      const today       = new Date().toISOString().slice(0, 10);
      if (lastConfirm === today) return;
      // Check if we're in the morning window (ARP → ARP + 3h, wider than before)
      const now     = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const arp     = profile.anchorTime;
      // Show if within ARP to ARP+3h (wider window since we have wake detection now)
      if (nowMins >= Math.max(arp - 30, 0) && nowMins <= arp + 180) {
        setShowMorningConfirm(true);
      }
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

  // ─── Layer 1 — Home orientation guide handlers ────────────────────────────

  const GUIDE_MESSAGES = [
    'This is your day, built around your natural rhythm.',
    'This is what matters right now.',
    "I'll guide you through it.",
  ] as const;

  const GUIDE_STEP_KEYS = [
    GUIDE_KEYS.HOME_RHYTHM,
    GUIDE_KEYS.HOME_ACTION,
    GUIDE_KEYS.HOME_RLO,
  ] as const;

  // Spotlight Y positions (approximate, relative to screen top)
  // Adjusted for safe area + header height
  const topOffset = insets.top + 60; // header space
  const GUIDE_SPOTLIGHT_Y = [
    topOffset + 80,   // Step 0: rhythm timeline area
    topOffset + 200,  // Step 1: action card area
    topOffset + 310,  // Step 2: R-Lo message area
  ];

  const handleGuideNext = useCallback(async () => {
    if (guideStep === null) return;
    await markGuideSeen(GUIDE_STEP_KEYS[guideStep]);
    if (guideStep < 2) {
      setGuideStep((guideStep + 1) as 0 | 1 | 2);
    } else {
      setGuideStep(null);
    }
  }, [guideStep]);

  const handleGuideSkip = useCallback(async () => {
    await skipHomeOrientation();
    setGuideStep(null);
  }, []);

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
          {/* Streak badge */}
          {streak > 0 && (
            <Pressable onPress={() => setShowStreakDetail(true)} style={sh.streakBadge}>
              <Ionicons name="flame" size={14} color="#D97706" />
              <Text style={sh.streakCount}>{streak} day{streak > 1 ? 's' : ''}</Text>
            </Pressable>
          )}

          {/* 2. Rhythm Timeline */}
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
            mood={{ streak, zone: dayPlan?.readiness?.zone ?? null }}
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

      <StreakDetail
        visible={showStreakDetail}
        onClose={() => setShowStreakDetail(false)}
      />

      <RhythmPointsToast
        points={toastPoints}
        label="Rhythm Points"
        visible={showToast}
      />

      {/* Layer 1 — Home orientation spotlight (shown once) */}
      <RLoSpotlight
        visible={guideStep !== null}
        message={guideStep !== null ? GUIDE_MESSAGES[guideStep] : ''}
        spotlightY={guideStep !== null ? GUIDE_SPOTLIGHT_Y[guideStep] : 0}
        spotlightHeight={90}
        onNext={handleGuideNext}
        onSkip={handleGuideSkip}
        step={(guideStep ?? 0) + 1}
        totalSteps={3}
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

const sh = StyleSheet.create({
  streakBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    alignSelf:       'flex-end',
    marginRight:     20,
    marginTop:       12,
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderRadius:    20,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderWidth:     1,
    borderColor:     'rgba(245,166,35,0.25)',
  },

  streakCount: { fontSize: 12, fontWeight: '700', color: '#D97706' },
});
