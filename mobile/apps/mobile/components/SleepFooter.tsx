/**
 * SleepFooter — Spec pixel-perfect R90
 *
 * "🌙 23:00" — discret, bas de page
 * 14px, #002060 opacity 0.6
 */

import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fmtMin as fmt } from '../lib/time-utils';

const TEXT_PRIMARY = '#002060';

interface SleepFooterProps {
  bedtime: number | null;
}

export const SleepFooter = memo(function SleepFooter({ bedtime }: SleepFooterProps) {
  if (bedtime === null) return null;
  return (
    <View style={sf.wrap}>
      <Text style={sf.text}>🌙 {fmt(bedtime)}</Text>
    </View>
  );
});

const sf = StyleSheet.create({
  wrap: {
    alignItems:    'center',
    paddingBottom: 20,
    marginTop:     'auto',
  },
  text: {
    fontSize:  14,
    color:     TEXT_PRIMARY,
    opacity:   0.6,
    lineHeight: 20,
  },
});
