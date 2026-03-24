/**
 * RLoMessageBar — Spec pixel-perfect R90
 *
 * - Avatar 28px, glow bleu léger
 * - 1 phrase max, 14px, #002060 opacity 0.8
 * - Pas de chevron, pas de CTA
 * - Fade + slide 200ms à l'apparition
 */

import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { MascotImage } from './ui/MascotImage';

const TEXT_PRIMARY = '#002060';
const ACCENT       = '#1c9fda';

interface RLoMessageBarProps {
  text:     string;
  onTap:    () => void;
  emotion?: import('./ui/MascotImage').MascotEmotion;
}

export const RLoMessageBar = memo(function RLoMessageBar({
  text, onTap, emotion = 'rassurante',
}: RLoMessageBarProps) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  // Fade + slide in on mount / text change
  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [text]);

  return (
    <Pressable
      onPress={onTap}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Open R-Lo chat"
    >
      <Animated.View
        style={[
          rl.wrap,
          {
            opacity:   fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Avatar with subtle glow */}
        <View style={rl.avatarWrap}>
          <View style={rl.avatarGlow} />
          <View style={rl.avatar}>
            <MascotImage emotion={emotion} size="sm" />
          </View>
        </View>

        <Text style={rl.text} numberOfLines={1}>{text}</Text>
      </Animated.View>
    </Pressable>
  );
});

const rl = StyleSheet.create({
  wrap: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    marginHorizontal: 20,
    marginTop:      14,
    paddingVertical: 2,
  },
  avatarWrap: {
    position:       'relative',
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
    backgroundColor: `${ACCENT}18`,
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
    opacity:    0.8,
    lineHeight: 20,
  },
});
