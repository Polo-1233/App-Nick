/**
 * AudioPlayer — composant de lecture audio R90
 *
 * Variants :
 *   mrm       — cercle de respiration (expand/contract 4s)
 *   crp       — ondulation douce
 *   winddown  — particules étoilées lentes
 *
 * Props :
 *   source    — require() local ou { uri: string }
 *   title     — titre affiché
 *   duration  — "2 min" ou "20 min"
 *   onComplete — appelé à la fin
 *   onClose   — bouton X
 *   variant   — animation de fond
 *   showTimer — afficher le timer (défaut true)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  Dimensions, Platform,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

// Immersive player — always dark, even in light theme
const BG     = '#0a0a3a';   // darkTheme.background
const ACCENT = '#1c9fda';   // darkTheme.accent
const TEXT   = '#FFFFFF';    // darkTheme.text
const MUTED  = '#6B8CAE';   // darkTheme.textMuted
const GOLD   = '#F5A623';   // darkTheme.gold

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}

// ─── Breathing Circle (MRM) — 4-4-4-4 box breathing ─────────────────────────
const BREATH_PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
const BREATH_DUR    = 4000; // 4 seconds each phase

function BreathingCircle() {
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const scale3 = useRef(new Animated.Value(1)).current;
  const ringOp = useRef(new Animated.Value(0.08)).current;
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    // Concentric rings — staggered expand/contract
    const makeLoop = (anim: Animated.Value, delay: number, peak: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: peak, duration: BREATH_DUR * 2, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,    duration: BREATH_DUR * 2, useNativeDriver: true }),
      ]));

    const l1 = makeLoop(scale1, 0,    1.40);
    const l2 = makeLoop(scale2, 300,  1.25);
    const l3 = makeLoop(scale3, 600,  1.12);

    // Outer ring glow pulse
    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(ringOp, { toValue: 0.20, duration: BREATH_DUR * 2, useNativeDriver: true }),
      Animated.timing(ringOp, { toValue: 0.06, duration: BREATH_DUR * 2, useNativeDriver: true }),
    ]));

    l1.start(); l2.start(); l3.start(); glowLoop.start();

    // Phase label cycle
    const interval = setInterval(() => {
      phaseRef.current = (phaseRef.current + 1) % BREATH_PHASES.length;
      setPhaseIdx(phaseRef.current);
    }, BREATH_DUR);

    return () => {
      l1.stop(); l2.stop(); l3.stop(); glowLoop.stop();
      clearInterval(interval);
    };
  }, [scale1, scale2, scale3, ringOp]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={bg.circleWrap}>
        {/* Outermost glow ring */}
        <Animated.View style={[bg.circle, bg.circleOuter, { transform: [{ scale: scale1 }], opacity: ringOp }]} />
        {/* Mid ring */}
        <Animated.View style={[bg.circle, bg.circleMid, { transform: [{ scale: scale2 }] }]} />
        {/* Inner ring */}
        <Animated.View style={[bg.circle, bg.circleInner, { transform: [{ scale: scale3 }] }]} />
        {/* Core — static */}
        <View style={bg.circleCore} />
        {/* Phase label */}
        <Text style={bg.breathLabel}>{BREATH_PHASES[phaseIdx]}</Text>
      </View>
    </View>
  );
}

// ─── Wave (CRP) — slow breathing arcs ────────────────────────────────────────
const WAVE_COUNT = 5;

function WaveBackground() {
  const anims = Array.from({ length: WAVE_COUNT }, () => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    anims.forEach((a, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 700),
          Animated.timing(a, { toValue: 1, duration: 4000 + i * 300, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 4000 + i * 300, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View key={i} style={[bg.wave, {
          top:       H * 0.35 + i * 40,
          opacity:   a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.02, 0.10, 0.02] }),
          transform: [
            { scaleX:    a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.15] }) },
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -12 - i * 4] }) },
          ],
        }]} />
      ))}
    </View>
  );
}

// ─── Stars (wind-down) — soft twinkle + gentle drift ─────────────────────────
const STARS = Array.from({ length: 36 }, () => ({
  x:     Math.random(),
  y:     Math.random() * 0.65,
  size:  Math.random() < 0.15 ? 3 : Math.random() < 0.4 ? 2 : 1.5,
  delay: Math.floor(Math.random() * 4000),
  dur:   2500 + Math.floor(Math.random() * 3000),
  driftY: (Math.random() - 0.5) * 14,
}));

function StarField() {
  const opacs  = STARS.map(() => useRef(new Animated.Value(Math.random() * 0.3)).current);
  const drifts = STARS.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    STARS.forEach((s, i) => {
      // Twinkle
      Animated.loop(Animated.sequence([
        Animated.delay(s.delay),
        Animated.timing(opacs[i],  { toValue: 0.85, duration: s.dur,     useNativeDriver: true }),
        Animated.timing(opacs[i],  { toValue: 0.12, duration: s.dur * 1.2, useNativeDriver: true }),
      ])).start();
      // Slow vertical drift
      Animated.loop(Animated.sequence([
        Animated.timing(drifts[i], { toValue: 1,  duration: 8000 + s.delay, useNativeDriver: true }),
        Animated.timing(drifts[i], { toValue: 0,  duration: 8000 + s.delay, useNativeDriver: true }),
      ])).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((s, i) => (
        <Animated.View key={i} style={{
          position:        'absolute',
          left:            s.x * W,
          top:             s.y * H,
          width:           s.size,
          height:          s.size,
          borderRadius:    s.size / 2,
          backgroundColor: s.size >= 3 ? ACCENT : '#fff',
          opacity:         opacs[i],
          transform:       [{
            translateY: drifts[i].interpolate({
              inputRange:  [0, 1],
              outputRange: [0, s.driftY],
            }),
          }],
        }} />
      ))}
    </View>
  );
}

