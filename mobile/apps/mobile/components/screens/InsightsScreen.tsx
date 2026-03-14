/**
 * InsightsScreen — R90 Navigator
 *
 * Layout (top → bottom):
 *   1. Header "Insights"
 *   2. Energy Score card (main)
 *   3. Row: Cycles this week + Sleep Debt
 *   4. Sleep Consistency card
 *   5. Weekly Trend bar chart
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadProfile, loadWeekHistory } from '../../lib/storage';
import {
  computeInsights,
  type InsightsData,
  type DayTrend,
} from '../../lib/insights';
import type { UserProfile, NightRecord } from '@r90/types';

// ─── Palette (same as app) ────────────────────────────────────────────────────

const C = {
  bg:        '#0B1220',
  card:      '#1A2436',
  surface2:  '#243046',
  accent:    '#4DA3FF',
  success:   '#3DDC97',
  warning:   '#F5A623',
  error:     '#F87171',
  text:      '#E6EDF7',
  textSub:   '#9FB0C5',
  textMuted: '#6B7F99',
  border:    'rgba(255,255,255,0.06)',
};

// ─── Energy Score card ────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return C.success;
  if (score >= 50) return C.warning;
  return C.error;
}

function EnergyCard({ score }: { score: number }) {
  const color = scoreColor(score);
  const label = score >= 75 ? 'High energy' : score >= 50 ? 'Building' : 'Recovery needed';
  const progress = score / 100;

  return (
    <View style={s.energyCard}>
      <Text style={s.cardLabel}>Energy Score</Text>
      <View style={s.energyRow}>
        <Text style={[s.energyScore, { color }]}>{score}</Text>
        <Text style={s.energyOf}> / 100</Text>
      </View>
      {/* Progress bar */}
      <View style={s.energyBarBg}>
        <View style={[s.energyBarFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.energyLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Small metric card ────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, color ? { color } : {}]}>{value}</Text>
      {sub ? <Text style={s.metricSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Weekly Trend bar chart ───────────────────────────────────────────────────

const TREND_MAX_HEIGHT = 64;

function TrendChart({ trend, target }: { trend: DayTrend[]; target: number }) {
  const maxCycles = Math.max(...trend.map(d => d.cycles), target, 1);

  function dayLabel(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'narrow' });
    } catch { return ''; }
  }

  return (
    <View style={s.trendCard}>
      <Text style={s.cardLabel}>Weekly Trend</Text>
      <View style={s.trendBars}>
        {trend.map((d, i) => {
          const h = Math.round((d.cycles / maxCycles) * TREND_MAX_HEIGHT);
          const color = d.cycles >= target ? C.success : d.cycles >= target * 0.7 ? C.warning : C.error;
          return (
            <View key={i} style={s.trendCol}>
              <View style={[s.trendBarBg, { height: TREND_MAX_HEIGHT }]}>
                <View style={[s.trendBarFill, { height: h, backgroundColor: color }]} />
              </View>
              <Text style={s.trendDay}>{dayLabel(d.date)}</Text>
              <Text style={[s.trendCycles, { color }]}>{d.cycles}</Text>
            </View>
          );
        })}
      </View>
      {/* Target line label */}
      <Text style={s.trendTargetNote}>Target: {target} cycles/night</Text>
    </View>
  );
}

// ─── Consistency ring ─────────────────────────────────────────────────────────

