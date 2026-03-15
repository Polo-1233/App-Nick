/**
 * InsightsScreen — Recovery analysis + actionable coaching
 *
 * Layout:
 *   1. Energy Score card    — score + interpretation message
 *   2. Cycles + Sleep Debt  — clearer labels + helper text
 *   3. Sleep Consistency    — elevated prominence (R90 key metric)
 *   4. Weekly Trend chart   — cycles under each day + coaching insight below
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView }           from 'react-native-safe-area-context';
import { Ionicons }               from '@expo/vector-icons';
import { loadProfile, loadWeekHistory } from '../../lib/storage';
import {
  computeInsights,
  type InsightsData,
  type DayTrend,
} from '../../lib/insights';
import { getMockInsightsData }    from '../../lib/mock-insights-data';
import type { UserProfile, NightRecord } from '@r90/types';

// ─── Palette ──────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 75) return C.success;
  if (score >= 50) return C.warning;
  return C.error;
}

function energyInsight(score: number, consistency: number, debt: number): string {
  if (score >= 85) return 'Your recovery is excellent. Keep the rhythm going.';
  if (score >= 75) return 'Strong recovery. Your rhythm is working well.';
  if (consistency >= 80 && score >= 60) return 'Your rhythm is very consistent this week.';
  if (debt < -3)   return `You're behind on cycles. An early night tonight will help.`;
  if (score >= 50) return 'Your recovery is building. Stay consistent tonight.';
  return 'Your body needs more rest. Prioritise sleep this week.';
}

function cyclesHelper(cycles: number, target: number): string {
  const diff = target - cycles;
  if (diff <= 0)  return '✓ Target reached';
  if (diff === 1) return '1 cycle to go';
  if (diff <= 3)  return 'Almost on target';
  return `${diff} cycles to go`;
}

function debtLabel(debt: number): string {
  if (debt === 0)  return 'On target';
  if (debt > 0)    return `${debt} ${debt === 1 ? 'cycle' : 'cycles'} ahead`;
  return `${Math.abs(debt)} ${Math.abs(debt) === 1 ? 'cycle' : 'cycles'} behind`;
}

function debtHelper(debt: number): string {
  if (debt >= 2)  return 'Great buffer — well ahead of target';
  if (debt === 1) return 'Slightly ahead — good position';
  if (debt === 0) return 'Perfectly on track';
  if (debt === -1) return 'One extra cycle tonight gets you back';
  if (debt >= -3) return 'An earlier bedtime will recover this quickly';
  return 'Prioritise sleep this week to recover';
}

function predictiveInsight(debt: number, target: number, cycles: number, nightlyTarget: number): string {
  const remaining = target - cycles;
  if (remaining <= 0) return 'You have already reached your weekly cycle target. Well done.';
  if (remaining <= nightlyTarget) {
    return `If you reach ${remaining} cycles tonight, you will hit your weekly target.`;
  }
  return `${remaining} cycles remain this week. Consistent nights of ${nightlyTarget} cycles will get you there.`;
}

function consistencyLabel(pct: number): string {
  if (pct >= 90) return 'Excellent consistency';
  if (pct >= 80) return 'Strong rhythm';
  if (pct >= 65) return 'Building consistency';
  if (pct >= 50) return 'Room to improve';
  return 'Irregular rhythm';
}

function consistencyAdvice(pct: number): string {
  if (pct >= 80) return 'Your anchor time is solid. The R90 method is working.';
  if (pct >= 65) return 'Try to keep your wake time within 15 minutes each day.';
  return 'A consistent anchor wake time is the foundation of R90 recovery.';
}

// ─── 1. Energy Score card ─────────────────────────────────────────────────────
function EnergyCard({ score, consistency, debt }: { score: number; consistency: number; debt: number }) {
  const color   = scoreColor(score);
  const insight = energyInsight(score, consistency, debt);
  return (
    <View style={s.energyCard}>
      <Text style={s.cardLabel}>Energy Score</Text>
      <View style={s.energyRow}>
        <Text style={[s.energyScore, { color }]}>{score}</Text>
        <Text style={s.energyOf}> / 100</Text>
      </View>
      <View style={s.energyBarBg}>
        <View style={[s.energyBarFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
      {/* Insight message */}
      <View style={s.insightRow}>
        <Ionicons name="bulb-outline" size={14} color={color} />
        <Text style={[s.insightText, { color }]}>{insight}</Text>
      </View>
    </View>
  );
}

