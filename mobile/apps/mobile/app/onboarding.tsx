/**
 * Onboarding — 7-step linear flow.
 *
 * Steps:
 *   0 — "8h myth" hook (strikethrough animation)
 *   1 — Cycle visualization (Light → Deep → REM → Wake = 90 min)
 *   2 — Nick authority + teams (Man United, Team Sky, Ronaldo, Olympics)
 *   3 — Meet R-Lo + Name input (fused — R-Lo asks for the name)
 *   4 — Chronotype picker (AMer / Intermediate / PMer)
 *   5 — Anchor time (ARP) picker + live rhythm preview
 *   6 — Cycle count selector (3/4/5/6) + "35 cycles per week" insight
 *
 * On finish (step 6 → Create my plan):
 *   - Saves onboarding data (firstName, wakeTimeMinutes, cycles)
 *   - Saves profile (anchorTime, idealCyclesPerNight)
 *   - Bootstraps backend user
 *   - Marks intro complete
 *   - Sets phase to 'plan' → routes to /(tabs) where OnboardingPlanOverlay
 *     shows plan generation (step 10) → plan reveal (step 11) → paywall → login
 *
 * Data flow:
 *   firstName  → saved in OnboardingData.firstName
 *   wakeMin    → saved in UserProfile.anchorTime + OnboardingData.wakeTimeMinutes
 *   cycles     → saved in UserProfile.idealCyclesPerNight
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Alert,
  Keyboard,
  TextInput,
  Dimensions,
  Animated,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  markIntroComplete,
  setOnboardingPhase,
  saveOnboardingData,
  saveProfile,
  loadProfile,
} from '../lib/storage';
import { bootstrapUser } from '../lib/api';
import { HapticsLight, HapticsSuccess } from '../utils/haptics';
import { MascotImage } from '../components/ui/MascotImage';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_PAGES = 7;

const SCREEN_W = Dimensions.get('window').width;
const PHASE_BLOCK_W = SCREEN_W < 375 ? 46 : 52;

// Phase colours — reusable across onboarding + daily loop timeline
export const PHASE_COLORS = {
  light: { bg: 'rgba(93,202,165,0.18)',  text: '#5DCAA5', border: 'rgba(93,202,165,0.40)' },
  deep:  { bg: 'rgba(133,183,235,0.18)', text: '#85B7EB', border: 'rgba(133,183,235,0.40)' },
  rem:   { bg: 'rgba(175,169,236,0.18)', text: '#AFA9EC', border: 'rgba(175,169,236,0.40)' },
  awake: { bg: 'rgba(242,166,35,0.12)',  text: '#F2A623', border: 'rgba(242,166,35,0.40)' },
} as const;

// Accent colour aliases — used standalone for calc box highlights
const GOLD = '#F2A623';
const TEAL = '#5DCAA5';

// Onboarding always dark — aligned with darkTheme tokens
const ACCENT    = '#1c9fda';   // darkTheme.accent
const BG        = '#0a0a3a';   // darkTheme.background
const SURFACE   = '#141466';   // darkTheme.surface
const BORDER    = '#1c1c7a';   // darkTheme.border
const TEXT_CLR  = '#FFFFFF';   // darkTheme.text (was #E6EDF7 — now aligned)
const TEXT_SUB  = '#A8C4E0';   // darkTheme.textSub (was #9FB0C5 — now aligned)
const TEXT_MUTED = '#6B8CAE';  // darkTheme.textMuted (was #6B7F99 — now aligned)
const TEXT_DIM  = '#4A6580';   // faint placeholder text

const CIRCLE_SIZE = 230;
const CIRCLE_NICK = 290;

// ─── ScrollPicker — iOS-style snap scroll wheel with looping ─────────────────

const ITEM_H = 60;
const VISIBLE = 5; // show 5 rows: 2 above + selected + 2 below
const PICKER_H = VISIBLE * ITEM_H;

// For looping: repeat the list N times so user can scroll "infinitely"
const LOOP_REPEATS = 40; // enough so user never hits the edge

interface ScrollPickerProps {
  items: number[];
  selected: number;
  onChange: (value: number) => void;
  formatLabel?: (value: number) => string;
  width?: number;
  loop?: boolean; // true = infinite loop (minutes), false = clamped (hours)
}

function ScrollPicker({
  items,
  selected,
  onChange,
  formatLabel = (v) => String(v).padStart(2, '0'),
  width = 100,
  loop = false,
}: ScrollPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const mounted = useRef(false);
  const settling = useRef(false);

  const count = items.length;

  // Build the data array
  // Loop mode: repeat items LOOP_REPEATS times, start in the middle
  // Non-loop mode: just the items with padding
  const loopData = loop
    ? Array.from({ length: count * LOOP_REPEATS }, (_, i) => items[i % count])
    : items;

  // The index in loopData that corresponds to `selected`
  const selectedInItems = items.indexOf(selected);
  const centerRepeat = Math.floor(LOOP_REPEATS / 2);
  const initialIdx = loop
    ? centerRepeat * count + selectedInItems
    : selectedInItems;

  // Padding so the first/last item can be centered
  const padItems = Math.floor(VISIBLE / 2); // 2

  // Scroll to initial position on mount
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: initialIdx * ITEM_H,
        animated: false,
      });
      mounted.current = true;
    }, 30);
    return () => clearTimeout(t);
  }, []);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!mounted.current || settling.current) return;
      const y = e.nativeEvent.contentOffset.y;
      const rawIdx = Math.round(y / ITEM_H);
      const clampedIdx = Math.max(0, Math.min(loopData.length - 1, rawIdx));
      const value = loopData[clampedIdx];

      // Snap to exact position
      settling.current = true;
      scrollRef.current?.scrollTo({ y: clampedIdx * ITEM_H, animated: true });
      setTimeout(() => { settling.current = false; }, 200);

      if (value !== selected) {
        HapticsLight();
        onChange(value);
      }

      // Loop mode: if we're far from center, silently re-center
      if (loop) {
        const distFromCenter = Math.abs(clampedIdx - centerRepeat * count);
        if (distFromCenter > count * 8) {
          const recentered = centerRepeat * count + (clampedIdx % count);
          setTimeout(() => {
            scrollRef.current?.scrollTo({ y: recentered * ITEM_H, animated: false });
          }, 300);
        }
      }
    },
    [loopData, selected, onChange, loop, count],
  );

  return (
    <View style={[pk.container, { width, height: PICKER_H }]}>
      {/* Center highlight */}
      <View style={pk.highlight} pointerEvents="none" />

      {/* Fade top */}
      <View style={pk.fadeTop} pointerEvents="none" />
      {/* Fade bottom */}
      <View style={pk.fadeBottom} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          // Also snap on drag end (not just momentum)
          const y = e.nativeEvent.contentOffset.y;
          const idx = Math.round(y / ITEM_H);
          const clamped = Math.max(0, Math.min(loopData.length - 1, idx));
          scrollRef.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
          // Delay value change slightly for smooth snap
          setTimeout(() => handleScrollEnd(e), 100);
        }}
        contentContainerStyle={{
          paddingTop: padItems * ITEM_H,
          paddingBottom: padItems * ITEM_H,
        }}
        nestedScrollEnabled
        overScrollMode="never"
        bounces={!loop}
      >
        {loopData.map((item, i) => (
          <View key={i} style={pk.item}>
            <Text style={[pk.itemText, item === selected && pk.itemTextSel]}>
              {formatLabel(item)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const pk = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
  },
  highlight: {
    position: 'absolute',
    top: Math.floor(VISIBLE / 2) * ITEM_H,
    left: 0, right: 0,
    height: ITEM_H,
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(28,159,218,0.18)',
    zIndex: 0,
  },
  fadeTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: ITEM_H * 1.5,
    zIndex: 2,
    backgroundColor: BG,
    opacity: 0.65,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: ITEM_H * 1.5,
    zIndex: 2,
    backgroundColor: BG,
    opacity: 0.65,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 36,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: -0.5,
  },
  itemTextSel: {
    fontSize: 46,
    fontWeight: '800',
    color: TEXT_CLR,
    letterSpacing: -2,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();

  const [page,      setPage]      = useState(0);
  const [saving,    setSaving]    = useState(false);
  const [firstName,  setFirstName]  = useState('');
  const [chronotype, setChronotype] = useState<'AMer' | 'Neither' | 'PMer'>('Neither');
  const [wakeHour,   setWakeHour]   = useState(7);
  const [wakeMin,    setWakeMin]    = useState(0);
  const [cycles,     setCycles]     = useState(5);



  const isNavigating    = useRef(false);
  const pageTransition  = useRef(new Animated.Value(1)).current;
  const pulseAnim       = useRef(new Animated.Value(1)).current;
  const breathOuter     = useRef(new Animated.Value(1)).current;
  const breathMid       = useRef(new Animated.Value(1)).current;
  const breathInner     = useRef(new Animated.Value(1)).current;
  const mascotBreath    = useRef(new Animated.Value(1)).current;
  const mascotBlink     = useRef(new Animated.Value(1)).current;
  const btnPressAnim    = useRef(new Animated.Value(1)).current;
  const circlePulse1    = useRef(new Animated.Value(1)).current;
  const circlePulse2    = useRef(new Animated.Value(1)).current;

  const fadeAnim0 = useRef(new Animated.Value(0)).current;
  const fadeAnim1 = useRef(new Animated.Value(0)).current;
  const fadeAnim2 = useRef(new Animated.Value(0)).current;
  const fadeAnim3 = useRef(new Animated.Value(0)).current;
  const fadeAnim4 = useRef(new Animated.Value(0)).current;

  // Page 3 — R-Lo personalised greeting animation
  const rloGreetAnim  = useRef(new Animated.Value(0)).current;
  const rloGreetSlide = useRef(new Animated.Value(10)).current;

  // ── Page 1 — Cycle screen animations ─────────────────────────────────────
  // 4 phase blocks: opacity + scale, staggered 300ms each
  const phaseAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const cycleLabelAnim   = useRef(new Animated.Value(0)).current; // "= 1 cycle complet"
  const insightBoxAnim   = useRef(new Animated.Value(0)).current; // insight box
  const p1AnimDone       = useRef(false);

  // Page 1 — team items stagger animation (4 items, 250ms apart)
  const teamAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  // ── Page 0 — Myth screen animations ─────────────────────────────────────
  const p0BgNumAnim    = useRef(new Animated.Value(0)).current; // bg "8h" fade+scale
  const p0LabelAnim    = useRef(new Animated.Value(0)).current; // category label
  const p0TitleAnim    = useRef(new Animated.Value(0)).current; // title block
  const p0BodyAnim     = useRef(new Animated.Value(0)).current; // body text
  const p0StrikeAnim   = useRef(new Animated.Value(0)).current; // strikethrough width (JS driver)

  // ── Breathing circles — 3 staggered loops (like HTML prototype) ──────────
  useEffect(() => {
    // Each ring breathes independently with a delay offset → organic pulse effect
    const makeLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1.15, duration: 3000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1.00, duration: 3000, useNativeDriver: true }),
        ]),
      );
    const l1 = makeLoop(breathOuter, 0);
    const l2 = makeLoop(breathMid,   300);
    const l3 = makeLoop(breathInner,  600);
    l1.start(); l2.start(); l3.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); };
  }, [breathOuter, breathMid, breathInner]);

  // ── Slide 0 circle pulse ─────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(circlePulse1, { toValue: 1.07, duration: 2800, useNativeDriver: true }),
        Animated.timing(circlePulse1, { toValue: 1.00, duration: 2800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [circlePulse1]);

  // ── Slide 1 (Nick) circle pulse ──────────────────────────────────────────
  useEffect(() => {
    if (page !== 1) return;
    circlePulse2.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(circlePulse2, { toValue: 1.06, duration: 3400, useNativeDriver: true }),
        Animated.timing(circlePulse2, { toValue: 1.00, duration: 3400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [page, circlePulse2]);

  // ── Mascot idle animation (slides 0,3) ───────────────────────────────────
  useEffect(() => {
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotBreath, { toValue: 1.04, duration: 3200, useNativeDriver: true }),
        Animated.timing(mascotBreath, { toValue: 1.00, duration: 3200, useNativeDriver: true }),
      ]),
    );
    breathLoop.start();
    let blinkTimer: ReturnType<typeof setTimeout>;
    function scheduleBlink() {
      blinkTimer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(mascotBlink, { toValue: 0.82, duration: 90, useNativeDriver: true }),
          Animated.timing(mascotBlink, { toValue: 1.00, duration: 90, useNativeDriver: true }),
        ]).start(() => scheduleBlink());
      }, 3800 + Math.random() * 2000);
    }
    scheduleBlink();
    return () => { breathLoop.stop(); clearTimeout(blinkTimer); };
  }, [mascotBreath, mascotBlink]);

  // ── Fade-in for slide 0 (mount) ──────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim0, { toValue: 1, duration: 700, delay: 150, useNativeDriver: true }).start();
  }, [fadeAnim0]);

  // ── Page 0 — Myth screen sequential animation ────────────────────────────
  useEffect(() => {
    if (page !== 0) return;
    p0BgNumAnim.setValue(0);
    p0LabelAnim.setValue(0);
    p0TitleAnim.setValue(0);
    p0BodyAnim.setValue(0);
    p0StrikeAnim.setValue(0);

    Animated.sequence([
      // 1. bg number fades in (800ms)
      Animated.timing(p0BgNumAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      // 2. label (200ms stagger, native driver OK — translateY + opacity)
      Animated.timing(p0LabelAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      // 3. title
      Animated.timing(p0TitleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      // 4. body
      Animated.timing(p0BodyAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      // 5. strikethrough — 600ms after text visible → JS driver (width)
      Animated.delay(300),
      Animated.timing(p0StrikeAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
    ]).start();
  }, [page]);

  // ── Page 1 — Cycle visualization sequential animation ───────────────────
  useEffect(() => {
    if (page !== 1) return;
    if (p1AnimDone.current) return;
    p1AnimDone.current = true;

    phaseAnims.forEach(a => a.setValue(0));
    cycleLabelAnim.setValue(0);
    insightBoxAnim.setValue(0);

    // Stagger 4 blocks, 300ms apart, each 500ms with spring-like cubic timing
    const blockAnims = phaseAnims.map((a, i) =>
      Animated.sequence([
        Animated.delay(i * 300),
        Animated.spring(a, {
          toValue: 1,
          tension: 200,
          friction: 10,
          useNativeDriver: true,
        }),
      ])
    );

    Animated.sequence([
      Animated.parallel(blockAnims),
      Animated.delay(400),
      Animated.timing(cycleLabelAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(insightBoxAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [page]);

  // Reset p1AnimDone when leaving page 1 so it replays on re-entry
  useEffect(() => {
    if (page !== 1) {
      p1AnimDone.current = false;
    }
  }, [page]);

  // ── Fade-in for slides 2, 3, 4 (on page change) ─────────────────────────
  useEffect(() => {
    if (page === 2) {
      fadeAnim1.setValue(0);
      teamAnims.forEach(a => a.setValue(0));
      Animated.timing(fadeAnim1, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }).start(() => {
        Animated.stagger(250, teamAnims.map(a =>
          Animated.timing(a, { toValue: 1, duration: 400, useNativeDriver: true })
        )).start();
      });
    }
  }, [page, fadeAnim1]);

  useEffect(() => {
    if (page === 3) {
      fadeAnim2.setValue(0);
      Animated.timing(fadeAnim2, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }).start();
    }
  }, [page, fadeAnim2]);

  useEffect(() => {
    if (page === 4) {
      fadeAnim3.setValue(0);
      Animated.timing(fadeAnim3, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }).start();
    }
  }, [page, fadeAnim3]);

  // Page 3 — R-Lo greeting appears when firstName is long enough
  useEffect(() => {
    if (firstName.trim().length >= 2) {
      Animated.parallel([
        Animated.timing(rloGreetAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(rloGreetSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    } else {
      rloGreetAnim.setValue(0);
      rloGreetSlide.setValue(10);
    }
  }, [firstName, rloGreetAnim, rloGreetSlide]);



  // ── Pulse on last CTA ────────────────────────────────────────────────────
  useEffect(() => {
    if (page === TOTAL_PAGES - 1) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [page, pulseAnim]);

  // ── Navigation helpers ───────────────────────────────────────────────────

  const goToPage = useCallback((index: number) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    Keyboard.dismiss();
    Animated.timing(pageTransition, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setPage(index);
      Animated.timing(pageTransition, { toValue: 1, duration: 260, useNativeDriver: true }).start(() => {
        isNavigating.current = false;
      });
    });
  }, [pageTransition]);

  function handleBack() {
    if (page > 0) goToPage(page - 1);
  }

  // ── ARP helpers ──────────────────────────────────────────────────────────

  const isValidArp = wakeHour >= 4 && wakeHour <= 12;

  // ── Finish: save data → plan phase ───────────────────────────────────────

  async function finishOnboarding() {
    if (saving) return;
    setSaving(true);
    try {
      const arpMinutes = wakeHour * 60 + wakeMin;
      const name = firstName.trim() || 'there';

      // Save onboarding data (used by chat, morning confirmation, etc.)
      await saveOnboardingData({
        firstName: name,
        wakeTimeMinutes: arpMinutes,
        priority: '',     // not collected in this flow
        constraint: '',   // not collected in this flow
      });

      // Save profile (used by day plan, notifications, etc.)
      const existingProfile = await loadProfile();
      await saveProfile({
        anchorTime: arpMinutes,
        chronotype: chronotype,
        idealCyclesPerNight: cycles,
        weeklyTarget: cycles * 7,
      });

      // Bootstrap backend user
      await bootstrapUser().catch(() => {});

      // Mark intro complete and go to plan phase
      await markIntroComplete();
      await setOnboardingPhase('plan');

      HapticsSuccess();
      router.replace('/(tabs)');
    } catch {
      setSaving(false);
      Alert.alert('Setup failed', 'Could not complete setup. Please try again.');
    }
  }

  // ── Handle next button ───────────────────────────────────────────────────

  async function handleNext() {
    HapticsLight();
    Animated.sequence([
      Animated.timing(btnPressAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(btnPressAnim, { toValue: 1.00, duration: 120, useNativeDriver: true }),
    ]).start();

    if (page < TOTAL_PAGES - 1) {
      goToPage(page + 1);
    } else {
      // Last page (cycles) → finish
      await finishOnboarding();
    }
  }

  // ── Button state ─────────────────────────────────────────────────────────

  // Disable next on R-Lo+name page (page 3) if name empty
  const isNextDisabled = saving || (page === 3 && firstName.trim().length === 0);

  const nextLabel =
    page === TOTAL_PAGES - 1 ? (saving ? 'Setting up…' : 'Create my plan →') :
    page === 0               ? "Let's see →" :
    page === 1               ? 'Makes sense →' :  // Point #6 — better CTA
    page === 3               ? 'Continue →' :      // R-Lo + name
    page === 4               ? 'Continue →' :      // chronotype
    page === 5               ? 'Next →' :          // ARP
    'Next →';

  // ── Computed values for ARP result display ───────────────────────────────

  const arpTotal = wakeHour * 60 + wakeMin;
  const sleepOnset = ((arpTotal - cycles * 90) + 1440) % 1440;
  const fmtTime = (m: number) => {
    const n = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>

        {/* ── Header: back + progress bar ── */}
        <View style={s.header}>
          <Pressable
            style={[s.backBtn, page === 0 && s.backHidden]}
            onPress={handleBack}
            disabled={page === 0}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={20} color={TEXT_CLR} />
          </Pressable>
          <View style={s.progressWrap}>
            <ProgressBar value={(page + 1) / TOTAL_PAGES} color={ACCENT} height={3} />
          </View>
          {/* Skip link — educational pages only (0-2) */}
          {page <= 2 ? (
            <Pressable onPress={() => goToPage(3)} hitSlop={12} style={{ width: 36, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_MUTED }}>Skip</Text>
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {/* ── Slides pager ── */}
        <View style={s.pagerClip}>
          <Animated.View style={[s.pager, { opacity: pageTransition }]}>

            {/* ══════ PAGE 0 — "Le mythe des 8h" ══════ */}
            {page === 0 && (
              <View style={s.slide0Root}>
                {/* ÉLÉMENT 1 — Big decorative "8h" background */}
                <Animated.Text
                  pointerEvents="none"
                  style={[s.slide0BgNum, {
                    opacity: p0BgNumAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
                    transform: [{ scale: p0BgNumAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
                  }]}
                >
                  8h
                </Animated.Text>

                {/* Bottom-aligned content block */}
                <View style={s.slide0BottomBlock}>

                  {/* ÉLÉMENT 2 — Category label */}
                  <Animated.Text style={[s.slide0Label, {
                    opacity: p0LabelAnim,
                    transform: [{ translateY: p0LabelAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
                  }]}>
                    SLEEP MYTH #1
                  </Animated.Text>

                  {/* ÉLÉMENT 3 — Title with animated strikethrough */}
                  <Animated.View style={[s.slide0TitleWrap, {
                    opacity: p0TitleAnim,
                    transform: [{ translateY: p0TitleAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
                  }]}>
                    {/* "8 heures de sommeil." with animated strikethrough */}
                    <View style={s.slide0StrikeRow}>
                      <Text style={s.slide0TitleStruck}>8 hours of sleep.</Text>
                      {/* Animated strike bar — rendered over the text */}
                      <Animated.View style={[s.slide0StrikeLine, {
                        width: p0StrikeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                      }]} />
                    </View>
                    <Text style={s.slide0TitleClean}>Forget that rule.</Text>
                  </Animated.View>

                  {/* ÉLÉMENT 4 — Body text */}
                  <Animated.Text style={[s.slide0Body, {
                    opacity: p0BodyAnim,
                    transform: [{ translateY: p0BodyAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
                  }]}>
                    {"Your body doesn't recover in hours.\nIt recovers in 90-minute cycles."}
                  </Animated.Text>

                </View>
              </View>
            )}

            {/* ══════ PAGE 1 — Cycle Visualization ══════ */}
            {page === 1 && (
              <View style={s.cycleSlide}>

                {/* Label contextuel */}
                <Text style={s.cycleContextLabel}>A complete sleep cycle</Text>

                {/* 4 phase blocks */}
                <View style={s.cyclePhaseRow}>
                  {(
                    [
                      { key: 'light', label: 'Light' },
                      { key: 'deep',  label: 'Deep'  },
                      { key: 'rem',   label: 'REM'   },
                      { key: 'awake', label: 'Wake'  },
                    ] as const
                  ).map((phase, i) => {
                    const c = PHASE_COLORS[phase.key];
                    return (
                      <Animated.View
                        key={phase.key}
                        style={[
                          s.cyclePhaseBlock,
                          {
                            backgroundColor: c.bg,
                            borderColor:     c.border,
                            width: PHASE_BLOCK_W,
                            opacity: phaseAnims[i],
                            transform: [{
                              scale: phaseAnims[i].interpolate({
                                inputRange:  [0, 1],
                                outputRange: [0.8, 1],
                              }),
                            }],
                          },
                        ]}
                      >
                        <Text style={[s.cyclePhaseLabel, { color: c.text }]}>{phase.label}</Text>
                      </Animated.View>
                    );
                  })}
                </View>

                {/* Duration label */}
                <Text style={s.cycleDurationLabel}>← 90 minutes →</Text>

                {/* "= 1 full recovery cycle" — fades in after blocks */}
                <Animated.Text
                  style={[s.cycleTotalLabel, { opacity: cycleLabelAnim }]}
                >
                  = 1 full recovery cycle
                </Animated.Text>

                {/* Insight box */}
                <Animated.View
                  style={[
                    s.cycleInsightBox,
                    {
                      opacity: insightBoxAnim,
                      transform: [{
                        translateY: insightBoxAnim.interpolate({
                          inputRange:  [0, 1],
                          outputRange: [10, 0],
                        }),
                      }],
                    },
                  ]}
                >
                  <Text style={s.cycleInsightTitle}>Think in cycles, not hours</Text>
                  <Text style={s.cycleInsightBody}>
                    {"5 cycles × 90 min = 7h30 optimal sleep.\nWaking mid-cycle = fatigue. Waking at the end = energy."}
                  </Text>
                </Animated.View>

              </View>
            )}

            {/* ══════ PAGE 2 — Nick Authority + Teams ══════ */}
            {page === 2 && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={s.nickSlide}
                showsVerticalScrollIndicator={false}
              >
                <Animated.View style={{ opacity: fadeAnim1 }}>
                  {/* Nick badge */}
                  <View style={nk.badge}>
                    <View style={nk.badgeDot} />
                    <Text style={nk.badgeText}>Created by Nick Littlehales</Text>
                  </View>

                  {/* Title */}
                  <Text style={nk.title}>
                    {"The method used by\nworld champions"}
                  </Text>
                </Animated.View>

                {/* Team details — staggered list */}
                {([
                  {
                    icon:     'football-outline' as const,
                    iconColor: '#5DCAA5',
                    name:     'Manchester United',
                    sub:      'Historic treble era',
                  },
                  {
                    icon:     'bicycle-outline' as const,
                    iconColor: '#F2A623',
                    name:     'Team Sky / British Cycling',
                    sub:      '7 Tours de France, Olympic records',
                  },
                  {
                    icon:     'star-outline' as const,
                    iconColor: '#F09575',
                    name:     'Cristiano Ronaldo',
                    sub:      'R90 recovery protocols',
                  },
                  {
                    icon:     'medal-outline' as const,
                    iconColor: '#85B7EB',
                    name:     'Olympic athletes',
                    sub:      'NBA, NFL, Premier League',
                  },
                ] as const).map((item, i) => (
                  <Animated.View
                    key={i}
                    style={[nk.teamItem, {
                      opacity: teamAnims[i],
                      transform: [{
                        translateY: teamAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      }],
                    }]}
                  >
                    <View style={[nk.teamIcon, { backgroundColor: `${item.iconColor}20` }]}>
                      <Ionicons name={item.icon} size={18} color={item.iconColor} />
                    </View>
                    <View style={nk.teamText}>
                      <Text style={nk.teamName}>{item.name}</Text>
                      <Text style={nk.teamSub}>{item.sub}</Text>
                    </View>
                  </Animated.View>
                ))}
              </ScrollView>
            )}

            {/* ══════ DISABLED — Schema / Strategy (kept for future use) ══════
            {page === _DISABLED_ && (
              <View style={s.slide3Schema}>
                <Animated.View style={[s.slide3SchemaContent, { opacity: fadeAnim2 }]}>
                  <Text style={s.schemaTitle}>
                    {"Your sleep strategy is\ncalculated automatically"}
                  </Text>
                  <Image
                    source={require('../assets/shemav2.png')}
                    style={s.schemaImage}
                    resizeMode="contain"
                  />
                  <Text style={s.schemaText}>
                    {"R-Lo combines your sleep data, your schedule, and the R90 method to build your optimal sleep plan."}
                  </Text>
                </Animated.View>
              </View>
            )}
            ══════ END DISABLED ══════ */}

            {/* ══════ PAGE 3 — Meet R-Lo + Name (fused) ══════ */}
            {page === 3 && (
              <View style={s.slideV}>
                <Animated.View style={[s.meetRLoContent, { opacity: fadeAnim2 }]}>
                  {/* Mascot with speech bubble overlay */}
                  <View style={s.meetRLoMascotArea}>
                    <View style={s.meetRLoGlow} />
                    <Animated.View style={{
                      transform: [{ scale: mascotBreath }],
                      opacity: mascotBlink,
                    }}>
                      <MascotImage emotion="Enthousisate" style={s.meetRLoMascotImg} />
                    </Animated.View>

                    {/* R-Lo personalised reply — floats top-right, like a speech bubble */}
                    <Animated.View style={[
                      s.rloGreetBubble,
                      {
                        opacity: rloGreetAnim,
                        transform: [{ translateY: rloGreetSlide }],
                      },
                    ]}>
                      {/* Queue pointant vers R-Lo (bas gauche) */}
                      <View style={s.rloGreetTail} />
                      <Text style={s.rloGreetText}>
                        {`Hey ${firstName.trim()}! 🌙\nLet's build your rhythm together.`}
                      </Text>
                    </Animated.View>
                  </View>

                  {/* Speech bubble — R-Lo asks for the name */}
                  <View style={s.meetRLoBubbleWrap}>
                    <View style={s.meetRLoBubbleTip} />
                    <View style={s.meetRLoBubble}>
                      <Text style={s.meetRLoBubbleHi}>Hi, I'm R-Lo</Text>
                      <Text style={s.meetRLoBubbleText}>
                        Your rhythm companion.{'\n'}What should I call you?
                      </Text>
                      {/* Name input inside the bubble */}
                      <View style={s.nameInputWrap}>
                        <TextInput
                          style={s.nameInput}
                          placeholder="Your first name"
                          placeholderTextColor={TEXT_DIM}
                          value={firstName}
                          onChangeText={setFirstName}
                          autoCapitalize="words"
                          autoComplete="given-name"
                          autoCorrect={false}
                          returnKeyType="next"
                          onSubmitEditing={() => { if (firstName.trim().length > 0) handleNext(); }}
                        />
                        {firstName.trim().length >= 2 && (
                          <View style={s.nameCheck}>
                            <Ionicons name="checkmark" size={13} color="#fff" />
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </Animated.View>
              </View>
            )}

            {/* ══════ PAGE 4 — Chronotype ══════ */}
            {page === 4 && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={ct.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={ct.title}>{firstName.trim() ? `${firstName.trim()}, what's your chronotype?` : "What's your chronotype?"}</Text>
                <Text style={ct.subtitle}>This decides when your energy peaks and when to recover</Text>

                {([
                  {
                    id: 'AMer' as const,
                    icon: 'sunny-outline' as const,
                    iconColor: '#F2A623',
                    label: 'AMer — Early riser',
                    range: '5:30 – 7:00',
                    desc: "You're the one who's sharp at 6 AM while everyone else hits snooze. Mornings are your superpower.",
                    defaultHour: 6,
                  },
                  {
                    id: 'Neither' as const,
                    icon: 'partly-sunny-outline' as const,
                    iconColor: '#85B7EB',
                    label: 'Intermediate',
                    range: '7:00 – 8:00',
                    desc: 'You adapt to whatever life throws at you. Your sweet spot is mid-morning to early evening.',
                    defaultHour: 7,
                  },
                  {
                    id: 'PMer' as const,
                    icon: 'moon-outline' as const,
                    iconColor: '#A78BFA',
                    label: 'PMer — Night owl',
                    range: '8:00 – 10:00',
                    desc: "Your brain kicks into gear when others are winding down. Late nights are when you do your best work.",
                    defaultHour: 8,
                  },
                ]).map(opt => {
                  const selected = chronotype === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      style={[ct.card, selected && ct.cardSelected]}
                      onPress={() => {
                        HapticsLight();
                        setChronotype(opt.id);
                        setWakeHour(opt.defaultHour);
                        setWakeMin(0);
                      }}
                    >
                      <View style={ct.cardHeader}>
                        <View style={ct.cardLeft}>
                          <Ionicons
                            name={opt.icon}
                            size={18}
                            color={selected ? opt.iconColor : TEXT_MUTED}
                          />
                          <Text style={[ct.cardLabel, selected && { color: TEXT_CLR }]}>
                            {opt.label}
                          </Text>
                        </View>
                        <Text style={[ct.cardRange, selected && { color: '#F2A623' }]}>
                          {opt.range}
                        </Text>
                      </View>
                      <Text style={[ct.cardDesc, selected && { color: TEXT_SUB }]}>
                        {opt.desc}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* ══════ PAGE 5 — ARP (Anchor Time) ══════ */}
            {page === 5 && (() => {
              return (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={arp.scroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* TITRE — Point #8: make the ARP feel important */}
                  <Text style={arp.title}>When do you wake up?</Text>
                  <Text style={arp.subtitle}>This one time anchors your entire rhythm</Text>

                  {/* TIME PICKER — scroll wheel heures + minutes */}
                  <View style={arp.pickerWrap}>
                    <ScrollPicker
                      items={Array.from({ length: 24 }, (_, i) => i)}
                      selected={wakeHour}
                      onChange={(v) => { HapticsLight(); setWakeHour(v); }}
                      width={96}
                      loop
                    />
                    <Text style={arp.timeSep}>:</Text>
                    <ScrollPicker
                      items={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]}
                      selected={wakeMin}
                      onChange={(v) => { HapticsLight(); setWakeMin(v); }}
                      width={96}
                      loop
                    />
                  </View>

                  {/* Live rhythm preview — Point #8 */}
                  <View style={arp.previewRow}>
                    <View style={arp.previewItem}>
                      <Ionicons name="sunny" size={14} color="#F2A623" />
                      <Text style={arp.previewValue}>{fmtTime(arpTotal)}</Text>
                      <Text style={arp.previewLabel}>Wake</Text>
                    </View>
                    <View style={arp.previewDot} />
                    <View style={arp.previewItem}>
                      <Ionicons name="moon-outline" size={14} color="#A78BFA" />
                      <Text style={arp.previewValue}>{fmtTime(sleepOnset)}</Text>
                      <Text style={arp.previewLabel}>Sleep</Text>
                    </View>
                    <View style={arp.previewDot} />
                    <View style={arp.previewItem}>
                      <Ionicons name="bed-outline" size={14} color={ACCENT} />
                      <Text style={arp.previewValue}>{fmtTime(((sleepOnset - 60) + 1440) % 1440)}</Text>
                      <Text style={arp.previewLabel}>Wind-down</Text>
                    </View>
                  </View>

                  {/* Out-of-range warning */}
                  {!isValidArp && (
                    <View style={arp.warnBox}>
                      <Ionicons name="information-circle-outline" size={14} color={GOLD} />
                      <Text style={arp.warnText}>
                        R-Lo works best with wake times between 04:00 and 12:00.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              );
            })()}

            {/* ══════ PAGE 6 — Cycle Count ══════ */}
            {page === 6 && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={cy.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={cy.title}>How many cycles per night?</Text>
                <Text style={cy.subtitle}>Nick recommends 5 for most people</Text>

                {/* 4 cycle options in a row */}
                <View style={cy.optionRow}>
                  {([
                    { n: 3, dur: '4h30' },
                    { n: 4, dur: '6h00' },
                    { n: 5, dur: '7h30', recommended: true },
                    { n: 6, dur: '9h00' },
                  ] as const).map(opt => {
                    const sel = cycles === opt.n;
                    return (
                      <Pressable
                        key={opt.n}
                        style={[cy.option, sel && cy.optionSelected]}
                        onPress={() => { HapticsLight(); setCycles(opt.n); }}
                      >
                        <Text style={[cy.optionNum, sel && cy.optionNumSelected]}>{opt.n}</Text>
                        <Text style={[cy.optionDur, sel && cy.optionDurSelected]}>{opt.dur}</Text>
                        {'recommended' in opt && opt.recommended && (
                          <View style={cy.recBadge}>
                            <Text style={cy.recBadgeText}>Recommended</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {/* 3-cycle warning */}
                {cycles === 3 && (
                  <View style={cy.warnRow}>
                    <Ionicons name="information-circle-outline" size={14} color="#F2A623" />
                    <Text style={cy.warnText}>3 cycles require daytime CRPs to compensate.</Text>
                  </View>
                )}

                {/* Cycles per week insight — critical R90 concept */}
                <View style={cy.insightBox}>
                  <Text style={cy.insightTitle}>{cycles * 7} cycles per week</Text>
                  <Text style={cy.insightText}>
                    {cycles === 5
                      ? "That's 35 cycles per week — the gold standard Nick uses with elite athletes. Think in weeks, not nights."
                      : cycles === 6
                      ? "That's 42 cycles — optimal recovery. The same protocol used by Olympic athletes."
                      : cycles === 4
                      ? "That's 28 cycles — a solid rhythm. Many top performers start here and build up."
                      : `That's ${cycles * 7} cycles per week. Every cycle counts — you never fail, you adapt.`}
                  </Text>
                </View>
              </ScrollView>
            )}

          </Animated.View>
        </View>

        {/* ── Footer: CTA button ── */}
        <View style={s.footer}>
          <Animated.View style={{ transform: [{ scale: Animated.multiply(pulseAnim, btnPressAnim) }] }}>
            <Button
              label={nextLabel}
              onPress={handleNext}
              variant="primary"
              size="lg"
              fullWidth
              disabled={isNextDisabled}
              loading={saving}
            />
          </Animated.View>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: BG },
  safeArea: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  backHidden:   { opacity: 0 },
  progressWrap: { flex: 1 },

  // ── Pager ──
  pagerClip: { flex: 1, overflow: 'hidden' },
  pager:     { flex: 1 },

  // ── Footer ──
  footer: {
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4,
  },
  skipBtn: {
    alignItems: 'center', paddingVertical: 12,
  },
  skipBtnText: {
    fontSize: 14, fontWeight: '600', color: TEXT_MUTED,
  },

  // ── Shared slide layout ──
  slideV: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, overflow: 'hidden',
  },

  slideTitle: {
    fontSize: 30, fontWeight: '700', color: TEXT_CLR,
    textAlign: 'center', lineHeight: 42, letterSpacing: -0.5,
  },

  // ══════ PAGE 1 — Cycle Visualization ══════
  cycleSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 0,
  },
  cycleContextLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: TEXT_MUTED,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },
  cyclePhaseRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  cyclePhaseBlock: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cyclePhaseLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  cycleDurationLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 6,
  },
  cycleTotalLabel: {
    fontSize: 22,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontWeight: '400',
    color: TEXT_CLR,
    textAlign: 'center',
    marginTop: 20,
  },
  cycleInsightBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    width: '100%',
  },
  cycleInsightTitle: {
    fontSize: 17,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontWeight: '400',
    color: TEXT_CLR,
    marginBottom: 10,
  },
  cycleInsightBody: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: TEXT_SUB,
    lineHeight: 22,
  },

  // ══════ PAGE 0 — "Le mythe des 8h" ══════
  slide0Root: {
    flex: 1,
    overflow: 'hidden',
  },
  slide0BgNum: {
    position: 'absolute',
    top: -20,
    right: -20,
    fontSize: 180,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontWeight: '400',
    color: ACCENT,
    lineHeight: 180,
  },
  slide0BottomBlock: {
    position: 'absolute',
    bottom: 80,
    left: 28,
    right: 28,
    gap: 16,
  },
  slide0Label: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: ACCENT,
    marginBottom: 4,
  },
  slide0TitleWrap: {
    gap: 0,
    marginBottom: 0,
  },
  slide0StrikeRow: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  slide0TitleStruck: {
    fontSize: 32,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontWeight: '400',
    color: '#5A5852',
    lineHeight: 38,
  },
  slide0StrikeLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    height: 3,
    backgroundColor: ACCENT,
    marginTop: -1.5,
  },
  slide0TitleClean: {
    fontSize: 32,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontWeight: '400',
    color: TEXT_CLR,
    lineHeight: 38,
    marginTop: 2,
  },
  slide0Body: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#8A8780',
    lineHeight: 24,
    maxWidth: 280,
    marginTop: 0,
  },

  // ══════ PAGE 1 — Nick Authority + Teams ══════
  nickSlide: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },

  // (Legacy circle styles — kept for potential reuse)
  slide2Content: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    gap: 36, transform: [{ translateY: -52 }],
  },
  slide2CircleWrap: { alignItems: 'center', justifyContent: 'center' },
  slide2Halo: {
    position: 'absolute',
    width: CIRCLE_NICK * 1.8, height: CIRCLE_NICK * 1.8,
    borderRadius: (CIRCLE_NICK * 1.8) / 2,
    backgroundColor: TEXT_CLR,
  },
  circleGlowSilver: {
    position: 'absolute',
    width: CIRCLE_NICK * 1.35, height: CIRCLE_NICK * 1.35,
    borderRadius: (CIRCLE_NICK * 1.35) / 2,
    backgroundColor: TEXT_CLR,
  },
  circleRingSilver: {
    width: CIRCLE_NICK, height: CIRCLE_NICK,
    borderRadius: CIRCLE_NICK / 2,
    borderWidth: 1, borderColor: TEXT_CLR,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: TEXT_CLR, shadowOpacity: 0.25, shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  slide2Inner: {
    flex: 1, flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 20, gap: 10,
  },
  slide2DevelopedBy: {
    fontSize: 12, fontWeight: '600', color: TEXT_SUB,
    textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' as const,
  },
  slide2AuthorName: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF',
    textAlign: 'center', letterSpacing: -0.3,
  },
  slide2Credential: {
    fontSize: 12, fontWeight: '500', color: TEXT_CLR,
    textAlign: 'center', lineHeight: 19, paddingHorizontal: 16,
  },

  // ══════ PAGE 2 — Schema ══════
  slide3Schema: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
  },
  slide3SchemaContent: { alignItems: 'center', gap: 24, width: '100%' },
  schemaTitle: {
    fontSize: 22, fontWeight: '700', color: TEXT_CLR,
    textAlign: 'center', lineHeight: 32, letterSpacing: -0.4,
  },
  schemaImage: {
    width: '100%',
    height: Dimensions.get('window').height * 0.5,
  },
  schemaText: {
    fontSize: 13, color: TEXT_SUB, textAlign: 'center', lineHeight: 21,
  },

  // ══════ PAGE 3 — Meet R-Lo ══════
  meetRLoContent: {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    gap: 4, transform: [{ translateY: -24 }],
  },
  meetRLoMascotArea: {
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    position: 'relative',
  },
  meetRLoGlow: {
    position: 'absolute', width: 280, height: 280,
    borderRadius: 140, backgroundColor: ACCENT, opacity: 0.06,
  },
  meetRLoMascotImg: { width: 200, height: 200 },
  meetRLoBubbleWrap: { alignItems: 'center', width: '100%' },
  meetRLoBubbleTip: {
    width: 0, height: 0,
    borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 14,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: SURFACE,
  },
  meetRLoBubble: {
    backgroundColor: SURFACE, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 22,
    width: '100%', alignItems: 'center', gap: 10,
  },
  meetRLoBubbleHi: {
    fontSize: 20, fontWeight: '600', color: TEXT_CLR,
    textAlign: 'center', letterSpacing: -0.2,
  },
  meetRLoBubbleText: {
    fontSize: 16, fontWeight: '400', color: TEXT_SUB,
    textAlign: 'center', lineHeight: 26,
  },

  // ══════ PAGE 4 — First Name ══════
  nameContent: {
    alignItems: 'center', gap: 8,
  },
  nameMascotArea: {
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  nameMascotGlow: {
    position: 'absolute', width: 240, height: 240,
    borderRadius: 120, backgroundColor: ACCENT, opacity: 0.06,
  },
  nameMascotImg: {
    width: 180, height: 180,
  },
  nameTitle: {
    fontSize: 22, fontWeight: '700', color: TEXT_CLR,
    textAlign: 'center', lineHeight: 30,
    marginBottom: 20,
  },
  nameInputWrap: {
    position: 'relative', width: 280,
  },
  nameInput: {
    width: '100%', padding: 14,
    borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(28,159,218,0.25)',
    backgroundColor: SURFACE,
    color: TEXT_CLR, fontSize: 20, fontWeight: '600',
    textAlign: 'center', letterSpacing: 0.3,
  },
  nameCheck: {
    position: 'absolute', right: 14, top: '50%',
    marginTop: -11,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },

  // R-Lo greeting bubble (Step 3 personalised reply)
  rloGreetBubble: {
    position: 'absolute',
    top: -80,
    right: -10,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  rloGreetTail: {
    position: 'absolute',
    bottom: -10,
    left: 16,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 0,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: ACCENT,
  },
  rloGreetEmoji: {
    fontSize: 18,
  },
  rloGreetText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
    color: '#fff',
    lineHeight: 19,
  },

  // ══════ PAGE 5 — ARP Setup ══════
  setupContent: {
    alignItems: 'center', gap: 8,
  },
  setupTitle: {
    fontSize: 22, fontWeight: '700', color: TEXT_CLR,
    textAlign: 'center',
  },
  setupSub: {
    fontSize: 14, color: TEXT_MUTED, textAlign: 'center',
    marginBottom: 32,
  },
  timePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  timeSep: {
    fontSize: 48, fontWeight: '800', color: TEXT_MUTED,
    paddingHorizontal: 4,
  },

  // ══════ PAGE 6 — Cycle Setup ══════
  cycleSelector: {
    flexDirection: 'row', gap: 12, marginBottom: 32,
  },
  cycleOpt: {
    alignItems: 'center', gap: 6,
    paddingVertical: 16, paddingHorizontal: 20,
    borderRadius: 16, backgroundColor: SURFACE,
    borderWidth: 2, borderColor: 'transparent',
    minWidth: 90,
  },
  cycleOptSelected: {
    borderColor: ACCENT, backgroundColor: 'rgba(28,159,218,0.12)',
  },
  cycleNum: {
    fontSize: 28, fontWeight: '800', color: TEXT_CLR,
  },
  cycleNumSelected: {
    color: ACCENT,
  },
  cycleDur: {
    fontSize: 11, fontWeight: '600', color: TEXT_MUTED,
  },
  previewCard: {
    backgroundColor: SURFACE, borderRadius: 20,
    padding: 20, width: '100%',
    borderWidth: 1, borderColor: 'rgba(28,159,218,0.12)',
  },
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12,
  },
  previewDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  previewLabel: {
    fontSize: 14, fontWeight: '500', color: TEXT_MUTED,
  },
  previewValue: {
    fontSize: 17, fontWeight: '700', color: TEXT_CLR,
  },
});

// ─── Nick Authority + Teams styles ──────────────────────────────────────────

const nk = StyleSheet.create({
  badge: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    gap:               8,
    backgroundColor:   'rgba(28,159,218,0.10)',
    borderWidth:       1,
    borderColor:       'rgba(28,159,218,0.18)',
    borderRadius:      20,
    paddingVertical:   6,
    paddingHorizontal: 14,
    marginBottom:      24,
  },
  badgeDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#1c9fda',
  },
  badgeText: {
    fontSize:   12,
    fontWeight: '500',
    color:      '#1c9fda',
  },
  title: {
    fontSize:      26,
    fontWeight:    '400',
    color:         '#FFFFFF',
    lineHeight:    34,
    marginBottom:  32,
    letterSpacing: -0.3,
  },
  teamItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    backgroundColor:   '#141466',
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.06)',
    paddingVertical:   12,
    paddingHorizontal: 16,
  },
  teamIcon: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  teamText: {
    flex: 1,
    gap:  2,
  },
  teamName: {
    fontSize:   14,
    fontWeight: '700',
    color:      '#FFFFFF',
  },
  teamSub: {
    fontSize: 12,
    color:    '#6B8CAE',
  },
  // Logo circles row
  logosRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            20,
    marginBottom:   24,
  },
  logoCircleWrap: {
    alignItems: 'center',
    gap:        6,
  },
  logoCircle: {
    width:           48,
    height:          48,
    borderRadius:    24,
    borderWidth:     1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  logoEmoji: {
    fontSize: 20,
  },
  logoLabel: {
    fontSize:   10,
    fontWeight: '700',
    textAlign:  'center',
    lineHeight: 12,
  },
});

// ─── Chronotype picker styles ───────────────────────────────────────────────

// ─── ARP (Page 6) styles ─────────────────────────────────────────────────────

const arp = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontWeight: '400',
    color: TEXT_CLR,
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: TEXT_SUB,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 36,
  },

  // Wheel picker
  pickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: 12,
  },
  timeSep: {
    fontSize: 40,
    fontWeight: '300',
    color: TEXT_MUTED,
    paddingHorizontal: 6,
    marginBottom: 2,
  },

  // Out-of-range warning
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(242,166,35,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(242,166,35,0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    width: '100%',
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: GOLD,
    lineHeight: 19,
  },

  // Ideal bedtime hint
  bedtimeRow: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  bedtimeText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
    color: TEXT_SUB,
  },

  // Live rhythm preview (Point #8)
  previewRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            16,
    marginTop:      20,
    marginBottom:   8,
  },
  previewItem: {
    alignItems: 'center',
    gap:        4,
  },
  previewValue: {
    fontSize:   18,
    fontWeight: '700',
    color:      '#FFFFFF',
    letterSpacing: -0.5,
  },
  previewLabel: {
    fontSize:   11,
    fontWeight: '500',
    color:      '#6B8CAE',
  },
  previewDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // Live calc box
  calcBox: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 20,
    width: '100%',
    overflow: 'hidden',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  calcDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  calcLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calcLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: TEXT_SUB,
  },
  calcLabelBadge: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: TEXT_MUTED,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  // Wake time — neutral
  calcValueBase: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_CLR,
    fontFamily: 'Inter-Regular',
  },
  // 5 cycles — gold highlight
  calcValue5: {
    fontSize: 18,
    fontWeight: '700',
    color: GOLD,
    fontFamily: 'Inter-Regular',
  },
  // Wind-down — teal
  calcValueWind: {
    fontSize: 15,
    fontWeight: '600',
    color: TEAL,
    fontFamily: 'Inter-Regular',
  },
});

// ─── Chronotype (Page 5) styles ───────────────────────────────────────────────

const ct = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop:        16,
    paddingBottom:     24,
    gap:               12,
  },
  title: {
    fontSize:      26,
    fontWeight:    '400',
    color:         '#FFFFFF',
    lineHeight:    34,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize:   14,
    color:      '#A8C4E0',
    marginBottom: 20,
  },
  card: {
    padding:           20,
    backgroundColor:   '#141466',
    borderRadius:      16,
    borderWidth:       2,
    borderColor:       'rgba(255,255,255,0.06)',
    gap:               6,
  },
  cardSelected: {
    borderColor:     '#F2A623',
    backgroundColor: 'rgba(242,166,35,0.10)',
  },
  cardHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  cardLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      '#6B8CAE',
  },
  cardRange: {
    fontSize:   13,
    fontWeight: '500',
    color:      '#6B8CAE',
  },
  cardDesc: {
    fontSize:   13,
    color:      '#6B8CAE',
    lineHeight: 18,
    marginTop:  2,
  },
});

// ─── Cycle count picker styles ──────────────────────────────────────────────

const TEAL_CY = '#1D9E75';

const cy = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop:        16,
    paddingBottom:     24,
    gap:               16,
  },
  title: {
    fontSize:      26,
    fontWeight:    '400',
    color:         '#FFFFFF',
    lineHeight:    34,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize:     14,
    color:        '#A8C4E0',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            10,
  },
  option: {
    width:           72,
    height:          80,
    backgroundColor: '#141466',
    borderRadius:    16,
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.06)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
    position:        'relative',
    marginBottom:    16,
  },
  optionSelected: {
    borderColor:     TEAL_CY,
    backgroundColor: 'rgba(29,158,117,0.10)',
  },
  optionNum: {
    fontSize:   24,
    fontWeight: '700',
    color:      '#6B8CAE',
  },
  optionNumSelected: {
    color: TEAL_CY,
  },
  optionDur: {
    fontSize:   11,
    color:      '#6B8CAE',
  },
  optionDurSelected: {
    color: TEAL_CY,
  },
  recBadge: {
    position:        'absolute',
    bottom:          -12,
    backgroundColor: 'rgba(29,158,117,0.15)',
    borderRadius:    6,
    paddingVertical:   2,
    paddingHorizontal: 8,
  },
  recBadgeText: {
    fontSize:   10,
    fontWeight: '700',
    color:      TEAL_CY,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginTop:     4,
  },
  warnText: {
    fontSize: 13,
    color:    '#F2A623',
    flex:     1,
  },
  insightBox: {
    backgroundColor:   '#141466',
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.06)',
    padding:           20,
    gap:               8,
    marginTop:         8,
  },
  insightTitle: {
    fontSize:   18,
    fontWeight: '400',
    color:      '#FFFFFF',
    letterSpacing: -0.2,
  },
  insightText: {
    fontSize:   13,
    color:      '#A8C4E0',
    lineHeight: 20,
  },
});
