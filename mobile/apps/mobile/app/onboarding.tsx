/**
 * Onboarding — 5-screen personalization flow.
 *
 * Screens (vertical paging, scrollEnabled=false):
 *   0 — Why R90        (ecran1.png)  Intro: cycles, not hours
 *   1 — First name     (ecran1.png)
 *   2 — Wake-up time   (ecran2.png)
 *   3 — Chronotype     (ecran3.png)  AMer / Neither / PMer
 *   4 — Cycles target  (ecran4.png)  4 or 5 cycles per night
 *
 * On Finish: saves UserProfile + OnboardingData, then routes to Home.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ImageBackground,
  Alert,
  Platform,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal interface for an expo-av Sound instance (avoids static import). */
interface AVSound {
  playAsync(): Promise<void>;
  stopAsync(): Promise<void>;
  unloadAsync(): Promise<void>;
  setVolumeAsync(volume: number): Promise<void>;
}

// ─── Assets ──────────────────────────────────────────────────────────────────

const BG_IMAGES = [
  require('../assets/images/ecran1.png'), // intro
  require('../assets/images/ecran1.png'), // first name
  require('../assets/images/ecran2.png'), // wake time
  require('../assets/images/ecran3.png'), // chronotype
  require('../assets/images/ecran4.png'), // cycles
];

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_PAGES = 5;

const QUESTIONS = [
  '', // intro screen has no question label
  "What's your first name?",
  'What time do you usually wake up?',
  'When do you naturally feel at your best?',
  'How many sleep cycles do you want to target each night?',
];

const CHRONOTYPE_OPTIONS = [
  {
    id: 'AMer',
    label: 'Morning',
    sublabel: 'Best before midday — early riser',
  },
  {
    id: 'Neither',
    label: 'Neutral',
    sublabel: 'No strong preference either way',
  },
  {
    id: 'PMer',
    label: 'Evening',
    sublabel: 'Best in the afternoon or evening',
  },
];

const CYCLE_OPTIONS = [
  {
    id: '5',
    label: '5 cycles',
    sublabel: '7h 30min — full recovery target',
  },
  {
    id: '4',
    label: '4 cycles',
    sublabel: '6h 00min — acceptable minimum',
  },
];

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});

// ─── OnboardingHeader ─────────────────────────────────────────────────────────

function OnboardingHeader({
  pageIndex,
  total,
  onBack,
}: {
  pageIndex: number;
  total: number;
  onBack: () => void;
}) {
  const backDisabled = pageIndex === 0;
  return (
    <View style={oh.row}>
      <Pressable
        style={[oh.backBtn, backDisabled && oh.backHidden]}
        onPress={onBack}
        disabled={backDisabled}
        hitSlop={12}
      >
        <Feather name="arrow-left" size={22} color="#FFFFFF" />
      </Pressable>
      <ProgressBar current={pageIndex + 1} total={total} />
      {/* Spacer mirrors back button width so progress bar is centred */}
      <View style={oh.spacer} />
    </View>
  );
}

const oh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backHidden: {
    opacity: 0,
  },
  spacer: {
    width: 38,
  },
});

// ─── OptionGrid ───────────────────────────────────────────────────────────────

