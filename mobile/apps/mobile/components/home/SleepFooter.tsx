/**
 * SleepFooter
 *
 * Discreet tonight's sleep window indicator.
 * "🌙 Tonight: 23:00"
 * Small, low opacity, at the bottom.
 */

import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fmtMin } from '../../lib/time-utils';

interface SleepFooterProps { bedtime: number | null }

export const SleepFooter = memo(function SleepFooter({ bedtime }: SleepFooterProps) {
  if (bedtime === null) return null;
  return (
    <View style={s.wrap}>
      <Text style={s.text}>🌙  Tonight: {fmtMin(bedtime)}</Text>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20 },
  text: { fontSize: 13, color: '#002060', opacity: 0.45, letterSpacing: 0.2 },
});
