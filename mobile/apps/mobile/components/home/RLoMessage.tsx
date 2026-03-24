/**
 * RLoMessage
 *
 * A single calm sentence from R-Lo.
 * Appears with a subtle fade-in animation.
 *
 * Rules:
 *   - 1 sentence MAX
 *   - Never repeats the CTA
 *   - Calm and supportive tone
 *   - Small avatar on the left
 */

import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { MascotImage } from '../ui/MascotImage';
import type { MascotEmotion } from '../ui/MascotImage';

const TEXT_PRIMARY = '#002060';
const ACCENT       = '#1c9fda';

interface RLoMessageProps {
  text:     string;
  emotion?: MascotEmotion;
  onTap?:   () => void;
}

export const RLoMessage = memo(function RLoMessage({
  text,
  emotion = 'rassurante',
  onTap,
}: RLoMessageProps) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  // Fade + slide in when text changes
  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(6);
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [text]);

  return (
    <Pressable onPress={onTap} disabled={!onTap}>
      <Animated.View
        style={[
          rl.wrap,
          { opacity, transform: [{ translateY }] },
        ]}
      >
        {/* Avatar — 28px with subtle glow ring */}
        <View style={rl.avatarWrap}>
          <View style={rl.avatarGlow} />
          <View style={rl.avatar}>
            <MascotImage emotion={emotion} size="sm" />
          </View>
        </View>

        {/* Message — 1 sentence, low opacity */}
        <Text style={rl.text} numberOfLines={2}>{text}</Text>
      </Animated.View>
    </Pressable>
  );
});

const rl = StyleSheet.create({
  wrap: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    marginHorizontal: 20,
    marginTop:        14,
  },
  avatarWrap: {
    width:          28,
    height:         28,
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    position:        'absolute',
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: `${ACCENT}15`,
  },
  avatar: {
    width:        28,
    height:       28,
    borderRadius: 14,
    overflow:     'hidden',
  },
  text: {
    flex:       1,
    fontSize:   14,
    color:      TEXT_PRIMARY,
    opacity:    0.75,
    lineHeight: 20,
  },
});
