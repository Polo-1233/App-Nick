/**
 * RhythmTimeline
 *
 * Shows the user's position across their day as a segmented horizontal timeline.
 *
 * Visual elements:
 *   - Background track (light gray-blue line, 4px)
 *   - Cycle segments (blocks above the track)
 *   - Current cycle: larger + primary blue + subtle glow
 *   - Cursor: animated pulsing dot at current position
 *   - Markers: MRM (dot), CRP (outlined circle), Sleep (moon at far right)
 *
 * No text labels. Visual comprehension only.
 */

import { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TimeBlock } from '@r90/types';
import { nowMin } from '../../lib/time-utils';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT      = '#1c9fda';
const TRACK_COLOR = '#E6EEF5';
const CYCLE_COLOR = '#DCEAF5';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface RhythmTimelineProps {
  blocks:     TimeBlock[];
  bedtime:    number;   // minutes since midnight
  anchorTime: number;   // ARP (wake time)
}

// ─── Component ─────────────────────────────────────────────────────────────────
export const RhythmTimeline = memo(function RhythmTimeline({
  blocks, bedtime, anchorTime,
}: RhythmTimelineProps) {
  const W   = Dimensions.get('window').width;
  const PAD = 20;
  const TW  = W - PAD * 2;       // usable track width
  const DAY = 1440;

  // ── Time math ──────────────────────────────────────────────────────────────
  const spanStart = anchorTime;
  const spanEnd   = bedtime <= anchorTime ? bedtime + DAY : bedtime;
  const spanTotal = Math.max(spanEnd - spanStart, 1);

  const now    = nowMin();
  const nowAdj = now < spanStart ? now + DAY : now;
  const pct    = Math.max(0, Math.min(1, (nowAdj - spanStart) / spanTotal));
  const nowX   = pct * TW;

  function xOf(min: number): number {
    const m = min < spanStart ? min + DAY : min;
    return Math.max(0, Math.min(TW, ((m - spanStart) / spanTotal) * TW));
  }

  // ── Cursor pulse — slow 1.5s loop ──────────────────────────────────────────
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // ── Block filtering ─────────────────────────────────────────────────────────
  const cycleBlocks = blocks.filter(b => b.type === 'sleep_cycle');
  const crpBlocks   = blocks.filter(b => b.type === 'crp');
  const mrmBlocks   = blocks.filter(b => b.type === 'down_period');

  // Current cycle: first block the cursor is inside
  const currentIdx = cycleBlocks.findIndex(b => {
    const s = b.start < spanStart ? b.start + DAY : b.start;
    const e = b.end   < spanStart ? b.end   + DAY : b.end;
    return nowAdj >= s && nowAdj < e;
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[tl.container, { width: TW }]}>

      {/* Track — background line */}
      <View style={tl.track} />

      {/* Cycle segments */}
      {cycleBlocks.map((b, i) => {
        const x1      = xOf(b.start);
        const x2      = xOf(b.end);
        const segW    = Math.max(6, x2 - x1 - 3);
        const current = i === currentIdx;

        return (
          <View
            key={i}
            style={[
              tl.cycle,
              {
                left:            x1,
                width:           segW,
                height:          current ? 18 : 12,
                top:             current ? 34 : 37,
                backgroundColor: current ? ACCENT : CYCLE_COLOR,
                borderRadius:    current ? 6 : 4,
                // Glow for current cycle (iOS only — elevation on Android)
                ...(current && {
                  shadowColor:   ACCENT,
                  shadowOffset:  { width: 0, height: 0 },
                  shadowOpacity: 0.4,
                  shadowRadius:  8,
                  elevation:     3,
                }),
              },
            ]}
          />
        );
      })}

      {/* MRM markers — small gray dot */}
      {mrmBlocks.map((b, i) => (
        <View
          key={`mrm-${i}`}
          style={[tl.mrmDot, { left: xOf(b.start) - 3 }]}
        />
      ))}

      {/* CRP markers — outlined circle */}
      {crpBlocks.map((b, i) => (
        <View
          key={`crp-${i}`}
          style={[tl.crpRing, { left: xOf(b.start) - 5 }]}
        />
      ))}

      {/* Sleep marker — moon at far right */}
      <View style={[tl.sleepMarker, { left: TW - 14 }]}>
        <Ionicons name="moon" size={12} color={ACCENT} />
      </View>

      {/* Cursor — animated pulse */}
      <Animated.View
        pointerEvents="none"
        style={[
          tl.cursor,
          {
            left:      nowX - 5,
            transform: [{ scale: pulse }],
          },
        ]}
      />

    </View>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────────────────
const tl = StyleSheet.create({
  container: {
    alignSelf:   'center',
    height:      90,
    marginTop:   10,
  },
  track: {
    position:        'absolute',
    left:            0,
    right:           0,
    top:             43,
    height:          4,
    borderRadius:    2,
    backgroundColor: TRACK_COLOR,
  },
  cycle: {
    position: 'absolute',
  },
  mrmDot: {
    position:        'absolute',
    top:             40,
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#B8CCE0',
  },
  crpRing: {
    position:        'absolute',
    top:             38,
    width:           10,
    height:          10,
    borderRadius:    5,
    borderWidth:     1.5,
    borderColor:     '#F5A623',
    backgroundColor: 'transparent',
  },
  sleepMarker: {
    position:       'absolute',
    top:            32,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cursor: {
    position:        'absolute',
    top:             38,
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: ACCENT,
    shadowColor:     ACCENT,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.6,
    shadowRadius:    6,
    elevation:       4,
  },
});
