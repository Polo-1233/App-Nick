/**
 * mrm-player.tsx — MRM (Micro Recovery Moment) Player
 *
 * Modal présenté quand l'utilisateur démarre un MRM.
 * onComplete : +2 Rhythm Points + marque MRM dans le daily log.
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AudioPlayer } from '../components/AudioPlayer';
import { MascotImage } from '../components/ui/MascotImage';
import { RLoTooltip } from '../components/RLoGuide';
import { usePremiumGate } from '../lib/use-premium-gate';
import { getNextContent, markContentPlayed } from '../lib/content-registry';
import { addPoints, POINTS } from '../lib/rhythm-points';
import { addSignal, SIGNAL } from '../lib/rhythm-depth';
import { GUIDE_KEYS, shouldShowGuide, markGuideSeen } from '../lib/onboarding-guide';
import type { ContentItem } from '../lib/content-registry';

const BG     = '#0a0a3a';
const ACCENT = '#1c9fda';
const TEXT   = '#FFFFFF';
const MUTED  = '#6B8CAE';

export default function MrmPlayerScreen() {
  const router           = useRouter();
  const { isPremium }    = usePremiumGate();
  const [content,   setContent]   = useState<ContentItem | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [showTip,   setShowTip]   = useState(false);

  useEffect(() => {
    getNextContent('mrm', isPremium).then(c => {
      setContent(c);
      setLoading(false);
    });
    // Layer 2: show contextual tip on first MRM visit
    shouldShowGuide(GUIDE_KEYS.FEAT_MRM).then(setShowTip).catch(() => {});
  }, [isPremium]);

  async function handleComplete() {
    if (!content) return;
    await markContentPlayed('mrm', content.id);
    await addPoints(POINTS.MRM_COMPLETE, 'mrm_done').catch(() => {});
    await addSignal(SIGNAL.MRM_COMPLETE).catch(() => {});
    setCompleted(true);
  }

  if (loading || !content) {
    return (
      <View style={s.root}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (completed) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.doneWrap}>
          <MascotImage emotion="Fiere" size="md" />
          <Text style={s.doneTitle}>Break done.</Text>
          <Text style={s.doneSub}>+{POINTS.MRM_COMPLETE} Rhythm Points ✦</Text>
          <Pressable style={s.closeBtn} onPress={() => router.back()}>
            <Text style={s.closeTxt}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      {/* Layer 2 tooltip — shown once on first MRM */}
      {showTip && (
        <View style={{ position: 'absolute', top: 80, left: 0, right: 0, zIndex: 50 }}>
          <RLoTooltip
            visible={showTip}
            message="This is a reset moment. 2 minutes to help you stay sharp."
            onDismiss={async () => {
              await markGuideSeen(GUIDE_KEYS.FEAT_MRM);
              setShowTip(false);
            }}
          />
        </View>
      )}
      <AudioPlayer
        source={content.source}
        title={content.title}
        duration={`${Math.round(content.duration / 60)} min`}
        variant="mrm"
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
  doneSub:  { fontSize: 14, color: ACCENT, fontWeight: '600' },
  closeBtn: { marginTop: 16, backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  closeTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
