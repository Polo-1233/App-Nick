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
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Animated } from 'react-native';
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
import { MascotImage }       from '../ui/MascotImage';
import { AmbientBackground } from '../ui/AmbientBackground';
import { MorningConfirmation, CONFIRM_DATE_KEY } from '../MorningConfirmation';
import { StreakDetail }          from '../StreakDetail';
import { RhythmPointsToast }     from '../RhythmPointsToast';
import { RhythmDepthSheet }     from '../RhythmDepthSheet';
// OnboardingChatFlow removed — data collection moved to onboarding pager

// ─── Utilities & data ──────────────────────────────────────────────────────────
import { getFlow }              from '../../lib/rhythm-points';
import { getDepth, getProgressToNext, type RhythmDepthState } from '../../lib/rhythm-depth';
import { WeeklyRecap, shouldShowWeeklyRecap } from '../WeeklyRecap';
import { WeeklyChallenge } from '../WeeklyChallenge';
import { ShareCard, type ShareCardHandle } from '../ShareCard';
import { usePremiumGate } from '../../lib/use-premium-gate';
import { isMilestone, getMilestoneMessage } from '../../lib/rlo-mood';
// getMissedCycleInfo now handled inside action-state.ts
import { getTodayInsight, markInsightSeen, ensureSignupDate } from '../../lib/coach-insights';
import { shouldShowNotifPrompt, dismissNotifPrompt, markNotifGranted } from '../../lib/contextual-permissions';
import * as Notifications from 'expo-notifications';
import { saveMorningLight, saveMrmCompletion } from '../../lib/kspi';
import { HapticsSuccess } from '../../utils/haptics';
import {
  loadProfile, loadWeekHistory, hasCompletedIntro, loadOnboardingData,
} from '../../lib/storage';
import { getUpcomingEvents } from '../../lib/api';
import type { UserProfile, ReadinessState } from '@r90/types';



