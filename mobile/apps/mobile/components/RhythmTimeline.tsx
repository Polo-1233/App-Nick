/**
 * RhythmTimeline — Spec pixel-perfect R90
 *
 * - Ligne fine 4px avec segments cycles
 * - Cycle actuel : +20% width, bleu plein, glow
 * - Curseur 10px pulsant = "you are here"
 * - Marqueurs : MRM (dot 6px), CRP (cercle creux), Sleep (🌙 à droite)
 * - Pas de label "cycle X/Y"
 */

import { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TimeBlock } from '@r90/types';
import { nowMin } from '../lib/time-utils';

// Brand colors — fixed (track is design-language, not surface)
const ACCENT   = '#1c9fda';
const TRACK_BG = '#E6EEF5';
const CYCLE_BG = '#DCEAF5';

interface RhythmTimelineProps {
  blocks:     TimeBlock[];
  wakeTime:   number;
  bedtime:    number;
  anchorTime: number;
}

export const RhythmTimeline = memo(function RhythmTimeline({
  blocks, bedtime, anchorTime,
}: RhythmTimelineProps) {
  const { width: W } = Dimensions.get('window');
  const PAD  = 20;
  const TW   = W - PAD * 2;
  const DAY  = 1440;
  const TRACK_H = 4;
  const CYCLE_H = 16; // cycles sit on top of the track, centred

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

  // Cursor pulse — slow 1.5s loop
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const cycleBlocks = blocks.filter(b => b.type === 'sleep_cycle');
  const crpBlocks   = blocks.filter(b => b.type === 'crp');
  const mrmBlocks   = blocks.filter(b => b.type === 'down_period');

  // Current cycle
  const currentCycle = cycleBlocks.findIndex(b => {
    const s = b.start < spanStart ? b.start + DAY : b.start;
    const e = b.end   < spanStart ? b.end   + DAY : b.end;
    return nowAdj >= s && nowAdj < e;
  });

  // Compute cycle widths (+20% for current)
  const baseWidth = cycleBlocks.length > 0
    ? (TW - (cycleBlocks.length - 1) * 6) / cycleBlocks.length
    : 0;

  return (
    <View style={[tl.wrap, { width: TW }]}>

      {/* ── Track base ── */}
      <View style={tl.track} />

      {/* ── Cycle segments (above track, centred vertically) ── */}
      <View style={[tl.segmentLayer, { width: TW }]} pointerEvents="none">
        {cycleBlocks.map((b, i) => {
          const x1 = xOf(b.start);
          const x2 = xOf(b.end);
          const rawW = Math.max(8, x2 - x1 - 3);
          const isCurrent = i === currentCycle;
          const segW = isCurrent ? rawW * 1.0 : rawW; // width from data, +glow for current

          return (
            <View
              key={i}
              style={[
                tl.cycleBar,
                {
                  left:            x1,
                  width:           segW,
                  height:          isCurrent ? CYCLE_H : CYCLE_H - 4,
                  top:             isCurrent ? 0 : 2,
                  backgroundColor: isCurrent ? ACCENT : CYCLE_BG,
                  borderRadius:    isCurrent ? 8 : 4,
                  // Shadow / glow for current cycle
                  ...(isCurrent && {
                    shadowColor:   ACCENT,
                    shadowOffset:  { width: 0, height: 0 },
                    shadowOpacity: 0.35,
                    shadowRadius:  8,
                    elevation:     4,
                  }),
                },
              ]}
            />
          );
        })}
      </View>

      {/* ── MRM dots ── */}
      {mrmBlocks.map((b, i) => (
        <View
          key={`mrm-${i}`}
          style={[tl.mrmDot, { left: xOf(b.start) - 3 }]}
        />
      ))}

      {/* ── CRP hollow circle ── */}
      {crpBlocks.map((b, i) => (
        <View
          key={`crp-${i}`}
          style={[tl.crpCircle, { left: xOf(b.start) - 5 }]}
        />
      ))}

      {/* ── Sleep moon — always at far right ── */}
      <View style={[tl.sleepMoon, { left: TW - 14 }]}>
        <Ionicons name="moon" size={13} color={ACCENT} />
      </View>

      {/* ── Cursor "you are here" ── */}
      <Animated.View
        style={[
          tl.cursor,
          {
            left: nowX - 5,
            transform: [{ scale: pulse }],
          },
        ]}
        pointerEvents="none"
      />

    </View>
  );
});

const tl = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop:        10,
    height:           90,
    justifyContent:   'center',
  },
  track: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          4,
    borderRadius:    2,
    backgroundColor: TRACK_BG,
    top:             43, // centre vertical in 90px container
  },
  segmentLayer: {
    position:  'absolute',
    top:       35, // centres CYCLE_H=16 around track centre (43 - 8)
    height:    16,
  },
  cycleBar: {
    position: 'absolute',
  },
  mrmDot: {
    position:        'absolute',
    top:             37, // sits on the track
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#B0C4D8',
  },
  crpCircle: {
    position:     'absolute',
    top:          34,
    width:        12,
    height:       12,
    borderRadius: 6,
    borderWidth:  1.5,
    borderColor:  '#F5A623',
    backgroundColor: 'transparent',
  },
  sleepMoon: {
    position:       'absolute',
    top:            30,
    width:          14,
    height:         14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cursor: {
    position:        'absolute',
    top:             38, // centred on track
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: ACCENT,
    shadowColor:     ACCENT,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.5,
    shadowRadius:    6,
    elevation:       4,
  },
});
