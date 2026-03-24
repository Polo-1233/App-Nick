/**
 * AmbientBackground — Dynamic time-of-day gradient for light mode
 *
 * Almost invisible: 2–5% color presence max.
 * Transitions smoothly between morning · day · evening · night.
 * No-ops in dark mode (dark screens keep their existing navy palette).
 *
 * Usage:
 *   <AmbientBackground wakeMin={profile?.anchorTime}>
 *     {children}
 *   </AmbientBackground>
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../lib/theme-context';
import { nowMin } from '../../lib/time-utils';
import { getAmbientState, AMBIENT } from '../../lib/ambient-background';

interface AmbientBackgroundProps {
  children:  ReactNode;
  wakeMin?:  number;
  style?:    object;
}

// Cross-fade duration between states (ms)
const TRANSITION_MS = 4000;

export function AmbientBackground({ children, wakeMin = 390, style }: AmbientBackgroundProps) {
  const { theme } = useTheme();

  // ── Dark mode: no ambient overlay — native background handles it ──────────
  if (theme.dark) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }, style]}>
        {children}
      </View>
    );
  }

  return <LightAmbient wakeMin={wakeMin} style={style}>{children}</LightAmbient>;
}

// ─── Light mode implementation ────────────────────────────────────────────────

function LightAmbient({ children, wakeMin, style }: AmbientBackgroundProps) {
  const state        = getAmbientState(nowMin(), wakeMin);
  const { top, bottom } = AMBIENT[state];

  // Animate opacity of the gradient overlay (cross-fade on state change)
  const opacity = useRef(new Animated.Value(1)).current;
  const prevState = useRef<typeof state>(state);

  useEffect(() => {
    if (prevState.current === state) return;
    prevState.current = state;

    // Fade out → swap colors → fade in  (React Native can't tween color strings natively)
    // We use two stacked gradients: old fades out, new fades in via opacity
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0, duration: TRANSITION_MS / 2, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: TRANSITION_MS / 2, useNativeDriver: true }),
    ]).start();
  }, [state, opacity]);

  return (
    <View style={[s.root, style]}>
      {/* Base white */}
      <View style={[StyleSheet.absoluteFill, s.white]} />

      {/* Animated gradient overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
        <LinearGradient
          colors={[top, bottom]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </Animated.View>

      {/* Content */}
      <View style={[StyleSheet.absoluteFill, s.content]}>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, position: 'relative' },
  white:   { backgroundColor: '#FFFFFF' },
  content: { flex: 1 },
});