// ─── HomeScreen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { theme }                      = useTheme();
  const { openChat }                   = useChatContext();
  const { isPremium }                  = usePremiumGate();
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
  const [depthInfo,          setDepthInfo]           = useState<{ levelLabel: string; levelColor: string; nextLabel: string | null; pct: number } | null>(null);
  const [rhythmScore,        setRhythmScore]         = useState<number | null>(null); // 0-100%
  const [showRecap,          setShowRecap]           = useState(false);
  const [showLevelUp,        setShowLevelUp]         = useState<{ level: string; color: string } | null>(null);
  const [behaviorCtx,        setBehaviorCtx]         = useState<import('../../lib/rlo-message').BehaviorContext | undefined>(undefined);
  const streakBounce = useRef(new Animated.Value(1)).current;
  const shareRef     = useRef<ShareCardHandle>(null);
  const [bannerEvent,        setBannerEvent]         = useState<{ title: string; start_time: string; event_type_hint?: string } | null>(null);
  const [bannerDismissed,    setBannerDismissed]     = useState(false);
  const [coachInsight,       setCoachInsight]        = useState<{ id: string; message: string } | null>(null);
  const [showMorningConfirm, setShowMorningConfirm]  = useState(false);
  const [showStreakDetail,   setShowStreakDetail]     = useState(false);
  const [showDepthSheet,     setShowDepthSheet]       = useState(false);
  const [toastPoints,        setToastPoints]          = useState(0);
  const [toastLabel,         setToastLabel]           = useState('Rhythm Points');
  const [showToast,          setShowToast]            = useState(false);
  const [showLightBanner,    setShowLightBanner]      = useState(false);
  const [showPostWindown,    setShowPostWindown]       = useState(false);
  const lightBannerAnim = useRef(new Animated.Value(0)).current;
  const wakeButtonAnim  = useRef(new Animated.Value(1)).current;

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

      // ── SMOKE DATA — remove before production ──────────────────────────
      const smokeProfile: UserProfile = { anchorTime: 390, idealCyclesPerNight: 5, chronotype: 'Neither', weeklyTarget: 35 };
      const activeProfile = p ?? smokeProfile;
      const smokeName = onboarding?.firstName ?? 'Thomas';
      setUserName(smokeName);
      setProfile(activeProfile);
      setActionState(getCurrentActionState(getNowMin(), activeProfile.anchorTime, activeProfile.idealCyclesPerNight).state);
      setStreak(7); // demo streak
      setCoachInsight({ id: 'smoke-1', message: '90-minute cycles exist during the day too — that\'s why MRMs matter. Even 2 minutes makes a difference.' });
      // ───────────────────────────────────────────────────────────────────

      if (p) {
        setProfile(p);
        setActionState(getCurrentActionState(getNowMin(), p.anchorTime, p.idealCyclesPerNight).state);
      }
      if (onboarding?.firstName) setUserName(onboarding.firstName);
      getFlow().then(f => { if (f.currentStreak > 0) setStreak(f.currentStreak); }).catch(() => {});
      // Load rhythm score from week history
      loadWeekHistory().then(h => {
        if (h && h.length > 0 && p) {
          const totalCycles = h.reduce((s, n) => s + n.cyclesCompleted, 0);
          const weekTarget  = p.idealCyclesPerNight * 7;
          setRhythmScore(Math.min(100, Math.round((totalCycles / weekTarget) * 100)));
        }
      }).catch(() => {});
      // Load rhythm depth + build behavior context for R-Lo
      Promise.all([getDepth(), getFlow()]).then(([d, f]) => {
        const { level, next, pct } = getProgressToNext(d.signal);
        setDepthInfo({ levelLabel: level.label, levelColor: level.color, nextLabel: next?.label ?? null, pct });
        setBehaviorCtx({
          streak:             f.currentStreak,
          bestStreak:         f.bestStreak,
          weekAligned:        f.weekAligned,
          depthLevel:         level.label,
          totalDaysActive:    d.totalDaysActive,
          winddownsThisWeek:  0,  // would need to query — acceptable default
          crpsThisWeek:       0,
          missedMornings:     f.currentStreak === 0 && f.bestStreak > 0 ? 1 : 0,
        });
      }).catch(() => {});
      void ensureSignupDate();
      // Check for weekly recap (Sunday evening / Monday morning)
      shouldShowWeeklyRecap().then(show => { if (show) setShowRecap(true); }).catch(() => {});
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

  // ── Post-wind-down notif prompt (after first completion) ──────────────────
  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@r90:winddownCount');
        if (raw !== '1') return;                         // only on first completion
        const shouldShow = await shouldShowNotifPrompt();
        if (shouldShow) setShowPostWindown(true);
      } catch { /* non-fatal */ }
    })();
  }, []));

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

  // ── Calendar banner (real data) ────────────────────────────────────────────
  useEffect(() => {
    if (isOnboarding) return;
    getUpcomingEvents(1).then(res => {
      if (res.ok && res.data?.events?.[0]) setBannerEvent(res.data.events[0]);
    }).catch(() => {});
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
          {/* Progression row — streak dominant, points + level secondary */}
          {(streak > 0 || depthInfo) && (
            <View style={sh.progressWrap}>
              {/* Streak — dominant */}
              {streak > 0 && (
                <Animated.View style={{ transform: [{ scale: streakBounce }] }}>
                  <Pressable onPress={() => setShowStreakDetail(true)} style={sh.streakRow}>
                    <Ionicons name="flame" size={22} color="#D97706" />
                    <Text style={sh.streakBig}>{streak} days</Text>
                  </Pressable>
                </Animated.View>
              )}
              {/* Secondary row: score + level */}
              <View style={sh.secondaryRow}>
                {rhythmScore !== null && (
                  <View style={sh.secondaryItem}>
                    <Ionicons name="star-outline" size={12} color="#6B8CAE" />
                    <Text style={sh.secondaryText}>{rhythmScore}%</Text>
                  </View>
                )}
                {depthInfo && (
                  <Pressable onPress={() => setShowDepthSheet(true)} style={sh.secondaryItem}>
                    <View style={[sh.levelDot, { backgroundColor: depthInfo.levelColor }]} />
                    <Text style={[sh.secondaryText, { color: depthInfo.levelColor }]}>{depthInfo.levelLabel}</Text>
                  </Pressable>
                )}
              </View>
            </View>
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

          {/* 4. R-Lo — contextual companion with behavioral awareness */}
          <RLoMessage
            actionState={actionState}
            wakeMin={profile?.anchorTime ?? 390}
            onChatTap={openChat}
            mood={{ streak, zone: dayPlan?.readiness?.zone ?? null }}
            behavior={behaviorCtx}
          />

          {/* 5. Weekly Challenge */}
          <View style={{ marginTop: 12 }}>
            <WeeklyChallenge />
          </View>

          {/* 6. Secondary Cards — only rendered if data exists */}
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
        onConfirm={() => {
          setShowMorningConfirm(false);
          // Celebration: haptic + pulse + toast
          HapticsSuccess();
          Animated.sequence([
            Animated.timing(wakeButtonAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
            Animated.timing(wakeButtonAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
          ]).start();
          setToastPoints(5);
          setToastLabel('Rise and shine ☀️');
          setShowToast(true);
          setTimeout(() => { setShowToast(false); setToastLabel('Rhythm Points'); }, 2000);
          // Show morning light banner
          setShowLightBanner(true);
          Animated.timing(lightBannerAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
          // Auto-dismiss after 8s
          setTimeout(() => {
            Animated.timing(lightBannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowLightBanner(false));
          }, 8000);
          // Refresh streak, depth, and bounce the badge
          getFlow().then(f => {
            if (f.currentStreak > 0) {
              setStreak(f.currentStreak);
              Animated.sequence([
                Animated.timing(streakBounce, { toValue: 1.3, duration: 150, useNativeDriver: true }),
                Animated.spring(streakBounce, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
              ]).start();
            }
          }).catch(() => {});
          // Check for level-up
          getDepth().then(d => {
            const { level, next, pct } = getProgressToNext(d.signal);
            const prevLabel = depthInfo?.levelLabel;
            setDepthInfo({ levelLabel: level.label, levelColor: level.color, nextLabel: next?.label ?? null, pct });
            // Level up detected!
            if (prevLabel && prevLabel !== level.label) {
              setShowLevelUp({ level: level.label, color: level.color });
            }
          }).catch(() => {});
        }}
        onDismiss={() => setShowMorningConfirm(false)}
      />

      <StreakDetail
        visible={showStreakDetail}
        onClose={() => setShowStreakDetail(false)}
      />

      <RhythmDepthSheet
        visible={showDepthSheet}
        onClose={() => setShowDepthSheet(false)}
      />

      <RhythmPointsToast
        points={toastPoints}
        label={toastLabel}
        visible={showToast}
      />

      {/* Morning light banner */}
      {showLightBanner && (
        <Animated.View style={[ml.banner, { opacity: lightBannerAnim, transform: [{ translateY: lightBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
          <Ionicons name="sunny" size={20} color="#F2A623" />
          <Text style={ml.bannerText}>Get some daylight in the next 30 min — it sets your clock</Text>
          <View style={ml.bannerActions}>
            <Pressable style={ml.gotLightBtn} onPress={() => {
              saveMorningLight(true).catch(() => {});
              Animated.timing(lightBannerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowLightBanner(false));
            }}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={ml.gotLightTxt}>Got light</Text>
            </Pressable>
            <Pressable onPress={() => {
              Animated.timing(lightBannerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowLightBanner(false));
            }}>
              <Text style={ml.skipTxt}>Skip</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Weekly recap (Sunday evening) */}
      <WeeklyRecap visible={showRecap} onClose={() => setShowRecap(false)} />

      {/* Post-wind-down notification prompt (fires after first wind-down) */}
      {showPostWindown && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowPostWindown(false)}>
          <View style={pw.overlay}>
            <View style={pw.sheet}>
              <MascotImage emotion="celebration" size="sm" />
              <Text style={pw.title}>You just completed your first wind-down! 🎉</Text>
              <Text style={pw.body}>Want a reminder tomorrow evening so you keep the habit going?</Text>
              <Pressable
                style={pw.btnPrimary}
                onPress={async () => {
                  setShowPostWindown(false);
                  try {
                    const { status } = await Notifications.requestPermissionsAsync();
                    if (status === 'granted') await markNotifGranted();
                    else await dismissNotifPrompt();
                  } catch { await dismissNotifPrompt().catch(() => {}); }
                }}
              >
                <Text style={pw.btnPrimaryText}>Yes, remind me</Text>
              </Pressable>
              <Pressable
                style={pw.btnSecondary}
                onPress={async () => {
                  setShowPostWindown(false);
                  await dismissNotifPrompt().catch(() => {});
                }}
              >
                <Text style={pw.btnSecondaryText}>Not now</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Level-up celebration */}
      {showLevelUp && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowLevelUp(null)}>
          <View style={lu.overlay}>
            <View style={lu.card}>
              <MascotImage emotion="celebration" size="md" />
              <Text style={lu.badge}>LEVEL UP</Text>
              <Text style={[lu.level, { color: showLevelUp.color }]}>{showLevelUp.level}</Text>
              <Text style={lu.msg}>Your rhythm is deepening. New content unlocked.</Text>
              <Pressable style={[lu.btn, { backgroundColor: showLevelUp.color }]} onPress={() => setShowLevelUp(null)}>
                <Text style={lu.btnText}>Continue →</Text>
              </Pressable>
              {/* Share level-up */}
              <Pressable style={lu.shareRow} onPress={() => shareRef.current?.share()}>
                <Ionicons name="share-outline" size={14} color="#1c9fda" />
                <Text style={lu.shareText}>Share this milestone</Text>
              </Pressable>
              {!isPremium && (
                <Pressable style={lu.premiumBtn} onPress={() => { setShowLevelUp(null); router.push('/premium'); }}>
                  <Text style={lu.premiumBtnText}>Unlock all {showLevelUp.level} content</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Off-screen ShareCard for image generation */}
      {showLevelUp && (
        <ShareCard
          ref={shareRef}
          type="level-up"
          data={{ level: showLevelUp.level, levelColor: showLevelUp.color }}
        />
      )}

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
  demoBanner: {
    alignSelf:       'center',
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderRadius:    8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop:       8,
    borderWidth:     1,
    borderColor:     'rgba(245,166,35,0.30)',
  },
  demoText: {
    fontSize:    10,
    fontWeight:  '700',
    color:       '#D97706',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  progressWrap: {
    alignItems:       'center',
    marginTop:        14,
    marginHorizontal: 20,
    gap:              4,
  },
  streakRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
  },
  streakBig: {
    fontSize:      28,
    fontWeight:    '800',
    color:         '#D97706',
    letterSpacing: -0.5,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  secondaryItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  secondaryText: {
    fontSize:   13,
    fontWeight: '600',
    color:      '#6B8CAE',
  },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
});

// ─── Level-up celebration styles ────────────────────────────────────────────

const lu = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#141466',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F5A623',
    letterSpacing: 2,
  },
  level: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  msg: {
    fontSize: 14,
    color: '#A8C4E0',
    textAlign: 'center',
    lineHeight: 21,
  },
  btn: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  shareText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1c9fda',
  },
  premiumBtn: {
    paddingVertical: 10,
  },
  premiumBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1c9fda',
  },
});

// ─── Morning Light Banner ─────────────────────────────────────────────────────
const ml = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: '#141466',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'column',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(242,166,35,0.20)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bannerText: {
    fontSize: 14,
    color: '#E6EDF7',
    lineHeight: 20,
    marginLeft: 30,
    marginTop: -22,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 30,
  },
  gotLightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3DDC97',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  gotLightTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipTxt: {
    fontSize: 14,
    color: '#6B8CAE',
  },
});

// ─── Post wind-down notif sheet ───────────────────────────────────────────────
const pw = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#141466',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 44,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E6EDF7',
    textAlign: 'center',
    marginTop: 8,
  },
  body: {
    fontSize: 15,
    color: '#A8C4E0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  btnPrimary: {
    backgroundColor: '#3DDC97',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnSecondary: {
    paddingVertical: 12,
  },
  btnSecondaryText: {
    fontSize: 15,
    color: '#6B8CAE',
    fontWeight: '500',
  },
});
