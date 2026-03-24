/**
 * RhythmTimeline — Journée entière en segments de 90 min
 *
 * Divise toute la journée (anchorTime → bedtime) en blocs de 90 min.
 * Chaque bloc = 1 segment pilule.
 *
 * États des segments :
 *   - Passé  : bleu plein (#1c9fda)
 *   - Actuel : bleu plein + curseur blanc lumineux dessus
 *   - Futur  : dark outline vide
 *
 * Marqueurs :
 *   ☀️ gauche (ARP) · 🌙 droite (bedtime)
 *   ⚡ sous les segments MRM · ○ sous les segments CRP
 *
 * Labels :
 *   "06:30" · "Cycle 5/11" · "23:00"
 */

import { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TimeBlock } from '@r90/types';
import { nowMin, fmtMin } from '../../lib/time-utils';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const ACCENT      = '#1c9fda';
const FILLED_BG   = '#1c9fda';
const EMPTY_BG    = 'rgba(28,100,160,0.22)';
const EMPTY_BORDER = 'rgba(28,159,218,0.35)';
const GOLD        = '#F5A623';
const TEXT_MUTED  = '#7A9BBC';
const TEXT_LABEL  = '#002060';
const CURSOR_WHITE = '#FFFFFF';
const SEGMENT_H   = 14;
const SEGMENT_R   = 7;
const CYCLE_MIN   = 90; // 90 minutes per segment

interface RhythmTimelineProps {
  blocks:     TimeBlock[];
  bedtime:    number;   // minutes since midnight
  anchorTime: number;   // ARP (wake)
}

export const RhythmTimeline = memo(function RhythmTimeline({
  blocks, bedtime, anchorTime,
}: RhythmTimelineProps) {
  const W   = Dimensions.get('window').width;
  const PAD = 20;
  const TW  = W - PAD * 2;
  const DAY = 1440;

  // ── Time span ──────────────────────────────────────────────────────────────
  const spanStart = anchorTime;
  const spanEnd   = bedtime <= anchorTime ? bedtime + DAY : bedtime;
  const spanTotal = Math.max(spanEnd - spanStart, 1);

  const now    = nowMin();
  const nowAdj = now < spanStart ? now + DAY : now;

  // ── Build 90-min segments ─────────────────────────────────────────────────
  // How many 90-min slots fit in the day span
  const segCount = Math.max(1, Math.round(spanTotal / CYCLE_MIN));

  // Width of each segment + gap
  const GAP  = segCount > 8 ? 3 : 4;
  const segW = (TW - (segCount - 1) * GAP) / segCount;

  // Current segment index (0-based)
  const elapsedMin   = Math.max(0, nowAdj - spanStart);
  const currentIdx   = nowAdj >= spanStart && nowAdj < spanEnd
    ? Math.min(Math.floor(elapsedMin / CYCLE_MIN), segCount - 1)
    : nowAdj < spanStart ? -1 : segCount; // -1 = before day, segCount = after day

  // Cursor X: center of current segment
  const cursorSegIdx = Math.max(0, Math.min(currentIdx, segCount - 1));
  const cursorX      = cursorSegIdx * (segW + GAP) + segW / 2;

  // Cycle label
  const cycleNum   = currentIdx >= 0 ? Math.min(currentIdx + 1, segCount) : 0;
  const cycleLabel = currentIdx >= 0 && currentIdx < segCount
    ? `Cycle ${cycleNum}/${segCount}`
    : `${segCount} cycles`;

  // ── Map MRM and CRP to segment indices ────────────────────────────────────
  function blockToSegIdx(startMin: number): number {
    const adj = startMin < spanStart ? startMin + DAY : startMin;
    return Math.floor(Math.max(0, adj - spanStart) / CYCLE_MIN);
  }

  const mrmSegs = new Set(
    blocks.filter(b => b.type === 'down_period').map(b => blockToSegIdx(b.start))
  );
  const crpSegs = new Set(
    blocks.filter(b => b.type === 'crp').map(b => blockToSegIdx(b.start))
  );

  // ── Cursor pulse ──────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={tl.outer}>

      {/* Top icons row: ☀️ — — — 🌙 */}
      <View style={[tl.iconRow, { width: TW }]}>
        <Ionicons name="sunny" size={16} color={GOLD} />
        <View style={{ flex: 1 }} />
        <Ionicons name="moon" size={14} color={GOLD} />
      </View>

      {/* Segments row */}
      <View style={[tl.segRow, { width: TW }]}>
        {Array.from({ length: segCount }, (_, i) => {
          const filled = i <= currentIdx && currentIdx >= 0;

          return (
            <View
              key={i}
              style={[
                tl.seg,
                {
                  width:           segW,
                  marginRight:     i < segCount - 1 ? GAP : 0,
                  backgroundColor: filled ? FILLED_BG : EMPTY_BG,
                  borderColor:     filled ? 'transparent' : EMPTY_BORDER,
                  borderWidth:     filled ? 0 : 1,
                },
              ]}
            />
          );
        })}

        {/* Cursor — blanc lumineux sur segment actuel */}
        {currentIdx >= 0 && currentIdx < segCount && (
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

      {/* Markers below segments: ⚡ MRM · ○ CRP */}
      {(mrmSegs.size > 0 || crpSegs.size > 0) && (
        <View style={[tl.markerBelow, { width: TW }]}>
          {Array.from({ length: segCount }, (_, i) => {
            const segX = i * (segW + GAP) + segW / 2;
            if (mrmSegs.has(i)) {
              return (
                <View key={i} style={[tl.markerIcon, { left: segX - 5 }]}>
                  <Ionicons name="flash" size={10} color={GOLD} />
                </View>
              );
            }
            if (crpSegs.has(i)) {
              return (
                <View key={i} style={[tl.markerIcon, { left: segX - 5 }]}>
                  <View style={tl.crpDot} />
                </View>
              );
            }
            return null;
          })}
        </View>
      )}

      {/* Labels row */}
      <View style={[tl.labels, { width: TW }]}>
        <Text style={tl.labelSide}>{fmtMin(anchorTime)}</Text>
        <Text style={tl.labelCenter}>{cycleLabel}</Text>
        <Text style={tl.labelSide} numberOfLines={1}>{fmtMin(bedtime)}</Text>
      </View>

    </View>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const tl = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    marginTop:         14,
    gap:               4,
  },
  iconRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   4,
  },
  segRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           0,        // gaps handled per-segment via width calc
    height:        SEGMENT_H + 16, // extra for cursor
    position:      'relative',
    // Use rowGap via gap on outer if needed; we lay segments manually
    flexWrap:      'nowrap',
  },
  seg: {
    height:       SEGMENT_H,
    borderRadius: SEGMENT_R,
    // width set inline
    // marginRight set via GAP calc
  },
  cursor: {
    position:        'absolute',
    top:             (SEGMENT_H + 16 - 16) / 2,
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: CURSOR_WHITE,
    shadowColor:     CURSOR_WHITE,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    10,
    elevation:       8,
  },
  markerBelow: {
    position: 'relative',
    height:   14,
  },
  markerIcon: {
    position: 'absolute',
    top:      0,
  },
  crpDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    borderWidth:  1.5,
    borderColor:  GOLD,
  },
  labels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:       4,
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
