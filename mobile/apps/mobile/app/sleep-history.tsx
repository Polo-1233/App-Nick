/**
 * sleep-history.tsx — Sleep history & stats
 *
 * Shows last 10 nights + weekly summary stats.
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
  type EnrichedNightRecord,
} from '../lib/mock-sleep-history';

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

function formatMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ─── Night row ────────────────────────────────────────────────────────────────
function NightRow({ record }: { record: EnrichedNightRecord }) {
  const color     = recoveryColor(record.recoveryStatus, {
    success: C.success, warning: C.warning, error: C.error, muted: C.textMuted,
  });
  const isPending = record.cyclesCompleted === 0;
  const fillPct   = isPending ? '0%' : `${Math.min((record.cyclesCompleted / 5) * 100, 100)}%`;

  return (
    <View style={nr.row}>
      {/* Date + status */}
      <View style={nr.topRow}>
        <Text style={nr.date}>{formatDate(record.date)}</Text>
        <Text style={[nr.status, { color }]}>{record.recoveryStatus}</Text>
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

      {/* Bar + cycles + note */}
      <View style={nr.bottomRow}>
        <View style={[nr.barBg, { backgroundColor: `${color}18` }]}>
          <View style={[nr.barFill, { width: fillPct as any, backgroundColor: color }]} />
        </View>
        <Text style={[nr.cycles, { color }]}>
          {isPending ? '—' : `${record.cyclesCompleted} cycles`}
        </Text>
      </View>
      <Text style={nr.note} numberOfLines={1}>{record.note}</Text>
    </View>
  );
}

const nr = StyleSheet.create({
  row:       { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, gap: 7 },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date:      { fontSize: 15, fontWeight: '600', color: C.text },
  status:    { fontSize: 12, fontWeight: '700' },
  timesRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  time:      { fontSize: 13, color: C.textSub, fontWeight: '500' },
  sep:       { fontSize: 12, color: C.textMuted, marginHorizontal: 2 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barBg:     { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 3 },
  cycles:    { fontSize: 12, fontWeight: '700', width: 58 },
  note:      { fontSize: 12, color: C.textMuted, fontStyle: 'italic' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SleepHistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<EnrichedNightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    loadWeekHistory()
      .then(real => {
        if (real && real.length > 0) {
          // Enrich real NightRecords with placeholder status/note
          const enriched: EnrichedNightRecord[] = real.map(r => ({
            ...r,
            recoveryStatus: r.cyclesCompleted >= 4 ? 'Great recovery'
                          : r.cyclesCompleted >= 2 ? 'Stable rhythm'
                          : 'Slight sleep debt',
            note: '',
          }));
          setHistory(enriched);
        } else {
          // No real data → use mock
          setHistory(getMockSleepHistory());
          setUsingMock(true);
        }
      })
      .catch(() => {
        setHistory(getMockSleepHistory());
        setUsingMock(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const logged  = history.filter(r => r.cyclesCompleted > 0);
  const total   = logged.reduce((s, r) => s + r.cyclesCompleted, 0);
  const avg     = logged.length > 0 ? (total / logged.length).toFixed(1) : '–';
  const best    = logged.length > 0 ? Math.max(...logged.map(r => r.cyclesCompleted)) : 0;

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

        {/* Mock data banner */}
        {usingMock && (
          <View style={s.mockBanner}>
            <Ionicons name="flask-outline" size={14} color={C.warning} />
            <Text style={s.mockTxt}>Preview — using sample data</Text>
          </View>
        )}

        {/* Stats */}
        {logged.length > 0 && (
          <View style={s.statsRow}>
            {[
              { label: 'Total cycles', value: String(total) },
              { label: 'Daily avg',    value: String(avg)   },
              { label: 'Best night',   value: String(best)  },
            ].map(({ label, value }) => (
              <View key={label} style={s.statBox}>
                <Text style={s.statValue}>{value}</Text>
                <Text style={s.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Night list */}
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

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text },

  mockBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: `rgba(245,166,35,0.10)`, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  mockTxt:    { fontSize: 12, color: C.warning, fontWeight: '500' },

  statsRow:  { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 16, marginBottom: 12 },
  statBox:   { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 26, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 11, color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },

  listCard:  { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
});
