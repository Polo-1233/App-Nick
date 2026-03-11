/**
 * DayPager — infinite 3-page horizontal pager for day / 3D navigation.
 *
 * Architecture:
 *   • 3 pages: [prev, current, next] — each page is a full DayTimeGrid.
 *   • ScrollView starts at center (page 1 = current).
 *   • On swipe → onMomentumScrollEnd detects the landing page, calls
 *     onDateChange and scrolls back to center with no animation.
 *   • useEffect resets to center whenever focusedDate changes from the
 *     parent (arrow-button navigation or month-tap).
 *
 * Gesture note:
 *   This is a horizontal ScrollView nested inside the outer Revolut-style
 *   horizontal pager. React Native gives gesture priority to the innermost
 *   scrollable view, so horizontal swipes on the Calendar tab will change
 *   days (not switch tabs). Users switch tabs via the bottom tab bar.
 *   This mirrors Google Calendar's Android UX.
 *
 * Step sizes:
 *   '1d' mode → step = 1 day  per swipe, colCount = 1
 *   '3d' mode → step = 3 days per swipe, colCount = 3
 */

import { useRef, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import type { TimeBlock, Conflict, ReadinessZone } from '@r90/types';
import { TIME_COL_W } from './constants';
import { DayTimeGrid } from './DayTimeGrid';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PagerMode = '1d' | '3d';

interface Props {
  mode:             PagerMode;
  focusedDate:      Date;
  todayStr:         string;
  currentMin:       number;
  zone?:            ReadinessZone | null;
  getBlocksForDate: (d: Date) => { blocks: TimeBlock[]; conflicts: Conflict[] };
  onBlockPress:     (b: TimeBlock, c: Conflict | undefined) => void;
  onDateChange:     (date: Date) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildDates(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

// ─── DayPager ────────────────────────────────────────────────────────────────

export function DayPager({
  mode,
  focusedDate,
  todayStr,
  currentMin,
  zone,
  getBlocksForDate,
  onBlockPress,
  onDateChange,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const scrollRef          = useRef<ScrollView>(null);

  const step     = mode === '3d' ? 3 : 1;
  const colCount = mode === '3d' ? 3 : 1;
  const colWidth = (screenW - TIME_COL_W) / colCount;

  // Build the 3 pages: [prev, current, next]
  const prevDates = buildDates(addDays(focusedDate, -step), colCount);
  const currDates = buildDates(focusedDate, colCount);
  const nextDates = buildDates(addDays(focusedDate, step), colCount);

  // Reset to center page whenever focusedDate or mode changes.
  // This handles arrow navigation and month-grid taps from the parent.
  // scrollTo with animated:false is imperceptible (< 1 frame).
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: screenW, animated: false });
  }, [focusedDate, screenW, mode]);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / screenW);
      if (page === 1) return; // already on center, no change

      // Immediately snap back to center so the new focusedDate slides in cleanly.
      scrollRef.current?.scrollTo({ x: screenW, animated: false });

      const delta = page === 0 ? -step : step;
      onDateChange(addDays(focusedDate, delta));
    },
    [focusedDate, step, screenW, onDateChange],
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      decelerationRate="fast"
      onMomentumScrollEnd={handleMomentumEnd}
      contentContainerStyle={{ width: screenW * 3 }}
      style={{ flex: 1 }}
    >
      {/* Page 0 — previous day(s) */}
      <View style={{ width: screenW, flex: 1 }}>
        <DayTimeGrid
          dates={prevDates}
          colWidth={colWidth}
          todayStr={todayStr}
          currentMin={currentMin}
          isAtToday={prevDates.some(d => toDateStr(d) === todayStr)}
          show3dHeader={mode === '3d'}
          zone={zone}
          getBlocksForDate={getBlocksForDate}
          onBlockPress={onBlockPress}
        />
      </View>

      {/* Page 1 — current (focused) day(s) */}
      <View style={{ width: screenW, flex: 1 }}>
        <DayTimeGrid
          dates={currDates}
          colWidth={colWidth}
          todayStr={todayStr}
          currentMin={currentMin}
          isAtToday={currDates.some(d => toDateStr(d) === todayStr)}
          show3dHeader={mode === '3d'}
          zone={zone}
          getBlocksForDate={getBlocksForDate}
          onBlockPress={onBlockPress}
        />
      </View>

      {/* Page 2 — next day(s) */}
      <View style={{ width: screenW, flex: 1 }}>
        <DayTimeGrid
          dates={nextDates}
          colWidth={colWidth}
          todayStr={todayStr}
          currentMin={currentMin}
          isAtToday={nextDates.some(d => toDateStr(d) === todayStr)}
          show3dHeader={mode === '3d'}
          zone={zone}
          getBlocksForDate={getBlocksForDate}
          onBlockPress={onBlockPress}
        />
      </View>
    </ScrollView>
  );
}
