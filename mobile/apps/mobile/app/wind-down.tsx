/**
 * Wind-down screen — /wind-down
 *
 * Full-screen minimal UI shown 90 minutes before planned bedtime.
 * Deep-linked from the wind-down local notification.
 *
 * Layout:
 *   - Dark navy/purple background (#0D0F1E)
 *   - R-Lo mascot (rassurante in idle, celebration in done)
 *   - Horizontal progress bar (violet) when running
 *   - Large countdown timer
 *   - Interactive checklist
 *   - Completion state
 *
 * Soft-mode only — no DND / system Focus automation.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loadWindDownMusicEnabled } from '../lib/wind-down';
import { playAmbientLoop, stopAmbient } from '../lib/ambient-audio';
import { HapticsLight } from '../utils/haptics';
import { useTheme } from '../lib/theme-context';
import { MascotImage } from '../components/ui/MascotImage';
import { Button } from '../components/ui/Button';

// ─── Constants ────────────────────────────────────────────────────────────────

const WIND_DOWN_DURATION_SECONDS = 90 * 60;
const VIOLET = '#9B7AFF';

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
  const { theme } = useTheme();
  const c = theme.colors;

  const [phase,      setPhase]      = useState<'idle' | 'running' | 'paused' | 'done'>('idle');
  const [checked,    setChecked]    = useState<Set<string>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState(WIND_DOWN_DURATION_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const checkAnims   = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(CHECKLIST.map(item => [item.id, new Animated.Value(0)]))
  ).current;

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

  // ── Timer cleanup ──────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Start ──────────────────────────────────────────────────────────────────
  const startRoutine = useCallback(() => {
    void HapticsLight();
    setPhase('running');

    Animated.timing(progressAnim, {
      toValue:         1,
      duration:        WIND_DOWN_DURATION_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

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

  // ── Pause ──────────────────────────────────────────────────────────────────
  const pauseRoutine = useCallback(() => {
    void HapticsLight();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    progressAnim.stopAnimation();
    setPhase('paused');
  }, [progressAnim]);

  // ── Resume ─────────────────────────────────────────────────────────────────
  const resumeRoutine = useCallback(() => {
    void HapticsLight();
    setPhase('running');

    Animated.timing(progressAnim, {
      toValue:         1,
      duration:        secondsLeft * 1000,
      useNativeDriver: false,
    }).start();

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
  }, [progressAnim, secondsLeft]);

  // ── Toggle check ───────────────────────────────────────────────────────────
  const toggleCheck = useCallback((id: string) => {
    void HapticsLight();
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        Animated.timing(checkAnims[id], {
          toValue: 0, duration: 150, useNativeDriver: true,
        }).start();
      } else {
        next.add(id);
        Animated.spring(checkAnims[id], {
          toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6,
        }).start();
      }
      return next;
    });
  }, [checkAnims]);

  const allChecked = checked.size === CHECKLIST.length;
  const progressWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });
  const minutesLeft = Math.ceil(secondsLeft / 60);

  return (
    <View style={[s.root, { backgroundColor: '#0D0F1E' }]}>
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom', 'left', 'right']}>

        {/* Close */}
        <Pressable
          style={[s.closeBtn, { backgroundColor: 'rgba(255,255,255,0.07)' }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close wind-down screen"
          hitSlop={12}
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
        </Pressable>

        {/* Header */}
        <View style={s.headerBlock}>
          <Text style={[s.title, { color: c.text }]}>Wind Down</Text>
          <Text style={[s.subtitle, { color: c.textSub }]}>
            {phase === 'idle'   ? '90 minutes to sleep'
             : phase === 'done' ? 'Routine complete'
             : `${formatCountdown(secondsLeft)} remaining`}
          </Text>
        </View>

        {/* R-Lo — idle and paused */}
        {(phase === 'idle' || phase === 'paused') && (
          <View style={s.mascotContainer}>
            <MascotImage emotion="rassurante" size="md" />
          </View>
        )}

        {/* Timer display — running */}
        {(phase === 'running') && (
          <View style={s.timerBlock}>
            <Text style={[s.timerText, { color: c.text }]}>
              {minutesLeft}
            </Text>
            <Text style={[s.timerLabel, { color: c.textSub }]}>minutes remaining</Text>
          </View>
        )}

        {/* Progress bar */}
        {(phase === 'running' || phase === 'paused') && (
          <View style={[s.progressTrack, { backgroundColor: c.surface2 }]}>
            <Animated.View style={[
              s.progressFill,
              { width: progressWidth, backgroundColor: VIOLET },
            ]} />
          </View>
        )}

        <View style={s.fill} />

        {/* Done state */}
        {phase === 'done' ? (
          <View style={s.doneBlock}>
            <MascotImage emotion="celebration" size="xl" />
            <Text style={[s.doneTitle, { color: c.text }]}>
              Time to sleep 🌙
            </Text>
            <Text style={[s.doneSub, { color: c.textSub }]}>
              {allChecked
                ? 'All steps done. Sweet dreams.'
                : 'Routine finished. Head to bed when ready.'}
            </Text>
            <Button
              label="Close"
              onPress={() => router.back()}
              variant="primary"
              fullWidth
              icon="arrow-forward"
            />
          </View>
        ) : (
          <>
            {/* Checklist */}
            <View style={s.checklist}>
              <Text style={[s.checklistTitle, { color: c.textFaint }]}>
                BEFORE YOU SLEEP
              </Text>
              {CHECKLIST.map(item => {
                const done = checked.has(item.id);
                const scale = checkAnims[item.id].interpolate({
                  inputRange: [0, 1], outputRange: [1, 1.15],
                });
                return (
                  <Pressable
                    key={item.id}
                    style={[s.checkItem, { borderBottomColor: c.borderSub, backgroundColor: c.surface }]}
                    onPress={() => toggleCheck(item.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={item.text}
                  >
                    <Animated.View style={[
                      s.checkDot,
                      {
                        borderColor:     done ? VIOLET : c.border,
                        backgroundColor: done ? VIOLET : 'transparent',
                        transform:       [{ scale }],
                      },
                    ]}>
                      {done && (
                        <Animated.View style={{ opacity: checkAnims[item.id] }}>
                          <Ionicons name="checkmark" size={13} color="#fff" />
                        </Animated.View>
                      )}
                    </Animated.View>
                    <Text style={[
                      s.checkText,
                      { color: done ? c.textMuted : c.text },
                      done && s.checkTextDone,
                    ]}>
                      {item.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* CTA */}
            {phase === 'idle' && (
              <Button
                label="Start Wind Down"
                onPress={startRoutine}
                variant="primary"
                fullWidth
              />
            )}
            {phase === 'running' && (
              <Button
                label="Pause"
                onPress={pauseRoutine}
                variant="secondary"
                fullWidth
              />
            )}
            {phase === 'paused' && (
              <View style={s.pausedRow}>
                <Button
                  label="Resume"
                  onPress={resumeRoutine}
                  variant="primary"
                  fullWidth
                />
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
    flex: 1,
  },
  safeArea: {
    flex:    1,
    padding: 24,
  },

  closeBtn: {
    alignSelf:    'flex-start',
    padding:      8,
    borderRadius: 20,
  },

  headerBlock: {
    alignItems:  'center',
    marginTop:   28,
    marginBottom: 8,
    gap:          6,
  },
  title: {
    fontSize:      24,
    fontWeight:    '700',
    fontFamily:    'Inter_700Bold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize:   15,
    fontWeight: '400',
  },

  mascotContainer: {
    alignItems:  'center',
    marginTop:   24,
    marginBottom: 8,
  },

  timerBlock: {
    alignItems:  'center',
    marginTop:   24,
    marginBottom: 8,
  },
  timerText: {
    fontSize:      72,
    fontWeight:    '700',
    fontFamily:    'Inter_700Bold',
    letterSpacing: -2,
    lineHeight:    80,
  },
  timerLabel: {
    fontSize:   15,
    marginTop:  4,
  },

  progressTrack: {
    height:       4,
    borderRadius: 2,
    overflow:     'hidden',
    marginTop:    20,
  },
  progressFill: {
    height:       '100%',
    borderRadius: 2,
  },

  fill: { flex: 1 },

  // Checklist
  checklist: {
    marginBottom: 16,
    gap: 0,
  },
  checklistTitle: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  10,
  },
  checkItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    paddingVertical:   13,
    paddingHorizontal: 12,
    borderRadius:      10,
    marginBottom:      6,
    borderBottomWidth: 0,
  },
  checkDot: {
    width:           24,
    height:          24,
    borderRadius:    12,
    borderWidth:     1.5,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkText: {
    fontSize:   16,
    fontWeight: '400',
    flex:       1,
  },
  checkTextDone: {
    textDecorationLine: 'line-through',
  },

  // Done
  doneBlock: {
    alignItems:    'center',
    marginBottom:  8,
    gap:           16,
  },
  doneTitle: {
    fontSize:   24,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  doneSub: {
    fontSize:  15,
    textAlign: 'center',
    lineHeight: 22,
  },

  pausedRow: {},
});
