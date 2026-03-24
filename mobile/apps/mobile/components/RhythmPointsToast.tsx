/**
 * RhythmPointsToast — Floating "+N Rhythm Points" notification
 *
 * Appears briefly after earning points (MRM, CRP, ARP confirm, etc.)
 * Slides down from top, stays 1.5s, slides back up.
 * Non-blocking, non-intrusive.
 *
 * Usage:
 *   <RhythmPointsToast points={5} label="ARP confirmed" visible={show} />
 */

import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';

interface RhythmPointsToastProps {
  points:  number;
  label?:  string;
  visible: boolean;
}

export function RhythmPointsToast({ points, label, visible }: RhythmPointsToastProps) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.sequence([
      // Slide in
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0,   duration: 300, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 1,   duration: 300, useNativeDriver: true }),
      ]),
      // Hold
      Animated.delay(1500),
      // Slide out
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible, points, translateY, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[s.wrap, { transform: [{ translateY }], opacity }]}>
      <View style={s.pill}>
        <Ionicons name="star" size={12} color={GOLD} />
        <Text style={s.points}>+{points}</Text>
        {label && <Text style={s.label}>{label}</Text>}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position:        'absolute',
    top:             60,
    left:            0,
    right:           0,
    alignItems:      'center',
    zIndex:          9999,
    pointerEvents:   'none',
  } as any,
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: '#FFFFFF',
    borderRadius:    24,
    paddingHorizontal: 16,
    paddingVertical:   10,
    shadowColor:     ACCENT,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.18,
    shadowRadius:    12,
    elevation:       8,
    borderWidth:     1,
    borderColor:     `${ACCENT}20`,
  },
  points: {
    fontSize:   14,
    fontWeight: '800',
    color:      GOLD,
  },
  label: {
    fontSize:   13,
    color:      '#5A7A9A',
    fontWeight: '500',
  },
});
