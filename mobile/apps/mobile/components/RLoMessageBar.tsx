/**
 * RLoMessageBar — Message contextuel R-Lo (1-2 lignes)
 *
 * Tap → ouvre le chat R-Lo via ChatContext.openChat()
 */

import { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MascotImage } from './ui/MascotImage';

const SURFACE2 = '#1c1c7a';
const ACCENT   = '#1c9fda';
const TEXT     = '#FFFFFF';
const MUTED    = '#6B8CAE';

interface RLoMessageBarProps {
  text:     string;
  onTap:    () => void;
  emotion?: 'rassurante' | 'encourageant' | 'Fiere' | 'Reflexion' | 'Enthousisate';
}

export const RLoMessageBar = memo(function RLoMessageBar({
  text, onTap, emotion = 'rassurante',
}: RLoMessageBarProps) {
  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => [rl.wrap, pressed && { opacity: 0.75 }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Open R-Lo chat"
    >
      <View style={rl.avatar}>
        <MascotImage emotion={emotion} size="sm" />
      </View>

      <View style={rl.content}>
        <Text style={rl.text} numberOfLines={2}>{text}</Text>
        <Text style={rl.cta}>Discuter avec R-Lo →</Text>
      </View>

      <Ionicons name="chevron-forward" size={14} color={MUTED} />
    </Pressable>
  );
});

const rl = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 14, backgroundColor: SURFACE2, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: `${ACCENT}20` },
  avatar:  { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  content: { flex: 1, gap: 3 },
  text:    { fontSize: 13, color: TEXT, lineHeight: 19 },
  cta:     { fontSize: 11, color: ACCENT, fontWeight: '600' },
});