const bg = StyleSheet.create({
  circleWrap:  { position: 'absolute', top: H * 0.12, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  circle:      { position: 'absolute', borderRadius: 1000 },
  circleOuter: { width: W * 0.85, height: W * 0.85, backgroundColor: `${ACCENT}08` },
  circleMid:   { width: W * 0.6,  height: W * 0.6,  backgroundColor: `${ACCENT}10` },
  circleInner: { width: W * 0.35, height: W * 0.35, backgroundColor: `${ACCENT}18` },
  wave:        { position: 'absolute', left: -W * 0.1, width: W * 1.2, height: 60, backgroundColor: ACCENT, borderRadius: 30 },
});

// ─── Main Component ────────────────────────────────────────────────────────────

export interface AudioPlayerProps {
  source:     { uri: string } | number;
  title:      string;
  duration:   string;
  onComplete: () => void;
  onClose:    () => void;
  variant:    'mrm' | 'crp' | 'winddown';
  showTimer?: boolean;
  /** Optional info button (ⓘ) shown in the header alongside the close button */
  onInfo?:    () => void;
}

export function AudioPlayer({
  source, title, duration, onComplete, onClose, variant, showTimer = true, onInfo,
}: AudioPlayerProps) {
  const soundRef   = useRef<Audio.Sound | null>(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [posMs,        setPosMs]        = useState(0);
  const [durationMs,   setDurationMs]   = useState(0);
  const [loaded,       setLoaded]       = useState(false);
  const [error,        setError]        = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Load audio
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS:    true,
          staysActiveInBackground: true,
          allowsRecordingIOS:      false,
        });
        const { sound } = await Audio.Sound.createAsync(source as any, { shouldPlay: true });
        if (!mounted) { sound.unloadAsync(); return; }
        soundRef.current = sound;
        setIsPlaying(true);
        setLoaded(true);
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          setPosMs(status.positionMillis ?? 0);
          setDurationMs(status.durationMillis ?? 0);
          if (status.didJustFinish) {
            setIsPlaying(false);
            onComplete();
          }
        });
      } catch {
        if (mounted) {
          setError(true);
          setLoaded(true);
        }
      }
    }
    void load();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, []);

  // Timeout guard: if not loaded after 5 seconds, show error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!loaded) {
        setError(true);
        setLoaded(true);
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [loaded]);

  // Progress bar animation
  useEffect(() => {
    if (durationMs > 0) {
      Animated.timing(progressAnim, {
        toValue:  posMs / durationMs,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [posMs, durationMs]);

  const togglePlay = useCallback(async () => {
    if (!soundRef.current) return;
    if (isPlaying) { await soundRef.current.pauseAsync(); setIsPlaying(false); }
    else           { await soundRef.current.playAsync();  setIsPlaying(true);  }
  }, [isPlaying]);

  const accentColor = variant === 'mrm' ? ACCENT : variant === 'crp' ? GOLD : ACCENT;
  const remaining   = durationMs > 0 ? Math.max(0, Math.ceil((durationMs - posMs) / 1000)) : 0;

  return (
    <View style={ap.root}>
      {/* Background animation */}
      {variant === 'mrm'      && <BreathingCircle />}
      {variant === 'crp'      && <WaveBackground />}
      {variant === 'winddown' && <StarField />}

      {/* Header: optional info button (left) + close button (right) */}
      <SafeAreaView style={ap.safeArea} edges={['top']}>
        <View style={ap.headerRow}>
          {onInfo ? (
            <Pressable onPress={onInfo} style={ap.headerBtn} hitSlop={12}>
              <Ionicons name="information-circle-outline" size={22} color={TEXT} />
            </Pressable>
          ) : <View style={ap.headerBtn} />}
          <Pressable onPress={onClose} style={ap.headerBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={TEXT} />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Content */}
      <View style={ap.content}>
        <Text style={ap.duration}>{duration}</Text>
        <Text style={ap.title}>{title}</Text>

        {/* Timer */}
        {showTimer && loaded && !error && (
          <Text style={[ap.timer, { color: accentColor }]}>
            {fmtSeconds(remaining)}
          </Text>
        )}

        {/* Progress bar */}
        {!error && (
          <View style={ap.progressBg}>
            <Animated.View style={[
              ap.progressFill,
              {
                width: progressAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }),
                backgroundColor: accentColor,
              },
            ]} />
          </View>
        )}

        {/* Error state */}
        {error && (
          <View style={{ alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Text style={{ color: MUTED, fontSize: 15, textAlign: 'center' }}>
              Content coming soon.
            </Text>
            <Pressable
              onPress={onClose}
              style={{ marginTop: 16, backgroundColor: `${ACCENT}20`, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 14 }}>Go back</Text>
            </Pressable>
          </View>
        )}

        {/* Play / Pause button */}
        {!error && (
          <Pressable
            onPress={() => { void togglePlay(); }}
            style={[ap.playBtn, { borderColor: `${accentColor}60`, backgroundColor: `${accentColor}18` }]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={36}
              color={accentColor}
              style={{ marginLeft: isPlaying ? 0 : 3 }}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const ap = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG, justifyContent: 'center' },
  safeArea:   { position: 'absolute', top: 0, right: 0, left: 0 },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  headerBtn:  { padding: 12, width: 46, alignItems: 'center' },
  content:    { alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  duration:   { fontSize: 13, color: MUTED, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  title:      { fontSize: 22, fontWeight: '700', color: TEXT, textAlign: 'center', lineHeight: 30 },
  timer:      { fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  progressBg: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  playBtn:    { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
