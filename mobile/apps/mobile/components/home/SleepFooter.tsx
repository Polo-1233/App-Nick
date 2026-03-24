/**
 * SleepFooter
 *
 * Passive reminder of tonight's sleep window.
 * Minimal presence — does not compete with the Action Card.
 *
 * "🌙 23:00"
 */

import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fmtMin } from '../../lib/time-utils';

const TEXT_PRIMARY = '#002060';

interface SleepFooterProps {
  bedtime: number | null; // minutes since midnight
}

export const SleepFooter = memo(function SleepFooter({ bedtime }: SleepFooterProps) {
  if (bedtime === null) return null;

  return (
    <View style={sf.wrap}>
      <Text style={sf.text}>🌙 {fmtMin(bedtime)}</Text>
    </View>
  );
});

const sf = StyleSheet.create({
  wrap: {
    alignItems:  'center',
    paddingBottom: 24,
    paddingTop:    12,
  },
  text: {
    fontSize:  14,
    color:     TEXT_PRIMARY,
    opacity:   0.5,
    lineHeight: 20,
  },
});
