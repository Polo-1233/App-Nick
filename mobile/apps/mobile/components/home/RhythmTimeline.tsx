/**
 * RhythmTimeline — Redesigned v2
 *
 * Answers in 1 second:
 *   1. Where am I?        → cursor + current block highlighted
 *   2. What's coming?     → next 2 cycles visible
 *   3. What should I do?  → "Next: MRM in 12 min" label
 *
 * Structure:
 *   [Cycle label]           [tap hint]
 *   [████░░░░][░░░░░░][░░░░░]   ← blocks + cursor
 *   [markers row: MRM · CRP · 🌙]
 *   [Next action label]
 */

import { useEffect, useRef, useState, memo } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, CYCLE } from '../../lib/rhythm-clock';
import { FullClockView } from './FullClockView';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const ACCENT        = '#1c9fda';
const ACCENT_LIGHT  = 'rgba(28,159,218,0.18)';
const ACCENT_BORDER = 'rgba(28,159,218,0.40)';
const GOLD          = '#D97706';
const PURPLE        = '#8B5CF6';
const TEXT_PRIMARY  = '#002060';
const TEXT_MUTED    = '#5A7A9A';
const TEXT_FAINT    = '#9BB5CC';
const CURSOR_COLOR  = '#FFFFFF';

const SEG_H  = 18;   // taller blocks — more presence
const GAP    = 6;
const VISIBLE = 3;

interface RhythmTimelineProps {
  wakeMin:     number;
  idealCycles: number;
}

