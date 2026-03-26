/**
 * TrendsScreen — Analytics dashboard with 7/30 day toggle
 *
 * Sections:
 *   1. Cycles per night (bar chart)
 *   2. Wind-down completion rate
 *   3. Streak timeline
 *   4. Rhythm Depth progression
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadWeekHistory, loadProfile } from '../../lib/storage';
import { getGraphData, type WeeklySnapshot } from '../../lib/weekly-snapshots';
import { getThisWeekActivity, getLastWeekActivity } from '../../lib/activity-tracker';
import { getFlow } from '../../lib/rhythm-points';
import { getDepth, getProgressToNext } from '../../lib/rhythm-depth';
import type { NightRecord, UserProfile } from '@r90/types';

const BG     = '#0a0a3a';
const CARD   = '#141466';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const GREEN  = '#3DDC97';
const TEXT_W = '#E6EDF7';
const TEXT_S = '#9FB0C5';
const TEXT_M = '#6B7F99';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function TrendsScreen({ visible, onClose }: Props) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [history, setHistory] = useState<NightRecord[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [snapshots, setSnapshots] = useState<WeeklySnapshot[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [depthLabel, setDepthLabel] = useState('Aware');
  const [depthPct, setDepthPct] = useState(0);
  const [winddowns, setWinddowns] = useState(0);

  useEffect(() => {
    if (!visible) return;
    Promise.all([
      loadWeekHistory(),
      loadProfile(),
      getGraphData(),
      getFlow(),
      getDepth(),
      getThisWeekActivity(),
    ]).then(([h, p, snaps, flow, depth, activity]) => {
      setHistory(h ?? []);
      setProfile(p);
      setSnapshots(snaps);
      setStreak(flow.currentStreak);
      setBestStreak(flow.bestStreak);
      const { level, pct } = getProgressToNext(depth.signal);
      setDepthLabel(level.label);
      setDepthPct(Math.round(pct * 100));
      setWinddowns(activity.winddowns);
    }).catch(() => {});
  }, [visible]);

  const filtered = period >= 30 ? history : history.slice(0, period);
  const target = profile?.idealCyclesPerNight ?? 5;
  const maxCycles = Math.max(target, ...filtered.map(n => n.cyclesCompleted));

  if (!visible) return null;

  const hasEnoughData = filtered.length >= 3;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 24 }}
            style={{ padding: 4 }}
          >
            <Ionicons name="chevron-back" size={24} color={TEXT_S} />
          </Pressable>
          <Text style={s.title}>Trends</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Period toggle */}
        <View style={s.toggleRow}>
          <Pressable style={[s.toggle, period === 7 && s.toggleActive]} onPress={() => setPeriod(7)}>
            <Text style={[s.toggleText, period === 7 && s.toggleTextActive]}>7 days</Text>
          </Pressable>
          <Pressable style={[s.toggle, period === 30 && s.toggleActive]} onPress={() => setPeriod(30)}>
            <Text style={[s.toggleText, period === 30 && s.toggleTextActive]}>30 days</Text>
          </Pressable>
        </View>

        {!hasEnoughData ? (
          <View style={s.emptyWrap}>
            <Ionicons name="bar-chart-outline" size={48} color={TEXT_M} />
            <Text style={s.emptyTitle}>Trends coming soon</Text>
            <Text style={s.emptySub}>Keep going — your trends will appear after your first full week.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {/* 1. Cycles per night — bar chart */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Cycles per night</Text>
              <View style={s.barChart}>
                {filtered.slice(-period).map((n, i) => {
                  const h = maxCycles > 0 ? (n.cyclesCompleted / maxCycles) * 80 : 0;
                  const onTarget = n.cyclesCompleted >= target;
                  return (
                    <View key={i} style={s.barCol}>
                      <View style={[s.bar, { height: Math.max(4, h), backgroundColor: onTarget ? GREEN : GOLD }]} />
                      <Text style={s.barLabel}>{n.cyclesCompleted}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={s.targetLine}>
                <View style={s.targetDash} />
                <Text style={s.targetText}>Target: {target}</Text>
              </View>
            </View>

            {/* 2. Wind-down rate */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Wind-down completion</Text>
              <View style={s.statRow}>
                <Text style={s.statValue}>{winddowns}</Text>
                <Text style={s.statLabel}>this week</Text>
              </View>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${Math.min(100, (winddowns / 7) * 100)}%` }]} />
              </View>
            </View>

            {/* 3. Streak */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Streak</Text>
              <View style={s.streakRow}>
                <View style={s.streakItem}>
                  <Ionicons name="flame" size={20} color="#D97706" />
                  <Text style={s.streakValue}>{streak}</Text>
                  <Text style={s.streakLabel}>current</Text>
                </View>
                <View style={s.streakDivider} />
                <View style={s.streakItem}>
                  <Ionicons name="trophy" size={20} color={GOLD} />
                  <Text style={s.streakValue}>{bestStreak}</Text>
                  <Text style={s.streakLabel}>best</Text>
                </View>
              </View>
            </View>

            {/* 4. Mastery Level */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Mastery Level</Text>
              <View style={s.depthRow}>
                <Text style={s.depthLevel}>{depthLabel}</Text>
                <Text style={s.depthPct}>{depthPct}%</Text>
              </View>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${depthPct}%`, backgroundColor: ACCENT }]} />
              </View>
            </View>

            {/* Rhythm Score trend (from snapshots) */}
            {snapshots.length >= 2 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Weekly rhythm score</Text>
                <View style={s.scoreTrend}>
                  {snapshots.slice(-8).map((snap, i) => (
                    <View key={i} style={s.scoreCol}>
                      <View style={[s.scoreBar, { height: Math.max(4, (snap.rhythmScore / 100) * 60) }]} />
                      <Text style={s.scoreLabel}>{snap.rhythmScore}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:  { fontSize: 20, fontWeight: '700', color: TEXT_W },
  scroll: { padding: 20, gap: 16 },

  toggleRow:        { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  toggle:           { flex: 1, backgroundColor: CARD, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  toggleActive:     { borderColor: ACCENT, backgroundColor: `${ACCENT}12` },
  toggleText:       { fontSize: 14, fontWeight: '600', color: TEXT_M },
  toggleTextActive: { color: ACCENT },

  card:      { backgroundColor: CARD, borderRadius: 18, padding: 18, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: TEXT_W },

  // Bar chart
  barChart:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90 },
  barCol:     { flex: 1, alignItems: 'center', gap: 4 },
  bar:        { width: '80%', borderRadius: 3 },
  barLabel:   { fontSize: 10, fontWeight: '600', color: TEXT_M },
  targetLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetDash: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' as any },
  targetText: { fontSize: 11, color: TEXT_M },

  // Stats
  statRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  statValue: { fontSize: 28, fontWeight: '800', color: TEXT_W },
  statLabel: { fontSize: 13, color: TEXT_M },

  // Progress bar
  progressBar:  { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: GREEN },

  // Streak
  streakRow:     { flexDirection: 'row', alignItems: 'center' },
  streakItem:    { flex: 1, alignItems: 'center', gap: 4 },
  streakDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.06)' },
  streakValue:   { fontSize: 24, fontWeight: '800', color: TEXT_W },
  streakLabel:   { fontSize: 11, color: TEXT_M },

  // Depth
  depthRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  depthLevel: { fontSize: 18, fontWeight: '700', color: ACCENT },
  depthPct:   { fontSize: 16, fontWeight: '800', color: TEXT_S },

  // Score trend
  scoreTrend: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 },
  scoreCol:   { flex: 1, alignItems: 'center', gap: 4 },
  scoreBar:   { width: '80%', borderRadius: 3, backgroundColor: ACCENT },
  scoreLabel: { fontSize: 10, fontWeight: '600', color: TEXT_M },

  // Empty
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT_W },
  emptySub:   { fontSize: 14, color: TEXT_S, textAlign: 'center', lineHeight: 21 },
});
