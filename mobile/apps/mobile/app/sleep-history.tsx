/**
 * sleep-history.tsx — Sleep history & stats
 *
 * Shows last 7 nights + weekly summary stats.
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MascotImage } from '../components/ui/MascotImage';
import { loadWeekHistory } from '../lib/storage';
import type { NightRecord } from '@r90/types';

const C = {
  bg:       '#0B1220',
  card:     '#1A2436',
  surface2: '#243046',
  accent:   '#F5A623',
  text:     '#E6EDF7',
  textSub:  '#9FB0C5',
  textMuted:'#6B7F99',
  success:  '#3DDC97',
  warning:  '#F5A623',
  error:    '#F87171',
  border:   'rgba(255,255,255,0.07)',
};

function cycleColor(n: number): string {
  if (n >= 4) return C.success;
  if (n >= 2) return C.warning;
  return C.error;
}

function cycleLabel(n: number): string {
  if (n >= 4) return 'Great';
  if (n >= 2) return 'Fair';
  return 'Low';
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return dateStr; }
}

function NightRow({ record }: { record: NightRecord }) {
  const color = cycleColor(record.cyclesCompleted);
  return (
    <View style={n.row}>
      <View style={n.left}>
        <Text style={n.date}>{formatDate(record.date)}</Text>
        <Text style={[n.label, { color }]}>{cycleLabel(record.cyclesCompleted)}</Text>
      </View>
      <View style={n.right}>
        <Text style={n.cycles}>{record.cyclesCompleted}</Text>
        <Text style={n.cyclesSub}> cycles</Text>
      </View>
      <View style={[n.bar, { backgroundColor: `${color}20` }]}>
        <View style={[n.barFill, { width: `${Math.min((record.cyclesCompleted / 5) * 100, 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const n = StyleSheet.create({
  row:       { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, gap: 8 },
  left:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date:      { fontSize: 15, fontWeight: '500', color: C.text },
  label:     { fontSize: 13, fontWeight: '600' },
  right:     { flexDirection: 'row', alignItems: 'baseline' },
  cycles:    { fontSize: 28, fontWeight: '800', color: C.text },
  cyclesSub: { fontSize: 13, color: C.textSub },
  bar:       { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 3 },
});

export default function SleepHistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<NightRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeekHistory().then(h => { setHistory(h); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const total   = history.reduce((s, r) => s + r.cyclesCompleted, 0);
  const avg     = history.length > 0 ? (total / history.length).toFixed(1) : '–';
  const best    = history.length > 0 ? Math.max(...history.map(r => r.cyclesCompleted)) : 0;

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
        {/* Stats summary */}
        {history.length > 0 && (
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

  statsRow:  { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 16, marginBottom: 12 },
  statBox:   { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 26, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 11, color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },

  listCard:  { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
});
