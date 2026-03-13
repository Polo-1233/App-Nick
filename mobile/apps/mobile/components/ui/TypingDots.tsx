/**
 * Animated typing indicator — three dots that pulse sequentially.
 * Used in the onboarding chat overlays and any R-Lo chat interface.
 */

import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const SURFACE  = '#1A2436';
const TEXT_SUB = '#9FB0C5';

export function TypingDots() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const d1 = anim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0.3, 1.0, 0.3, 0.3, 0.3] });
  const d2 = anim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0.3, 0.3, 1.0, 0.3, 0.3] });
  const d3 = anim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0.3, 0.3, 0.3, 1.0, 0.3] });

  return (
    <View style={s.bubble}>
      <Animated.View style={[s.dot, { opacity: d1 }]} />
      <Animated.View style={[s.dot, { opacity: d2 }]} />
      <Animated.View style={[s.dot, { opacity: d3 }]} />
    </View>
  );
}

const s = StyleSheet.create({
  bubble: {
    flexDirection:       'row',
    alignItems:          'center',
    backgroundColor:     SURFACE,
    borderRadius:        16,
    borderTopLeftRadius: 4,
    paddingHorizontal:   16,
    paddingVertical:     14,
    gap:                 6,
    alignSelf:           'flex-start',
    marginBottom:        8,
  },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: TEXT_SUB,
  },
});
