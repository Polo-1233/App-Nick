/**
 * StreakDetail — Modal showing Rhythm Flow stats.
 *
 * Opened by tapping the 🔥 streak badge in HomeHeader.
 * Data loaded fresh on open (not cached).
 *
 * Shows:
 *   - Current streak
 *   - Best streak
 *   - Total points + today's points
 *   - Week alignment (x/7 days)
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ActivityIndicator,
} from 'react-native';
import { getFlow, getPoints } from '../lib/rhythm-points';
import type { RhythmFlowState, RhythmPointsState } from '../lib/rhythm-points';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const BG     = '#0a0a3a';
const CARD   = '#141466';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const TEXT   = '#FFFFFF';
const SUB    = '#A8C4E0';
const MUTED  = '#6B8CAE';

interface StreakDetailProps {
  visible:  boolean;
  onClose:  () => void;
}

export function StreakDetail({ visible, onClose }: StreakDetailProps) {
  const [flow,    setFlow]    = useState<RhythmFlowState | null>(null);
  const [points,  setPoints]  = useState<RhythmPointsState | null>(null);
  const [loading, setLoading] = useState(false);

  // Load fresh data every time the modal opens
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([getFlow(), getPoints()])
      .then(([f, p]) => {
        setFlow(f);
        setPoints(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          {/* Header */}
          <View style={s.headerRow}>
            <Text style={s.emoji}>🔥</Text>
            <Text style={s.title}>Rhythm Flow</Text>
          </View>

          {loading || !flow || !points ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
          ) : (
            <>
              {/* Current streak */}
              <Text style={s.bigNumber}>{flow.currentStreak}</Text>
              <Text style={s.bigLabel}>
                {flow.currentStreak === 1 ? 'day' : 'days'}
              </Text>
              <Text style={s.bestStreak}>Best streak: {flow.bestStreak} days</Text>

              <View style={s.divider} />

              {/* Points */}
              <View style={s.row}>
                <Text style={s.rowLabel}>Total points</Text>
                <Text style={s.rowValue}>{points.total}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>Today</Text>
                <Text style={[s.rowValue, { color: GOLD }]}>
                  {points.today > 0 ? `+${points.today}` : '—'}
                </Text>
              </View>

              <View style={s.divider} />

              {/* Week alignment */}
              <View style={s.row}>
                <Text style={s.rowLabel}>This week</Text>
                <Text style={s.rowValue}>{flow.weekAligned}/7 aligned</Text>
              </View>

              {/* Week dots */}
              <View style={s.dotsRow}>
                {Array.from({ length: 7 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      s.dot,
                      i < flow.weekAligned ? s.dotActive : s.dotInactive,
                    ]}
                  />
                ))}
              </View>
            </>
          )}

          {/* Dismiss */}
          <Pressable onPress={onClose} style={s.btn}>
            <Text style={s.btnLabel}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: `${ACCENT}25`,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  emoji:      { fontSize: 22 },
  title:      { fontSize: 18, fontWeight: '700', color: TEXT },
  bigNumber:  { fontSize: 64, fontWeight: '900', color: GOLD, lineHeight: 72, marginTop: 4 },
  bigLabel:   { fontSize: 16, color: SUB, marginTop: -4 },
  bestStreak: { fontSize: 13, color: MUTED, marginTop: 4 },
  divider:    { width: '100%', height: 1, backgroundColor: `${ACCENT}20`, marginVertical: 8 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4 },
  rowLabel:   { fontSize: 14, color: SUB },
  rowValue:   { fontSize: 14, fontWeight: '700', color: TEXT },
  dotsRow:    { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4 },
  dot:        { width: 18, height: 18, borderRadius: 9 },
  dotActive:  { backgroundColor: GOLD },
  dotInactive:{ backgroundColor: `${MUTED}40` },
  btn: {
    marginTop: 16,
    backgroundColor: `${ACCENT}20`,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  btnLabel: { fontSize: 14, fontWeight: '700', color: ACCENT },
});
