/**
 * wind-down.tsx — Flow guidé de préparation au sommeil
 *
 * 4 phases séquentielles :
 *   1. intro     — 3s, R-Lo introduit le wind-down
 *   2. checklist — 5 items à cocher
 *   3. content   — sélection + lecture audio
 *   4. goodnight — écran presque noir, fenêtre de sommeil
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MascotImage }   from '../components/ui/MascotImage';
import { AudioPlayer }   from '../components/AudioPlayer';
import { usePremiumGate } from '../lib/use-premium-gate';
import { getNextContent, markContentPlayed } from '../lib/content-registry';
import { addPoints, POINTS } from '../lib/rhythm-points';
import { HapticsLight, HapticsSuccess } from '../utils/haptics';
import type { ContentItem } from '../lib/content-registry';

const BG     = '#0a0a3a';
const CARD   = '#141466';
const ACCENT = '#1c9fda';
const TEXT   = '#FFFFFF';
const MUTED  = '#6B8CAE';

type WindDownPhase = 'intro' | 'checklist' | 'content' | 'goodnight';

const CHECKLIST = [
  { id: 'lights',   label: 'Lumière tamisée ?' },
  { id: 'cool',     label: 'Pièce fraîche ?' },
  { id: 'caffeine', label: 'Plus de caféine ?' },
  { id: 'screens',  label: 'Écrans en mode nuit ?' },
  { id: 'ready',    label: 'Prêt pour le sommeil ?' },
];

// ─── Phase 1 — Intro ──────────────────────────────────────────────────────────
function IntroPhase({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const t = setTimeout(onNext, 3000);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <Pressable style={ph.wrap} onPress={onNext}>
      <MascotImage emotion="rassurante" size="md" />
      <Text style={ph.title}>Ton wind-down commence.</Text>
      <Text style={ph.sub}>Prépare-toi pour une bonne nuit.</Text>
    </Pressable>
  );
}

// ─── Phase 2 — Checklist ─────────────────────────────────────────────────────
function ChecklistPhase({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const scales = useRef(CHECKLIST.map(() => new Animated.Value(1))).current;

  function toggle(id: string, idx: number) {
    HapticsLight();
    Animated.sequence([
      Animated.spring(scales[idx], { toValue: 1.15, useNativeDriver: true, speed: 50 }),
      Animated.spring(scales[idx], { toValue: 1.00, useNativeDriver: true, speed: 50 }),
    ]).start();
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const allChecked = CHECKLIST.every(i => checked[i.id]);

  useEffect(() => {
    if (allChecked) {
      HapticsSuccess();
      const t = setTimeout(onNext, 600);
      return () => clearTimeout(t);
    }
  }, [allChecked, onNext]);

  return (
    <View style={ph.wrap}>
      <Text style={ph.title}>Prépare ton environnement</Text>
      <View style={cl.list}>
        {CHECKLIST.map((item, i) => (
          <Pressable key={item.id} onPress={() => toggle(item.id, i)}>
            <Animated.View style={[cl.row, checked[item.id] && cl.rowDone, { transform: [{ scale: scales[i] }] }]}>
              <View style={[cl.check, checked[item.id] && { backgroundColor: ACCENT }]}>
                {checked[item.id] && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={[cl.label, checked[item.id] && cl.labelDone]}>{item.label}</Text>
            </Animated.View>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onNext} style={ph.mainBtn}>
        <Text style={ph.mainBtnTxt}>Continuer →</Text>
      </Pressable>
      <Pressable onPress={onSkip} style={ph.skipBtn}>
        <Text style={ph.skipTxt}>Passer</Text>
      </Pressable>
    </View>
  );
}

// ─── Phase 3 — Content ────────────────────────────────────────────────────────
function ContentPhase({
  onComplete, isPremium,
}: { onComplete: () => void; isPremium: boolean }) {
  const [content,  setContent]  = useState<ContentItem | null>(null);
  const [playing,  setPlaying]  = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getNextContent('winddown', isPremium).then(c => { setContent(c); setLoading(false); });
  }, [isPremium]);

  async function handleComplete() {
    if (!content) return;
    await markContentPlayed('winddown', content.id);
    await addPoints(POINTS.WINDDOWN_CONTENT, 'winddown_content').catch(() => {});
    onComplete();
  }

  if (loading || !content) return null;

  if (playing) {
    return (
      <AudioPlayer
        source={content.source}
        title={content.title}
        duration={`${Math.round(content.duration / 60)} min`}
        variant="winddown"
        onComplete={() => { void handleComplete(); }}
        onClose={() => setPlaying(false)}
      />
    );
  }

  return (
    <View style={ph.wrap}>
      <Text style={ph.title}>Ce soir</Text>
      <View style={ct.card}>
        <Text style={ct.cardTitle}>{content.title}</Text>
        <Text style={ct.cardSub}>{content.description}</Text>
        <Text style={ct.cardDur}>{Math.round(content.duration / 60)} min</Text>
      </View>
      <Pressable style={ph.mainBtn} onPress={async () => {
        await addPoints(POINTS.WINDDOWN_START, 'winddown_start').catch(() => {});
        setPlaying(true);
      }}>
        <Text style={ph.mainBtnTxt}>Écouter →</Text>
      </Pressable>
      <Pressable style={ph.skipBtn} onPress={() => {
        getNextContent('winddown', isPremium).then(c => setContent(c));
      }}>
        <Text style={ph.skipTxt}>Autre chose</Text>
      </Pressable>
    </View>
  );
}

// ─── Phase 4 — Goodnight ──────────────────────────────────────────────────────
function GoodnightPhase({ onClose }: { onClose: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
  }, []);
  return (
    <Pressable style={gn.wrap} onPress={onClose}>
      <Animated.View style={[gn.content, { opacity }]}>
        <MascotImage emotion="rassurante" size="sm" />
        <Text style={gn.text}>Fenêtre de sommeil ouverte.</Text>
        <Text style={gn.sub}>Bonne nuit.</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WindDownScreen() {
  const router        = useRouter();
  const { isPremium } = usePremiumGate();
  const [phase, setPhase] = useState<WindDownPhase>('intro');

  const next = useCallback((p: WindDownPhase) => setPhase(p), []);

  return (
    <View style={s.root}>
      {phase === 'intro' && (
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={MUTED} />
          </Pressable>
          <IntroPhase onNext={() => next('checklist')} />
        </SafeAreaView>
      )}

      {phase === 'checklist' && (
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={MUTED} />
          </Pressable>
          <ChecklistPhase
            onNext={() => next('content')}
            onSkip={() => next('content')}
          />
        </SafeAreaView>
      )}

      {phase === 'content' && (
        <ContentPhase
          isPremium={isPremium}
          onComplete={() => next('goodnight')}
        />
      )}

      {phase === 'goodnight' && (
        <GoodnightPhase onClose={() => router.replace('/(tabs)')} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: BG },
  closeBtn: { alignSelf: 'flex-end', padding: 16 },
});

const ph = StyleSheet.create({
  wrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  title:      { fontSize: 22, fontWeight: '700', color: TEXT, textAlign: 'center', lineHeight: 30 },
  sub:        { fontSize: 15, color: MUTED, textAlign: 'center' },
  mainBtn:    { backgroundColor: ACCENT, borderRadius: 16, paddingHorizontal: 36, paddingVertical: 15, marginTop: 8 },
  mainBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  skipBtn:    { paddingVertical: 10 },
  skipTxt:    { fontSize: 13, color: MUTED },
});

const cl = StyleSheet.create({
  list:     { width: '100%', gap: 10, marginVertical: 16 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: CARD, borderRadius: 14, padding: 16 },
  rowDone:  { backgroundColor: `${ACCENT}15`, borderWidth: 1, borderColor: `${ACCENT}30` },
  check:    { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: MUTED, alignItems: 'center', justifyContent: 'center' },
  label:    { fontSize: 15, color: TEXT, fontWeight: '500', flex: 1 },
  labelDone:{ color: ACCENT },
});

const ct = StyleSheet.create({
  card:     { backgroundColor: CARD, borderRadius: 18, padding: 20, width: '100%', gap: 8 },
  cardTitle:{ fontSize: 18, fontWeight: '700', color: TEXT },
  cardSub:  { fontSize: 14, color: MUTED, lineHeight: 20 },
  cardDur:  { fontSize: 12, color: ACCENT, fontWeight: '600' },
});

const gn = StyleSheet.create({
  wrap:    { flex: 1, backgroundColor: '#02020e', alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: 14 },
  text:    { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  sub:     { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
});