function OptionGrid({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; label: string; sublabel?: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={og.grid}>
      {options.map((opt) => {
        const active = selected === opt.id;
        return (
          <Pressable
            key={opt.id}
            style={[og.option, active && og.optionActive]}
            onPress={() => onSelect(opt.id)}
          >
            <Text style={[og.label, active && og.labelActive]}>{opt.label}</Text>
            {opt.sublabel ? (
              <Text style={[og.sublabel, active && og.sublabelActive]}>{opt.sublabel}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const og = StyleSheet.create({
  grid: { gap: 10 },
  option: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  optionActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: '#FFFFFF',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  labelActive: {
    color: '#0A0A0A',
  },
  sublabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 4,
  },
  sublabelActive: {
    color: 'rgba(10,10,10,0.55)',
  },
  // Intro screen
  introBlock: {
    gap: 18,
  },
  introHeading: {
    color:         '#FFFFFF',
    fontSize:      32,
    fontWeight:    '700',
    letterSpacing: -0.5,
    lineHeight:    40,
    marginBottom:  8,
  },
  introBody: {
    color:      'rgba(255,255,255,0.72)',
    fontSize:   16,
    lineHeight: 26,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [page, setPage] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [wakeDate, setWakeDate] = useState(() => {
    const d = new Date();
    d.setHours(6, 30, 0, 0);
    return d;
  });
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [chronotype, setChronotype] = useState('');
  const [cyclesTarget, setCyclesTarget] = useState('');
  const [saving, setSaving] = useState(false);
  // null = modal hidden; 'calendar'/'notifications' = which step is showing
  const [permStep,         setPermStep]         = useState<PermStep | null>(null);
  const [showAcquisition,  setShowAcquisition]  = useState(false);

  // Guards against double-tapping Next/Back mid-animation
  const isNavigating = useRef(false);

  // ── Background music (onboarding only) ────────────────────────────────────
  const soundRef   = useRef<AVSound | null>(null);
  const fadeRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function startMusic() {
      try {
        // Dynamic import: avoids requireNativeModule('ExponentAV') at module load
        // time, which throws synchronously when the native module is absent (e.g.
        // running in Expo Go or before a dev-client rebuild after adding expo-av).
        const { Audio } = await import('expo-av');

        // Respect silent mode: playsInSilentModeIOS defaults to false — correct.
        // staysActiveInBackground false: music stops if app backgrounds.
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS:    false,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          require('../assets/music/music1.mp3'),
          { isLooping: true, volume: 0, shouldPlay: true },
        );

        if (!mounted) {
          // Component unmounted before async completed — clean up immediately
          sound.unloadAsync();
          return;
        }

        soundRef.current = sound as unknown as AVSound;

        // Fade in: 0 → 0.35 over 1 500 ms in 30 steps
        const TARGET   = 0.35;
        const STEPS    = 30;
        const INTERVAL = 1500 / STEPS;
        let   step     = 0;

        fadeRef.current = setInterval(() => {
          step++;
          sound.setVolumeAsync(Math.min((step / STEPS) * TARGET, TARGET));
          if (step >= STEPS) {
            clearInterval(fadeRef.current!);
            fadeRef.current = null;
          }
        }, INTERVAL);
      } catch {
        // Audio failure must never break onboarding — silently ignore
      }
    }

    startMusic();

    return () => {
      mounted = false;
      if (fadeRef.current) {
        clearInterval(fadeRef.current);
        fadeRef.current = null;
      }
      const s = soundRef.current;
      soundRef.current = null;
      // stop then unload sequentially; swallow all errors
      (async () => {
        try { await s?.stopAsync(); } catch { /* ignore */ }
        try { await s?.unloadAsync(); } catch { /* ignore */ }
      })();
    };
  }, []);

  const wakeMinutes = wakeDate.getHours() * 60 + wakeDate.getMinutes();

  const goToPage = useCallback((index: number) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    Keyboard.dismiss();
    // animated:true gives the smooth native "slide" feel on both platforms.
    // pagingEnabled snaps user-initiated scroll (insurance); programmatic
    // scroll lands exactly on index * windowHeight.
    scrollRef.current?.scrollTo({ y: index * windowHeight, animated: true });
    setPage(index);
    setShowAndroidPicker(false);
    // ~350 ms matches the native scroll deceleration on iOS + Android
    setTimeout(() => { isNavigating.current = false; }, 350);
  }, [windowHeight]);

  function handleBack() {
    if (page > 0) goToPage(page - 1);
  }

  function validate(): boolean {
    if (page === 1 && firstName.trim().length === 0) {
      Alert.alert('', 'Please enter your first name.');
      return false;
    }
    if (page === 3 && !chronotype) {
      Alert.alert('', 'Please choose when you feel at your best.');
      return false;
    }
    if (page === 4 && !cyclesTarget) {
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
      const idealCycles = cyclesTarget === '4' ? 4 : 5;
      const weeklyTarget = idealCycles * 7;

      // 1 — Save locally (keeps the app working offline / as fallback)
      await saveProfile({
        anchorTime: wakeMinutes,
        chronotype: (chronotype as 'AMer' | 'PMer' | 'Neither') || 'Neither',
        idealCyclesPerNight: idealCycles,
        weeklyTarget,
      });
      await saveOnboardingData({
        firstName:      firstName.trim(),
        wakeTimeMinutes: wakeMinutes,
        priority:   chronotype,    // stores chronotype
        constraint: cyclesTarget,  // stores cycles target
      });

      // 2 — Bootstrap backend user (idempotent — safe to call every onboarding)
      await bootstrapUser();

      // 3 — Send profile to backend: ARP time + chronotype + cycle target
      const arpHH = String(Math.floor(wakeMinutes / 60)).padStart(2, '0');
      const arpMM = String(wakeMinutes % 60).padStart(2, '0');
      // ARP must be on a 30-min boundary — round to nearest
      const roundedMM = wakeMinutes % 60 >= 15 ? '30' : '00';
      const arpTime   = `${arpHH}:${roundedMM}`;

      const backendChronotype =
        chronotype === 'AMer'    ? 'AMer' :
        chronotype === 'PMer'    ? 'PMer' :
        chronotype === 'Neither' ? 'In-betweener' : 'Unknown';

      await updateProfile({
        arp_time:              arpTime,
        arp_committed:         true,
        chronotype:            backendChronotype,
        cycle_target:          idealCycles,
        onboarding_step:       4,
        onboarding_completed:  true,
      });

      setSaving(false);
      HapticsSuccess();
      setPermStep('calendar');
    } catch {
      setSaving(false);
      Alert.alert('Setup failed', 'Could not save your profile. Please try again.');
    }
  }

  // ── Permission modal handlers ──────────────────────────────────────────────

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
      markPermissionPromptShown(); // fire-and-forget
      setPermStep(null);
      setShowAcquisition(true);
    }
  }

  return (
    <View style={s.root}>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={false}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        bounces={false}
        style={s.scroll}
      >
        {BG_IMAGES.map((image, i) => (
          <ImageBackground
            key={i}
            source={image}
            style={[s.page, { height: windowHeight }]}
            resizeMode="cover"
          >
            {/* Darkening overlay for text readability */}
            <View style={s.overlay} />

            <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
              <View style={s.inner}>
                {/* ── Header ── */}
                <View style={s.header}>
                  <OnboardingHeader
                    pageIndex={i}
                    total={TOTAL_PAGES}
                    onBack={handleBack}
                  />
                </View>

                {/* ── Question + input — sits directly under the progress bar ── */}
                <View style={s.topContent}>
                  <Text style={s.question}>{QUESTIONS[i]}</Text>

                  {/* Screen 0: Why R90 intro */}
                  {i === 0 && (
                    <View style={og.introBlock}>
                      <Text style={og.introHeading}>Sleep in cycles,{'\n'}not hours.</Text>
                      <Text style={og.introBody}>
                        The R90 method, developed by Nick Littlehales, sleep coach to elite athletes, structures recovery around 90-minute cycles.
                      </Text>
                      <Text style={og.introBody}>
                        A full night is 5 cycles — 7h 30min. What matters is when you wake up, not when you go to bed.
                      </Text>
                      <Text style={og.introBody}>
                        This app builds your personalised schedule around a fixed wake time. No streaks. No scores. Just cycles.
                      </Text>
                    </View>
                  )}

                  {/* Screen 1: first name */}
                  {i === 1 && (
                    <TextInput
                      style={s.textInput}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Your name"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleNext}
                    />
                  )}

                  {/* Screen 2: wake time */}
                  {i === 2 && (
                    <View style={s.pickerWrap}>
                      {Platform.OS === 'ios' ? (
                        <DateTimePicker
                          value={wakeDate}
                          mode="time"
                          display="spinner"
                          onChange={(_, d) => { if (d) setWakeDate(d); }}
                          style={s.iosPicker}
                          // textColor is iOS-only, not in community typedefs
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          {...({ textColor: '#FFFFFF' } as any)}
                        />
                      ) : (
                        <>
                          <Pressable
                            style={s.androidTimeBtn}
                            onPress={() => setShowAndroidPicker(true)}
                          >
                            <Text style={s.androidTimeText}>
                              {formatTime(wakeMinutes)}
                            </Text>
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
                  )}

                  {/* Screen 3: chronotype */}
                  {i === 3 && (
                    <OptionGrid
                      options={CHRONOTYPE_OPTIONS}
                      selected={chronotype}
                      onSelect={setChronotype}
                    />
                  )}

                  {/* Screen 4: cycles target */}
                  {i === 4 && (
                    <OptionGrid
                      options={CYCLE_OPTIONS}
                      selected={cyclesTarget}
                      onSelect={setCyclesTarget}
                    />
                  )}
                </View>

                {/* ── Open space — background image / mascot visible here ── */}
                <View style={s.openSpace} />

                {/* ── Footer ── */}
                <View style={s.footer}>
                  <Pressable
                    style={[s.nextBtn, saving && s.nextBtnDisabled]}
                    onPress={handleNext}
                    disabled={saving}
                  >
                    <Text style={s.nextBtnText}>
                      {i === TOTAL_PAGES - 1
                        ? saving ? 'Setting up…' : 'Finish'
                        : 'Next'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </ImageBackground>
        ))}
      </ScrollView>

      {/* Permission modal — shown after onboarding data is saved */}
      <PermissionModal
        visible={permStep !== null}
        step={permStep ?? 'calendar'}
        onAllow={handlePermAllow}
        onSkip={handlePermSkip}
      />

      {/* Acquisition source sheet — shown after permissions flow, before Home */}
      <AcquisitionSourceSheet
        visible={showAcquisition}
        onDone={() => router.replace('/')}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scroll: {
    flex: 1,
  },
  page: {
    // height set inline via useWindowDimensions
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  safeArea: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  // Header row
  header: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  // Question + input — top-aligned directly under the progress bar.
  // Does NOT fill remaining space; open space below it shows the background.
  topContent: {
    gap: 24,
    paddingBottom: 8,
  },
  // Fills the space between the input area and the footer, keeping the
  // background / mascot visible in the centre of the screen.
  openSpace: {
    flex: 1,
  },
  question: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // Screen 1 — text input
  textInput: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.55)',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  // Screen 2 — time picker container
  pickerWrap: {
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  iosPicker: {
    height: 160,
  },
  androidTimeBtn: {
    paddingVertical: 22,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  androidTimeText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: 2,
  },
  // Footer
  footer: {
    paddingBottom: 8,
  },
  nextBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: '#15803D',
    opacity: 0.7,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
