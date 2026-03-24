/**
 * RLoCard (RLoMessage)
 *
 * Second card below ActionCard.
 * Matches reference: rich blue card with avatar + message text + "Chat →" CTA.
 *
 * Layout:
 *   [R-Lo avatar]  [1–2 sentence message]  [Chat →]
 *
 * Rules:
 *   - 1–2 sentences MAX
 *   - Never repeats the CTA from ActionCard
 *   - Calm, intelligent tone
 *   - Fade-in on mount / message change
 */

import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { MascotImage } from '../ui/MascotImage';
import type { MascotEmotion } from '../ui/MascotImage';

const DEEP   = '#141466';
const ACCENT = '#1c9fda';
const WHITE  = '#FFFFFF';

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
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(6);
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [text]);

  return (
    <Pressable onPress={onTap} disabled={!onTap}>
      <Animated.View
        style={[rl.card, { opacity, transform: [{ translateY }] }]}
      >
        {/* R-Lo avatar */}
        <View style={rl.avatarWrap}>
          <View style={rl.avatar}>
            <MascotImage emotion={emotion} size="sm" />
          </View>
        </View>

        {/* Message */}
        <Text style={rl.text} numberOfLines={2}>{text}</Text>

        {/* Chat CTA */}
        {!!onTap && (
          <Text style={rl.cta}>Chat →</Text>
        )}
      </Animated.View>
    </Pressable>
  );
});

const rl = StyleSheet.create({
  card: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              12,
    marginHorizontal: 20,
    marginTop:        10,
    padding:          16,
    borderRadius:     18,
    backgroundColor:  DEEP,
    shadowColor:      DEEP,
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.12,
    shadowRadius:     14,
    elevation:        3,
  },
  avatarWrap: {
    width:        36,
    height:       36,
    borderRadius: 18,
    overflow:     'hidden',
    flexShrink:   0,
    backgroundColor: `${ACCENT}25`,
  },
  avatar: {
    width:        36,
    height:       36,
    borderRadius: 18,
    overflow:     'hidden',
  },
  text: {
    flex:       1,
    fontSize:   14,
    color:      'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  cta: {
    fontSize:   13,
    fontWeight: '700',
    color:      ACCENT,
    flexShrink: 0,
  },
});
