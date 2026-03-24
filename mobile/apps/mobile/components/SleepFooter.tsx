/**
 * SleepFooter — "Tonight: 23:00" toujours visible en bas
 *
 * Style discret, rappel passif de la fenêtre de sommeil.
 */

import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#1c9fda';
const MUTED  = '#6B8CAE';

function fmt(m: number): string {
  const norm = ((m % 1440) + 1440) % 1440;
  const h    = Math.floor(norm / 60);
  const min  = norm % 60;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

interface SleepFooterProps {
  bedtime: number | null;  // minutes from midnight
}

export const SleepFooter = memo(function SleepFooter({ bedtime }: SleepFooterProps) {
  if (bedtime === null) return null;
  return (
    <View style={sf.wrap}>
      <Ionicons name="moon-outline" size={12} color={ACCENT} />
      <Text style={sf.text}>Tonight: {fmt(bedtime)}</Text>
    </View>
  );
});

const sf = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  text: { fontSize: 12, fontWeight: '600', color: MUTED, letterSpacing: 0.3 },
});
