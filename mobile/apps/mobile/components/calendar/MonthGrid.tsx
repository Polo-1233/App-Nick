/**
 * MonthGrid — full-month calendar grid (Google Calendar month view).
 *
 * • 5–6 week rows starting on Monday.
 * • Today cell highlighted with green circle.
 * • Cycle count shown for days with history.
 * • Conflict red dot shown on today if conflicts exist.
 * • Tapping any day calls onDayTap so the parent can jump to Day view.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NightRecord, ReadinessZone } from '@r90/types';
import { useTheme } from '../../lib/theme-context';
import { ZONE_COLOR } from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  focusedDate:      Date;
  weekHistory:      NightRecord[];
  todayStr:         string;
  todayCycles?:     number;
  todayZone?:       ReadinessZone;
  todayHasConflict: boolean;
  onDayTap:         (date: Date) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ─── MonthGrid ────────────────────────────────────────────────────────────────

export function MonthGrid({
  focusedDate, weekHistory, todayStr,
  todayCycles, todayZone, todayHasConflict, onDayTap,
}: Props) {
  const { theme } = useTheme();
  const year  = focusedDate.getFullYear();
  const month = focusedDate.getMonth();

  const firstDay   = new Date(year, month, 1);
  const dow        = firstDay.getDay();
  const startDelta = dow === 0 ? -6 : 1 - dow;
  const gridStart  = addDays(firstDay, startDelta);

  const allRows = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)),
  );
  // Drop rows that are entirely outside the current month
  const rows = allRows.filter(row => row.some(d => d.getMonth() === month));

  return (
    <View style={s.root}>

      {/* Day-name headers */}
      <View style={s.namesRow}>
        {DAY_NAMES.map(n => (
          <View key={n} style={s.nameCell}>
            <Text style={[s.nameText, { color: theme.colors.textMuted }]}>{n}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {rows.map((row, wi) => (
        <View key={wi} style={s.weekRow}>
          {row.map((date, di) => {
            const dStr        = toDateStr(date);
            const isToday     = dStr === todayStr;
            const inMonth     = date.getMonth() === month;
            const record      = weekHistory.find(r => r.date === dStr);
            const cycles      = isToday ? todayCycles : record?.cyclesCompleted;
            const zone        = isToday ? todayZone   : undefined;
            const hasConflict = isToday && todayHasConflict;

            return (
              <Pressable
                key={di}
                style={({ pressed }) => [
                  s.cell,
                  isToday  && s.cellToday,
                  pressed  && s.cellPressed,
                ]}
                onPress={() => onDayTap(date)}
              >
                <View style={[s.numWrap, isToday && s.numWrapToday]}>
                  <Text style={[
                    s.numText,
                    { color: theme.colors.text },
                    isToday  && s.numTextToday,
                    !inMonth && { color: theme.colors.textFaint },
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>

                {cycles !== undefined && inMonth && (
                  <Text style={[
                    s.cyclesText,
                    { color: theme.colors.textMuted },
                    zone && { color: ZONE_COLOR[zone] },
                  ]}>
                    {cycles}c
                  </Text>
                )}

                {hasConflict && <View style={s.conflictDot} />}
              </Pressable>
            );
          })}
        </View>
      ))}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex:              1,
    paddingHorizontal: 4,
    paddingTop:        8,
    paddingBottom:     4,
  },
  namesRow:   { flexDirection: 'row', marginBottom: 4 },
  nameCell:   { flex: 1, alignItems: 'center', paddingBottom: 6 },
  nameText:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  weekRow:    { flex: 1, flexDirection: 'row' },
  cell: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             2,
    borderRadius:    8,
    paddingVertical: 4,
  },
  cellToday:   { backgroundColor: 'rgba(34,197,94,0.06)' },
  cellPressed: { backgroundColor: 'rgba(128,128,128,0.08)' },
  numWrap: {
    width:          30,
    height:         30,
    borderRadius:   15,
    alignItems:     'center',
    justifyContent: 'center',
  },
  numWrapToday:  { backgroundColor: '#22C55E' },
  numText:       { fontSize: 13, fontWeight: '600' },
  numTextToday:  { color: '#FFFFFF', fontWeight: '700' },
  cyclesText:    { fontSize: 9, fontWeight: '600' },
  conflictDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: '#EF4444' },
});
