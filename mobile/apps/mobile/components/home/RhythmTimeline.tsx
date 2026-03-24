/**
 * RhythmTimeline
 *
 * Visual structure (matches reference screenshot):
 *   - Thin horizontal track (light blue-gray)
 *   - Segmented colored cycle blocks above the track
 *   - Current cycle: highlighted blue, slightly larger, subtle glow
 *   - Cursor: animated pulsing dot at current position
 *   - Left marker: sun icon (wake/ARP)
 *   - Right marker: moon icon (sleep window)
 *   - MRM dots, CRP outlined rings
 *   - Labels row: "06:30" — "Cycle X/Y" — "23:00"
 */

import { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TimeBlock } from '@r90/types';
import { nowMin, fmtMin } from '../../lib/time-utils';

// ─── Tokens ────────────────────────────────────────────────────────────────────
const ACCENT      = '#1c9fda';
const DEEP        = '#141466';
const TRACK_COLOR = '#D6E8F5';
const CYCLE_IDLE  = '#BDDFF5';
const CYCLE_DONE  = '#E8F4FB';
const GOLD        = '#F5A623';
const TEXT_MUTED  = '#8AA6C0';
const TEXT_LABEL  = '#002060';

interface RhythmTimelineProps {
  blocks:     TimeBlock[];
  bedtime:    number;
  anchorTime: number;
}

export const RhythmTimeline = memo(function RhythmTimeline({
  blocks, bedtime, anchorTime,
}: RhythmTimelineProps) {
  const W   = Dimensions.get('window').width;
  const PAD = 20;
  const TW  = W - PAD * 2;
  const DAY = 1440;

  // ── Time math ──────────────────────────────────────────────────────────────
  const spanStart = anchorTime;
  const spanEnd   = bedtime <= anchorTime ? bedtime + DAY : bedtime;
  const spanTotal = Math.max(spanEnd - spanStart, 1);
  const now       = nowMin();
  const nowAdj    = now < spanStart ? now + DAY : now;
  const pct       = Math.max(0, Math.min(1, (nowAdj - spanStart) / spanTotal));
  const nowX      = pct * TW;

  function xOf(min: number): number {
    const m = min < spanStart ? min + DAY : min;
    return Math.max(0, Math.min(TW, ((m - spanStart) / spanTotal) * TW));
  }

  // ── Cursor pulse ────────────────────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.7, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // ── Block data ──────────────────────────────────────────────────────────────
  const cycleBlocks = blocks.filter(b => b.type === 'sleep_cycle');
  const crpBlocks   = blocks.filter(b => b.type === 'crp');
  const mrmBlocks   = blocks.filter(b => b.type === 'down_period');
  const totalCycles = cycleBlocks.length;

  const currentIdx = cycleBlocks.findIndex(b => {
    const s = b.start < spanStart ? b.start + DAY : b.start;
    const e = b.end   < spanStart ? b.end   + DAY : b.end;
    return nowAdj >= s && nowAdj < e;
  });

  // Cycles before cursor = done (lighter), after = upcoming
  const cycleLabel = currentIdx >= 0
    ? `Cycle ${currentIdx + 1}/${totalCycles}`
    : `${totalCycles} cycles`;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={tl.outer}>
      <View style={[tl.container, { width: TW }]}>

        {/* Track */}
        <View style={tl.track} />

        {/* Cycle segments */}
        {cycleBlocks.map((b, i) => {
          const x1 = xOf(b.start);
          const x2 = xOf(b.end);
          const w  = Math.max(6, x2 - x1 - 3);
          const isCurrent = i === currentIdx;
          const isPast    = i < currentIdx;

          return (
            <View
              key={i}
              style={[
                tl.cycle,
                {
                  left:   x1,
                  width:  w,
                  height: isCurrent ? 20 : 14,
                  top:    isCurrent ? 31  : 34,
                  backgroundColor: isCurrent
                    ? ACCENT
                    : isPast ? CYCLE_DONE : CYCLE_IDLE,
                  borderRadius: isCurrent ? 7 : 5,
                  opacity: isPast ? 0.6 : 1,
                  ...(isCurrent && {
                    shadowColor:   ACCENT,
                    shadowOffset:  { width: 0, height: 0 },
                    shadowOpacity: 0.45,
                    shadowRadius:  8,
                    elevation:     3,
                  }),
                },
              ]}
            />
          );
        })}

        {/* MRM dots */}
        {mrmBlocks.map((b, i) => (
          <View key={`mrm-${i}`} style={[tl.mrmDot, { left: xOf(b.start) - 3 }]} />
        ))}

        {/* CRP rings */}
        {crpBlocks.map((b, i) => (
          <View key={`crp-${i}`} style={[tl.crpRing, { left: xOf(b.start) - 5 }]} />
        ))}

        {/* Sun marker — left (ARP) */}
        <View style={tl.sunMarker}>
          <Ionicons name="sunny" size={14} color={GOLD} />
        </View>

        {/* Moon marker — right (sleep) */}
        <View style={[tl.moonMarker, { left: TW - 14 }]}>
          <Ionicons name="moon" size={12} color={ACCENT} />
        </View>

        {/* Cursor */}
        <Animated.View
          pointerEvents="none"
          style={[tl.cursor, { left: nowX - 5, transform: [{ scale: pulse }] }]}
        />

      </View>

      {/* Labels row */}
      <View style={[tl.labels, { width: TW }]}>
        <Text style={tl.labelSide}>{fmtMin(anchorTime)}</Text>
        <Text style={tl.labelCenter}>{cycleLabel}</Text>
        <Text style={tl.labelSide}>{fmtMin(bedtime)}</Text>
      </View>
    </View>
  );
});

const tl = StyleSheet.create({
  outer: {
    marginTop:    12,
    alignItems:   'center',
  },
  container: {
    height:     80,
    position:   'relative',
  },
  track: {
    position:        'absolute',
    left:            0,
    right:           0,
    top:             41,
    height:          4,
    borderRadius:    2,
    backgroundColor: TRACK_COLOR,
  },
  cycle: {
    position: 'absolute',
  },
  mrmDot: {
    position:        'absolute',
    top:             39,
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#A8CADE',
  },
  crpRing: {
    position:        'absolute',
    top:             37,
    width:           10,
    height:          10,
    borderRadius:    5,
    borderWidth:     1.5,
    borderColor:     GOLD,
    backgroundColor: 'transparent',
  },
  sunMarker: {
    position:       'absolute',
    left:           -4,
    top:            30,
    width:          20,
    height:         20,
    alignItems:     'center',
    justifyContent: 'center',
  },
  moonMarker: {
    position:       'absolute',
    top:            32,
    width:          14,
    height:         14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cursor: {
    position:        'absolute',
    top:             36,
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: ACCENT,
    shadowColor:     ACCENT,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.7,
    shadowRadius:    6,
    elevation:       4,
  },
  labels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:       6,
    paddingHorizontal: 4,
  },
  labelSide: {
    fontSize:  11,
    color:     TEXT_MUTED,
    width:     44,
  },
  labelCenter: {
    fontSize:   12,
    fontWeight: '600',
    color:      TEXT_LABEL,
    textAlign:  'center',
    flex:       1,
    opacity:    0.7,
  },
});