// ─── Next action label ────────────────────────────────────────────────────────
function getNextActionLabel(
  data:       ReturnType<typeof computeRhythmData>,
  wakeMin:    number,
  idealCycles:number,
): string | null {
  const { currentIdx, nowMin: now, totalCycles, segments } = data;

  if (currentIdx < 0) {
    const minsToWake = ((wakeMin - now) + 1440) % 1440;
    return `Wake up in ${minsToWake} min`;
  }

  if (currentIdx >= totalCycles) return 'Day complete — rest well tonight';

  const seg = segments[currentIdx];
  if (!seg) return null;

  const elapsed = ((now - seg.startMin) + 1440) % 1440;
  const remaining = CYCLE - elapsed;

  // MRM is at 80 min into cycle
  const minsToMRM = 80 - elapsed;
  if (minsToMRM > 0 && minsToMRM <= 20 && seg.hasMRM) {
    return `MRM in ${Math.round(minsToMRM)} min`;
  }

  // CRP
  if (seg.isCRP) {
    const minsIntoCRP = elapsed;
    if (minsIntoCRP < 30) return `CRP window open — ${Math.round(30 - minsIntoCRP)} min remaining`;
  }

  // End of current cycle
  if (remaining <= 20) {
    if (currentIdx === totalCycles - 1) {
      return `Sleep window in ${Math.round(remaining)} min`;
    }
    return `Next cycle in ${Math.round(remaining)} min`;
  }

  // Generic
  return `${Math.round(remaining)} min in cycle ${currentIdx + 1}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RhythmTimeline = memo(function RhythmTimeline({
  wakeMin, idealCycles,
}: RhythmTimelineProps) {
  const W  = Dimensions.get('window').width;
  const TW = W - 40;

  const [clockOpen, setClockOpen] = useState(false);
  const [data, setData] = useState(() => computeRhythmData(nowMin(), wakeMin, idealCycles));

  useEffect(() => {
    const id = setInterval(() => setData(computeRhythmData(nowMin(), wakeMin, idealCycles)), 30_000);
    return () => clearInterval(id);
  }, [wakeMin, idealCycles]);

  // Cursor pulse animation
  const pulseScale  = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale,   { toValue: 1.5, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0,   duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale,   { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseScale, pulseOpacity]);

  // ── Visible window ────────────────────────────────────────────────────────
  const { segments, currentIdx, totalCycles } = data;

  const clampedIdx = currentIdx >= totalCycles ? totalCycles - 1 : Math.max(0, currentIdx);
  const startIdx   = Math.max(0, Math.min(clampedIdx, totalCycles - VISIBLE));
  const endIdx     = Math.min(totalCycles - 1, startIdx + VISIBLE - 1);
  const visible    = segments.slice(startIdx, endIdx + 1);
  const visCount   = Math.max(1, visible.length);

  const segW = (TW - (visCount - 1) * GAP) / visCount;

  const isActiveCycle = currentIdx >= 0 && currentIdx < totalCycles;
  const currentSeg    = isActiveCycle ? segments[currentIdx] : null;
  const progressInCycle = currentSeg
    ? Math.max(0, Math.min(1, ((data.nowMin - currentSeg.startMin + 1440) % 1440) / 90))
    : 0;

  const cursorVisible = isActiveCycle && currentIdx >= startIdx && currentIdx <= endIdx;
  const cursorX = cursorVisible
    ? (currentIdx - startIdx) * (segW + GAP) + progressInCycle * segW
    : -100;

  // ── Labels ────────────────────────────────────────────────────────────────
  const cycleLabel = isActiveCycle
    ? `Cycle ${currentIdx + 1} / ${totalCycles}`
    : currentIdx < 0
      ? `${totalCycles} cycles today`
      : `Day complete`;

  const nextLabel = getNextActionLabel(data, wakeMin, idealCycles);

  return (
    <>
      <Pressable onPress={() => setClockOpen(true)} style={tl.outer}>

        {/* ── Top row: cycle label + tap hint ── */}
        <View style={tl.topRow}>
          <Text style={tl.cycleLabel}>{cycleLabel}</Text>
          <Text style={tl.tapHint}>Full view ›</Text>
        </View>

        {/* ── Blocks ── */}
        <View style={[tl.segRow, { width: TW }]}>
          {visible.map((seg, i) => {
            const isCurrent = seg.isCurrent && isActiveCycle;
            const isPast    = seg.isPast || (!isActiveCycle && currentIdx >= totalCycles);

            return (
              <View key={seg.index} style={[tl.segWrap, { marginRight: i < visCount - 1 ? GAP : 0 }]}>
                {/* Block */}
                <View style={[
                  tl.seg,
                  { width: segW },
                  isCurrent && tl.segCurrent,
                  !isCurrent && !isPast && tl.segFuture,
                  isPast && tl.segPast,
                ]}>
                  {/* Fill bar — progress inside current block */}
                  {isCurrent && (
                    <View style={[tl.segFill, { width: `${progressInCycle * 100}%` }]} />
                  )}
                </View>

                {/* Markers below block */}
                <View style={[tl.markers, { width: segW }]}>
                  {seg.hasMRM && !isPast && (
                    <View style={tl.mrmMarker}>
                      <View style={tl.mrmDot} />
                      <Text style={tl.markerLabel}>MRM</Text>
                    </View>
                  )}
                  {seg.isCRP && !isPast && (
                    <View style={tl.crpMarker}>
                      <Ionicons name="flash" size={9} color={GOLD} />
                      <Text style={[tl.markerLabel, { color: GOLD }]}>CRP</Text>
                    </View>
                  )}
                  {seg.isSleep && !isPast && (
                    <View style={tl.sleepMarker}>
                      <Ionicons name="moon" size={9} color={PURPLE} />
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Animated cursor */}
          {cursorVisible && (
            <View pointerEvents="none" style={[tl.cursorWrap, { left: cursorX - 7 }]}>
              {/* Pulse ring */}
              <Animated.View style={[
                tl.cursorRing,
                { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
              ]} />
              {/* Solid dot */}
              <View style={tl.cursorDot} />
            </View>
          )}
        </View>

        {/* ── Next action label ── */}
        {nextLabel && (
          <View style={tl.nextRow}>
            <View style={tl.nextDot} />
            <Text style={tl.nextLabel}>{nextLabel}</Text>
          </View>
        )}

      </Pressable>

      <FullClockView
        visible={clockOpen}
        onClose={() => setClockOpen(false)}
        wakeMin={wakeMin}
        idealCycles={idealCycles}
      />
    </>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const tl = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    marginTop:         20,
    gap:               8,
  },

  // Top row
  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   2,
  },
  cycleLabel: {
    fontSize:   15,
    fontWeight: '700',
    color:      TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  tapHint: {
    fontSize:   12,
    color:      ACCENT,
    fontWeight: '600',
  },

  // Segment row
  segRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    position:      'relative',
    paddingBottom: 20,  // space for markers
  },
  segWrap: {
    position: 'relative',
  },

  // Blocks
  seg: {
    height:       SEG_H,
    borderRadius: 9,
    overflow:     'hidden',
  },
  segCurrent: {
    backgroundColor: ACCENT_LIGHT,
    borderWidth:     1.5,
    borderColor:     ACCENT,
  },
  segFuture: {
    backgroundColor: 'rgba(28,100,160,0.10)',
    borderWidth:     1,
    borderColor:     ACCENT_BORDER,
  },
  segPast: {
    backgroundColor: 'rgba(28,159,218,0.35)',
    borderWidth:     0,
  },
  segFill: {
    position:        'absolute',
    top:             0, bottom: 0, left: 0,
    backgroundColor: ACCENT,
    borderRadius:    8,
    opacity:         0.85,
  },

  // Markers (below blocks)
  markers: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    alignItems:     'center',
    gap:            4,
    marginTop:      5,
    paddingRight:   2,
  },
  mrmMarker: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  mrmDot: {
    width:           5,
    height:          5,
    borderRadius:    3,
    backgroundColor: ACCENT,
    opacity:         0.7,
  },
  markerLabel: {
    fontSize:   8,
    fontWeight: '700',
    color:      TEXT_FAINT,
    letterSpacing: 0.3,
  },
  crpMarker: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  sleepMarker: {
    marginLeft: 2,
  },

  // Cursor
  cursorWrap: {
    position:        'absolute',
    top:             (SEG_H - 14) / 2,
    width:           14,
    height:          14,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cursorRing: {
    position:        'absolute',
    width:           14,
    height:          14,
    borderRadius:    7,
    borderWidth:     1.5,
    borderColor:     CURSOR_COLOR,
  },
  cursorDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: CURSOR_COLOR,
    shadowColor:     ACCENT,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    6,
    elevation:       8,
  },

  // Next action
  nextRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     2,
  },
  nextDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: ACCENT,
  },
  nextLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      TEXT_MUTED,
  },
});