// ─── 2. Small metric card ─────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, helper, color,
}: {
  label: string; value: string; sub?: string; helper?: string; color?: string;
}) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, color ? { color } : {}]}>{value}</Text>
      {sub    ? <Text style={s.metricSub}>{sub}</Text>    : null}
      {helper ? <Text style={s.metricHelper}>{helper}</Text> : null}
    </View>
  );
}

// ─── 3. Consistency card (elevated) ──────────────────────────────────────────
function ConsistencyCard({ pct }: { pct: number }) {
  const color  = pct >= 80 ? C.success : pct >= 65 ? C.warning : C.error;
  const label  = consistencyLabel(pct);
  const advice = consistencyAdvice(pct);
  return (
    <View style={s.consistencyCard}>
      <View style={s.consistencyTop}>
        <View>
          <Text style={s.cardLabel}>Sleep Consistency</Text>
          <Text style={[s.consistencyPct, { color }]}>{pct}%</Text>
          <Text style={[s.consistencyLabel, { color }]}>{label}</Text>
        </View>
        {/* Circular badge */}
        <View style={[s.consistencyBadge, { borderColor: `${color}50`, backgroundColor: `${color}12` }]}>
          <Ionicons
            name={pct >= 80 ? 'checkmark-circle' : pct >= 65 ? 'time-outline' : 'alert-circle-outline'}
            size={28}
            color={color}
          />
        </View>
      </View>
      <View style={s.consistencyBarBg}>
        <View style={[s.consistencyBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.consistencyAdvice}>{advice}</Text>
    </View>
  );
}

// ─── 4. Weekly Trend chart ────────────────────────────────────────────────────
const TREND_MAX_HEIGHT = 60;

function TrendChart({
  trend, target, nightlyTarget, weeklyCycles, weeklyTarget,
}: {
  trend: DayTrend[];
  target: number;
  nightlyTarget: number;
  weeklyCycles: number;
  weeklyTarget: number;
}) {
  const maxCycles = Math.max(...trend.map(d => d.cycles), target, 1);
  const insight   = predictiveInsight(weeklyTarget - weeklyCycles, weeklyTarget, weeklyCycles, nightlyTarget);

  function dayLabel(dateStr: string): string {
    try { return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'narrow' }); }
    catch { return ''; }
  }

  return (
    <View style={s.trendCard}>
      <Text style={s.cardLabel}>Weekly Trend</Text>

      <View style={s.trendBars}>
        {trend.map((d, i) => {
          const h     = Math.max(4, Math.round((d.cycles / maxCycles) * TREND_MAX_HEIGHT));
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

      <Text style={s.trendTargetNote}>Target: {target} cycles/night</Text>

      {/* Predictive insight */}
      <View style={s.predictiveBox}>
        <Ionicons name="trending-up-outline" size={15} color={C.accent} />
        <Text style={s.predictiveText}>{insight}</Text>
      </View>
    </View>
  );
}

// ─── Loading / empty ──────────────────────────────────────────────────────────
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

  useEffect(() => {
    async function load() {
      const [p, h] = await Promise.all([loadProfile(), loadWeekHistory()]);
      const useReal = p && h && h.length > 0;
      const { history, profile: mockProfile } = useReal ? { history: h!, profile: p! } : getMockInsightsData();
      const resolvedProfile = useReal ? p! : mockProfile;
      setProfile(resolvedProfile);
      setInsights(computeInsights(history, resolvedProfile));
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        <View style={s.header}>
          <Text style={s.headerTitle}>Insights</Text>
          <Text style={s.headerSub}>Your recovery at a glance</Text>
        </View>

        {!insights ? <EmptyState /> : (
          <>
            {/* 1. Energy Score + insight */}
            <EnergyCard
              score={insights.energyScore}
              consistency={insights.sleepConsistency}
              debt={insights.sleepDebt}
            />

            {/* 2. Cycles + Debt */}
            <View style={s.row}>
              <MetricCard
                label="Cycles this week"
                value={`${insights.weeklyCycles}`}
                sub={`of ${insights.weeklyTarget} target`}
                helper={cyclesHelper(insights.weeklyCycles, insights.weeklyTarget)}
                color={insights.weeklyCycles >= insights.weeklyTarget ? C.success : C.accent}
              />
              <MetricCard
                label="Sleep debt"
                value={debtLabel(insights.sleepDebt)}
                helper={debtHelper(insights.sleepDebt)}
                color={insights.sleepDebt >= 0 ? C.success : insights.sleepDebt >= -2 ? C.warning : C.error}
              />
            </View>

            {/* 3. Consistency — elevated */}
            <ConsistencyCard pct={insights.sleepConsistency} />

            {/* 4. Weekly chart + prediction */}
            {insights.weeklyTrend.length > 0 && (
              <TrendChart
                trend={insights.weeklyTrend}
                target={nightlyTarget}
                nightlyTarget={nightlyTarget}
                weeklyCycles={insights.weeklyCycles}
                weeklyTarget={insights.weeklyTarget}
              />
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

  header:      { paddingTop: 16, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: C.text },
  headerSub:   { fontSize: 14, color: C.textSub, marginTop: 4 },

  // Energy card
  energyCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, marginBottom: 12, gap: 12 },
  energyRow:  { flexDirection: 'row', alignItems: 'baseline' },
  energyScore:{ fontSize: 64, fontWeight: '900', lineHeight: 72 },
  energyOf:   { fontSize: 22, fontWeight: '600', color: C.textSub },
  energyBarBg:{ height: 6, borderRadius: 3, backgroundColor: C.surface2, overflow: 'hidden' },
  energyBarFill: { height: '100%', borderRadius: 3 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 2 },
  insightText:{ fontSize: 14, fontWeight: '500', lineHeight: 20, flex: 1 },

  cardLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },

  // Row of two metric cards
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  metricCard:  { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 18, gap: 4 },
  metricLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 },
  metricValue: { fontSize: 20, fontWeight: '800', color: C.text, lineHeight: 26 },
  metricSub:   { fontSize: 12, color: C.textMuted },
  metricHelper:{ fontSize: 12, color: C.textSub, fontWeight: '500', marginTop: 2 },

  // Consistency card — elevated
  consistencyCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 12, gap: 12 },
  consistencyTop:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  consistencyPct:  { fontSize: 44, fontWeight: '900', lineHeight: 50, marginTop: 4 },
  consistencyLabel:{ fontSize: 14, fontWeight: '600', marginTop: 2 },
  consistencyBadge:{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  consistencyBarBg:{ height: 8, borderRadius: 4, backgroundColor: C.surface2, overflow: 'hidden' },
  consistencyBarFill: { height: '100%', borderRadius: 4 },
  consistencyAdvice: { fontSize: 13, color: C.textSub, lineHeight: 20 },

  // Trend chart
  trendCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 12, gap: 16 },
  trendBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 },
  trendCol:  { flex: 1, alignItems: 'center', gap: 5 },
  trendBarBg:{ width: '100%', borderRadius: 6, backgroundColor: C.surface2, justifyContent: 'flex-end', overflow: 'hidden' },
  trendBarFill: { width: '100%', borderRadius: 6 },
  trendDay:  { fontSize: 11, color: C.textMuted, fontWeight: '700', marginTop: 2 },
  trendCycles: { fontSize: 12, fontWeight: '800' },
  trendTargetNote: { fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: -4 },

  // Predictive insight
  predictiveBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: `${C.accent}12`, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: `${C.accent}25` },
  predictiveText: { fontSize: 13, color: C.textSub, lineHeight: 20, flex: 1 },

  // Empty
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  emptySub:   { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 },
});
