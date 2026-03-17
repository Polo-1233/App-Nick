/**
 * Onboarding — 5-screen intro pager (slides 0–4).
 *
 * Slides:
 *   0 — Premium intro     "Most sleep problems aren't sleep problems"
 *   1 — Cognitive intro   "Sleep is the result of your entire day"
 *   2 — Authority         The R90 Method / Nick Littlehales
 *   3 — Meet R-Lo         Mascot introduction
 *   4 — R-Lo focus        Home preview + R-Lo chat bubble preview
 *
 * Layout (slides 0–2):
 *   ProgressBar → TitleBlock → (flex:1) BreathingCircle → Button
 *   Title sits above the circle; explanatory text lives inside the circle.
 *
 * On finish: bootstraps the backend user record, marks intro complete,
 * then routes to /(tabs). Data collection (name, wake time, sleep issue,
 * chronotype) happens via the overlay flow in /(tabs)/_layout.tsx.
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
  useWindowDimensions,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { markIntroComplete, setOnboardingPhase } from '../lib/storage';
import { bootstrapUser } from '../lib/api';
import { HapticsLight, HapticsSuccess } from '../utils/haptics';
import { MascotImage } from '../components/ui/MascotImage';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AVSound {
  playAsync(): Promise<void>;
  stopAsync(): Promise<void>;
  unloadAsync(): Promise<void>;
  setVolumeAsync(volume: number): Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_PAGES = 4;

const DAYS_ABR            = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const CAL_PREVIEW_HEIGHTS = [28, 44, 20, 52, 36, 16, 32] as const;
const HOME_STAT_WIDTHS    = [88, 56, 72] as const;

const ACCENT  = '#33C8E8';   // turquoise brand accent
const BG      = '#0B1220';
const SURFACE = '#1A2436';
const BORDER  = '#243046';
const TEXT    = '#E6EDF7';
const TEXT_SUB  = '#9FB0C5';
const TEXT_MUTED = '#6B7F99';

const CIRCLE_SIZE = 230;
const CIRCLE_NICK = 290;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [page,   setPage]   = useState(0);
  const [saving, setSaving] = useState(false);

  const isNavigating = useRef(false);
  const translateX        = useRef(new Animated.Value(0)).current; // kept for compat, unused
  const pageTransition    = useRef(new Animated.Value(1)).current;
  const pulseAnim       = useRef(new Animated.Value(1)).current;
  const breatheAnim     = useRef(new Animated.Value(0)).current;
  const mascotBreath    = useRef(new Animated.Value(1)).current;
  const mascotBlink     = useRef(new Animated.Value(1)).current;
  const btnPressAnim    = useRef(new Animated.Value(1)).current;
  const circlePulse1      = useRef(new Animated.Value(1)).current;
  const circlePulse2      = useRef(new Animated.Value(1)).current;
  // Slide 3 — isolated animations (scope: slide only)
  const slide3MascotScale = useRef(new Animated.Value(1)).current;
  const slide3GlowOpacity = useRef(new Animated.Value(0.15)).current;
  const fadeAnim0    = useRef(new Animated.Value(0)).current;
  const fadeAnim1    = useRef(new Animated.Value(0)).current;
  const fadeAnim2    = useRef(new Animated.Value(0)).current;
  const fadeAnim3    = useRef(new Animated.Value(0)).current;
  const fadeAnim4    = useRef(new Animated.Value(0)).current;
  const dotsAnim     = useRef(new Animated.Value(0)).current;
  const messageAnim  = useRef(new Animated.Value(0)).current;
  const soundRef     = useRef<AVSound | null>(null);
  const fadeRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Breathing circle — starts on mount, runs forever ─────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 3600, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 3600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breatheAnim]);

  // ── Slide 1: circle pulse — slow 90-min cycle metaphor ─────────────────────
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

  // ── Slide 2: circle pulse — authority/silver, slow + calm ───────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(circlePulse2, { toValue: 1.06, duration: 3400, useNativeDriver: true }),
        Animated.timing(circlePulse2, { toValue: 1.00, duration: 3400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [circlePulse2]);

  // ── Slide 0: mascot idle — breathing + occasional blink ───────────────────
  useEffect(() => {
    // Slow breathing scale
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotBreath, { toValue: 1.04, duration: 3200, useNativeDriver: true }),
        Animated.timing(mascotBreath, { toValue: 1.00, duration: 3200, useNativeDriver: true }),
      ]),
    );
    breathLoop.start();

    // Blink: quick opacity dip every ~4s
    let blinkTimer: ReturnType<typeof setTimeout>;
    function scheduleBlink() {
      blinkTimer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(mascotBlink, { toValue: 0.82, duration: 90,  useNativeDriver: true }),
          Animated.timing(mascotBlink, { toValue: 1.00, duration: 90,  useNativeDriver: true }),
        ]).start(() => scheduleBlink());
      }, 3800 + Math.random() * 2000);
    }
    scheduleBlink();

    return () => { breathLoop.stop(); clearTimeout(blinkTimer); };
  }, [mascotBreath, mascotBlink]);

  // ── Slide 0: fade-in on first mount ───────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim0, {
      toValue: 1, duration: 700, delay: 150, useNativeDriver: true,
    }).start();
  }, [fadeAnim0]);

  // ── Slide 1: fade-in each time the user lands here ────────────────────────
  useEffect(() => {
    if (page === 2) {
      fadeAnim1.setValue(0);
      Animated.timing(fadeAnim1, {
        toValue: 1, duration: 600, delay: 100, useNativeDriver: true,
      }).start();
    }
  }, [page, fadeAnim1]);

  // ── Slide 2: fade-in each time the user lands here ────────────────────────
  useEffect(() => {
    if (page === 1) {
      fadeAnim2.setValue(0);
      Animated.timing(fadeAnim2, {
        toValue: 1, duration: 600, delay: 100, useNativeDriver: true,
      }).start();
    }
  }, [page, fadeAnim2]);

  // ── Slide 3 (plan mockup): fade-in ───────────────────────────────────────
  useEffect(() => {
    if (page !== 3) return;
    fadeAnim3.setValue(0);
    Animated.timing(fadeAnim3, { toValue: 1, duration: 600, delay: 80, useNativeDriver: true }).start();
  }, [page, fadeAnim3]);

  // ── Slide 4 (Meet R-Lo): fade-in + isolated mascot/glow animations ────────
  useEffect(() => {
    if (page !== 4) return;
    fadeAnim4.setValue(0);
    Animated.timing(fadeAnim4, { toValue: 1, duration: 700, delay: 80, useNativeDriver: true }).start();

    // Mascot breathing: scale 1 → 1.03, 2500ms easeInOut loop
    slide3MascotScale.setValue(1);
    const mascotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(slide3MascotScale, { toValue: 1.03, duration: 2500, useNativeDriver: true }),
        Animated.timing(slide3MascotScale, { toValue: 1.00, duration: 2500, useNativeDriver: true }),
      ]),
    );
    mascotLoop.start();

    // Glow pulse: opacity 0.15 → 0.25, 3000ms loop
    slide3GlowOpacity.setValue(0.15);
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(slide3GlowOpacity, { toValue: 0.25, duration: 3000, useNativeDriver: true }),
        Animated.timing(slide3GlowOpacity, { toValue: 0.15, duration: 3000, useNativeDriver: true }),
      ]),
    );
    glowLoop.start();

    return () => { mascotLoop.stop(); glowLoop.stop(); };
  }, [page, fadeAnim4, slide3MascotScale, slide3GlowOpacity]);

  

  // ── Pulse animation on the final CTA ──────────────────────────────────────
  useEffect(() => {
    if (page === TOTAL_PAGES - 1) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [page, pulseAnim]);

  // ── Background music ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function startMusic() {
      try {
        const { Audio } = await import('expo-av');
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: false, staysActiveInBackground: false });
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/music/music1.mp3'),
          { isLooping: true, volume: 0, shouldPlay: true },
        );
        if (!mounted) { sound.unloadAsync(); return; }
        soundRef.current = sound as unknown as AVSound;
        const TARGET = 0.35;
        const STEPS  = 30;
        const INT    = 1500 / STEPS;
        let   step   = 0;
        fadeRef.current = setInterval(() => {
          step++;
          sound.setVolumeAsync(Math.min((step / STEPS) * TARGET, TARGET));
          if (step >= STEPS) { clearInterval(fadeRef.current!); fadeRef.current = null; }
        }, INT);
      } catch { /* Audio failure must not break onboarding */ }
    }

    startMusic();

    return () => {
      mounted = false;
      if (fadeRef.current) { clearInterval(fadeRef.current); fadeRef.current = null; }
      const s = soundRef.current;
      soundRef.current = null;
      (async () => {
        try { await s?.stopAsync();   } catch { /* ignore */ }
        try { await s?.unloadAsync(); } catch { /* ignore */ }
      })();
    };
  }, []);

  const goToPage = useCallback((index: number) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    Keyboard.dismiss();
    // Fade out → swap slide (unmounts previous) → fade in
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

  async function finishIntro() {
    if (saving) return;
    setSaving(true);
    try {
      await markIntroComplete();
      await setOnboardingPhase('guided_chat');
      HapticsSuccess();
      router.replace('/(tabs)');
    } catch {
      setSaving(false);
      Alert.alert('Setup failed', 'Could not complete setup. Please try again.');
    }
  }

  async function handleNext() {
    HapticsLight();
    // Tap animation: 1 → 0.97 → 1
    Animated.sequence([
      Animated.timing(btnPressAnim, { toValue: 0.97, duration: 80,  useNativeDriver: true }),
      Animated.timing(btnPressAnim, { toValue: 1.00, duration: 120, useNativeDriver: true }),
    ]).start();
    if (page < TOTAL_PAGES - 1) {
      goToPage(page + 1);
    } else {
      await finishIntro();
    }
  }

  const isNextDisabled = saving;

  const nextLabel =
    page === TOTAL_PAGES - 1 ? (saving ? 'Setting up…' : 'Create my plan') :
    page === 0 ? "Let's fix it" :
    'Continue';

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>

        {/* ── Header: back + animated progress bar ── */}
        <View style={s.header}>
          <Pressable
            style={[s.backBtn, page === 0 && s.backHidden]}
            onPress={handleBack}
            disabled={page === 0}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={20} color={TEXT} />
          </Pressable>
          <View style={s.progressWrap}>
            <ProgressBar value={(page + 1) / TOTAL_PAGES} color={ACCENT} height={3} />
          </View>
          {/* Spacer mirrors back button for centering */}
          <View style={s.backBtn} />
        </View>

        {/* ── Slides pager ── */}
        <View style={s.pagerClip}>
          {/* Single-slide renderer — cross-fade, no adjacent slide bleed */}
          <Animated.View style={[s.pager, { opacity: pageTransition }]}>

            {/* ── Slide 0: Coach intro — R-Lo + speech bubble ──────────── */}
            {page === 0 && <View style={s.slideV}>
              <Animated.View style={[s.slide0Wrap, { opacity: fadeAnim0 }]}>

                {/* Speech bubble */}
                <View style={s.bubble}>
                  <Text style={s.bubbleText}>
                    {"Your sleep schedule is probably wrong."}
                  </Text>
                  {/* Triangle pointer pointing down toward R-Lo */}
                  <View style={s.bubbleTip} />
                </View>

                {/* R-Lo mascot — idle: breathing + blink */}
                <Animated.View style={{
                  transform: [{ scale: mascotBreath }],
                  opacity:   mascotBlink,
                  marginTop: 14,
                }}>
                  <MascotImage emotion="Fiere" style={s.slide0Mascot} />
                </Animated.View>

                {/* Supporting sentence */}
                <Text style={s.slide0Sub}>
                  {"Most people don't sleep according to their natural cycles."}
                </Text>

              </Animated.View>
            </View>}

            {/* ── Slide 3: Schéma R90 ──────────────────────────────────── */}
            {page === 2 && <View style={s.slide3Schema}>
              <Animated.View style={[s.slide3SchemaContent, { opacity: fadeAnim1 }]}>

                {/* Titre */}
                <Text style={s.schemaTitle}>
                  {"Your sleep strategy is\ncalculated automatically"}
                </Text>

                {/* ── Image schéma ── */}
                <Image
                  source={require('../assets/shemav2.png')}
                  style={s.schemaImage}
                  resizeMode="contain"
                />

                {/* Texte */}
                <Text style={s.schemaText}>
                  {"R90 Navigator combines your sleep data, your schedule, and the R90 method to build your optimal sleep plan."}
                </Text>

              </Animated.View>
            </View>}

            {/* ── Slide 2: Authority — The R90 Method ──────────────────── */}
            {page === 1 && <View style={s.slideV}>
              {/* Title + circle centered together as a unit */}
              <Animated.View style={[s.slide2Content, { opacity: fadeAnim2 }]}>

                <Text style={s.slideTitle}>{"The R90 Method"}</Text>

                {/* Silver authority circle */}
                <View style={s.slide2CircleWrap}>
                  {/* Outer halo — soft atmospheric glow */}
                  <Animated.View
                    style={[
                      s.slide2Halo,
                      {
                        opacity:   circlePulse2.interpolate({ inputRange: [1, 1.06], outputRange: [0.04, 0.10] }),
                        transform: [{ scale: circlePulse2.interpolate({ inputRange: [1, 1.06], outputRange: [1.0, 1.18] }) }],
                      },
                    ]}
                  />
                  {/* Inner glow */}
                  <Animated.View
                    style={[
                      s.circleGlowSilver,
                      {
                        opacity:   circlePulse2.interpolate({ inputRange: [1, 1.06], outputRange: [0.0, 0.06] }),
                        transform: [{ scale: circlePulse2 }],
                      },
                    ]}
                  />
                  {/* Ring — animation only on border/glow, text outside */}
                  <Animated.View
                    style={[
                      s.circleRingSilver,
                      {
                        opacity:   circlePulse2.interpolate({ inputRange: [1, 1.06], outputRange: [0.55, 0.80] }),
                        transform: [{ scale: circlePulse2 }],
                      },
                    ]}
                  />
                  {/* Text — scale with breathing, opacity always 1 */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      s.slide2Inner,
                      { transform: [{ scale: circlePulse2 }] },
                    ]}
                  >
                    <Text style={s.slide2DevelopedBy}>Developed by</Text>
                    <Text style={s.slide2AuthorName}>Nick Littlehales</Text>
                    <Text style={s.slide2Credential}>
                      {"The R90 method used by elite athletes\n(Cristiano Ronaldo, Manchester United, Team Sky)"}
                    </Text>
                  </Animated.View>
                </View>

              </Animated.View>
            </View>}

            {/* ── Slide 3: Meet R-Lo ───────────────────────────────────── */}
            {/* ── Slide 4: Plan mockup ──────────────────────────────────── */}
            {page === 3 && <View style={s.slidePlan}>
              <Animated.View style={[s.slidePlanContent, { opacity: fadeAnim3 }]}>

                {/* ── TOP: Titre ── */}
                <Text style={s.planSlideTitle}>
                  {"Every day you receive\na personalized plan"}
                </Text>

                {/* ── MIDDLE: Plan card centré ── */}
                <View style={s.planCardWrap}>
                  <View style={s.planMockCard}>
                    {/* Header */}
                    <View style={s.planMockHeader}>
                      <Text style={s.planMockTitle}>Tonight's plan</Text>
                      <View style={s.planMockBadge}><Text style={s.planMockBadgeText}>5 cycles</Text></View>
                    </View>

                    {/* Timeline */}
                    <View style={s.planTimeline}>
                      {/* Wind-down */}
                      <View style={s.planTimelineRow}>
                        <View style={s.planTrack}>
                          <View style={[s.planDot, { backgroundColor: '#A78BFA' }]} />
                          <View style={s.planConnector} />
                        </View>
                        <View style={s.planInfo}>
                          <Text style={s.planTime}>22:30</Text>
                          <Text style={s.planLabel}>Wind-down</Text>
                        </View>
                      </View>
                      {/* Bedtime */}
                      <View style={s.planTimelineRow}>
                        <View style={s.planTrack}>
                          <View style={[s.planDot, { backgroundColor: ACCENT }]} />
                          <View style={s.planConnector} />
                        </View>
                        <View style={s.planInfo}>
                          <Text style={[s.planTime, { color: ACCENT }]}>23:00</Text>
                          <Text style={s.planLabel}>Ideal bedtime · 5 cycles</Text>
                        </View>
                      </View>
                      {/* Wake */}
                      <View style={s.planTimelineRow}>
                        <View style={s.planTrack}>
                          <View style={[s.planDot, { backgroundColor: '#4ADE80' }]} />
                        </View>
                        <View style={s.planInfo}>
                          <Text style={[s.planTime, { color: '#4ADE80' }]}>06:30</Text>
                          <Text style={s.planLabel}>Wake up · ARP anchor</Text>
                        </View>
                      </View>
                    </View>

                    {/* R-Lo bubble */}
                    <View style={s.planMockBubble}>
                      <View style={s.planMockAvatar}><Text style={s.planMockAvatarText}>R</Text></View>
                      <Text style={s.planMockBubbleText}>Go to sleep at 23:00 for optimal recovery tonight.</Text>
                    </View>
                  </View>
                </View>

                {/* ── BOTTOM: Features ── */}
                <View style={s.planFeatures}>
                  {[
                    'Your optimal bedtime',
                    'Your energy prediction',
                    'Your recovery strategy',
                  ].map((f, i) => (
                    <View key={i} style={s.planFeatureRow}>
                      <Text style={s.planChevron}>›</Text>
                      <Text style={s.planFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>

              </Animated.View>
            </View>}



            {/* slide 4 removed */}
            {false && <View style={s.slide4}>

              {/* Title — centered in top third */}
              <Animated.View style={[s.slide4Title, { opacity: fadeAnim4 }]}>
                <Text style={s.slideTitle}>{"Your rhythm.\nYour coach."}</Text>
              </Animated.View>

              {/* Dimmed static home-screen skeleton (backdrop) */}
              <View style={s.slide4Preview} pointerEvents="none">
                {/* Greeting bar */}
                <View style={s.slide4GreetRow}>
                  <View style={s.slide4GreetText}>
                    <View style={s.slide4GreetLine1} />
                    <View style={s.slide4GreetLine2} />
                  </View>
                  <View style={s.slide4Avatar} />
                </View>

                {/* Cycle ring + stat chips */}
                <View style={s.slide4RingRow}>
                  <View style={s.slide4Ring}>
                    <View style={s.slide4RingInner} />
                  </View>
                  <View style={s.slide4Chips}>
                    {HOME_STAT_WIDTHS.map((w, i) => (
                      <View key={i} style={[s.slide4Chip, { width: w }]} />
                    ))}
                  </View>
                </View>

                {/* Calendar strip */}
                <View style={s.slide4Cal}>
                  {DAYS_ABR.map((day, i) => (
                    <View key={i} style={s.slide4CalCol}>
                      <View style={[s.slide4CalBar, { height: CAL_PREVIEW_HEIGHTS[i] }]} />
                      <Text style={s.slide4CalDay}>{day}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Semi-transparent scrim — dims preview, focuses eye on chat */}
              <View style={s.slide4Scrim} pointerEvents="none" />

              {/* R-Lo chat bubble — centered, full brightness */}
              <Animated.View style={[s.slide4ChatArea, { opacity: fadeAnim4 }]}>
                <Animated.View
                  style={{
                    alignSelf:  'flex-end',
                    marginBottom: 6,
                    transform: [{ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.03] }) }],
                  }}
                >
                  <MascotImage emotion="rassurante" size="sm" />
                </Animated.View>

                <View style={s.slide4Bubble}>
                  {/* Message text — always laid out to size the bubble */}
                  <Animated.Text style={[s.slide4MsgText, { opacity: messageAnim }]}>
                    {"Hi.\n\nI'm R-Lo.\n\nLet's understand\nyour rhythm."}
                  </Animated.Text>

                  {/* Typing dots — absolute overlay, fades out when message arrives */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      s.slide4DotsRow,
                      { opacity: messageAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] }) },
                    ]}
                  >
                    <Animated.View style={[s.slide4Dot, { opacity: dotsAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0.3, 1.0, 0.3, 0.3, 0.3] }) }]} />
                    <Animated.View style={[s.slide4Dot, { opacity: dotsAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0.3, 0.3, 1.0, 0.3, 0.3] }) }]} />
                    <Animated.View style={[s.slide4Dot, { opacity: dotsAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0.3, 0.3, 0.3, 1.0, 0.3] }) }]} />
                  </Animated.View>
                </View>
              </Animated.View>

              {/* Dimmed tab-bar silhouette */}
              <View style={s.slide4TabBar} pointerEvents="none">
                {[0, 1, 2, 3].map(i => <View key={i} style={s.slide4TabDot} />)}
              </View>

            </View>}

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

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:        8,
    paddingBottom:     16,
    gap:               12,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent:  'center',
    alignItems:      'center',
  },
  backHidden:   { opacity: 0 },
  progressWrap: { flex: 1 },

  // ── Pager ─────────────────────────────────────────────────────────────────
  pagerClip: { flex: 1, overflow: 'hidden' },
  pager:     { flex: 1 },   // single-slide: no row, no fixed width

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingTop:        12,
    paddingBottom:     4,
  },

  // ── Shared slide layout (slides 0, 1, 2) ──────────────────────────────────
  // The circle is the center anchor (flex:1, justifyContent:center).
  // The title floats above via absolute positioning — never pushes the circle.
  slideV: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 24,
    overflow:          'hidden',    // clip absolute glows to slide bounds
  },

  // ── Slide 0 — conversational coach intro ──────────────────────────────────
  slide0Wrap: {
    alignItems:    'center',
    justifyContent:'center',
    gap:           0,
    paddingBottom: 16,
  },
  bubble: {
    backgroundColor:  '#1A2436',
    borderRadius:     20,
    paddingVertical:  20,
    paddingHorizontal: 28,   // slightly narrower padding → bubble ~10% narrower
    alignItems:       'center',
    alignSelf:        'center',
    width:            '82%', // explicit 82% width (~10% less than full)
    borderWidth:      1,
    borderColor:      'rgba(77,163,255,0.20)',
  },
  bubbleText: {
    fontSize:      22,       // up from 20 → better readability
    fontWeight:    '700',
    color:         '#E6EDF7',
    textAlign:     'center',
    lineHeight:    32,
    letterSpacing: -0.4,
  },
  bubbleTip: {
    position:         'absolute',
    bottom:           -10,
    width:            0,
    height:           0,
    borderLeftWidth:  10,
    borderRightWidth: 10,
    borderTopWidth:   10,
    borderLeftColor:  'transparent',
    borderRightColor: 'transparent',
    borderTopColor:   '#1A2436',
  },
  slide0Mascot: {
    width:  200,   // up from 160 (+25%)
    height: 200,
  },
  slide0Sub: {
    fontSize:   15,
    color:      '#9FB0C5',
    textAlign:  'center',
    lineHeight: 24,
    marginTop:  16,
  },

  // Title — absolute, floats between progress bar and top of circle.
  // Circle center ≈ 50% of slide; circle top ≈ 35%. Title centered in 0→35% zone.
  titleArea: {
    position:          'absolute',
    top:               0,
    left:              24,
    right:             24,
    height:            '34%',
    alignItems:        'center',
    justifyContent:    'center',
  },

  titleBlock: {
    alignItems:        'center',
    paddingHorizontal: 8,
  },

  slideTitle: {
    fontSize:      30,
    fontFamily:    'Inter-Bold',
    fontWeight:    '700',
    color:         TEXT,
    textAlign:     'center',
    lineHeight:    42,
    letterSpacing: -0.5,
  },

  // ── Breathing circle container ─────────────────────────────────────────────
  // No flex — circle sits naturally in the center of slideV (justifyContent:center)
  circleCenter: {
    width:          '100%',
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Slide 1: circle + R-Lo observer layout ────────────────────────────────
  slide1Anchor: {
    width:          '100%',
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  slide1Rlo: {
    position: 'absolute',
    bottom:   -14,
    right:    '18%',  // closer to circle center, not at screen edge
  },
  slide1RloImg: {
    width:  86,   // 72 → 86 (+19%)
    height: 86,
  },

  // Turquoise glow — absolute behind the ring, centered via circleCenter
  circleGlow: {
    position:        'absolute',
    width:           CIRCLE_SIZE * 1.35,
    height:          CIRCLE_SIZE * 1.35,
    borderRadius:    (CIRCLE_SIZE * 1.35) / 2,
    backgroundColor: ACCENT,
  },

  // Turquoise ring — relative, determines layout position
  circleRing: {
    width:          CIRCLE_SIZE,
    height:         CIRCLE_SIZE,
    borderRadius:   CIRCLE_SIZE / 2,
    borderWidth:    1.5,
    borderColor:    ACCENT,
    justifyContent: 'center',
    alignItems:     'center',
    shadowColor:    ACCENT,
    shadowOpacity:  0.55,
    shadowRadius:   22,
    shadowOffset:   { width: 0, height: 0 },
  },

  // Silver ring — authority slide (slide 2)
  // ── Slide 2 layout ────────────────────────────────────────────────────────
  slide2Content: {
    alignSelf:      'stretch',      // s'étire sur toute la largeur disponible
    alignItems:     'center',       // centre les enfants horizontalement
    justifyContent: 'center',
    gap:            36,
    transform:      [{ translateY: -52 }],
  },
  slide2CircleWrap: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  slide2Halo: {
    position:        'absolute',
    width:           CIRCLE_NICK * 1.8,
    height:          CIRCLE_NICK * 1.8,
    borderRadius:    (CIRCLE_NICK * 1.8) / 2,
    backgroundColor: TEXT,
  },
  slide2Inner: {
    flex:            1,
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 20,
    gap:             10,
  },
  slide2DevelopedBy: {
    fontSize:      12,
    fontFamily:    'Inter-Regular',
    fontWeight:    '600',
    color:         TEXT_SUB,
    textAlign:     'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  slide2AuthorName: {
    fontSize:      24,
    fontFamily:    'Inter-Bold',
    fontWeight:    '800',
    color:         '#FFFFFF',
    textAlign:     'center',
    letterSpacing: -0.3,
  },
  slide2Credential: {
    fontSize:      12,
    fontFamily:    'Inter-Regular',
    fontWeight:    '500',
    color:         TEXT,
    textAlign:     'center',
    lineHeight:    19,
    paddingHorizontal: 16,
  },

  circleGlowSilver: {
    position:        'absolute',
    width:           CIRCLE_NICK * 1.35,
    height:          CIRCLE_NICK * 1.35,
    borderRadius:    (CIRCLE_NICK * 1.35) / 2,
    backgroundColor: TEXT,
  },
  circleRingSilver: {
    width:          CIRCLE_NICK,
    height:         CIRCLE_NICK,
    borderRadius:   CIRCLE_NICK / 2,
    borderWidth:    1,
    borderColor:    TEXT,
    justifyContent: 'center',
    alignItems:     'center',
    shadowColor:    TEXT,
    shadowOpacity:  0.25,
    shadowRadius:   20,
    shadowOffset:   { width: 0, height: 0 },
  },

  // ── Circle inner text ──────────────────────────────────────────────────────
  circleInnerGroup: {
    alignItems: 'center',
    gap:        16,
  },

  circleInnerText: {
    fontSize:   14,
    fontFamily: 'Inter-Regular',
    fontWeight: '500',   // Regular → Medium (+contrast)
    color:      TEXT,    // TEXT_SUB (#9FB0C5) → TEXT (#E6EDF7) — +13% brightness
    textAlign:  'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  // Slide 2 author attribution
  circleAuthorLine: {
    fontSize:   14,
    fontFamily: 'Inter-Regular',
    fontWeight: '400',
    color:      TEXT_SUB,
    textAlign:  'center',
    lineHeight: 22,
  },
  circleAuthorName: {
    fontSize:      15,
    fontFamily:    'Inter-SemiBold',
    fontWeight:    '600',
    color:         TEXT,
    letterSpacing: 0.2,
  },
  circleCredential: {
    fontSize:          12,
    fontFamily:        'Inter-Regular',
    fontWeight:        '400',
    color:             TEXT_MUTED,
    textAlign:         'center',
    lineHeight:        19,
    paddingHorizontal: 18,
  },

  // ── Rhythm lines (slide 1 — inside ring) ──────────────────────────────────
  circleRhythmWrap: {
    justifyContent: 'center',
    alignItems:     'center',
  },
  rhythmLines: {
    alignItems: 'center',
    gap:        26,
  },
  rhythmLine: {
    width:           110,
    height:          1,
    backgroundColor: ACCENT,
    borderRadius:    1,
  },

  // ── Slide 4 — Plan mockup ─────────────────────────────────────────────────
  slidePlan: {
    flex:              1,
    paddingHorizontal: 24,
  },
  slidePlanContent: {
    flex:            1,
    width:           '100%',
    flexDirection:   'column',
    justifyContent:  'space-between',
    paddingTop:      4,
    paddingBottom:   8,
  },
  planSlideTitle: {
    fontSize:      24,
    fontWeight:    '700',
    color:         TEXT,
    textAlign:     'center',
    lineHeight:    33,
    letterSpacing: -0.4,
    marginTop:     23,
    marginBottom:  8,
  },
  planCardWrap: {
    flex:           1,
    justifyContent: 'center',
    paddingBottom:  28,
  },
  planMockCard: {
    width:           '100%',
    backgroundColor: SURFACE,
    borderRadius:    20,
    padding:         18,
    borderWidth:     1,
    borderColor:     BORDER,
    gap:             14,
  },
  planMockHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  planMockTitle:     { fontSize: 14, fontWeight: '700', color: TEXT },
  planMockBadge:     { backgroundColor: `${ACCENT}18`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: `${ACCENT}50` },
  planMockBadgeText: { fontSize: 11, fontWeight: '600', color: ACCENT },
  // Timeline
  planTimeline:      { gap: 0 },
  planTimelineRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, minHeight: 44 },
  planTrack:         { alignItems: 'center', width: 12 },
  planDot:           { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  planConnector:     { flex: 1, width: 2, backgroundColor: BORDER, marginVertical: 3 },
  planInfo:          { flex: 1, paddingBottom: 10 },
  planTime:          { fontSize: 18, fontWeight: '800', color: TEXT, letterSpacing: -0.3 },
  planLabel:         { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  // R-Lo bubble
  planMockBubble:    { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: BG, borderRadius: 12, padding: 12 },
  planMockAvatar:    { width: 26, height: 26, borderRadius: 13, backgroundColor: `${ACCENT}25`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${ACCENT}40` },
  planMockAvatarText:{ fontSize: 12, fontWeight: '800', color: ACCENT },
  planMockBubbleText:{ flex: 1, fontSize: 12, color: TEXT_SUB, lineHeight: 18 },
  // Features
  planFeatures:   { gap: 12, marginBottom: 54, marginTop: -8, width: '100%', paddingHorizontal: 20 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planChevron:    { fontSize: 20, fontWeight: '700', color: '#00D4FF', lineHeight: 24 },
  planFeatureText:{ fontSize: 14, color: '#A0AEC0' },

  // ── Slide 3 — Schéma R90 ──────────────────────────────────────────────────
  slide3Schema: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 28,
  },
  slide3SchemaContent: {
    alignItems: 'center',
    gap:        24,
    width:      '100%',
  },
  schemaTitle: {
    fontSize:      22,
    fontWeight:    '700',
    color:         TEXT,
    textAlign:     'center',
    lineHeight:    32,
    letterSpacing: -0.4,
  },
  schemaImage: {
    width:  '100%',
    height: Dimensions.get('window').height * 0.5,
  },
  schemaText: {
    fontSize:   13,
    color:      TEXT_SUB,
    textAlign:  'center',
    lineHeight: 21,
  },

  // ── Slide 4 — Meet R-Lo (Duolingo style) ─────────────────────────────────
  slide3: {
    flex:              1,
    paddingHorizontal: 32,
    alignItems:        'center',
    justifyContent:    'center',
    overflow:          'hidden',    // clip glow to slide bounds
  },
  slide3Content: {
    width:          '100%',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
    transform:      [{ translateY: -24 }], // optical lift
  },
  slide3MascotArea: {
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   4,
  },
  slide3Glow: {
    position:        'absolute',
    width:           280,
    height:          280,
    borderRadius:    140,
    backgroundColor: ACCENT,
  },

  // Speech bubble
  slide3BubbleWrap: {
    alignItems: 'center',
    width:      '100%',
  },
  slide3BubbleTip: {
    width:             0,
    height:            0,
    borderLeftWidth:   12,
    borderRightWidth:  12,
    borderBottomWidth: 14,
    borderLeftColor:   'transparent',
    borderRightColor:  'transparent',
    borderBottomColor: SURFACE,
  },
  slide3Bubble: {
    backgroundColor:   SURFACE,
    borderRadius:      20,
    paddingHorizontal: 24,
    paddingVertical:   22,
    width:             '100%',
    alignItems:        'center',
    gap:               10,
  },
  slide3BubbleHi: {
    fontSize:      20,
    fontFamily:    'Inter-SemiBold',
    fontWeight:    '600',
    color:         TEXT,
    textAlign:     'center',
    letterSpacing: -0.2,
  },
  slide3BubbleText: {
    fontSize:   16,
    fontFamily: 'Inter-Regular',
    fontWeight: '400',
    color:      TEXT_SUB,
    textAlign:  'center',
    lineHeight: 26,
  },

  // ── Slide 4 — R-Lo focus / home preview ──────────────────────────────────
  slide4: {
    flex:     1,
    overflow: 'hidden',
  },
  slide4Title: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    alignItems:        'center',
    justifyContent:    'center',
    height:            '38%',
    zIndex:            10,
    paddingHorizontal: 24,
  },
  slide4Preview: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    bottom:            0,
    paddingHorizontal: 24,
    paddingTop:        16,
    opacity:           0.22,
    gap:               20,
  },
  slide4GreetRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  slide4GreetText:  { gap: 6 },
  slide4GreetLine1: {
    width:           110,
    height:          10,
    borderRadius:    5,
    backgroundColor: TEXT,
  },
  slide4GreetLine2: {
    width:           72,
    height:          8,
    borderRadius:    4,
    backgroundColor: TEXT_SUB,
  },
  slide4Avatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: SURFACE,
    borderWidth:     1,
    borderColor:     BORDER,
  },
  slide4RingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           20,
  },
  slide4Ring: {
    width:           80,
    height:          80,
    borderRadius:    40,
    borderWidth:     6,
    borderColor:     ACCENT,
    justifyContent:  'center',
    alignItems:      'center',
  },
  slide4RingInner: {
    width:           50,
    height:          12,
    borderRadius:    6,
    backgroundColor: TEXT_SUB,
  },
  slide4Chips: { gap: 8 },
  slide4Chip: {
    height:          12,
    borderRadius:    6,
    backgroundColor: SURFACE,
    borderWidth:     1,
    borderColor:     BORDER,
  },
  slide4Cal: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
  },
  slide4CalCol: {
    alignItems: 'center',
    gap:        4,
  },
  slide4CalBar: {
    width:           28,
    borderRadius:    6,
    backgroundColor: ACCENT,
  },
  slide4CalDay: {
    fontSize:   10,
    fontFamily: 'Inter-Medium',
    color:      TEXT_MUTED,
  },
  slide4Scrim: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: 'rgba(11,18,32,0.58)',
  },
  slide4ChatArea: {
    position:          'absolute',
    top:               '40%',
    left:              0,
    right:             0,
    bottom:            56,
    flexDirection:     'row',
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 28,
    gap:               12,
  },
  slide4Bubble: {
    flex:                1,
    backgroundColor:     SURFACE,
    borderRadius:        18,
    borderTopLeftRadius: 4,
    padding:             20,
    borderWidth:         1,
    borderColor:         BORDER,
    minHeight:           120,
  },
  slide4DotsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  slide4Dot: {
    width:           9,
    height:          9,
    borderRadius:    4.5,
    backgroundColor: TEXT_SUB,
  },
  slide4MsgText: {
    fontSize:   18,
    fontFamily: 'Inter-Regular',
    fontWeight: '400',
    color:      TEXT,
    lineHeight: 30,
  },
  slide4TabBar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    height:            56,
    backgroundColor:   BG,
    borderTopWidth:    1,
    borderTopColor:    BORDER,
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'center',
    opacity:           0.22,
  },
  slide4TabDot: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: SURFACE,
  },
});
