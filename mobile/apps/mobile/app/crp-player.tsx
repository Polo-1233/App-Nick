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
import { RLoTooltip } from '../components/RLoGuide';
import { SessionIntro } from '../components/SessionIntro';
import { Glossary } from '../components/Glossary';
import { usePremiumGate } from '../lib/use-premium-gate';
import { getNextContent, markContentPlayed } from '../lib/content-registry';
import { addPoints, POINTS } from '../lib/rhythm-points';
import { addSignal, SIGNAL } from '../lib/rhythm-depth';
import { GUIDE_KEYS, shouldShowGuide, markGuideSeen } from '../lib/onboarding-guide';
import { SessionComplete } from '../components/SessionComplete';
import { syncTeamChallengeProgress } from '../lib/team-challenges';
import { trackCRP } from '../lib/activity-tracker';
import { useBadgeEvaluation } from '../lib/use-badge-evaluation';
import { BadgeEarnedModal } from '../components/BadgeEarnedModal';
import type { ContentItem } from '../lib/content-registry';

const BG     = '#0a0a3a';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const TEXT   = '#FFFFFF';

export default function CrpPlayerScreen() {
  const router        = useRouter();
  const { isPremium } = usePremiumGate();
  const { newBadges, evaluate: evalBadges, clearBadges } = useBadgeEvaluation();
  const [content,   setContent]   = useState<ContentItem | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [showTip,      setShowTip]      = useState(false);
  const [showIntro,    setShowIntro]    = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  useEffect(() => {
    getNextContent('crp', isPremium).then(c => { setContent(c); setLoading(false); });
    shouldShowGuide(GUIDE_KEYS.FEAT_CRP).then(v => {
      if (v) setShowIntro(true);
    }).catch(() => {});
  }, [isPremium]);

  async function dismissIntro() {
    await markGuideSeen(GUIDE_KEYS.FEAT_CRP);
    setShowIntro(false);
  }

  async function handleComplete() {
    if (!content) return;
    await markContentPlayed('crp', content.id);
    await addPoints(POINTS.CRP_COMPLETE, 'crp_done').catch(() => {});
    await addSignal(SIGNAL.CRP_COMPLETE).catch(() => {});
    await trackCRP().catch(() => {});
    void syncTeamChallengeProgress('crp_completions');
    void evalBadges();
    setCompleted(true);
  }

  if (loading || !content) {
    return <View style={s.root}><ActivityIndicator color={GOLD} /></View>;
  }

  if (completed) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <SessionComplete
          title="Recovery complete!"
          sessionName={content?.title ?? 'CRP Session'}
          duration={`${Math.round((content?.duration ?? 1200) / 60)} min`}
          points={POINTS.CRP_COMPLETE}
          signal={SIGNAL.CRP_COMPLETE}
          accentColor={GOLD}
          onDismiss={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      {/* Multi-step intro — shown once on first CRP visit */}
      <SessionIntro
        visible={showIntro}
        sessionType="crp"
        onStart={dismissIntro}
        onSkip={dismissIntro}
      />
      <AudioPlayer
        source={content.source}
        title={content.title}
        duration={`${Math.round(content.duration / 60)} min`}
        variant="crp"
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
  doneSub:  { fontSize: 14, color: '#F5A623', fontWeight: '600' },
  closeBtn: { marginTop: 16, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  closeTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
