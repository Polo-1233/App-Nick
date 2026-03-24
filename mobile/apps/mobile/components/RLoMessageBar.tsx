/**
 * RLoMessageBar — Message contextuel R-Lo (1-2 lignes)
 *
 * Tap → ouvre le chat R-Lo via ChatContext.openChat()
 */

import { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MascotImage } from './ui/MascotImage';
import { useTheme } from '../lib/theme-context';

interface RLoMessageBarProps {
  text:     string;
  onTap:    () => void;
  emotion?: import('./ui/MascotImage').MascotEmotion;
}

export const RLoMessageBar = memo(function RLoMessageBar({
  text, onTap, emotion = 'rassurante',
}: RLoMessageBarProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => [
        rl.wrap,
        {
          backgroundColor: c.surface2,
          borderColor:     `${c.accent}20`,
        },
        pressed && { opacity: 0.75 },
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Open R-Lo chat"
    >
      <View style={rl.avatar}>
        <MascotImage emotion={emotion} size="sm" />
      </View>

      <View style={rl.content}>
        <Text style={[rl.text, { color: c.text }]} numberOfLines={2}>{text}</Text>
        <Text style={[rl.cta, { color: c.accent }]}>Chat with R-Lo →</Text>
      </View>

      <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
    </Pressable>
  );
});

const rl = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 14, borderRadius: 16, padding: 14, borderWidth: 1 },
  avatar:  { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  content: { flex: 1, gap: 3 },
  text:    { fontSize: 13, lineHeight: 19 },
  cta:     { fontSize: 11, fontWeight: '600' },
});
