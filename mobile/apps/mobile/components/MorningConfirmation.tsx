/**
 * MorningConfirmation — Morning wake-up confirmation modal
 *
 * Shows after wake-up within the morning window.
 * Prefills with the best detected wake time candidate (from wake-detection.ts).
 * User can confirm or adjust the time.
 *
 * On confirm:
 *   - Stores confirmed wake time in wake-detection system
 *   - Awards Rhythm Points
 *   - Updates flow/streak
 */

import { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HapticsSuccess, HapticsLight } from '../utils/haptics';
import { addPoints, POINTS, updateFlow, getFlow } from '../lib/rhythm-points';
import { addSignal, SIGNAL } from '../lib/rhythm-depth';
import { isMilestone, getMilestoneMessage } from '../lib/rlo-mood';
import { confirmWakeTime, getSuggestedWakeTime } from '../lib/wake-detection';
import { MascotImage } from './ui/MascotImage';

// Modal always dark — aligned with darkTheme tokens
const BG     = '#0a0a3a';   // darkTheme.background
const CARD   = '#141466';   // darkTheme.surface
const ACCENT = '#1c9fda';   // darkTheme.accent
const TEXT   = '#FFFFFF';    // darkTheme.text
const MUTED  = '#6B8CAE';   // darkTheme.textMuted

export const CONFIRM_DATE_KEY = '@r90:lastConfirmDate:v1';

type Mood = 'tired' | 'neutral' | 'good';

