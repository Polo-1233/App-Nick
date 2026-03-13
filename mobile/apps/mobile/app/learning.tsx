/**
 * learning.tsx — R90 methodology lessons (coming soon placeholder)
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MascotImage } from '../components/ui/MascotImage';

const C = {
  bg: '#0B1220', card: '#1A2436', accent: '#F5A623',
  text: '#E6EDF7', textSub: '#9FB0C5', textMuted: '#6B7F99',
};

export default function LearningScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={C.textSub} />
        </Pressable>
        <Text style={s.headerTitle}>Learning</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={s.body}>
        <MascotImage emotion="Reflexion" size="md" />
        <Text style={s.title}>Coming soon</Text>
        <Text style={s.sub}>
          R90 methodology lessons, guided programs, and more — all in one place.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  body:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  title:       { fontSize: 24, fontWeight: '700', color: C.text, textAlign: 'center' },
  sub:         { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 },
});
