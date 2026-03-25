/**
 * Onboarding — 6-step linear flow.
 *
 * Steps:
 *   0 — "Your sleep is the result of your entire day" (R-Lo speech bubble)
 *   1 — "The R90 Method" (Nick Littlehales authority circle)
 *   2 — "Meet R-Lo" (mascot + speech bubble)
 *   3 — First name input
 *   4 — Anchor time (ARP) picker
 *   5 — Cycle count selector (4 / 5 / 6)
 *
 * DISABLED (kept in code):
 *   — "Your sleep strategy is calculated automatically" (schema image)
 *
 * On finish (step 6 → Continue):
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

const TOTAL_PAGES = 6;

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
  const [firstName, setFirstName] = useState('');
  const [wakeHour,  setWakeHour]  = useState(6);
  const [wakeMin,   setWakeMin]   = useState(30);
  const [cycles,    setCycles]    = useState(5);

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

  // ── Fade-in for slides 1, 2, 3 (on page change) ─────────────────────────
  useEffect(() => {
    if (page === 1) {
      fadeAnim1.setValue(0);
      Animated.timing(fadeAnim1, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }).start();
    }
  }, [page, fadeAnim1]);

  useEffect(() => {
    if (page === 2) {
      fadeAnim2.setValue(0);
      Animated.timing(fadeAnim2, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }).start();
    }
  }, [page, fadeAnim2]);

  useEffect(() => {
    if (page === 3) {
      fadeAnim3.setValue(0);
      Animated.timing(fadeAnim3, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }).start();
    }
  }, [page, fadeAnim3]);

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
        chronotype: existingProfile?.chronotype ?? 'Neither',
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

  // Disable next on name page (page 3) if empty
  const isNextDisabled = saving || (page === 3 && firstName.trim().length === 0);

  const nextLabel =
    page === TOTAL_PAGES - 1 ? (saving ? 'Setting up…' : 'Create my plan →') :
    page === 0               ? "Let's see →" :
    page === 2               ? 'Get started →' :
    page === 3               ? 'Continue →' :
    page === 4               ? 'Next →' :
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
          <View style={{ width: 36 }} />
        </View>

        {/* ── Slides pager ── */}
        <View style={s.pagerClip}>
          <Animated.View style={[s.pager, { opacity: pageTransition }]}>

            {/* ══════ PAGE 0 — Breathing circles + "Your sleep is the result…" ══════ */}
            {page === 0 && (
              <View style={s.slideV}>
                <Animated.View style={[s.slide0Wrap, { opacity: fadeAnim0 }]}>
                  {/* Breathing concentric circles — staggered pulse */}
                  <View style={s.breathWrap}>
                    <Animated.View style={[
                      s.breathCircle, s.breathOuterStyle,
                      { transform: [{ scale: breathOuter }] },
                    ]} />
                    <Animated.View style={[
                      s.breathCircle, s.breathMidStyle,
                      { transform: [{ scale: breathMid }] },
                    ]} />
                    <Animated.View style={[
                      s.breathCircle, s.breathInnerStyle,
                      { transform: [{ scale: breathInner }] },
                    ]} />
                    <View style={[s.breathCircle, s.breathCore]} />
                  </View>

                  {/* Title */}
                  <Text style={s.slide0Title}>
                    {"Your sleep is the result of your entire day"}
                  </Text>

                  {/* Subtitle */}
                  <Text style={s.slide0Sub}>
                    {"Not just what happens at night. R90 helps you build a rhythm that works."}
                  </Text>
                </Animated.View>
              </View>
            )}

            {/* ══════ PAGE 1 — Nick / R90 Method ══════ */}
            {page === 1 && (
              <View style={s.slideV}>
                <Animated.View style={[s.slide2Content, { opacity: fadeAnim1 }]}>
                  <Text style={s.slideTitle}>{"The R90 Method"}</Text>
                  <View style={s.slide2CircleWrap}>
                    <Animated.View style={[s.slide2Halo, {
                      opacity: circlePulse2.interpolate({ inputRange: [1, 1.06], outputRange: [0.04, 0.10] }),
                      transform: [{ scale: circlePulse2.interpolate({ inputRange: [1, 1.06], outputRange: [1.0, 1.18] }) }],
                    }]} />
                    <Animated.View style={[s.circleGlowSilver, {
                      opacity: circlePulse2.interpolate({ inputRange: [1, 1.06], outputRange: [0.0, 0.06] }),
                      transform: [{ scale: circlePulse2 }],
                    }]} />
                    <Animated.View style={[s.circleRingSilver, {
                      opacity: circlePulse2.interpolate({ inputRange: [1, 1.06], outputRange: [0.55, 0.80] }),
                      transform: [{ scale: circlePulse2 }],
                    }]} />
                    <Animated.View style={[StyleSheet.absoluteFill, s.slide2Inner, { transform: [{ scale: circlePulse2 }] }]}>
                      <Text style={s.slide2DevelopedBy}>Developed by</Text>
                      <Text style={s.slide2AuthorName}>Nick Littlehales</Text>
                      <Text style={s.slide2Credential}>
                        {"The R90 method used by elite athletes\n(Cristiano Ronaldo, Manchester United, Team Sky)"}
                      </Text>
                    </Animated.View>
                  </View>
                </Animated.View>
              </View>
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

            {/* ══════ PAGE 2 — Meet R-Lo ══════ */}
            {page === 2 && (
              <View style={s.slideV}>
                <Animated.View style={[s.meetRLoContent, { opacity: fadeAnim2 }]}>
                  {/* Mascot with glow */}
                  <View style={s.meetRLoMascotArea}>
                    <View style={s.meetRLoGlow} />
                    <Animated.View style={{
                      transform: [{ scale: mascotBreath }],
                      opacity: mascotBlink,
                    }}>
                      <MascotImage emotion="Enthousisate" style={s.meetRLoMascotImg} />
                    </Animated.View>
                  </View>
                  {/* Speech bubble pointing up to mascot */}
                  <View style={s.meetRLoBubbleWrap}>
                    <View style={s.meetRLoBubbleTip} />
                    <View style={s.meetRLoBubble}>
                      <Text style={s.meetRLoBubbleHi}>Hi, I'm R-Lo</Text>
                      <Text style={s.meetRLoBubbleText}>
                        {"Your rhythm companion.\n\nI help you move through your day\nin sync with your natural cycles."}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            )}

            {/* ══════ PAGE 3 — First Name ══════ */}
            {page === 3 && (
              <View style={s.slideV}>
                <View style={s.nameContent}>
                  <View style={s.nameMascotArea}>
                    <View style={s.nameMascotGlow} />
                    <MascotImage emotion="encourageant" style={s.nameMascotImg} />
                  </View>
                  <Text style={s.nameTitle}>What should R-Lo call you?</Text>
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
            )}

            {/* ══════ PAGE 4 — ARP (Anchor Time) — scroll picker ══════ */}
            {page === 4 && (
              <View style={s.slideV}>
                <View style={s.setupContent}>
                  <Text style={s.setupTitle}>When do you wake up?</Text>
                  <Text style={s.setupSub}>This anchors your entire rhythm</Text>
                  <View style={s.timePicker}>
                    <ScrollPicker
                      items={Array.from({ length: 24 }, (_, i) => i)}
                      selected={wakeHour}
                      onChange={setWakeHour}
                      width={100}
                      loop
                    />
                    <Text style={s.timeSep}>:</Text>
                    <ScrollPicker
                      items={[0, 15, 30, 45]}
                      selected={wakeMin}
                      onChange={setWakeMin}
                      width={100}
                      loop
                    />
                  </View>
                </View>
              </View>
            )}

            {/* ══════ PAGE 5 — Cycle Count ══════ */}
            {page === 5 && (
              <View style={s.slideV}>
                <View style={s.setupContent}>
                  <Text style={s.setupTitle}>How many cycles?</Text>
                  <Text style={s.setupSub}>Each cycle is 90 minutes of sleep</Text>
                  <View style={s.cycleSelector}>
                    {[
                      { n: 4, dur: '6h' },
                      { n: 5, dur: '7h30' },
                      { n: 6, dur: '9h' },
                    ].map(({ n, dur }) => (
                      <Pressable
                        key={n}
                        style={[s.cycleOpt, cycles === n && s.cycleOptSelected]}
                        onPress={() => { HapticsLight(); setCycles(n); }}
                      >
                        <Text style={[s.cycleNum, cycles === n && s.cycleNumSelected]}>{n}</Text>
                        <Text style={s.cycleDur}>{dur}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Preview card */}
                  <View style={s.previewCard}>
                    <View style={s.previewRow}>
                      <Text style={s.previewLabel}>Wake-up</Text>
                      <Text style={[s.previewValue, { color: ACCENT }]}>{fmtTime(arpTotal)}</Text>
                    </View>
                    <View style={s.previewDivider} />
                    <View style={s.previewRow}>
                      <Text style={s.previewLabel}>Sleep window</Text>
                      <Text style={s.previewValue}>{fmtTime(sleepOnset)}</Text>
                    </View>
                    <View style={s.previewDivider} />
                    <View style={s.previewRow}>
                      <Text style={s.previewLabel}>Cycles</Text>
                      <Text style={s.previewValue}>{cycles} × 90 min</Text>
                    </View>
                  </View>
                </View>
              </View>
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

  // ══════ PAGE 0 — Breathing circles ══════
  slide0Wrap: {
    alignItems: 'center', justifyContent: 'center', gap: 0, paddingBottom: 16,
  },
  breathWrap: {
    width: 230, height: 230,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 40,
  },
  breathCircle: {
    position: 'absolute', borderRadius: 9999,
  },
  breathOuterStyle: {
    width: 230, height: 230,
    backgroundColor: 'rgba(28,159,218,0.06)',
  },
  breathMidStyle: {
    width: 165, height: 165,
    backgroundColor: 'rgba(28,159,218,0.10)',
  },
  breathInnerStyle: {
    width: 105, height: 105,
    backgroundColor: 'rgba(28,159,218,0.18)',
  },
  breathCore: {
    width: 55, height: 55,
    backgroundColor: ACCENT,
    opacity: 0.3,
  },
  slide0Title: {
    fontSize: 26, fontWeight: '700', color: TEXT_CLR,
    textAlign: 'center', lineHeight: 34, letterSpacing: -0.3,
    marginBottom: 12,
  },
  slide0Sub: {
    fontSize: 15, color: '#9FB0C5', textAlign: 'center',
    lineHeight: 24, maxWidth: 300,
  },

  // ══════ PAGE 1 — Nick / R90 Method ══════
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
