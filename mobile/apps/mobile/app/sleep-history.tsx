/**
 * sleep-history.tsx — Sleep history & stats
 *
 * Sections:
 *   1. Stats cards  — Sleep Consistency / Average Cycles / Best Night
 *   2. Weekly trend — last 7 nights color dots
 *   3. Night list   — date, bedtime → wake, cycles bar, status icon, note
 *
 * Falls back to mock data when no real backend data exists.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter }    from 'expo-router';
import { Ionicons }     from '@expo/vector-icons';
import { MascotImage }  from '../components/ui/MascotImage';
import { loadWeekHistory } from '../lib/storage';
import {
  getMockSleepHistory,
  recoveryColor,
  recoveryIcon,
  type EnrichedNightRecord,
} from '../lib/mock-sleep-history';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0B1220',
  card:     '#1A2436',
  surface2: '#243046',
  accent:   '#4DA3FF',
  text:     '#E6EDF7',
  textSub:  '#9FB0C5',
  textMuted:'#6B7F99',
  success:  '#3DDC97',
  warning:  '#F5A623',
  error:    '#F87171',
  border:   'rgba(255,255,255,0.07)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return dateStr; }
}

/**
 * Format MinuteOfDay as HH:MM, handling wrap past midnight.
 * Values < 360 (before 06:00) are displayed as-is (early morning).
 * Values ≥ 360 are treated as night times.
 */
