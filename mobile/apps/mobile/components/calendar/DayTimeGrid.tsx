/**
 * DayTimeGrid — vertical time grid for one or more day columns.
 *
 * Used by DayPager (one instance per pager page).
 * Renders:
 *   • Optional 3D day-column headers (day name + circle + zone dot)
 *   • Left time-label column
 *   • One DayColumn per date
 *
 * Auto-scrolls to current time (+ 200 px margin) when isAtToday=true.
 */

import { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { TimeBlock, Conflict, ReadinessZone } from '@r90/types';
import { useTheme } from '../../lib/theme-context';
import { DayColumn } from './DayColumn';
import { TIME_COL_W, TOTAL_H, ZONE_COLOR, minToPx } from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  dates:            Date[];
  colWidth:         number;
  todayStr:         string;
  currentMin:       number;
  isAtToday:        boolean;
  /** Show mini day-name + number headers above each column (for 3D mode). */
  show3dHeader?:    boolean;
  zone?:            ReadinessZone | null;
  getBlocksForDate: (d: Date) => { blocks: TimeBlock[]; conflicts: Conflict[] };
  onBlockPress:     (b: TimeBlock, c: Conflict | undefined) => void;
}

// ─── TimeLabels ───────────────────────────────────────────────────────────────

function TimeLabels() {
  const { theme } = useTheme();
  return (
    <View style={{ width: TIME_COL_W, height: TOTAL_H }}>
      {Array.from({ length: 25 }, (_, h) => (
        <View
          key={h}
          style={{
            position:     'absolute',
            top:          minToPx(h * 60) - 7,
            width:        TIME_COL_W,
            alignItems:   'flex-end',
            paddingRight: 6,
          }}
        >
          {h < 24 && (
            <Text style={[tl.label, { color: theme.colors.textMuted }]}>
              {String(h).padStart(2, '0')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const tl = StyleSheet.create({
  label: { fontSize: 10, fontVariant: ['tabular-nums'] },
});

// ─── DayColHeader (3D mode only) ──────────────────────────────────────────────

interface DayColHeaderProps {
  date:     Date;
  isToday:  boolean;
  zone?:    ReadinessZone;
  colWidth: number;
}

function DayColHeader({ date, isToday, zone, colWidth }: DayColHeaderProps) {
  const { theme } = useTheme();
  const dayName   = date.toLocaleDateString('en', { weekday: 'short' });
  const dayNum    = date.getDate();
  return (
    <View style={[dch.col, { width: colWidth }]}>
      <Text style={[dch.name, { color: theme.colors.textMuted }, isToday && dch.nameToday]}>
        {dayName.toUpperCase()}
      </Text>
      <View style={[dch.circle, isToday && dch.circleToday]}>
        <Text style={[dch.num, { color: theme.colors.textSub }, isToday && dch.numToday]}>
          {dayNum}
        </Text>
      </View>
      {zone && <View style={[dch.zoneDot, { backgroundColor: ZONE_COLOR[zone] }]} />}
    </View>
  );
}

const dch = StyleSheet.create({
  col:         { alignItems: 'center', paddingVertical: 6, gap: 2 },
  name:        { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  nameToday:   { color: '#22C55E' },
  circle:      { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  circleToday: { backgroundColor: '#22C55E' },
  num:         { fontSize: 14, fontWeight: '700' },
  numToday:    { color: '#FFFFFF' },
  zoneDot:     { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
});

// ─── DayTimeGrid ─────────────────────────────────────────────────────────────

export function DayTimeGrid({
  dates,
  colWidth,
  todayStr,
  currentMin,
  isAtToday,
  show3dHeader = false,
  zone,
  getBlocksForDate,
  onBlockPress,
}: Props) {
  const { theme }  = useTheme();
  const scrollRef  = useRef<ScrollView>(null);

  // Scroll to current time once on mount (only when this grid contains today).
  useEffect(() => {
    if (isAtToday) {
      const y = Math.max(0, minToPx(currentMin) - 200);
      const t = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: true }), 350);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.root}>

      {/* 3D column headers */}
      {show3dHeader && (
        <View style={[s.colHdrRow, { borderBottomColor: theme.colors.border, marginLeft: TIME_COL_W }]}>
          {dates.map((d, i) => {
            const dStr   = d.toISOString().split('T')[0];
            const isToday = dStr === todayStr;
            return (
              <DayColHeader
                key={i}
                date={d}
                isToday={isToday}
                zone={isToday ? (zone ?? undefined) : undefined}
                colWidth={colWidth}
              />
            );
          })}
        </View>
      )}

      {/* Vertical scroll: time labels + day columns */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ height: TOTAL_H }}
        nestedScrollEnabled
      >
        <View style={s.gridRow}>
          <TimeLabels />
          {dates.map((date, i) => {
            const { blocks, conflicts } = getBlocksForDate(date);
            const isToday = date.toISOString().split('T')[0] === todayStr;
            return (
              <DayColumn
                key={i}
                blocks={blocks}
                conflicts={conflicts}
                colWidth={colWidth}
                isToday={isToday}
                isHighlighted={isToday}
                currentMinute={isToday ? currentMin : undefined}
                onBlockPress={onBlockPress}
              />
            );
          })}
        </View>
      </ScrollView>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:     { flex: 1 },
  colHdrRow: {
    flexDirection:     'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll:   { flex: 1 },
  gridRow: {
    flexDirection: 'row',
    height:        TOTAL_H,
  },
});
