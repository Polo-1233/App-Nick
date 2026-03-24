/**
 * StreakDetail — Rhythm Flow modal
 *
 * Shows:
 *   - R-LO mood + milestone message
 *   - Current streak + best streak
 *   - Rhythm Tier + progress to next
 *   - Total points + today
 *   - Week alignment dots (4 weeks calendar)
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  ActivityIndicator, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFlow, getPoints } from '../lib/rhythm-points';
import { getTier, getProgressToNextTier } from '../lib/rhythm-tiers';
import { getRLoMood, getMoodMessage } from '../lib/rlo-mood';
import { MascotImage } from './ui/MascotImage';
import type { RhythmFlowState, RhythmPointsState } from '../lib/rhythm-points';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BG     = '#0a0a3a';
const CARD   = '#141466';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const TEXT   = '#FFFFFF';
const SUB    = '#A8C4E0';
const MUTED  = '#6B8CAE';
const BORDER = 'rgba(28,159,218,0.15)';

interface StreakDetailProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Week calendar (4 weeks of dots) ─────────────────────────────────────────
function WeekCalendar({ weekAligned }: { weekAligned: number }) {
  const today    = new Date();
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0

  // Build 4 weeks × 7 days grid
  const weeks = Array.from({ length: 4 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const dayOffset = (3 - w) * 7 + d - todayIdx;
      const isFuture  = dayOffset > 0;
      const isToday   = dayOffset === 0;
      // Simulate alignment based on weekAligned for current week
      const isAligned = !isFuture && w === 3
        ? d < weekAligned
        : !isFuture && w < 3;
      return { isFuture, isToday, isAligned };
    })
  );

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View style={wc.wrap}>
      {/* Day headers */}
      <View style={wc.row}>
        {DAY_LABELS.map((l, i) => (
          <Text key={i} style={wc.dayLabel}>{l}</Text>
        ))}
      </View>
      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={wc.row}>
          {week.map((day, di) => (
            <View
              key={di}
              style={[
                wc.dot,
                day.isAligned  && wc.dotActive,
                day.isToday    && wc.dotToday,
                day.isFuture   && wc.dotFuture,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const wc = StyleSheet.create({
  wrap:     { width: '100%', gap: 6, marginTop: 4 },
  row:      { flexDirection: 'row', justifyContent: 'space-between' },
  dayLabel: { width: 28, textAlign: 'center', fontSize: 10, color: MUTED, fontWeight: '600' },
  dot:      { width: 28, height: 28, borderRadius: 8, backgroundColor: `${MUTED}25` },
  dotActive:{ backgroundColor: GOLD },
  dotToday: { borderWidth: 2, borderColor: ACCENT },
  dotFuture:{ opacity: 0.2 },
});

// ─── Tier progress bar ────────────────────────────────────────────────────────
function TierProgress({ totalPoints }: { totalPoints: number }) {
  const { tier, next, pct, pointsLeft } = getProgressToNextTier(totalPoints);
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct, width]);

  return (
    <View style={tp.wrap}>
      <View style={tp.header}>
        <View style={tp.tierBadge}>
          <Ionicons name={tier.icon as any} size={14} color={tier.color} />
          <Text style={[tp.tierLabel, { color: tier.color }]}>{tier.label}</Text>
        </View>
        {next && (
          <Text style={tp.next}>{pointsLeft} pts → {next.label}</Text>
        )}
      </View>
      <View style={tp.barBg}>
        <Animated.View style={[tp.barFill, {
          backgroundColor: tier.color,
          width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
      <Text style={tp.message}>{tier.message}</Text>
    </View>
  );
}

const tp = StyleSheet.create({
  wrap:      { width: '100%', gap: 8 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tierLabel: { fontSize: 13, fontWeight: '700' },
  next:      { fontSize: 11, color: MUTED },
  barBg:     { height: 5, backgroundColor: `${MUTED}30`, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: 5, borderRadius: 3 },
  message:   { fontSize: 12, color: MUTED, fontStyle: 'italic' },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export function StreakDetail({ visible, onClose }: StreakDetailProps) {
  const [flow,    setFlow]    = useState<RhythmFlowState | null>(null);
  const [points,  setPoints]  = useState<RhythmPointsState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([getFlow(), getPoints()])
      .then(([f, p]) => { setFlow(f); setPoints(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  const emotion = flow
    ? getRLoMood({ streak: flow.currentStreak, zone: null })
    : 'rassurante';
  const moodMsg = flow
    ? getMoodMessage({ streak: flow.currentStreak, weekAligned: flow.weekAligned })
    : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {loading || !flow || !points ? (
            <ActivityIndicator color={ACCENT} style={{ margin: 48 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

              {/* R-LO mood */}
              <View style={s.mascotRow}>
                <MascotImage emotion={emotion} size="sm" />
                <View style={s.mascotText}>
                  <Text style={s.mascotMsg}>{moodMsg}</Text>
                </View>
              </View>

              {/* Streak numbers */}
              <View style={s.streakRow}>
                <View style={s.streakBox}>
                  <Text style={s.streakNum}>{flow.currentStreak}</Text>
                  <Text style={s.streakLbl}>day streak</Text>
                </View>
                <View style={s.streakDivider} />
                <View style={s.streakBox}>
                  <Text style={s.streakNum}>{flow.bestStreak}</Text>
                  <Text style={s.streakLbl}>best streak</Text>
                </View>
                <View style={s.streakDivider} />
                <View style={s.streakBox}>
                  <Text style={[s.streakNum, { color: GOLD }]}>{points.total}</Text>
                  <Text style={s.streakLbl}>total points</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Tier progress */}
              <TierProgress totalPoints={points.total} />

              <View style={s.divider} />

              {/* Week calendar */}
              <View style={s.sectionHeader}>
                <Ionicons name="calendar-outline" size={14} color={MUTED} />
                <Text style={s.sectionTitle}>Last 4 weeks</Text>
              </View>
              <WeekCalendar weekAligned={flow.weekAligned} />

              <View style={s.divider} />

              {/* Today points */}
              <View style={s.row}>
                <Text style={s.rowLabel}>Today</Text>
                <Text style={[s.rowValue, { color: GOLD }]}>
                  {points.today > 0 ? `+${points.today} pts` : 'No activity yet'}
                </Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>This week</Text>
                <Text style={s.rowValue}>{flow.weekAligned}/7 aligned</Text>
              </View>

            </ScrollView>
          )}

          <Pressable onPress={onClose} style={s.btn}>
            <Text style={s.btnLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, paddingBottom: 8, maxHeight: '88%' },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 20 },
  content:     { gap: 16, paddingBottom: 16 },

  mascotRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: `${ACCENT}10`, borderRadius: 16, padding: 14 },
  mascotText:  { flex: 1 },
  mascotMsg:   { fontSize: 13, color: SUB, lineHeight: 19 },

  streakRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  streakBox:   { alignItems: 'center', gap: 4, flex: 1 },
  streakNum:   { fontSize: 36, fontWeight: '900', color: TEXT, letterSpacing: -1 },
  streakLbl:   { fontSize: 11, color: MUTED, textAlign: 'center' },
  streakDivider:{ width: 1, height: 40, backgroundColor: BORDER },

  divider:     { height: 1, backgroundColor: BORDER },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },

  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel:    { fontSize: 14, color: SUB },
  rowValue:    { fontSize: 14, fontWeight: '700', color: TEXT },

  btn:         { marginTop: 8, marginBottom: 32, backgroundColor: `${ACCENT}18`, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnLabel:    { fontSize: 14, fontWeight: '700', color: ACCENT },
});