const MOODS: Array<{ value: Mood; icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = [
  { value: 'tired',   icon: 'moon-outline',        color: '#8B5CF6', label: 'Tired'   },
  { value: 'neutral', icon: 'contrast-outline',      color: '#9BB5CC', label: 'Neutral' },
  { value: 'good',    icon: 'sunny-outline',        color: '#F5A623', label: 'Good'    },
];

interface Props {
  visible:    boolean;
  firstName:  string | null;
  wakeTime:   string;         // fallback "06:32" from ARP
  onConfirm:  (mood: Mood | null) => void;
  onDismiss:  () => void;
}

export const MorningConfirmation = memo(function MorningConfirmation({
  visible, firstName, wakeTime: fallbackWakeTime, onConfirm, onDismiss,
}: Props) {
  const [mood,           setMood]           = useState<Mood | null>(null);
  const [milestone,      setMilestone]      = useState<string | null>(null);
  const [displayTime,    setDisplayTime]    = useState(fallbackWakeTime);
  const [detectedMinute, setDetectedMinute] = useState<number | null>(null);
  const [adjusting,      setAdjusting]      = useState(false);
  const [adjustHour,     setAdjustHour]     = useState(6);
  const [adjustMin,      setAdjustMin]      = useState(30);

  // Load best wake candidate to prefill
  useEffect(() => {
    if (!visible) return;
    getSuggestedWakeTime().then(suggestion => {
      if (suggestion) {
        setDisplayTime(suggestion.time);
        setDetectedMinute(suggestion.minuteOfDay);
        setAdjustHour(Math.floor(suggestion.minuteOfDay / 60));
        setAdjustMin(suggestion.minuteOfDay % 60);
      } else {
        // Parse fallback time
        const [h, m] = fallbackWakeTime.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          setAdjustHour(h);
          setAdjustMin(m);
        }
      }
    }).catch(() => {});
  }, [visible, fallbackWakeTime]);

  async function handleConfirm() {
    HapticsSuccess();

    // Store confirmed wake time
    const minuteOfDay = adjusting
      ? adjustHour * 60 + adjustMin
      : detectedMinute ?? null;
    await confirmWakeTime(minuteOfDay, adjusting, mood ?? undefined).catch(() => {});

    // Points + streak
    await addPoints(POINTS.ARP_CONFIRM, 'arp_confirm').catch(() => {});
    await updateFlow(true).catch(() => {});
    await addSignal(SIGNAL.ARP_CONFIRM).catch(() => {});
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem(CONFIRM_DATE_KEY, today);

    // Check milestone
    const flow = await getFlow().catch(() => null);
    if (flow && isMilestone(flow.currentStreak)) {
      const msg = getMilestoneMessage(flow.currentStreak);
      if (msg) { setMilestone(msg); return; }
    }
    onConfirm(mood);
  }

  // ── Milestone celebration ─────────────────────────────────────────────────
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

  // ── Adjust mode ──────────────────────────────────────────────────────────
  if (adjusting) {
    const adjustedTime = `${String(adjustHour).padStart(2, '0')}:${String(adjustMin).padStart(2, '0')}`;
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setAdjusting(false)}>
        <View style={s.overlay}>
          <View style={s.card}>
            <Pressable onPress={() => setAdjusting(false)} style={s.closeBtn}>
              <Ionicons name="arrow-back" size={20} color={MUTED} />
            </Pressable>

            <Text style={s.greeting}>Adjust your wake time</Text>

            {/* Simple hour:minute adjuster */}
            <View style={s.adjusterRow}>
              <View style={s.adjCol}>
                <Pressable onPress={() => { HapticsLight(); setAdjustHour(h => (h + 1) % 24); }} hitSlop={8}>
                  <Ionicons name="chevron-up" size={24} color={MUTED} />
                </Pressable>
                <Text style={s.adjValue}>{String(adjustHour).padStart(2, '0')}</Text>
                <Pressable onPress={() => { HapticsLight(); setAdjustHour(h => (h - 1 + 24) % 24); }} hitSlop={8}>
                  <Ionicons name="chevron-down" size={24} color={MUTED} />
                </Pressable>
              </View>
              <Text style={s.adjSep}>:</Text>
              <View style={s.adjCol}>
                <Pressable onPress={() => { HapticsLight(); setAdjustMin(m => (m + 5) % 60); }} hitSlop={8}>
                  <Ionicons name="chevron-up" size={24} color={MUTED} />
                </Pressable>
                <Text style={s.adjValue}>{String(adjustMin).padStart(2, '0')}</Text>
                <Pressable onPress={() => { HapticsLight(); setAdjustMin(m => (m - 5 + 60) % 60); }} hitSlop={8}>
                  <Ionicons name="chevron-down" size={24} color={MUTED} />
                </Pressable>
              </View>
            </View>

            <Pressable style={s.confirmBtn} onPress={() => {
              setDisplayTime(adjustedTime);
              setAdjusting(false);
              void handleConfirm();
            }}>
              <Text style={s.confirmTxt}>Confirm {adjustedTime} →</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Main confirmation ──────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Pressable onPress={onDismiss} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={MUTED} />
          </Pressable>

          <View style={s.greetingRow}>
            <Ionicons name="sunny" size={20} color="#F5A623" />
            <Text style={s.greeting}>Good morning{firstName ? ` ${firstName}` : ''}</Text>
          </View>

          {/* Wake time — detected or ARP-based */}
          <Text style={s.wakePrompt}>Did you wake up at</Text>
          <Text style={s.wakeTimeDisplay}>{displayTime}</Text>

          {/* Mood selector */}
          <Text style={s.moodLabel}>How do you feel?</Text>
          <View style={s.moods}>
            {MOODS.map(m => (
              <Pressable
                key={m.value}
                style={[s.moodBtn, mood === m.value && s.moodSelected]}
                onPress={() => setMood(m.value)}
              >
                <Ionicons name={m.icon} size={22} color={mood === m.value ? m.color : MUTED} />
                <Text style={[s.moodTxt, mood === m.value && { color: ACCENT }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Actions */}
          <Pressable style={s.confirmBtn} onPress={() => { void handleConfirm(); }}>
            <Text style={s.confirmTxt}>Yes, confirm (+{POINTS.ARP_CONFIRM}) →</Text>
          </Pressable>

          <Pressable style={s.adjustBtn} onPress={() => setAdjusting(true)}>
            <Text style={s.adjustTxt}>Adjust time</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const s = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  card:             { backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, paddingBottom: 36 },
  closeBtn:         { alignSelf: 'flex-end', padding: 4 },
  greetingRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting:         { fontSize: 22, fontWeight: '700', color: TEXT },
  wakePrompt:       { fontSize: 14, color: MUTED, marginTop: 2 },
  wakeTimeDisplay:  { fontSize: 36, fontWeight: '800', color: ACCENT, letterSpacing: -1 },
  moodLabel:        { fontSize: 15, fontWeight: '600', color: TEXT, marginTop: 4 },
  moods:            { flexDirection: 'row', gap: 10 },
  moodBtn:          { flex: 1, alignItems: 'center', backgroundColor: '#1c1c7a', borderRadius: 14, padding: 12, gap: 4, borderWidth: 2, borderColor: 'transparent' },
  moodSelected:     { borderColor: ACCENT },

  moodTxt:          { fontSize: 12, color: MUTED, fontWeight: '600' },
  confirmBtn:       { backgroundColor: ACCENT, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4 },
  confirmTxt:       { fontSize: 15, fontWeight: '700', color: '#fff' },
  adjustBtn:        { alignItems: 'center', paddingVertical: 10 },
  adjustTxt:        { fontSize: 14, fontWeight: '600', color: MUTED },
  // Adjuster
  adjusterRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 12 },
  adjCol:           { alignItems: 'center', gap: 6 },
  adjValue:         { fontSize: 44, fontWeight: '800', color: TEXT, letterSpacing: -2, width: 70, textAlign: 'center' },
  adjSep:           { fontSize: 36, fontWeight: '800', color: MUTED },
  // Milestone
  milestoneCard:    { alignItems: 'center', gap: 16, borderRadius: 24 },
  milestoneTitle:   { fontSize: 26, fontWeight: '800', color: TEXT, letterSpacing: -0.5 },
  milestoneMsg:     { fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 22 },
});