function ConsistencyCard({ pct }: { pct: number }) {
  const color = pct >= 80 ? C.success : pct >= 60 ? C.warning : C.error;
  return (
    <View style={s.consistencyCard}>
      <Text style={s.cardLabel}>Sleep Consistency</Text>
      <View style={s.consistencyRow}>
        <Text style={[s.consistencyPct, { color }]}>{pct}%</Text>
        <View style={s.consistencyBarBg}>
          <View style={[s.consistencyBarFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
      </View>
      <Text style={s.metricSub}>How regular your sleep rhythm is</Text>
    </View>
  );
}

// ─── Empty / loading ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyTitle}>No data yet</Text>
      <Text style={s.emptySub}>Log your first night to unlock your Insights.</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const [loading,  setLoading]  = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [profile,  setProfile]  = useState<UserProfile | null>(null);
  const [history,  setHistory]  = useState<NightRecord[]>([]);

  useEffect(() => {
    async function load() {
      const [p, h] = await Promise.all([loadProfile(), loadWeekHistory()]);
      setProfile(p);
      setHistory(h ?? []);
      if (p && h && h.length > 0) setInsights(computeInsights(h, p));
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ActivityIndicator color={C.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const nightlyTarget = profile?.idealCyclesPerNight ?? 5;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Insights</Text>
          <Text style={s.headerSub}>Your recovery at a glance</Text>
        </View>

        {!insights ? (
          <EmptyState />
        ) : (
          <>
            {/* 1. Energy Score */}
            <EnergyCard score={insights.energyScore} />

            {/* 2. Cycles + Sleep Debt */}
            <View style={s.row}>
              <MetricCard
                label="Cycles this week"
                value={`${insights.weeklyCycles}`}
                sub={`of ${insights.weeklyTarget} target`}
                color={insights.weeklyCycles >= insights.weeklyTarget ? C.success : C.accent}
              />
              <MetricCard
                label="Sleep debt"
                value={`${insights.sleepDebt > 0 ? '+' : ''}${insights.sleepDebt} cyc`}
                sub={insights.sleepDebt >= 0 ? 'Ahead of target' : 'Behind target'}
                color={insights.sleepDebt >= 0 ? C.success : C.error}
              />
            </View>

            {/* 3. Consistency */}
            <ConsistencyCard pct={insights.sleepConsistency} />

            {/* 4. Trend */}
            {insights.weeklyTrend.length > 0 && (
              <TrendChart trend={insights.weeklyTrend} target={nightlyTarget} />
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  header: { paddingTop: 16, paddingBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: C.text },
  headerSub:   { fontSize: 14, color: C.textSub, marginTop: 4 },

  // Energy card
  energyCard: {
    backgroundColor: C.card,
    borderRadius:    20,
    padding:         24,
    marginBottom:    12,
    gap:             10,
  },
  energyRow: { flexDirection: 'row', alignItems: 'baseline' },
  energyScore: { fontSize: 64, fontWeight: '900', lineHeight: 72 },
  energyOf:    { fontSize: 22, fontWeight: '600', color: C.textSub },
  energyBarBg: {
    height: 6, borderRadius: 3, backgroundColor: C.surface2, overflow: 'hidden',
  },
  energyBarFill: { height: '100%', borderRadius: 3 },
  energyLabel: { fontSize: 14, fontWeight: '600' },
  cardLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Row of two cards
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  // Metric card
  metricCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 18, gap: 6,
  },
  metricLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 },
  metricValue: { fontSize: 28, fontWeight: '800', color: C.text },
  metricSub:   { fontSize: 12, color: C.textMuted },

  // Consistency card
  consistencyCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12, gap: 10,
  },
  consistencyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  consistencyPct: { fontSize: 36, fontWeight: '800', minWidth: 72 },
  consistencyBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.surface2, overflow: 'hidden' },
  consistencyBarFill: { height: '100%', borderRadius: 4 },

  // Trend chart
  trendCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12, gap: 16,
  },
  trendBars:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  trendCol:        { flex: 1, alignItems: 'center', gap: 4 },
  trendBarBg:      { width: '100%', borderRadius: 4, backgroundColor: C.surface2, justifyContent: 'flex-end', overflow: 'hidden' },
  trendBarFill:    { width: '100%', borderRadius: 4 },
  trendDay:        { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  trendCycles:     { fontSize: 11, fontWeight: '700' },
  trendTargetNote: { fontSize: 12, color: C.textMuted, textAlign: 'center' },

  // Empty
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  emptySub:   { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 },
});
