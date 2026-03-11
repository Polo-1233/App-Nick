/**
 * WeeklyCycleRing — animated, tappable circular progress ring.
 *
 * Replaces WeeklyCyclesRing with:
 *   - Entrance scale + opacity animation (Animated API, native driver)
 *   - onPress callback to open BottomSheetStats
 *   - "This week" label + streak subtext
 *   - No new dependencies (pure RN Views)
 */

import { useEffect, useRef } from 'react';
import { Animated, Pressable, View, Text, StyleSheet } from 'react-native';
import type { ReadinessZone } from '@r90/types';
import { HapticsSuccess } from '../utils/haptics';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  current:  number;
  target?:  number;
  zone?:    ReadinessZone;
  /** Consecutive ideal-night streak count. */
  streak?:  number;
  onPress?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZONE_COLOR: Record<ReadinessZone, string> = {
  green:  '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
};

const SIZE   = 220;
const CENTER = SIZE / 2;
const RADIUS = 88;  // distance from center to tick midpoint
const SEG_W  = 3.5; // tick width  (px)
const SEG_H  = 14;  // tick height (px)

// ─── Component ────────────────────────────────────────────────────────────────

export function WeeklyCycleRing({
  current,
  target  = 35,
  zone    = 'green',
  streak  = 0,
  onPress,
}: Props) {
  const scaleAnim       = useRef(new Animated.Value(0.88)).current;
  const opacityAnim     = useRef(new Animated.Value(0)).current;
  // Prevent the success haptic from firing more than once per mount
  const hasFiredSuccess = useRef(false);

  useEffect(() => {
    const isComplete = current >= target;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue:   1,
        damping:   18,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue:  1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Fire once, synchronized with animation end, only when week target is met
      if (isComplete && !hasFiredSuccess.current) {
        hasFiredSuccess.current = true;
        HapticsSuccess();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeColor = ZONE_COLOR[zone];
  const clamped     = Math.min(Math.max(current, 0), target);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Animated.View
        style={[
          styles.ringContainer,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      >
        {/* Tick marks arranged in a circle */}
        {Array.from({ length: target }, (_, i) => {
          const angleDeg = (i / target) * 360 - 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          const x        = CENTER + RADIUS * Math.cos(angleRad);
          const y        = CENTER + RADIUS * Math.sin(angleRad);
          const isActive = i < clamped;

          return (
            <View
              key={i}
              style={{
                position:        'absolute',
                width:           SEG_W,
                height:          SEG_H,
                left:            x - SEG_W / 2,
                top:             y - SEG_H / 2,
                borderRadius:    SEG_W / 2,
                backgroundColor: isActive ? activeColor : '#1E1E1E',
                transform:       [{ rotate: `${angleDeg + 90}deg` }],
              }}
            />
          );
        })}

        {/* Center content */}
        <View style={styles.center}>
          <Text style={styles.number}>{clamped}</Text>
          <Text style={styles.outOf}>/ {target}</Text>
        </View>
      </Animated.View>

      {/* Labels below ring */}
      <Text style={styles.weekLabel}>This week</Text>

      {streak > 0 && (
        <Text style={[styles.streakLabel, { color: activeColor }]}>
          {streak} night streak
        </Text>
      )}

      {onPress && (
        <Text style={styles.tapHint}>Tap for details</Text>
      )}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  ringContainer: {
    width:  SIZE,
    height: SIZE,
  },
  center: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    justifyContent: 'center',
    alignItems:     'center',
  },
  number: {
    color:         '#FFFFFF',
    fontSize:      56,
    fontWeight:    '700',
    letterSpacing: -2,
    lineHeight:    62,
  },
  outOf: {
    color:      '#525252',
    fontSize:   17,
    fontWeight: '500',
    marginTop:  -4,
  },
  weekLabel: {
    color:         '#737373',
    fontSize:      12,
    fontWeight:    '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign:     'center',
    marginTop:     12,
  },
  streakLabel: {
    fontSize:   13,
    fontWeight: '500',
    textAlign:  'center',
    marginTop:  4,
  },
  tapHint: {
    color:     '#2A2A2A',
    fontSize:  11,
    textAlign: 'center',
    marginTop: 6,
  },
});
