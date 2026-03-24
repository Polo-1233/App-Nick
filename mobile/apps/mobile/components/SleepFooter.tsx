/**
 * SleepFooter — "Tonight: 23:00" toujours visible en bas
 *
 * Style discret, rappel passif de la fenêtre de sommeil.
 */

import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmtMin as fmt } from '../lib/time-utils';
import { useTheme } from '../lib/theme-context';

interface SleepFooterProps {
  bedtime: number | null;  // minutes from midnight
}

export const SleepFooter = memo(function SleepFooter({ bedtime }: SleepFooterProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (bedtime === null) return null;
  return (
    <View style={sf.wrap}>
      <Ionicons name="moon-outline" size={12} color={c.accent} />
      <Text style={[sf.text, { color: c.textMuted }]}>Tonight: {fmt(bedtime)}</Text>
    </View>
  );
});

const sf = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  text: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});
