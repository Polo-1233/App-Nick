/**
 * MorningConfirmation — Modal matinal de confirmation du réveil
 *
 * Apparaît entre ARP et ARP+2h si la nuit n'a pas encore été confirmée aujourd'hui.
 * Actions : sélectionner un mood + confirmer (+5 Rhythm Points).
 */

import { useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HapticsSuccess } from '../utils/haptics';
import { addPoints, POINTS, updateFlow, getFlow } from '../lib/rhythm-points';
import { addSignal, SIGNAL } from '../lib/rhythm-depth';
import { isMilestone, getMilestoneMessage } from '../lib/rlo-mood';
import { MascotImage } from './ui/MascotImage';

const BG     = '#0a0a3a';
const CARD   = '#141466';
const ACCENT = '#1c9fda';
const TEXT   = '#FFFFFF';
const MUTED  = '#6B8CAE';

export const CONFIRM_DATE_KEY = '@r90:lastConfirmDate:v1';

type Mood = 'tired' | 'neutral' | 'good';

const MOODS: Array<{ value: Mood; emoji: string; label: string }> = [
  { value: 'tired',   emoji: '😴', label: 'Tired' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'good',    emoji: '😊', label: 'Good' },
];

interface Props {
  visible:   boolean;
  firstName: string | null;
  wakeTime:  string;         // "06:32"
  onConfirm: (mood: Mood | null) => void;
  onDismiss: () => void;
}

export const MorningConfirmation = memo(function MorningConfirmation({
  visible, firstName, wakeTime, onConfirm, onDismiss,
}: Props) {
  const [mood,         setMood]         = useState<Mood | null>(null);
  const [milestone,    setMilestone]    = useState<string | null>(null);

  async function handleConfirm() {
    HapticsSuccess();
    await addPoints(POINTS.ARP_CONFIRM, 'arp_confirm').catch(() => {});
    await updateFlow(true).catch(() => {});
    await addSignal(SIGNAL.ARP_CONFIRM).catch(() => {});
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem(CONFIRM_DATE_KEY, today);

    // Check milestone after streak update
    const flow = await getFlow().catch(() => null);
    if (flow && isMilestone(flow.currentStreak)) {
      const msg = getMilestoneMessage(flow.currentStreak);
      if (msg) { setMilestone(msg); return; } // show milestone screen first
    }
    onConfirm(mood);
  }

  // ── Milestone celebration screen ────────────────────────────────────────────
  if (milestone) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { setMilestone(null); onConfirm(mood); }}>
        <View style={s.overlay}>
          <View style={[s.card, s.milestoneCard]}>
            <MascotImage emotion="celebration" size="md" />
            <Text style={s.milestoneTitle}>Milestone!</Text>
            <Text style={s.milestoneMsg}>{milestone}</Text>
            <Pressable style={s.confirmBtn} onPress={() => { setMilestone(null); onConfirm(mood); }}>
              <Text style={s.confirmTxt}>Keep going →</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Pressable onPress={onDismiss} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={MUTED} />
          </Pressable>

          <Text style={s.greeting}>☀️ Good morning{firstName ? ` ${firstName}` : ''}</Text>
          <Text style={s.wakeTime}>You woke up at {wakeTime}</Text>

          <Text style={s.moodLabel}>How do you feel?</Text>
          <View style={s.moods}>
            {MOODS.map(m => (
              <Pressable
                key={m.value}
                style={[s.moodBtn, mood === m.value && s.moodSelected]}
                onPress={() => setMood(m.value)}
              >
                <Text style={s.moodEmoji}>{m.emoji}</Text>
                <Text style={[s.moodTxt, mood === m.value && { color: ACCENT }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={s.confirmBtn} onPress={() => { void handleConfirm(); }}>
            <Text style={s.confirmTxt}>Confirm (+{POINTS.ARP_CONFIRM}) →</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  card:         { backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, paddingBottom: 36 },
  closeBtn:     { alignSelf: 'flex-end', padding: 4 },
  greeting:     { fontSize: 22, fontWeight: '700', color: TEXT },
  wakeTime:     { fontSize: 14, color: MUTED },
  moodLabel:    { fontSize: 15, fontWeight: '600', color: TEXT, marginTop: 4 },
  moods:        { flexDirection: 'row', gap: 10 },
  moodBtn:      { flex: 1, alignItems: 'center', backgroundColor: '#1c1c7a', borderRadius: 14, padding: 12, gap: 4, borderWidth: 2, borderColor: 'transparent' },
  moodSelected: { borderColor: ACCENT },
  moodEmoji:    { fontSize: 22 },
  moodTxt:      { fontSize: 12, color: MUTED, fontWeight: '600' },
  confirmBtn:     { backgroundColor: ACCENT, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4 },
  confirmTxt:     { fontSize: 15, fontWeight: '700', color: '#fff' },
  milestoneCard:  { alignItems: 'center', gap: 16, borderRadius: 24 },
  milestoneTitle: { fontSize: 26, fontWeight: '800', color: TEXT, letterSpacing: -0.5 },
  milestoneMsg:   { fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 22 },
});
