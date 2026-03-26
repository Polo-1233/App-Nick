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
import { SessionIntro } from '../components/SessionIntro';
import { Glossary } from '../components/Glossary';
import { usePremiumGate } from '../lib/use-premium-gate';
import { getNextContent, markContentPlayed } from '../lib/content-registry';
import { addPoints, POINTS } from '../lib/rhythm-points';
import { addSignal, SIGNAL } from '../lib/rhythm-depth';
import { GUIDE_KEYS, shouldShowGuide, markGuideSeen } from '../lib/onboarding-guide';
import { SessionComplete } from '../components/SessionComplete';
import { saveMrmCompletion } from '../lib/kspi';
import { syncTeamChallengeProgress } from '../lib/team-challenges';
import { trackMRM } from '../lib/activity-tracker';
import { useBadgeEvaluation } from '../lib/use-badge-evaluation';
import { BadgeEarnedModal } from '../components/BadgeEarnedModal';
import type { ContentItem } from '../lib/content-registry';

const BG     = '#0a0a3a';
const ACCENT = '#1c9fda';
const TEXT   = '#FFFFFF';
const MUTED  = '#6B8CAE';

export default function MrmPlayerScreen() {
  const router           = useRouter();
  const { isPremium }    = usePremiumGate();
  const { newBadges, evaluate: evalBadges, clearBadges } = useBadgeEvaluation();
  const [content,   setContent]   = useState<ContentItem | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [showTip,      setShowTip]      = useState(false);
  const [showIntro,    setShowIntro]    = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  useEffect(() => {
    getNextContent('mrm', isPremium).then(c => {
      setContent(c);
      setLoading(false);
    });
    // Layer 2: show multi-step intro on first MRM visit
    shouldShowGuide(GUIDE_KEYS.FEAT_MRM).then(v => {
      if (v) setShowIntro(true);
    }).catch(() => {});
  }, [isPremium]);

  async function dismissIntro() {
    await markGuideSeen(GUIDE_KEYS.FEAT_MRM);
    setShowIntro(false);
  }

  async function handleComplete() {
    if (!content) return;
    await markContentPlayed('mrm', content.id);
    await addPoints(POINTS.MRM_COMPLETE, 'mrm_done').catch(() => {});
    await addSignal(SIGNAL.MRM_COMPLETE).catch(() => {});
    await saveMrmCompletion().catch(() => {});
    await trackMRM().catch(() => {});
    void syncTeamChallengeProgress('mrm_completions');
    void evalBadges();
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
        <SessionComplete
          title="Break done!"
          sessionName={content?.title ?? 'Micro Recovery'}
          duration={`${Math.round((content?.duration ?? 120) / 60)} min`}
          points={POINTS.MRM_COMPLETE}
          signal={SIGNAL.MRM_COMPLETE}
          onDismiss={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      {/* Multi-step intro — shown once on first MRM visit */}
      <SessionIntro
        visible={showIntro}
        sessionType="mrm"
        onStart={dismissIntro}
        onSkip={dismissIntro}
      />
      <AudioPlayer
        source={content.source}
        title={content.title}
        duration={`${Math.round(content.duration / 60)} min`}
        variant="mrm"
        onComplete={() => { void handleComplete(); }}
        onClose={() => router.back()}
        onInfo={() => setShowGlossary(true)}
      />
      <Glossary visible={showGlossary} onClose={() => setShowGlossary(false)} />
      {newBadges.length > 0 && (
        <BadgeEarnedModal badgeIds={newBadges} onClose={clearBadges} />
      )}
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
