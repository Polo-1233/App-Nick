/**
 * Onboarding — 6-screen personalization flow (horizontal pager).
 *
 * Slides:
 *   0 — Welcome        R-Lo mascot (Enthousisate), R90 title, tagline
 *   1 — How it works   Sleep cycles science
 *   2 — Chronotype     AMer / Neither / PMer selection
 *   3 — Cycles target  4 or 5 cycles per night
 *   4 — ARP            Wake-up time (Anchor Rise Point)
 *   5 — Final          Celebration, pulsing CTA
 *
 * On Finish: saves UserProfile + OnboardingData, then routes to Home.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Keyboard,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatTime } from '@r90/core';
import { saveProfile, saveOnboardingData } from '../lib/storage';
import { bootstrapUser, updateProfile } from '../lib/api';
import { HapticsLight, HapticsSuccess } from '../utils/haptics';
import {
  requestCalendar,
  requestNotifications,
  markPermissionPromptShown,
} from '../lib/permissions';
import { PermissionModal, type PermStep } from '../components/PermissionModal';
import { AcquisitionSourceSheet } from '../components/AcquisitionSourceSheet';
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

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_PAGES = 6;

const ACCENT     = '#F5A623';
const BG         = '#0B1220';
const SURFACE    = '#1A2436';
const BORDER     = '#243046';
const TEXT       = '#E6EDF7';
const TEXT_SUB   = '#9FB0C5';
const TEXT_MUTED = '#6B7F99';

const CHRONOTYPE_CARDS = [
  { id: 'AMer',    icon: 'sunny'        as const, label: 'Early Bird', sublabel: 'Before 7am' },
  { id: 'Neither', icon: 'partly-sunny' as const, label: 'In Between', sublabel: '7am – 9am'  },
  { id: 'PMer',    icon: 'moon'         as const, label: 'Night Owl',  sublabel: 'After 9am'  },
];

const CYCLE_CARDS = [
  { id: '4', cycles: '4 Cycles', hours: '6 hours',   desc: 'Good for busy schedules', badge: 'Minimum',     recommended: false },
  { id: '5', cycles: '5 Cycles', hours: '7.5 hours', desc: 'Optimal for most',         badge: 'Recommended', recommended: true  },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [page,              setPage]              = useState(0);
  const [wakeDate,          setWakeDate]          = useState(() => {
    const d = new Date();
    d.setHours(6, 30, 0, 0);
    return d;
  });
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [chronotype,        setChronotype]        = useState('');
  const [cyclesTarget,      setCyclesTarget]      = useState('');
  const [saving,            setSaving]            = useState(false);
  const [permStep,          setPermStep]          = useState<PermStep | null>(null);
  const [showAcquisition,   setShowAcquisition]   = useState(false);

  const isNavigating = useRef(false);
  const translateX   = useRef(new Animated.Value(0)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const soundRef     = useRef<AVSound | null>(null);
  const fadeRef      = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── Background music ────────────────────────────────────────────────────────
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

  const wakeMinutes = wakeDate.getHours() * 60 + wakeDate.getMinutes();

  const goToPage = useCallback((index: number) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    Keyboard.dismiss();
    Animated.timing(translateX, {
      toValue:         -index * windowWidth,
      duration:        320,
      useNativeDriver: true,
    }).start(() => { isNavigating.current = false; });
    setPage(index);
    setShowAndroidPicker(false);
  }, [translateX, windowWidth]);

  function handleBack() {
    if (page > 0) goToPage(page - 1);
  }

  function validate(): boolean {
    if (page === 2 && !chronotype) {
      Alert.alert('', 'Please choose when you feel at your best.');
      return false;
    }
    if (page === 3 && !cyclesTarget) {
      Alert.alert('', 'Please choose your cycles target.');
      return false;
    }
    return true;
  }

  async function handleNext() {
    if (!validate()) return;
    HapticsLight();
    if (page < TOTAL_PAGES - 1) {
      goToPage(page + 1);
    } else {
      await finish();
    }
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    try {
      const idealCycles  = cyclesTarget === '4' ? 4 : 5;
      const weeklyTarget = idealCycles * 7;

      await saveProfile({
        anchorTime:          wakeMinutes,
        chronotype:          (chronotype as 'AMer' | 'PMer' | 'Neither') || 'Neither',
        idealCyclesPerNight: idealCycles,
        weeklyTarget,
      });
      await saveOnboardingData({
        firstName:       '',
        wakeTimeMinutes: wakeMinutes,
        priority:        chronotype,
        constraint:      cyclesTarget,
      });

      await bootstrapUser();

      const arpHH       = String(Math.floor(wakeMinutes / 60)).padStart(2, '0');
      const roundedMM   = wakeMinutes % 60 >= 15 ? '30' : '00';
      const arpTime     = `${arpHH}:${roundedMM}`;

      const backendChronotype =
        chronotype === 'AMer'    ? 'AMer' :
        chronotype === 'PMer'    ? 'PMer' :
        chronotype === 'Neither' ? 'In-betweener' : 'Unknown';

      await updateProfile({
        arp_time:             arpTime,
        arp_committed:        true,
        chronotype:           backendChronotype,
        cycle_target:         idealCycles,
        onboarding_step:      5,
        onboarding_completed: true,
      });

      setSaving(false);
      HapticsSuccess();
      setPermStep('calendar');
    } catch {
      setSaving(false);
      Alert.alert('Setup failed', 'Could not save your profile. Please try again.');
    }
  }

  async function handlePermAllow() {
    if (permStep === 'calendar') {
      await requestCalendar();
      setPermStep('notifications');
    } else {
      await requestNotifications();
      await markPermissionPromptShown();
      setPermStep(null);
      setShowAcquisition(true);
    }
  }

  function handlePermSkip() {
    if (permStep === 'calendar') {
      setPermStep('notifications');
    } else {
      markPermissionPromptShown();
      setPermStep(null);
      setShowAcquisition(true);
    }
  }

  const isNextDisabled =
    (page === 2 && !chronotype) ||
    (page === 3 && !cyclesTarget) ||
    saving;

  const nextLabel =
    page === 0              ? 'Get Started' :
    page === TOTAL_PAGES - 1 ? (saving ? 'Setting up…' : 'Start my R90 journey') :
    'Next';

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

            {/* ── Slide 0: Welcome ──────────────────────────────────────── */}
            <View style={[s.slide, { width: windowWidth }]}>
              <View style={s.slideCenter}>
                <MascotImage emotion="Enthousisate" size="xl" />
                <Text style={s.r90Title}>R90</Text>
                <Text style={s.tagline}>Sleep. Recover. Perform.</Text>
                <Text style={s.taglineSub}>The methodology trusted by elite athletes.</Text>
              </View>
            </View>

            {/* ── Slide 1: How it works ─────────────────────────────────── */}
            <View style={[s.slide, { width: windowWidth }]}>
              <View style={s.slideInner}>
                <View style={s.iconWrap}>
                  <Ionicons name="moon-outline" size={80} color={ACCENT} />
                </View>
                <Text style={s.slideTitle}>Sleep in 90-min cycles</Text>
                <Text style={s.slideBody}>
                  R90 is built around the science of sleep cycles. Every night is made up of 90-minute blocks. The goal: 5 quality cycles.
                </Text>
                <View style={s.bulletList}>
                  {['90-min cycles', '5 cycles target', 'Track your progress'].map((b) => (
                    <View key={b} style={s.bulletRow}>
                      <View style={s.bulletDot} />
                      <Text style={s.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* ── Slide 2: Chronotype ───────────────────────────────────── */}
            <View style={[s.slide, { width: windowWidth }]}>
              <View style={s.slideInner}>
                <Text style={[s.slideTitle, { fontSize: 24 }]}>
                  When do you naturally{'\n'}wake up?
                </Text>
                <Text style={s.slideSub}>Be honest — no right answer.</Text>
                <View style={s.mascotRow}>
                  <MascotImage emotion="Reflexion" size="md" />
                </View>
                <View style={s.cardList}>
                  {CHRONOTYPE_CARDS.map((card) => {
                    const active = chronotype === card.id;
                    return (
                      <Pressable
                        key={card.id}
                        style={[s.selectCard, active && s.selectCardActive]}
                        onPress={() => setChronotype(card.id)}
                      >
                        <View style={s.selectCardLeft}>
                          <Ionicons
                            name={card.icon}
                            size={22}
                            color={active ? ACCENT : TEXT_SUB}
                          />
                          <Text style={[s.selectCardLabel, active && s.selectCardLabelActive]}>
                            {card.label}
                          </Text>
                        </View>
                        <Text style={[s.selectCardSub, active && s.selectCardSubActive]}>
                          {card.sublabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* ── Slide 3: Cycles target ────────────────────────────────── */}
            <View style={[s.slide, { width: windowWidth }]}>
              <View style={s.slideInner}>
                <Text style={[s.slideTitle, { fontSize: 24 }]}>
                  How many cycles{'\n'}per night?
                </Text>
                <View style={s.cycleRow}>
                  {CYCLE_CARDS.map((card) => {
                    const active = cyclesTarget === card.id;
                    return (
                      <Pressable
                        key={card.id}
                        style={[s.cycleCard, active && s.cycleCardActive]}
                        onPress={() => setCyclesTarget(card.id)}
                      >
                        <View style={s.cycleBadgeWrap}>
                          <View style={[s.cycleBadge, card.recommended && s.cycleBadgeAccent]}>
                            <Text style={[s.cycleBadgeText, card.recommended && s.cycleBadgeTextAccent]}>
                              {card.badge}
                            </Text>
                          </View>
                        </View>
                        <Text style={[s.cycleTitle, active && s.cycleTitleActive]}>
                          {card.cycles}
                        </Text>
                        <Text style={s.cycleHours}>{card.hours}</Text>
                        <Text style={s.cycleDesc}>{card.desc}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* ── Slide 4: ARP ──────────────────────────────────────────── */}
            <View style={[s.slide, { width: windowWidth }]}>
              <View style={s.slideInner}>
                <Text style={[s.slideTitle, { fontSize: 24 }]}>Set your wake-up time</Text>
                <Text style={s.slideSub}>
                  Your Anchor Rise Point — the foundation of your R90 plan.
                </Text>
                <View style={s.mascotRow}>
                  <MascotImage emotion="encourageant" size="sm" />
                </View>
                <View style={s.pickerWrap}>
                  {Platform.OS === 'ios' ? (
                    <DateTimePicker
                      value={wakeDate}
                      mode="time"
                      display="spinner"
                      onChange={(_, d) => { if (d) setWakeDate(d); }}
                      style={s.iosPicker}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      {...({ textColor: TEXT } as any)}
                    />
                  ) : (
                    <>
                      <Pressable
                        style={s.androidTimeBtn}
                        onPress={() => setShowAndroidPicker(true)}
                      >
                        <Text style={s.androidTimeText}>{formatTime(wakeMinutes)}</Text>
                      </Pressable>
                      {showAndroidPicker && (
                        <DateTimePicker
                          value={wakeDate}
                          mode="time"
                          display="default"
                          onChange={(_, d) => {
                            setShowAndroidPicker(false);
                            if (d) setWakeDate(d);
                          }}
                        />
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* ── Slide 5: Final ────────────────────────────────────────── */}
            <View style={[s.slide, { width: windowWidth }]}>
              <View style={s.slideCenter}>
                <MascotImage emotion="celebration" size="xl" />
                <Text style={s.finalTitle}>You're ready!</Text>
                <Text style={s.finalSub}>Your R90 plan is set. Let's start tracking.</Text>
              </View>
            </View>

          </Animated.View>
        </View>

        {/* ── Footer: CTA button (pulse on slide 5) ── */}
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

      <PermissionModal
        visible={permStep !== null}
        step={permStep ?? 'calendar'}
        onAllow={handlePermAllow}
        onSkip={handlePermSkip}
      />
      <AcquisitionSourceSheet
        visible={showAcquisition}
        onDone={() => router.replace('/')}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG },
  safeArea:   { flex: 1 },

  // Header
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 20,
    paddingTop:      8,
    paddingBottom:   16,
    gap:             12,
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

  // Pager
  pagerClip: { flex: 1, overflow: 'hidden' },
  pager:     { flex: 1, flexDirection: 'row' },
  slide:     { flex: 1, paddingHorizontal: 24 },

  // Centered layout (slides 0, 5)
  slideCenter: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    gap:            16,
    paddingBottom:  8,
  },

  // Top-aligned layout (slides 1–4)
  slideInner: {
    flex:    1,
    paddingTop: 8,
    gap:     18,
  },

  // Slide 0 — Welcome
  r90Title: {
    fontSize:     52,
    fontFamily:   'Inter-Bold',
    fontWeight:   '700',
    color:        ACCENT,
    letterSpacing: -1,
  },
  tagline: {
    fontSize:   18,
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
    color:      TEXT_SUB,
    textAlign:  'center',
  },
  taglineSub: {
    fontSize:  14,
    color:     TEXT_MUTED,
    textAlign: 'center',
  },

  // Slide 1 — How it works
  iconWrap:   { alignSelf: 'center', marginBottom: 4 },
  slideTitle: {
    fontSize:   28,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
    color:      TEXT,
    lineHeight: 36,
  },
  slideSub: {
    fontSize:   15,
    color:      TEXT_SUB,
    lineHeight: 22,
    marginTop:  -4,
  },
  slideBody: {
    fontSize:   16,
    color:      TEXT_SUB,
    lineHeight: 26,
  },
  bulletList: { gap: 10 },
  bulletRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  bulletText: { fontSize: 15, fontWeight: '500', color: TEXT },

  // Slide 2 — Chronotype
  mascotRow: { alignItems: 'center' },
  cardList:  { gap: 10 },
  selectCard: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: SURFACE,
    borderRadius:    14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth:     1.5,
    borderColor:     BORDER,
  },
  selectCardActive: {
    borderColor:     ACCENT,
    backgroundColor: 'rgba(245,166,35,0.08)',
  },
  selectCardLeft:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectCardLabel:       { fontSize: 16, fontWeight: '600', color: TEXT },
  selectCardLabelActive: { color: ACCENT },
  selectCardSub:         { fontSize: 13, color: TEXT_MUTED },
  selectCardSubActive:   { color: TEXT_SUB },

  // Slide 3 — Cycles
  cycleRow: { flexDirection: 'row', gap: 12, flex: 1 },
  cycleCard: {
    flex:            1,
    backgroundColor: SURFACE,
    borderRadius:    16,
    padding:         16,
    borderWidth:     1.5,
    borderColor:     BORDER,
    gap:             6,
  },
  cycleCardActive:    { borderColor: ACCENT, backgroundColor: 'rgba(245,166,35,0.08)' },
  cycleBadgeWrap:     { marginBottom: 2 },
  cycleBadge: {
    alignSelf:        'flex-start',
    backgroundColor:  'rgba(255,255,255,0.08)',
    borderRadius:     8,
    paddingHorizontal: 8,
    paddingVertical:  3,
  },
  cycleBadgeAccent:    { backgroundColor: 'rgba(245,166,35,0.15)' },
  cycleBadgeText:      { fontSize: 11, fontWeight: '600', color: TEXT_MUTED },
  cycleBadgeTextAccent: { color: ACCENT },
  cycleTitle:          { fontSize: 20, fontWeight: '700', color: TEXT },
  cycleTitleActive:    { color: ACCENT },
  cycleHours:          { fontSize: 14, fontWeight: '500', color: TEXT_SUB },
  cycleDesc:           { fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },

  // Slide 4 — ARP
  pickerWrap: {
    backgroundColor: 'rgba(26,36,54,0.9)',
    borderRadius:    16,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     BORDER,
  },
  iosPicker:       { height: 160 },
  androidTimeBtn:  { paddingVertical: 22, alignItems: 'center' },
  androidTimeText: {
    color:         TEXT,
    fontSize:      38,
    fontWeight:    '700',
    letterSpacing: 2,
  },

  // Slide 5 — Final
  finalTitle: {
    fontSize:   32,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
    color:      ACCENT,
    textAlign:  'center',
  },
  finalSub: {
    fontSize:   16,
    color:      TEXT_SUB,
    textAlign:  'center',
    lineHeight: 24,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop:        12,
    paddingBottom:     4,
  },
});
