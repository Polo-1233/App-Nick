/**
 * InsightsScreen — Rhythm Flow
 *
 * Structure (spec 1.3) :
 *   1. Rhythm Flow — grand nombre de jours + phrase R-Lo
 *   2. This week — 7 dots (vert/ambre/gris), phrase contextuelle
 *   3. [Learn more ↓] — section expandable avec détails en phrases
 *
 * Principes :
 *   - Pas de score numérique brut visible
 *   - Pas de rouge (rhythmLow = ambre)
 *   - Pas de "debt", "deficit", "behind"
 */

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Pressable, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { Ionicons }        from '@expo/vector-icons';
import { MascotImage }     from '../ui/MascotImage';
import { useFocusEffect }  from 'expo-router';
import { useCallback, useRef } from 'react';

import { loadProfile, loadWeekHistory } from '../../lib/storage';
import { getWeeklySummaries, getWearableHistory, type WeeklySummaryResponse } from '../../lib/api';
import {
  computeInsights,
  getRhythmInsightMessage,
  consistencyLabel,
  type InsightsData,
} from '../../lib/insights';
import { Analytics } from '../../lib/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../lib/theme-context';
import { AmbientBackground } from '../ui/AmbientBackground';
import { usePager } from '../../lib/pager-context';
import type { UserProfile, NightRecord } from '@r90/types';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:        '#0a0a3a',
  card:      '#141466',
  surface2:  '#1c1c7a',
  accent:    '#1c9fda',
  success:   '#3DDC97',
  rhythmLow: '#E8A020',  // ambre — jamais rouge pour le rythme
  text:      '#FFFFFF',
  textSub:   '#A8C4E0',
  textMuted: '#6B8CAE',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRhythmFlowDays(history: NightRecord[], target: number): number {
  // Compte les jours consécutifs récents avec cycles ≥ target - 1
  let streak = 0;
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  for (const n of sorted) {
    if (n.cyclesCompleted >= target - 1) streak++;
    else break;
  }
  return streak;
}

function getWeekDots(history: NightRecord[], target: number): Array<'green' | 'amber' | 'grey'> {
  const today  = new Date();
  const dots: Array<'green' | 'amber' | 'grey'> = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const night   = history.find(n => n.date === dateStr);
    if (!night) {
      dots.push('grey');
    } else if (night.cyclesCompleted >= target) {
      dots.push('green');
    } else if (night.cyclesCompleted >= target - 1) {
      dots.push('amber');
    } else {
      dots.push('grey');
    }
  }
  return dots;
}

function getAlignedCount(dots: Array<'green' | 'amber' | 'grey'>): number {
  return dots.filter(d => d === 'green' || d === 'amber').length;
}

function getWeekMessage(aligned: number, total: number): string {
  if (aligned === total) return 'Perfect week. Your rhythm is rock solid.';
  if (aligned >= 5) return `${aligned}/7 days aligned. On track.`;
  if (aligned >= 3) return `${aligned}/7 days aligned. Building your rhythm.`;
  return `${aligned}/7 days. Every cycle counts — keep going.`;
}

// ─── 7 Dots semaine ───────────────────────────────────────────────────────────

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function WeekDots({ dots }: { dots: Array<'green' | 'amber' | 'grey'> }) {
  const colorMap = { green: C.success, amber: C.rhythmLow, grey: '#444' };
  return (
    <View style={wd.row}>
      {dots.map((d, i) => (
        <View key={i} style={wd.col}>
          <View style={[wd.dot, { backgroundColor: colorMap[d] }]} />
          <Text style={wd.day}>{DAYS[i]}</Text>
        </View>
      ))}
    </View>
  );
}

const wd = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  col: { alignItems: 'center', gap: 6 },
  dot: { width: 24, height: 24, borderRadius: 12 },
  day: { fontSize: 10, color: C.textMuted, fontWeight: '600' },
});

// ─── Expandable details ────────────────────────────────────────────────────────

