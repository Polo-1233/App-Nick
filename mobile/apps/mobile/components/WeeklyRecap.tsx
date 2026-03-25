/**
 * WeeklyRecap — Sunday evening modal
 *
 * Shows a summary of the week:
 *   - Rhythm Score %
 *   - Cycles completed / target
 *   - Streak
 *   - Wind-downs this week
 *   - R-Lo personalized message
 *   - Next depth level progress
 *
 * Auto-dismissed on close. Shown once per week.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Animated, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MascotImage } from './ui/MascotImage';
import { getFlow, getPoints } from '../lib/rhythm-points';
import { getDepth, getProgressToNext } from '../lib/rhythm-depth';
import { loadWeekHistory, loadProfile } from '../lib/storage';

const BG     = '#0a0a3a';
const CARD   = '#141466';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const TEXT   = '#FFFFFF';
const SUB    = '#A8C4E0';
const MUTED  = '#6B8CAE';

const RECAP_KEY = '@r90:weeklyRecap:lastShown';

// ─── Should we show the recap? ──────────────────────────────────────────────

export async function shouldShowWeeklyRecap(): Promise<boolean> {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours();

  // Show Sunday 18:00+ or Monday before 12:00
  if (!((day === 0 && hour >= 18) || (day === 1 && hour < 12))) return false;

  // Only show once per week
  const lastShown = await AsyncStorage.getItem(RECAP_KEY).catch(() => null);
  if (lastShown) {
    const lastDate = new Date(lastShown);
    const daysSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 5) return false; // at least 5 days between recaps
  }

  return true;
}

export async function markRecapShown(): Promise<void> {
  await AsyncStorage.setItem(RECAP_KEY, new Date().toISOString());
}

// ─── Component ──────────────────────────────────────────────────────────────

interface WeeklyRecapProps {
  visible: boolean;
  onClose: () => void;
}

export function WeeklyRecap({ visible, onClose }: WeeklyRecapProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    rhythmScore: number;
    totalCycles: number;
    weekTarget:  number;
    streak:      number;
    levelLabel:  string;
    levelColor:  string;
    pct:         number;
    nextLabel:   string | null;
    totalPoints: number;
  } | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const [profile, history, flow, depth, points] = await Promise.all([
        loadProfile(),
        loadWeekHistory(),
        getFlow(),
        getDepth(),
        getPoints(),
      ]);

      if (!profile || !history) { setLoading(false); return; }

      const totalCycles = history.reduce((s, n) => s + n.cyclesCompleted, 0);
      const weekTarget  = profile.idealCyclesPerNight * 7;
      const { level, next, pct } = getProgressToNext(depth.signal);

      setData({
        rhythmScore: Math.min(100, Math.round((totalCycles / weekTarget) * 100)),
        totalCycles,
        weekTarget,
        streak:     flow.currentStreak,
        levelLabel: level.label,
        levelColor: level.color,
        pct,
        nextLabel:  next?.label ?? null,
        totalPoints: points.total,
      });
      setLoading(false);

      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      await markRecapShown();
    })();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={r.overlay}>
        <Animated.View style={[r.sheet, { opacity: fadeAnim }]}>
          <View style={r.handle} />

          {loading || !data ? (
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ color: MUTED }}>Loading your week...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={r.content}>

              {/* Header */}
              <View style={r.headerRow}>
                <MascotImage emotion="Fiere" size="sm" />
                <View style={{ flex: 1 }}>
                  <Text style={r.headerTitle}>Your week in rhythm</Text>
                  <Text style={r.headerSub}>Weekly recap</Text>
                </View>
              </View>

              {/* Rhythm Score — hero */}
              <View style={r.scoreCard}>
                <Text style={r.scoreLabel}>RHYTHM SCORE</Text>
                <Text style={[r.scoreNum, {
                  color: data.rhythmScore >= 80 ? GOLD : data.rhythmScore >= 60 ? ACCENT : MUTED,
                }]}>{data.rhythmScore}%</Text>
                <Text style={r.scoreSub}>{data.totalCycles} / {data.weekTarget} cycles</Text>
              </View>

              {/* Stats row */}
              <View style={r.statsRow}>
                <View style={r.statBox}>
                  <Text style={r.statNum}>{data.streak}</Text>
                  <Text style={r.statLabel}>day streak</Text>
                </View>
                <View style={r.statSep} />
                <View style={r.statBox}>
                  <Text style={[r.statNum, { color: data.levelColor }]}>{data.levelLabel}</Text>
                  <Text style={r.statLabel}>rhythm depth</Text>
                </View>
                <View style={r.statSep} />
                <View style={r.statBox}>
                  <Text style={[r.statNum, { color: GOLD }]}>{data.totalPoints}</Text>
                  <Text style={r.statLabel}>total points</Text>
                </View>
              </View>

              {/* Next goal */}
              {data.nextLabel && (
                <View style={r.nextRow}>
                  <View style={[r.nextDot, { backgroundColor: data.levelColor }]} />
                  <Text style={r.nextText}>
                    {Math.round(data.pct * 100)}% toward {data.nextLabel}
                  </Text>
                </View>
              )}

              {/* R-Lo message */}
              <View style={r.rloRow}>
                <Text style={r.rloMsg}>
                  {data.rhythmScore >= 85
                    ? "Exceptional week. Your rhythm is holding strong. Keep this up."
                    : data.rhythmScore >= 70
                      ? "Solid week. A few more aligned nights and you'll be above 85%."
                      : "Building week. Every cycle counts — next week is a fresh start."}
                </Text>
              </View>

            </ScrollView>
          )}

          <Pressable style={r.closeBtn} onPress={onClose}>
            <Text style={r.closeTxt}>Close</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const r = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, paddingBottom: 8, maxHeight: '85%' },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center', marginBottom: 20 },
  content:     { gap: 20, paddingBottom: 16 },

  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TEXT },
  headerSub:   { fontSize: 12, color: MUTED },

  scoreCard:   { alignItems: 'center', gap: 6, backgroundColor: BG, borderRadius: 20, padding: 24 },
  scoreLabel:  { fontSize: 11, fontWeight: '700', color: MUTED, letterSpacing: 1.5 },
  scoreNum:    { fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  scoreSub:    { fontSize: 14, color: SUB },

  statsRow:    { flexDirection: 'row', alignItems: 'center' },
  statBox:     { flex: 1, alignItems: 'center', gap: 4 },
  statNum:     { fontSize: 22, fontWeight: '800', color: TEXT },
  statLabel:   { fontSize: 11, color: MUTED },
  statSep:     { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },

  nextRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextDot:     { width: 8, height: 8, borderRadius: 4 },
  nextText:    { fontSize: 13, color: SUB },

  rloRow:      { backgroundColor: `${ACCENT}10`, borderRadius: 14, padding: 14 },
  rloMsg:      { fontSize: 13, color: SUB, lineHeight: 20, fontStyle: 'italic' },

  closeBtn:    { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  closeTxt:    { fontSize: 15, fontWeight: '700', color: TEXT },
});
