/**
 * RhythmTimeline — spec référence screenshot
 *
 * Layout:
 *   ☀️ [pill][pill][pill][●cursor][pill][pill]... 🌙
 *        ⚡           ⚡
 *   06:30        Cycle 5/11        23:00
 *
 * Segments:
 *   - Égaux en largeur, pilule arrondie
 *   - Passés/actuel : remplis bleu (#1c9fda)
 *   - Futurs : dark outline (empty)
 *   - Curseur : cercle blanc lumineux centré sur le cycle actuel
 *   - MRM : éclair ⚡ sous le segment
 */

import { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TimeBlock } from '@r90/types';
import { nowMin, fmtMin } from '../../lib/time-utils';

// ─── Tokens ─────────────────────────────────────────────────────────────────
const ACCENT    = '#1c9fda';
const FILLED_BG = '#1c9fda';        // completed + current cycles
const EMPTY_BG  = 'rgba(28,100,160,0.25)';  // future cycles
const GOLD      = '#F5A623';
const TEXT_MUTED = '#7A9BBC';
const TEXT_LABEL = '#002060';
const CURSOR_COLOR = '#FFFFFF';
const SEG_H      = 14;   // segment height
const SEG_RADIUS = 7;    // fully rounded
const GAP        = 4;    // gap between segments

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
  const TW  = W - PAD * 2;   // track width
  const DAY = 1440;

  // ── Time math ──────────────────────────────────────────────────────────────
  const spanStart = anchorTime;
  const spanEnd   = bedtime <= anchorTime ? bedtime + DAY : bedtime;
  const spanTotal = Math.max(spanEnd - spanStart, 1);
  const now       = nowMin();
  const nowAdj    = now < spanStart ? now + DAY : now;

  function xOf(min: number): number {
    const m = min < spanStart ? min + DAY : min;
    return Math.max(0, Math.min(TW, ((m - spanStart) / spanTotal) * TW));
  }

  // ── Block data ──────────────────────────────────────────────────────────────
  const cycleBlocks = blocks.filter(b => b.type === 'sleep_cycle');
  const mrmBlocks   = blocks.filter(b => b.type === 'down_period');
  const totalCycles = cycleBlocks.length;

  const currentIdx = cycleBlocks.findIndex(b => {
    const s = b.start < spanStart ? b.start + DAY : b.start;
    const e = b.end   < spanStart ? b.end   + DAY : b.end;
    return nowAdj >= s && nowAdj < e;
  });

  // Cursor pulse animation
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // ── Segment layout: equal-width pills ──────────────────────────────────────
  // Use equal segments when we have cycle blocks, fallback to 11 placeholders
  const segCount = totalCycles > 0 ? totalCycles : 11;
  const segW     = (TW - (segCount - 1) * GAP) / segCount;

  // Cursor X: center of current segment
  const cursorSegIdx = currentIdx >= 0 ? currentIdx : Math.round((nowAdj - spanStart) / (spanTotal / segCount));
  const cursorX      = cursorSegIdx * (segW + GAP) + segW / 2;

  // MRM segment indices
  const mrmIndices = new Set(
    mrmBlocks.map(b => {
      const mX = xOf(b.start);
      return Math.floor(mX / (segW + GAP));
    })
  );

  // Cycle label
  const cycleLabel = currentIdx >= 0
    ? `Cycle ${currentIdx + 1}/${totalCycles}`
    : `${totalCycles} cycles`;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={tl.outer}>

      {/* Icon markers row */}
      <View style={[tl.markerRow, { width: TW }]}>
        {/* Sun left */}
        <Ionicons name="sunny" size={16} color={GOLD} />

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Moon right */}
        <Ionicons name="moon" size={14} color={GOLD} />
      </View>

      {/* Track + segments + cursor */}
      <View style={[tl.track, { width: TW }]}>

        {/* Segments */}
        <View style={tl.segRow}>
          {Array.from({ length: segCount }, (_, i) => {
            const filled = currentIdx >= 0 ? i <= currentIdx : false;
            return (
              <View
                key={i}
                style={[
                  tl.seg,
                  {
                    width:           segW,
                    backgroundColor: filled ? FILLED_BG : EMPTY_BG,
                    borderColor:     filled ? 'transparent' : 'rgba(28,159,218,0.35)',
                    borderWidth:     filled ? 0 : 1,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Cursor — white glowing dot on current cycle */}
        {currentIdx >= 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              tl.cursor,
              {
                left:      cursorX - 8,
                transform: [{ scale: pulse }],
              },
            ]}
          />
        )}
      </View>

      {/* MRM lightning bolts below segments */}
      {mrmBlocks.length > 0 && (
        <View style={[tl.mrmRow, { width: TW }]}>
          {mrmBlocks.map((b, i) => {
            const mX = xOf(b.start);
            return (
              <View key={i} style={[tl.mrmIcon, { left: mX - 6 }]}>
                <Ionicons name="flash" size={10} color={GOLD} />
              </View>
            );
          })}
        </View>
      )}

      {/* Labels */}
      <View style={[tl.labels, { width: TW }]}>
        <Text style={tl.labelSide}>{fmtMin(anchorTime)}</Text>
        <Text style={tl.labelCenter}>{cycleLabel}</Text>
        <Text style={tl.labelSide}>{fmtMin(bedtime)}</Text>
      </View>

    </View>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const tl = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    marginTop:         14,
  },
  markerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   6,
  },
  track: {
    position:      'relative',
    height:        SEG_H + 16, // extra for cursor overflow
    justifyContent: 'center',
  },
  segRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           GAP,
  },
  seg: {
    height:       SEG_H,
    borderRadius: SEG_RADIUS,
  },
  cursor: {
    position:        'absolute',
    top:             0,
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: CURSOR_COLOR,
    shadowColor:     CURSOR_COLOR,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.9,
    shadowRadius:    8,
    elevation:       6,
  },
  mrmRow: {
    position: 'relative',
    height:   16,
    marginTop: 2,
  },
  mrmIcon: {
    position: 'absolute',
    top:      0,
  },
  labels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:       8,
  },
  labelSide: {
    fontSize:   12,
    color:      TEXT_MUTED,
    fontWeight: '500',
    width:      44,
  },
  labelCenter: {
    fontSize:   13,
    fontWeight: '700',
    color:      TEXT_LABEL,
    textAlign:  'center',
    flex:       1,
  },
});