function ExpandableDetails({
  insights, profile,
}: {
  insights: InsightsData;
  profile:  UserProfile;
}) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  function toggle() {
    setOpen(v => {
      Animated.timing(anim, {
        toValue: v ? 0 : 1,
        duration: 250,
        useNativeDriver: false,
      }).start();
      return !v;
    });
  }

  const consistPct = insights.sleepConsistency;
  const consist    = consistencyLabel(consistPct);
  const balanceAbs = Math.abs(insights.rhythmBalance);
  const balanceTxt = insights.rhythmBalance >= 0
    ? `${insights.rhythmBalance} cycle${insights.rhythmBalance !== 1 ? 's' : ''} ahead of target`
    : `${balanceAbs} cycle${balanceAbs !== 1 ? 's' : ''} to recover — an early night tonight does the trick`;

  return (
    <View style={ed.wrap}>
      <Pressable onPress={toggle} style={ed.toggle}>
        <Text style={ed.toggleLabel}>{open ? 'Less detail ↑' : 'Learn more ↓'}</Text>
      </Pressable>

      {open && (
        <View style={ed.details}>
          <View style={ed.row}>
            <Ionicons name="moon-outline" size={14} color={C.accent} />
            <Text style={ed.txt}>
              <Text style={ed.bold}>Cycles this week :</Text>{' '}
              {insights.weeklyCycles} of {insights.weeklyTarget} target
            </Text>
          </View>
          <View style={ed.row}>
            <Ionicons name="sync-outline" size={14} color={C.accent} />
            <Text style={ed.txt}>
              <Text style={ed.bold}>Consistency:</Text> {consist}
            </Text>
          </View>
          <View style={ed.row}>
            <Ionicons name="trending-up-outline" size={14} color={C.accent} />
            <Text style={ed.txt}>
              <Text style={ed.bold}>Rhythm:</Text> {balanceTxt}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const ed = StyleSheet.create({
  wrap:        { marginTop: 8 },
  toggle:      { paddingVertical: 12, alignItems: 'center' },
  toggleLabel: { fontSize: 13, color: C.accent, fontWeight: '600' },
  details:     { backgroundColor: C.surface2, borderRadius: 12, padding: 14, gap: 10 },
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  txt:         { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 19 },
  bold:        { fontWeight: '700', color: C.text },
});

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={s.emptyState}>
      <MascotImage emotion="Reflexion" size="md" />
      <Text style={s.emptyTitle}>Your rhythm is building</Text>
      <Text style={s.emptySub}>
        {"R-Lo needs a few nights to calculate your Rhythm Flow.\n\nStart by logging your first night or connecting a wearable."}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { theme }    = useTheme();
  const { goToPage } = usePager();
  const [loading,         setLoading]         = useState(true);
  const [insights,        setInsights]        = useState<InsightsData | null>(null);
  const [profile,         setProfile]         = useState<UserProfile | null>(null);
  const [weekSummary,     setWeekSummary]      = useState<WeeklySummaryResponse | null>(null);
  const [rawHistory,      setRawHistory]       = useState<NightRecord[]>([]);

  useFocusEffect(useCallback(() => { Analytics.screenViewed('insights'); }, []));

  useEffect(() => {
    async function load() {
      const [p, h, wearableRes] = await Promise.all([
        loadProfile(),
        loadWeekHistory(),
        getWearableHistory().catch(() => null),
      ]);
      if (p) setProfile(p);

      let history = h;
      if ((!history || history.length === 0) && wearableRes?.ok && wearableRes.data?.data) {
        const entries = wearableRes.data.data as any[];
        history = entries.map((w: any) => ({
          date:            w.collected_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          cyclesCompleted: w.sleep_duration_min ? Math.round(w.sleep_duration_min / 90) : 4,
          anchorTime:      p?.anchorTime ?? 390,
        }));
      }

      if (history) setRawHistory(history);
      if (p && history && history.length > 0) setInsights(computeInsights(history, p));
      setLoading(false);
    }
    void load();

    // Weekly summary from backend
    getWeeklySummaries(1).then(res => {
      if (res.ok && res.data?.summaries?.[0]) setWeekSummary(res.data.summaries[0]);
    }).catch(() => {});
  }, []);

  const BackHeader = () => (
    <View style={s.backHeader}>
      <Pressable onPress={() => goToPage(1)} style={s.backBtn} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        <Text style={[s.backLabel, { color: theme.colors.text }]}>Planning</Text>
      </Pressable>
      <Text style={[s.headerTitle, { color: theme.colors.text }]}>Insights</Text>
      <View style={{ width: 80 }} />
    </View>
  );

  if (loading) {
    return (
      <AmbientBackground wakeMin={profile?.anchorTime} style={s.root}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <BackHeader />
          <ActivityIndicator color={C.accent} style={{ marginTop: 80 }} />
        </SafeAreaView>
      </AmbientBackground>
    );
  }

  if (!insights || !profile) {
    return (
      <AmbientBackground wakeMin={profile?.anchorTime} style={s.root}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <BackHeader />
          <ScrollView contentContainerStyle={s.scroll}>
            <EmptyState />
          </ScrollView>
        </SafeAreaView>
      </AmbientBackground>
    );
  }

  const target      = profile.idealCyclesPerNight;
  const flowDays    = getRhythmFlowDays(rawHistory, target);
  const dots        = getWeekDots(rawHistory, target);
  const aligned     = getAlignedCount(dots);
  const weekMsg     = getWeekMessage(aligned, 7);
  const rloMsg      = getRhythmInsightMessage(insights.rhythmStrength);

  return (
    <AmbientBackground wakeMin={profile.anchorTime} style={s.root}>
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <BackHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── 1. Rhythm Flow ── */}
        <View style={s.flowCard}>
          <Text style={s.flowLabel}>Rhythm Flow</Text>
          <Text style={s.flowNumber}>{flowDays}</Text>
          <Text style={s.flowSub}>rhythm days</Text>

          {/* Phrase R-Lo */}
          <View style={s.rloRow}>
            <View style={s.rloAvatar}>
              <MascotImage emotion="encourageant" size="sm" />
            </View>
            <Text style={s.rloMsg}>{rloMsg}</Text>
          </View>
        </View>

        {/* ── 2. This week ── */}
        <View style={s.weekCard}>
          <Text style={s.sectionLabel}>This week</Text>
          <WeekDots dots={dots} />
          <Text style={s.weekMsg}>{weekMsg}</Text>

          {/* Weekly summary de backend si dispo */}
          {weekSummary?.on_track !== null && weekSummary && (
            <View style={[s.badge, { backgroundColor: weekSummary.on_track ? `${C.success}20` : `${C.rhythmLow}20` }]}>
              <Text style={[s.badgeText, { color: weekSummary.on_track ? C.success : C.rhythmLow }]}>
                {weekSummary.on_track ? 'On track' : 'Building'}
              </Text>
            </View>
          )}
        </View>

        {/* ── 3. En savoir plus ── */}
        <View style={s.detailsCard}>
          <ExpandableDetails insights={insights} profile={profile} />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
    </AmbientBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  // Back header
  backHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 },
  backLabel:   { fontSize: 15, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center', flex: 1 },

  // Rhythm Flow card
  flowCard:   { backgroundColor: C.card, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 14 },
  flowLabel:  { fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  flowNumber: { fontSize: 80, fontWeight: '900', color: C.text, lineHeight: 88 },
  flowSub:    { fontSize: 16, color: C.textSub, marginBottom: 20 },
  rloRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: 14, padding: 12, width: '100%' },
  rloAvatar:  { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  rloMsg:     { flex: 1, fontSize: 13, color: C.text, lineHeight: 19 },

  // This week card
  weekCard:    { backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 14 },
  sectionLabel:{ fontSize: 12, fontWeight: '700', color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 },
  weekMsg:     { fontSize: 14, color: C.textSub, marginTop: 14, lineHeight: 20, textAlign: 'center' },
  badge:       { alignSelf: 'center', marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  badgeText:   { fontSize: 12, fontWeight: '700' },

  // Details card
  detailsCard: { backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 16, paddingBottom: 8 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 16, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 },
});
