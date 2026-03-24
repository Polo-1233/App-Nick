/**
 * RLoMessage — Companion card on Home screen
 *
 * Role: emotional + contextual layer, secondary to ActionCard.
 * Layout: [avatar] [short message] [Chat → optional]
 *
 * Rules:
 *   - Max 1-2 lines
 *   - Never duplicates Action Card
 *   - Compact, calm, non-intrusive
 *   - Fade in when message changes
 */

import { memo, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { MascotImage } from '../ui/MascotImage';
import { getRLoMessage, type RLoMessage as RLoMsg } from '../../lib/rlo-message';
import { getRLoMood, type MoodInput } from '../../lib/rlo-mood';
import type { ActionState } from '../../lib/action-state';
import { nowMin } from '../../lib/time-utils';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const DEEP    = '#141466';
const ACCENT  = '#1c9fda';
const WHITE   = '#FFFFFF';
const SUB     = 'rgba(255,255,255,0.65)';

interface RLoMessageProps {
  actionState: ActionState;
  wakeMin:     number;
  onChatTap:   () => void;
  mood?:       MoodInput;  // streak + zone → R-LO emotion
}

export const RLoMessage = memo(function RLoMessage({
  actionState, wakeMin, onChatTap, mood,
}: RLoMessageProps) {
  const emotion = mood ? getRLoMood(mood) : 'rassurante';
  const now        = new Date();
  const hourOfDay  = now.getHours();
  const dayOfWeek  = now.getDay();
  const insightSeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // changes daily

  const [msg, setMsg] = useState<RLoMsg>(() =>
    getRLoMessage({ actionState, wakeMin, hourOfDay, dayOfWeek, insightSeed })
  );

  // Update message when action state changes
  useEffect(() => {
    const next = getRLoMessage({ actionState, wakeMin, hourOfDay, dayOfWeek, insightSeed });
    setMsg(next);
  }, [actionState, wakeMin]);

  // Fade in on message change
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(4)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(4);
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [msg.message]);

  // Category accent color (subtle differentiation)
  const categoryColor =
    msg.category === 'reminder'     ? '#60A5FA' :
    msg.category === 'advice'       ? '#FCD34D' :
    msg.category === 'insight'      ? '#A78BFA' :
    ACCENT;                          // encouragement

  return (
    <Pressable onPress={onChatTap}>
      <Animated.View
        style={[
          rl.card,
          { opacity, transform: [{ translateY }] },
        ]}
      >
        {/* Avatar */}
        <View style={rl.avatarWrap}>
          <MascotImage emotion={emotion} size="sm" style={rl.avatarImg} />
        </View>

        {/* Message */}
        <View style={rl.body}>
          <Text style={rl.message} numberOfLines={2}>{msg.message}</Text>
        </View>

        {/* Chat CTA */}
        <Pressable onPress={onChatTap} hitSlop={8}>
          <Text style={[rl.cta, { color: categoryColor }]}>Chat →</Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const rl = StyleSheet.create({
  card: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              12,
    marginHorizontal: 20,
    marginTop:        10,
    paddingVertical:  14,
    paddingHorizontal: 16,
    borderRadius:     18,
    backgroundColor:  '#1a1f6e',
    borderWidth:      1,
    borderColor:      `${ACCENT}20`,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.06,
    shadowRadius:     10,
    elevation:        2,
  },
  avatarWrap: {
    width:           34,
    height:          34,
    borderRadius:    17,
    overflow:        'hidden',
    backgroundColor: `${ACCENT}20`,
    flexShrink:      0,
  },
  avatarImg: {
    width:      50,
    height:     50,
    marginTop:  -8,
    marginLeft: -8,
  },
  body: {
    flex: 1,
  },
  message: {
    fontSize:  13,
    color:     'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  cta: {
    fontSize:   13,
    fontWeight: '700',
    flexShrink: 0,
  },
});
