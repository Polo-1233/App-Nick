/**
 * PerformanceCard — compact weekly performance summary.
 *
 * Shows: avg cycles/night, best streak, ideal nights count.
 * Language is neutral — no "score", "grade", "rating" per R90 guardrails.
 */

import { View, Text, StyleSheet } from 'react-native';
import type { NightRecord } from '@r90/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  weekHistory:         NightRecord[];
  idealCyclesPerNight: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeAvg(history: NightRecord[]): string {
  if (!history.length) return '—';
  const avg = history.reduce((s, n) => s + n.cyclesCompleted, 0) / history.length;
  return avg.toFixed(1);
}

function computeBestStreak(history: NightRecord[], ideal: number): number {
  if (!history.length) return 0;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0, cur = 0;
  for (const n of sorted) {
    if (n.cyclesCompleted >= ideal) { cur++; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
}

function countIdeal(history: NightRecord[], ideal: number): number {
  return history.filter(n => n.cyclesCompleted >= ideal).length;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PerformanceCard({ weekHistory, idealCyclesPerNight }: Props) {
  const avg         = computeAvg(weekHistory);
  const bestStreak  = computeBestStreak(weekHistory, idealCyclesPerNight);
  const idealNights = countIdeal(weekHistory, idealCyclesPerNight);
  const totalNights = weekHistory.length || 7;

  return (
    <View style={s.card}>
      <Text style={s.label}>PERFORMANCE</Text>

      <View style={s.row}>
        <Text style={s.value}>{avg}</Text>
        <Text style={s.desc}>avg / night</Text>
      </View>

      <View style={s.divider} />

      <View style={s.row}>
        <Text style={s.value}>{bestStreak}</Text>
        <Text style={s.desc}>best streak</Text>
      </View>

      <View style={s.divider} />

      <View style={s.row}>
        <Text style={s.value}>
          {idealNights}
          <Text style={s.valueSub}>/{totalNights}</Text>
        </Text>
        <Text style={s.desc}>ideal nights</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: '#111111',
    borderRadius:    18,
    padding:         16,
    borderWidth:     1,
    borderColor:     '#1A1A1A',
  },
  label: {
    color:         '#3A3A3A',
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.6,
    marginBottom:  14,
  },
  row: {
    paddingVertical: 9,
  },
  value: {
    color:         '#FFFFFF',
    fontSize:      22,
    fontWeight:    '700',
    letterSpacing: -0.5,
  },
  valueSub: {
    color:      '#525252',
    fontSize:   14,
    fontWeight: '400',
  },
  desc: {
    color:     '#525252',
    fontSize:  11,
    marginTop: 1,
  },
  divider: {
    height:          1,
    backgroundColor: '#1A1A1A',
  },
});
