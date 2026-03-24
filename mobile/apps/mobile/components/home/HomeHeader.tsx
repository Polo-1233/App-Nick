/**
 * HomeHeader
 *
 * Left  — current time (updates every 30s)
 * Right — optional streak badge + profile avatar
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TEXT    = '#002060';
const ACCENT  = '#1c9fda';
const AVATAR_BG = '#EAF4FB';

interface HomeHeaderProps {
  streak?:         number;
  onAvatarPress:   () => void;
  onStreakPress?:  () => void;
}

export function HomeHeader({ streak = 0, onAvatarPress, onStreakPress }: HomeHeaderProps) {
  const [time, setTime] = useState(currentTime);

  useEffect(() => {
    const id = setInterval(() => setTime(currentTime()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={s.wrap}>
      {/* Left — time */}
      <Text style={s.time}>{time}</Text>

      {/* Right — streak (optional) + avatar */}
      <View style={s.right}>
        {streak > 0 && (
          <Pressable onPress={onStreakPress} hitSlop={8} style={s.streakRow}>
            <Text style={s.streakEmoji}>🔥</Text>
            <Text style={s.streakNum}>{streak}</Text>
          </Pressable>
        )}
        <Pressable onPress={onAvatarPress} hitSlop={12} style={s.avatar}>
          <Ionicons name="person-outline" size={16} color={TEXT} />
        </Pressable>
      </View>
    </View>
  );
}

function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const s = StyleSheet.create({
  wrap: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    height:            60,
    paddingHorizontal: 20,
  },
  time: {
    fontSize:   18,
    fontWeight: '500',
    color:      TEXT,
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  streakEmoji: { fontSize: 13 },
  streakNum: {
    fontSize:   13,
    fontWeight: '600',
    color:      ACCENT,
  },
  avatar: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: AVATAR_BG,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
