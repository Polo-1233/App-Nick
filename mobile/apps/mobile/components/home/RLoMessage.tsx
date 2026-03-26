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

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MascotImage } from '../ui/MascotImage';
import { getRLoMessage, type RLoMessage as RLoMsg, type BehaviorContext } from '../../lib/rlo-message';
import { getRLoMood, type MoodInput } from '../../lib/rlo-mood';
import type { ActionState } from '../../lib/action-state';
import { nowMin } from '../../lib/time-utils';
import { HapticsLight } from '../../utils/haptics';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const DEEP    = '#141466';
const ACCENT  = '#1c9fda';
const WHITE   = '#FFFFFF';
const SUB     = 'rgba(255,255,255,0.65)';

interface RLoMessageProps {
  actionState:      ActionState;
  wakeMin:          number;
  onChatTap:        () => void;
  onMrmTap?:        () => void;
  mood?:            MoodInput;
  behavior?:        BehaviorContext;
  mrmDoneToday?:    boolean;
  emotionOverride?: string;  // from proactive insight
}

export const RLoMessage = memo(function RLoMessage({
  actionState, wakeMin, onChatTap, onMrmTap, mood, behavior, mrmDoneToday, emotionOverride,
}: RLoMessageProps) {
  const emotion = (emotionOverride ?? (mood ? getRLoMood(mood) : 'rassurante')) as any;
  const now        = new Date();
  const hourOfDay  = now.getHours();
  const dayOfWeek  = now.getDay();
  const insightSeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));

  const [msg, setMsg] = useState<RLoMsg>(() =>
    getRLoMessage({ actionState, wakeMin, hourOfDay, dayOfWeek, insightSeed, behavior, mrmDoneToday })
  );
  const [qrSelected, setQrSelected] = useState<string | null>(null);
  const [qrResponse, setQrResponse] = useState<string | null>(null);

  useEffect(() => {
    const next = getRLoMessage({ actionState, wakeMin, hourOfDay, dayOfWeek, insightSeed, behavior, mrmDoneToday });
    setMsg(next);
    setQrSelected(null);
    setQrResponse(null);
  }, [actionState, wakeMin, behavior?.streak, behavior?.winddownsThisWeek, mrmDoneToday]);

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

  const categoryColor =
    msg.category === 'reminder'     ? '#60A5FA' :
    msg.category === 'advice'       ? '#FCD34D' :
    msg.category === 'insight'      ? '#A78BFA' :
    ACCENT;

  // Quick reply handler
  const handleQuickReply = useCallback(async (value: string, label: string) => {
    HapticsLight();
    setQrSelected(value);
    // Store response
    try {
      const key = '@r90:quickReplies:v1';
      const raw = await AsyncStorage.getItem(key);
      const data: Array<{ date: string; trigger: string; value: string }> = raw ? JSON.parse(raw) : [];
      data.push({ date: new Date().toISOString(), trigger: actionState, value });
      if (data.length > 50) data.splice(0, data.length - 50);
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch {}
    // Contextual response
    const responses: Record<string, string> = {
      refreshed: "That's the rhythm working. Keep it up.",
      ok: "It builds over time. Consistency is key.",
      no_help: "Some days are harder. Tomorrow's reset will be better.",
      great: "Great start! Your rhythm is paying off.",
      average: "It'll build. Stick with your cycles today.",
      low: "Low energy mornings happen. Your CRP later will help.",
      ready: "Perfect. Sleep well tonight.",
      getting: "Almost there. Let the routine carry you.",
      racing: "Try the breathing exercise. It helps slow things down.",
    };
    setQrResponse(responses[value] ?? "Thanks for sharing.");
  }, [actionState]);

  const isMissedMrm = msg.hasCta && actionState === 'post_mrm' && !mrmDoneToday;

  return (
    <Pressable onPress={onChatTap} style={rl.pressable}>
      <Animated.View
        style={[rl.card, { opacity, transform: [{ translateY }] }]}
      >
        {/* Avatar */}
        <View style={rl.avatarWrap}>
          <MascotImage emotion={emotion} size="sm" style={rl.avatarImg} />
        </View>

        {/* Message + optional quick reply */}
        <View style={rl.body}>
          <Text style={rl.message} numberOfLines={qrResponse ? 3 : 2}>
            {qrResponse ?? msg.message}
          </Text>

          {/* Quick reply pills */}
          {msg.quickReply && !qrSelected && !qrResponse && (
            <View style={rl.qrRow}>
              {msg.quickReply.options.map(opt => (
                <Pressable
                  key={opt.value}
                  style={rl.qrPill}
                  onPress={() => handleQuickReply(opt.value, opt.label)}
                >
                  <Text style={rl.qrPillText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Missed MRM CTA */}
          {isMissedMrm && onMrmTap && (
            <Pressable onPress={onMrmTap} style={rl.tryNowBtn}>
              <Text style={rl.tryNowText}>Try now →</Text>
            </Pressable>
          )}
        </View>

        {/* Chat CTA (hidden when quick reply active) */}
        {!msg.quickReply && !isMissedMrm && (
          <Pressable onPress={onChatTap} hitSlop={8}>
            <Text style={[rl.cta, { color: categoryColor }]}>Chat →</Text>
          </Pressable>
        )}
      </Animated.View>
    </Pressable>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const rl = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
  },
  card: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              12,
    marginHorizontal: 20,
    marginTop:        10,
    paddingVertical:  14,
    paddingHorizontal: 16,
    borderRadius:     18,
    backgroundColor:  '#1c1c7a',   // surface2 from theme
    borderWidth:      1,
    borderColor:      `${ACCENT}18`,
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
    width:      34,
    height:     34,
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
  // Quick reply pills
  qrRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    marginTop:     8,
  },
  qrPill: {
    backgroundColor: `${ACCENT}20`,
    borderRadius:    12,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderWidth:     1,
    borderColor:     `${ACCENT}35`,
  },
  qrPillText: {
    fontSize:   12,
    fontWeight: '600',
    color:      ACCENT,
  },
  // Missed MRM CTA
  tryNowBtn: {
    marginTop:       6,
    backgroundColor: `${ACCENT}20`,
    borderRadius:    10,
    paddingHorizontal: 12,
    paddingVertical:   6,
    alignSelf:       'flex-start',
  },
  tryNowText: {
    fontSize:   12,
    fontWeight: '700',
    color:      ACCENT,
  },
});
