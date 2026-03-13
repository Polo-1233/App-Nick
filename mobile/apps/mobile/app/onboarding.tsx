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
  StyleSheet,
  Pressable,
  Alert,
  Keyboard,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { markIntroComplete } from '../lib/storage';
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

const TOTAL_PAGES = 5;

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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [page,   setPage]   = useState(0);
  const [saving, setSaving] = useState(false);

  const isNavigating = useRef(false);
  const translateX   = useRef(new Animated.Value(0)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const breatheAnim  = useRef(new Animated.Value(0)).current;
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

  // ── Slide 0: fade-in on first mount ───────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim0, {
      toValue: 1, duration: 700, delay: 150, useNativeDriver: true,
    }).start();
  }, [fadeAnim0]);

  // ── Slide 1: fade-in each time the user lands here ────────────────────────
  useEffect(() => {
    if (page === 1) {
      fadeAnim1.setValue(0);
      Animated.timing(fadeAnim1, {
        toValue: 1, duration: 600, delay: 100, useNativeDriver: true,
      }).start();
    }
  }, [page, fadeAnim1]);

  // ── Slide 2: fade-in each time the user lands here ────────────────────────
  useEffect(() => {
    if (page === 2) {
      fadeAnim2.setValue(0);
      Animated.timing(fadeAnim2, {
        toValue: 1, duration: 600, delay: 100, useNativeDriver: true,
      }).start();
    }
  }, [page, fadeAnim2]);

  // ── Slide 3: fade-in each time the user lands here ────────────────────────
  useEffect(() => {
    if (page === 3) {
      fadeAnim3.setValue(0);
      Animated.timing(fadeAnim3, {
        toValue: 1, duration: 700, delay: 80, useNativeDriver: true,
      }).start();
    }
  }, [page, fadeAnim3]);

  // ── Slide 4: typing indicator → message reveal ────────────────────────────
  useEffect(() => {
    if (page !== 4) return;
    fadeAnim4.setValue(0);
    messageAnim.setValue(0);
    dotsAnim.setValue(0);

    Animated.timing(fadeAnim4, {
      toValue: 1, duration: 500, delay: 100, useNativeDriver: true,
    }).start();

    const dotsLoop = Animated.loop(
      Animated.timing(dotsAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
    );
    dotsLoop.start();

    const timer = setTimeout(() => {
      dotsLoop.stop();
      Animated.timing(messageAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 2100);

    return () => { clearTimeout(timer); dotsLoop.stop(); };
  }, [page, fadeAnim4, dotsAnim, messageAnim]);

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
    Animated.timing(translateX, {
      toValue: -index * windowWidth, duration: 320, useNativeDriver: true,
    }).start(() => { isNavigating.current = false; });
    setPage(index);
  }, [translateX, windowWidth]);

  function handleBack() {
    if (page > 0) goToPage(page - 1);
  }

  async function finishIntro() {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.all([bootstrapUser(), markIntroComplete()]);
      setSaving(false);
      HapticsSuccess();
      router.replace('/(tabs)');
    } catch {
      setSaving(false);
      Alert.alert('Setup failed', 'Could not complete setup. Please try again.');
    }
  }

  async function handleNext() {
    HapticsLight();
    if (page < TOTAL_PAGES - 1) {
      goToPage(page + 1);
    } else {
      await finishIntro();
    }
  }

  const isNextDisabled = saving;

  const nextLabel =
    page === TOTAL_PAGES - 1 ? (saving ? 'Setting up…' : 'Begin with R-Lo') :
    page === 3               ? 'Begin with R-Lo' :
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
          <Animated.View
            style={[
              s.pager,
              { width: windowWidth * TOTAL_PAGES, transform: [{ translateX }] },
            ]}
          >

            {/* ── Slide 0: Premium intro ────────────────────────────────── */}
            <View style={[s.slideV, { width: windowWidth }]}>

              {/* Title — centered between header and circle */}
              <View style={s.titleArea}>
                <Animated.View style={[s.titleBlock, { opacity: fadeAnim0 }]}>
                  <Text style={s.slideTitle}>
                    {"Most sleep problems\naren't sleep problems"}
                  </Text>
                </Animated.View>
              </View>

              {/* Breathing circle — vertical center of remaining space */}
              <View style={s.circleCenter}>
                {/* Glow orb (absolute, sits behind the ring) */}
                <Animated.View
                  style={[
                    s.circleGlow,
                    {
                      opacity:   breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.10, 0.0] }),
                      transform: [{ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.18] }) }],
                    },
                  ]}
                />
                {/* Ring with inner explanatory text */}
                <Animated.View
                  style={[
                    s.circleRing,
                    {
                      opacity:   breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.88, 0.55] }),
                      transform: [{ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.08] }) }],
                    },
                  ]}
                >
                  <Animated.Text style={[s.circleInnerText, { opacity: fadeAnim0 }]}>
                    {"Your body runs on\n90-minute recovery cycles."}
                  </Animated.Text>
                </Animated.View>
              </View>

            </View>

            {/* ── Slide 1: Cognitive intro ──────────────────────────────── */}
            <View style={[s.slideV, { width: windowWidth }]}>

              <View style={s.titleArea}>
                <Animated.View style={[s.titleBlock, { opacity: fadeAnim1 }]}>
                  <Text style={s.slideTitle}>
                    {"Sleep is the result\nof your entire day"}
                  </Text>
                </Animated.View>
              </View>

              {/* Breathing circle */}
              <View style={s.circleCenter}>
                <Animated.View
                  style={[
                    s.circleGlow,
                    {
                      opacity:   breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.08, 0.0] }),
                      transform: [{ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.18] }) }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    s.circleRing,
                    {
                      opacity:   breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.48, 0.78, 0.48] }),
                      transform: [{ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.08] }) }],
                    },
                  ]}
                >
                  {/* Rhythm lines — faint horizontal markers behind text */}
                  <View style={[StyleSheet.absoluteFill, s.circleRhythmWrap]} pointerEvents="none">
                    <View style={s.rhythmLines}>
                      <Animated.View style={[s.rhythmLine, { opacity: breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.04, 0.12, 0.04] }) }]} />
                      <Animated.View style={[s.rhythmLine, { opacity: breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.06, 0.18, 0.06] }) }]} />
                      <Animated.View style={[s.rhythmLine, { opacity: breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.04, 0.12, 0.04] }) }]} />
                    </View>
                  </View>

                  {/* Text stanzas */}
                  <Animated.View style={[s.circleInnerGroup, { opacity: fadeAnim1 }]}>
                    <Text style={s.circleInnerText}>{"Your energy follows\nbiological cycles."}</Text>
                    <Text style={s.circleInnerText}>{"Most people live\nagainst them."}</Text>
                  </Animated.View>
                </Animated.View>
              </View>

            </View>

            {/* ── Slide 2: Authority — The R90 Method ──────────────────── */}
            <View style={[s.slideV, { width: windowWidth }]}>

              <View style={s.titleArea}>
                <Animated.View style={[s.titleBlock, { opacity: fadeAnim2 }]}>
                  <Text style={s.slideTitle}>{"The R90 Method"}</Text>
                </Animated.View>
              </View>

              {/* Silver breathing circle — authority palette */}
              <View style={s.circleCenter}>
                <Animated.View
                  style={[
                    s.circleGlowSilver,
                    {
                      opacity:   breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.05, 0.0] }),
                      transform: [{ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.18] }) }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    s.circleRingSilver,
                    {
                      opacity:   breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.28, 0.52, 0.28] }),
                      transform: [{ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.06] }) }],
                    },
                  ]}
                >
                  <Animated.View style={[s.circleInnerGroup, { opacity: fadeAnim2 }]}>
                    <Text style={s.circleAuthorLine}>
                      {'Developed by\n'}
                      <Text style={s.circleAuthorName}>{'Nick Littlehales.'}</Text>
                    </Text>
                    <Text style={s.circleCredential}>
                      {"Sleep coach to elite athletes\nand high-performance teams."}
                    </Text>
                  </Animated.View>
                </Animated.View>
              </View>

            </View>

            {/* ── Slide 3: Meet R-Lo — Duolingo style ──────────────────── */}
            <View style={[s.slide3, { width: windowWidth }]}>
              <Animated.View style={[s.slide3Content, { opacity: fadeAnim3 }]}>

                {/* Mascot — large, centered, gently breathing */}
                <View style={s.slide3MascotArea}>
                  <Animated.View
                    style={[
                      s.slide3Glow,
                      {
                        opacity:   breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.06, 0.20, 0.06] }),
                        transform: [{ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.16] }) }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={{
                      transform: [{ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.04] }) }],
                    }}
                  >
                    <MascotImage emotion="encourageant" size="xl" />
                  </Animated.View>
                </View>

                {/* Speech bubble — Duolingo style */}
                <View style={s.slide3BubbleWrap}>
                  {/* Triangle pointer pointing up toward mascot */}
                  <View style={s.slide3BubbleTip} />
                  <View style={s.slide3Bubble}>
                    <Text style={s.slide3BubbleName}>R-Lo</Text>
                    <Text style={s.slide3BubbleText}>
                      {"Hi! I'm your personal sleep coach.\nI'll help you align your day\nwith your biology."}
                    </Text>
                  </View>
                </View>

              </Animated.View>
            </View>

            {/* ── Slide 4: R-Lo focus — home preview + chat ───────────── */}
            <View style={[s.slide4, { width: windowWidth }]}>

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

            </View>

          </Animated.View>
        </View>

        {/* ── Footer: CTA button ── */}
        <View style={s.footer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
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
  pager:     { flex: 1, flexDirection: 'row' },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingTop:        12,
    paddingBottom:     4,
  },

  // ── Shared slide layout (slides 0, 1, 2) ──────────────────────────────────
  slideV: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: 24,
  },

  // Title floats centered between the header bar and the breathing circle
  titleArea: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
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
  // Fixed height = circle + glow headroom. Title fills flex:1 space above.
  circleCenter: {
    width:          '100%',
    height:         CIRCLE_SIZE * 1.5,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   16,
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
  circleGlowSilver: {
    position:        'absolute',
    width:           CIRCLE_SIZE * 1.35,
    height:          CIRCLE_SIZE * 1.35,
    borderRadius:    (CIRCLE_SIZE * 1.35) / 2,
    backgroundColor: TEXT,
  },
  circleRingSilver: {
    width:          CIRCLE_SIZE,
    height:         CIRCLE_SIZE,
    borderRadius:   CIRCLE_SIZE / 2,
    borderWidth:    1,
    borderColor:    TEXT,
    justifyContent: 'center',
    alignItems:     'center',
    shadowColor:    TEXT,
    shadowOpacity:  0.2,
    shadowRadius:   14,
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
    fontWeight: '400',
    color:      TEXT_SUB,
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

  // ── Slide 3 — Meet R-Lo (Duolingo style) ─────────────────────────────────
  slide3: {
    flex:              1,
    paddingHorizontal: 32,
    alignItems:        'center',
  },
  slide3Content: {
    flex:           1,
    width:          '100%',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            0,
  },
  slide3MascotArea: {
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   -8,
  },
  slide3Glow: {
    position:        'absolute',
    width:           260,
    height:          260,
    borderRadius:    130,
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
    paddingVertical:   20,
    width:             '100%',
    alignItems:        'center',
    gap:               8,
  },
  slide3BubbleName: {
    fontSize:      12,
    fontFamily:    'Inter-SemiBold',
    fontWeight:    '600',
    color:         ACCENT,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  slide3BubbleText: {
    fontSize:   17,
    fontFamily: 'Inter-Regular',
    fontWeight: '400',
    color:      TEXT,
    textAlign:  'center',
    lineHeight: 27,
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
