/**
 * crp-player.tsx — CRP (Controlled Recovery Period) Player
 *
 * +5 Rhythm Points à la fin.
 * Option "Raccourcir à 10 min" si la session dépasse 10 min.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { AudioPlayer } from '../components/AudioPlayer';
import { MascotImage } from '../components/ui/MascotImage';
import { usePremiumGate } from '../lib/use-premium-gate';
import { getNextContent, markContentPlayed } from '../lib/content-registry';
import { addPoints, POINTS } from '../lib/rhythm-points';
import type { ContentItem } from '../lib/content-registry';

const BG     = '#0a0a3a';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const TEXT   = '#FFFFFF';

export default function CrpPlayerScreen() {
  const router        = useRouter();
  const { isPremium } = usePremiumGate();
  const [content,   setContent]   = useState<ContentItem | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    getNextContent('crp', isPremium).then(c => { setContent(c); setLoading(false); });
  }, [isPremium]);

  async function handleComplete() {
    if (!content) return;
    await markContentPlayed('crp', content.id);
    await addPoints(POINTS.CRP_COMPLETE, 'crp_done').catch(() => {});
    setCompleted(true);
  }

  if (loading || !content) {
    return <View style={s.root}><ActivityIndicator color={GOLD} /></View>;
  }

  if (completed) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.doneWrap}>
          <MascotImage emotion="Fiere" size="md" />
          <Text style={s.doneTitle}>Belle récupération.</Text>
          <Text style={s.doneSub}>+{POINTS.CRP_COMPLETE} Rhythm Points ✦</Text>
          <Pressable style={[s.closeBtn, { backgroundColor: GOLD }]} onPress={() => router.back()}>
            <Text style={s.closeTxt}>Fermer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      <AudioPlayer
        source={content.source}
        title={content.title}
        duration={`${Math.round(content.duration / 60)} min`}
        variant="crp"
        onComplete={() => { void handleComplete(); }}
        onClose={() => router.back()}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: BG },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  doneTitle:{ fontSize: 22, fontWeight: '700', color: TEXT, textAlign: 'center' },
  doneSub:  { fontSize: 14, color: '#F5A623', fontWeight: '600' },
  closeBtn: { marginTop: 16, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  closeTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
