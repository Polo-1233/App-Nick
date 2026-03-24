/**
 * HomeHeader
 *
 * Layout: time (left) · streak pill (center) · avatar (right)
 * Height: 60px, horizontal padding: 20px
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT  = '#1c9fda';
const DEEP    = '#141466';
const TEXT    = '#002060';

interface HomeHeaderProps {
  streak?:        number;
  onAvatarPress:  () => void;
  onStreakPress?: () => void;
}

export function HomeHeader({ streak = 0, onAvatarPress, onStreakPress }: HomeHeaderProps) {
  const [time, setTime] = useState(getTime);

  useEffect(() => {
    const id = setInterval(() => setTime(getTime()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={s.row}>
      {/* Left — current time */}
      <Text style={s.time}>{time}</Text>

      {/* Center — streak pill (hidden when 0) */}
      {streak > 0 ? (
        <Pressable onPress={onStreakPress} hitSlop={8} style={s.pill}>
          <Text style={s.pillText}>🔥 {streak}</Text>
        </Pressable>
      ) : <View style={s.center} />}

      {/* Right — avatar */}
      <Pressable onPress={onAvatarPress} hitSlop={12} style={s.avatar}>
        <Ionicons name="person-outline" size={16} color={TEXT} />
      </Pressable>
    </View>
  );
}

function getTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n: number): string { return String(n).padStart(2, '0'); }

const s = StyleSheet.create({
  row: {
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
    width:      60,
  },
  center: { flex: 1 },
  pill: {
    backgroundColor: '#EAF4FB',
    borderRadius:    20,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  pillText: {
    fontSize:   13,
    fontWeight: '600',
    color:      ACCENT,
  },
  avatar: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: '#EAF4FB',
    alignItems:      'center',
    justifyContent:  'center',
  },
});