function formatMin(m: number): string {
  const safe = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function palette() {
  return { success: C.success, warning: C.warning, error: C.error, muted: C.textMuted };
}

// ─── 2. Weekly trend ──────────────────────────────────────────────────────────
const TREND_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function WeeklyTrend({ history }: { history: EnrichedNightRecord[] }) {
  // Take last 7 logged nights (skip pending)
  const logged = history.filter(r => r.cyclesCompleted > 0).slice(0, 7);

  // Build Mon–Sun buckets based on actual dates
  type DotEntry = { day: string; color: string; cycles: number; filled: boolean };
  const dots: DotEntry[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i)); // Mon–Sun ending today
    const iso = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const record = history.find(r => r.date === iso);
    if (!record || record.cyclesCompleted === 0) {
      return { day: dayLabel, color: C.surface2, cycles: 0, filled: false };
    }
    return {
      day:    dayLabel,
      color:  recoveryColor(record.recoveryStatus, palette()),
      cycles: record.cyclesCompleted,
      filled: true,
    };
  });

  return (
    <View style={wt.wrap}>
      <Text style={wt.title}>Last 7 nights</Text>
      <View style={wt.dots}>
        {dots.map((dot, i) => (
          <View key={i} style={wt.dotCol}>
            {/* Bar height proportional to cycles (max 5) */}
            <View style={wt.barContainer}>
              <View style={[
                wt.bar,
                {
                  height: dot.filled ? Math.max(12, (dot.cycles / 5) * 44) : 6,
                  backgroundColor: dot.color,
                  opacity: dot.filled ? 1 : 0.3,
                },
              ]} />
            </View>
            <Text style={wt.dayLabel}>{dot.day}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const wt = StyleSheet.create({
  wrap:        { marginHorizontal: 16, marginBottom: 14, backgroundColor: C.card, borderRadius: 18, padding: 18 },
  title:       { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
  dots:        { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  dotCol:      { flex: 1, alignItems: 'center', gap: 6 },
  barContainer:{ height: 44, justifyContent: 'flex-end' },
  bar:         { width: 22, borderRadius: 6 },
  dayLabel:    { fontSize: 11, color: C.textMuted, fontWeight: '500' },
});

// ─── 3. Night row ─────────────────────────────────────────────────────────────
function NightRow({ record }: { record: EnrichedNightRecord }) {
  const color     = recoveryColor(record.recoveryStatus, palette());
  const icon      = recoveryIcon(record.recoveryStatus);
  const isPending = record.cyclesCompleted === 0;
  const fillPct   = isPending ? 0 : Math.min((record.cyclesCompleted / 5) * 100, 100);

  return (
    <View style={nr.row}>
      {/* Date + status icon + status label */}
      <View style={nr.topRow}>
        <Text style={nr.date}>{formatDate(record.date)}</Text>
        <View style={nr.statusRow}>
          <Ionicons name={icon as any} size={14} color={color} />
          <Text style={[nr.status, { color }]}>{record.recoveryStatus}</Text>
        </View>
      </View>

      {/* Bedtime → wake */}
      {!isPending && record.actualBedtime !== undefined && (
        <View style={nr.timesRow}>
          <Ionicons name="moon-outline" size={12} color={C.textMuted} />
          <Text style={nr.time}>{formatMin(record.actualBedtime)}</Text>
          <Text style={nr.sep}>→</Text>
          <Ionicons name="sunny-outline" size={12} color={C.textMuted} />
          <Text style={nr.time}>{formatMin(record.anchorTime)}</Text>
        </View>
      )}

      {/* Cycles bar */}
      {!isPending && (
        <View style={nr.barRow}>
          <View style={[nr.barBg, { backgroundColor: `${color}18` }]}>
            <View style={[nr.barFill, { width: `${fillPct}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={[nr.cycles, { color }]}>{record.cyclesCompleted} cycles</Text>
        </View>
      )}

      {/* Note */}
      <Text style={nr.note} numberOfLines={1}>{record.note}</Text>
    </View>
  );
}
const nr = StyleSheet.create({
  row:       { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, gap: 7 },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date:      { fontSize: 15, fontWeight: '600', color: C.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  status:    { fontSize: 12, fontWeight: '700' },
  timesRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  time:      { fontSize: 13, color: C.textSub, fontWeight: '500' },
  sep:       { fontSize: 12, color: C.textMuted, marginHorizontal: 2 },
  barRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barBg:     { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 3 },
  cycles:    { fontSize: 12, fontWeight: '700', width: 58 },
  note:      { fontSize: 12, color: C.textMuted, fontStyle: 'italic' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SleepHistoryScreen() {
  const router = useRouter();
  const [history,   setHistory]   = useState<EnrichedNightRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    loadWeekHistory()
      .then(real => {
        if (real && real.length > 0) {
          const enriched: EnrichedNightRecord[] = real.map(r => ({
            ...r,
            recoveryStatus: r.cyclesCompleted >= 4 ? 'Great recovery'
                          : r.cyclesCompleted >= 2 ? 'Stable rhythm'
                          : 'Slight sleep debt',
            note: '',
          }));
          setHistory(enriched);
        } else {
          setHistory([]);
          setUsingMock(false);
        }
      })
      .catch(() => { setHistory([]); setUsingMock(false); })
      .finally(() => setLoading(false));
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const logged  = history.filter(r => r.cyclesCompleted > 0);
  const total   = logged.reduce((s, r) => s + r.cyclesCompleted, 0);
  const avg     = logged.length > 0 ? (total / logged.length) : 0;
  const best    = logged.length > 0 ? Math.max(...logged.map(r => r.cyclesCompleted)) : 0;
  const consistent = logged.filter(r => r.cyclesCompleted >= 4).length;
  const consistencyPct = logged.length > 0
    ? Math.round((consistent / logged.length) * 100)
    : 0;

  const STATS = [
    { label: 'Sleep\nConsistency', value: `${consistencyPct}%`          },
    { label: 'Average\nCycles',    value: avg > 0 ? `${avg.toFixed(1)}` : '–' },
    { label: 'Best\nNight',        value: best > 0 ? `${best} cycles`   : '–' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={C.textSub} />
        </Pressable>
        <Text style={s.headerTitle}>Sleep History</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Mock banner */}
        {usingMock && (
          <View style={s.mockBanner}>
            <Ionicons name="flask-outline" size={14} color={C.warning} />
            <Text style={s.mockTxt}>Preview — using sample data</Text>
          </View>
        )}

        {/* 1. Stats cards */}
        <View style={s.statsRow}>
          {STATS.map(({ label, value }) => (
            <View key={label} style={s.statBox}>
              <Text style={s.statValue}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* 2. Weekly trend */}
        {logged.length > 0 && <WeeklyTrend history={history} />}

        {/* 3. Night list */}
        <View style={s.listCard}>
          {loading ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: C.textSub }}>Loading…</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={{ padding: 32, alignItems: 'center', gap: 16 }}>
              <MascotImage emotion="rassurante" size="md" />
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
                No sleep data yet
              </Text>
              <Text style={{ color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                Log your first night to start tracking your sleep cycles.
              </Text>
            </View>
          ) : (
            history.map(r => <NightRow key={r.date} record={r} />)
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text },

  mockBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 8, marginBottom: 8, backgroundColor: 'rgba(245,166,35,0.10)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  mockTxt:    { fontSize: 12, color: C.warning, fontWeight: '500' },

  statsRow:  { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 14 },
  statBox:   { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  statValue: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center' },
  statLabel: { fontSize: 10, color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center', lineHeight: 14 },

  listCard:  { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
});
