/**
 * Wind-down screen — /wind-down
 *
 * Full-screen minimal UI shown 90 minutes before planned bedtime.
 * Deep-linked from the wind-down local notification.
 *
 * Layout:
 *   - Night campfire background (fire-camp.png) — dark, calming
 *   - Gradient overlay for readability
 *   - Title / subtitle
 *   - 90-minute countdown timer (starts on "Start routine")
 *   - Interactive checklist — items check off one by one
 *   - Completion state when all items checked + timer reached 0
 *
 * Soft-mode only — no DND / system Focus automation.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loadWindDownMusicEnabled } from '../lib/wind-down';
import { playAmbientLoop, stopAmbient } from '../lib/ambient-audio';
import { HapticsLight } from '../utils/haptics';

// ─── Constants ────────────────────────────────────────────────────────────────

const WIND_DOWN_DURATION_SECONDS = 90 * 60; // 90 minutes

const CHECKLIST: { id: string; text: string }[] = [
  { id: 'dim',      text: 'Dim all lights' },
  { id: 'prep',     text: 'Prepare for tomorrow' },
  { id: 'caffeine', text: 'No caffeine from here' },
  { id: 'screens',  text: 'Reduce screen brightness' },
  { id: 'temp',     text: 'Cool down your room' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── WindDown screen ──────────────────────────────────────────────────────────

export default function WindDownScreen() {
  const router = useRouter();

  // Routine state: idle → running → done
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState(WIND_DOWN_DURATION_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Progress animation (0 → 1 over 90 min)
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Ambient music ──────────────────────────────────────────────────────────
  useEffect(() => {
    let started = false;

    loadWindDownMusicEnabled().then(enabled => {
      if (!enabled) return;
      started = true;
      void playAmbientLoop(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../assets/music/ambient.mp3'),
        { volume: 0.35, fadeInMs: 3000 },
      );
    });

    return () => {
      if (started) void stopAmbient({ fadeOutMs: 1500 });
    };
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRoutine = useCallback(() => {
    void HapticsLight();
    setPhase('running');

    // Start progress animation
    Animated.timing(progressAnim, {
      toValue:         1,
      duration:        WIND_DOWN_DURATION_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    // Countdown tick
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setPhase('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [progressAnim]);

  const toggleCheck = useCallback((id: string) => {
    void HapticsLight();
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allChecked = checked.size === CHECKLIST.length;
  const progressWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={s.root}>

      {/* ── Night campfire background ── */}
      <Image
        source={require('../assets/images/fire-camp.png')}
        style={s.bg}
        resizeMode="cover"
      />

      {/* ── Dark gradient ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)']}
        style={StyleSheet.absoluteFill}
      />

      {/* ── UI content ── */}
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom', 'left', 'right']}>

        {/* Close */}
        <Pressable
          style={s.closeBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close wind-down screen"
          hitSlop={12}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.65)" />
        </Pressable>

        {/* Title block */}
        <View style={s.titleBlock}>
          <Text style={s.moonLabel}>🌙</Text>
          <Text style={s.title}>Wind-down</Text>
          <Text style={s.subtitle}>
            {phase === 'idle'    ? '90 minutes to bedtime' :
             phase === 'running' ? `${formatCountdown(secondsLeft)} remaining` :
                                   'Routine complete'}
          </Text>
        </View>

        {/* Progress bar — visible when running or done */}
        {phase !== 'idle' && (
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>
        )}

        <View style={s.fill} />

        {/* ── Done state ── */}
        {phase === 'done' ? (
          <View style={s.doneBlock}>
            <Text style={s.doneIcon}>✓</Text>
            <Text style={s.doneTitle}>Wind-down complete</Text>
            <Text style={s.doneSubtitle}>
              {allChecked
                ? 'All steps done. Time for sleep.'
                : 'Routine finished. Head to bed when ready.'}
            </Text>
            <Pressable
              style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={s.ctaText}>Go to sleep</Text>
              <Ionicons name="arrow-forward" size={18} color="#000000" />
            </Pressable>
          </View>
        ) : (
          <>
            {/* Checklist */}
            <View style={s.checklist}>
              <Text style={s.checklistTitle}>BEFORE YOU SLEEP</Text>
              {CHECKLIST.map(item => {
                const done = checked.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={s.checkItem}
                    onPress={() => toggleCheck(item.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={item.text}
                  >
                    <View style={[s.checkDot, done && s.checkDotDone]}>
                      {done && <Ionicons name="checkmark" size={12} color="#000" />}
                    </View>
                    <Text style={[s.checkText, done && s.checkTextDone]}>
                      {item.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* CTA */}
            {phase === 'idle' ? (
              <Pressable
                style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
                onPress={startRoutine}
                accessibilityRole="button"
                accessibilityLabel="Start routine"
              >
                <Text style={s.ctaText}>Start routine</Text>
                <Ionicons name="arrow-forward" size={18} color="#000000" />
              </Pressable>
            ) : (
              <View style={s.runningFooter}>
                <Text style={s.runningHint}>
                  {allChecked
                    ? 'All done — rest when ready.'
                    : `${CHECKLIST.length - checked.size} item${CHECKLIST.length - checked.size === 1 ? '' : 's'} remaining`}
                </Text>
              </View>
            )}
          </>
        )}

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#050A07',
  },
  bg: {
    position: 'absolute',
    width:    '100%',
    height:   '100%',
  },
  safeArea: {
    flex:    1,
    padding: 24,
  },

  // Close
  closeBtn: {
    alignSelf:       'flex-start',
    padding:         8,
    borderRadius:    20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Title block
  titleBlock: {
    alignItems:  'center',
    marginTop:   32,
  },
  moonLabel: {
    fontSize:     48,
    marginBottom: 12,
  },
  title: {
    color:         '#FFFFFF',
    fontSize:      34,
    fontWeight:    '700',
    letterSpacing: -0.5,
    marginBottom:  8,
  },
  subtitle: {
    color:      'rgba(255,255,255,0.55)',
    fontSize:   16,
    fontWeight: '400',
  },

  // Progress bar
  progressTrack: {
    height:          3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius:    2,
    overflow:        'hidden',
    marginTop:       24,
  },
  progressFill: {
    height:          '100%',
    backgroundColor: '#22C55E',
    borderRadius:    2,
  },

  fill: { flex: 1 },

  // Checklist
  checklist: {
    marginBottom: 20,
  },
  checklistTitle: {
    color:         'rgba(255,255,255,0.35)',
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  16,
  },
  checkItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    paddingVertical:   12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  checkDot: {
    width:           22,
    height:          22,
    borderRadius:    11,
    borderWidth:     1.5,
    borderColor:     '#22C55E',
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkDotDone: {
    backgroundColor: '#22C55E',
    borderColor:     '#22C55E',
  },
  checkText: {
    color:      'rgba(255,255,255,0.80)',
    fontSize:   16,
    fontWeight: '400',
  },
  checkTextDone: {
    color:          'rgba(255,255,255,0.35)',
    textDecorationLine: 'line-through',
  },

  // Running footer
  runningFooter: {
    alignItems:    'center',
    paddingBottom: 8,
  },
  runningHint: {
    color:      'rgba(255,255,255,0.45)',
    fontSize:   14,
    fontWeight: '400',
  },

  // Done block
  doneBlock: {
    alignItems:    'center',
    marginBottom:  16,
    gap:           12,
  },
  doneIcon: {
    fontSize: 48,
    color:    '#22C55E',
  },
  doneTitle: {
    color:      '#FFFFFF',
    fontSize:   24,
    fontWeight: '700',
  },
  doneSubtitle: {
    color:      'rgba(255,255,255,0.55)',
    fontSize:   15,
    textAlign:  'center',
  },

  // CTA
  cta: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    backgroundColor: '#22C55E',
    borderRadius:    16,
    paddingVertical: 18,
    marginBottom:    8,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaText: {
    color:      '#000000',
    fontSize:   17,
    fontWeight: '700',
  },
});
