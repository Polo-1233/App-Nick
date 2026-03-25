/**
 * RhythmTimeline — v3 Premium Redesign
 *
 * Shows the FULL day as a continuous rhythm track.
 * The active cycle is visually dominant. Past recedes. Future is quiet.
 *
 * Visual hierarchy:
 *   NOW  = tall segment, bright fill, glow cursor, time label
 *   NEXT = normal height, subtle border, softer
 *   PAST = shorter, faded, no border
 *
 * Structure:
 *   [wake time]                    [sleep time]
 *   [░░░░|████▌░░░░|░░░░|░░░░|░░░░]   ← all cycles, cursor at now
 *        ↑ active with progress fill
 *   [Cycle 3 of 5 · 42 min left]
 *
 * Tap → opens FullClockView
 */

import { useEffect, useRef, useState, memo } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme-context';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, CYCLE } from '../../lib/rhythm-clock';
import { spacing } from '../../lib/design-tokens';
import { FullClockView } from './FullClockView';

// ─── Layout tuning ────────────────────────────────────────────────────────────

/** Height of a normal (inactive) segment */
const SEG_H_NORMAL = 14;

/** Height of the active segment — taller = more dominant */
const SEG_H_ACTIVE = 22;

/** Height of past segments — shorter = receding */
const SEG_H_PAST = 10;

/** Gap between segments */
const GAP = 3;

/** Corner radius for segments */
const SEG_R = 5;

/** Cursor line width */
const CURSOR_W = 2.5;

/** Cursor glow spread */
const CURSOR_GLOW_W = 12;

interface RhythmTimelineProps {
  wakeMin:     number;
  idealCycles: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RhythmTimeline = memo(function RhythmTimeline({
  wakeMin, idealCycles,
}: RhythmTimelineProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const W  = Dimensions.get('window').width;
  const TW = W - spacing.screen * 2;

  const [clockOpen, setClockOpen] = useState(false);
  const [tappedSeg, setTappedSeg] = useState<number | null>(null);
  const [data, setData] = useState(() => computeRhythmData(nowMin(), wakeMin, idealCycles));

  useEffect(() => {
    const tick = () => setData(computeRhythmData(nowMin(), wakeMin, idealCycles));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [wakeMin, idealCycles]);

  // ── Cursor pulse ──────────────────────────────────────────────────────────
  const glowOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1,   duration: 1200, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowOpacity]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { segments, currentIdx, totalCycles, wakeMin: wake, bedtimeMin } = data;
  const isActive     = currentIdx >= 0 && currentIdx < totalCycles;
  const currentSeg   = isActive ? segments[currentIdx] : null;
  const elapsed      = currentSeg ? ((data.nowMin - currentSeg.startMin + 1440) % 1440) : 0;
  const progress     = Math.max(0, Math.min(1, elapsed / CYCLE));
  const remaining    = isActive ? Math.max(0, CYCLE - elapsed) : 0;

  // ── Segment widths ────────────────────────────────────────────────────────
  // All segments share the track width equally
  const totalGaps = (totalCycles - 1) * GAP;
  const segW      = Math.max(8, (TW - totalGaps) / totalCycles);

  // ── Cursor X position ─────────────────────────────────────────────────────
  const cursorX = isActive
    ? currentIdx * (segW + GAP) + progress * segW
    : -100;

  // ── Labels ────────────────────────────────────────────────────────────────
  const statusLabel = isActive
    ? `Cycle ${currentIdx + 1} of ${totalCycles} · ${Math.round(remaining)} min left`
    : currentIdx < 0
      ? 'Day starts soon'
      : 'Day complete';

  // ── MRM / CRP event chips ─────────────────────────────────────────────────
  // Collect upcoming events to show below the status line (cleaner than floating badge)
  type EventChip = { type: 'mrm' | 'crp'; label: string; segIdx: number };
  const eventChips: EventChip[] = [];

  if (isActive) {
    const minsToMRM = 80 - elapsed;
    if (minsToMRM > 0 && minsToMRM <= 25 && currentSeg?.hasMRM) {
      eventChips.push({ type: 'mrm', segIdx: currentIdx, label: `MRM in ${Math.round(minsToMRM)}m` });
    }
    const crpSeg = segments.find((s, i) => s.isCRP && i >= currentIdx && !s.isPast);
    if (crpSeg) {
      const minsTo = ((crpSeg.startMin - data.nowMin) + 1440) % 1440;
      if (minsTo < 180) {
        eventChips.push({ type: 'crp', segIdx: crpSeg.index, label: minsTo <= 0 ? 'CRP now' : `CRP in ${Math.round(minsTo)}m` });
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Pressable onPress={() => setClockOpen(true)} style={tl.outer}>

        {/* ── Time anchors ── */}
        <View style={tl.timeRow}>
          <View style={tl.timeAnchor}>
            <Ionicons name="sunny" size={11} color={c.gold} style={{ marginRight: 3 }} />
            <Text style={[tl.timeLabel, { color: c.textMuted }]}>{fmtMin(wake)}</Text>
          </View>
          <Text style={[tl.tapHint, { color: c.accent }]}>Full day ›</Text>
          <View style={tl.timeAnchor}>
            <Text style={[tl.timeLabel, { color: c.textMuted }]}>{fmtMin(bedtimeMin)}</Text>
            <Ionicons name="moon" size={10} color={c.purple} style={{ marginLeft: 3 }} />
          </View>
        </View>

        {/* ── Track — all cycles ── */}
        <View style={[tl.track, { width: TW, height: SEG_H_ACTIVE + 8 }]}>

          {/* Segments */}
          {segments.map((seg, i) => {
            const isCurr = i === currentIdx && isActive;
            const isPast = seg.isPast || (!isActive && currentIdx >= totalCycles);
            const isFuture = !isCurr && !isPast;

            // Dynamic height: past < normal < active
            const h = isCurr ? SEG_H_ACTIVE : isPast ? SEG_H_PAST : SEG_H_NORMAL;
            // Vertical centering within the track
            const top = (SEG_H_ACTIVE + 8 - h) / 2;
            // Horizontal position
            const left = i * (segW + GAP);

            // Color treatment
            const bgColor = isCurr
              ? `${c.accent}25`
              : isPast
                ? `${c.accent}15`
                : `${c.accent}0A`;

            const borderColor = isCurr
              ? c.accent
              : isFuture
                ? `${c.accent}20`
                : 'transparent';

            const borderW = isCurr ? 1.5 : isFuture ? 1 : 0;

            // CRP and sleep get subtle color hints
            const isSpecial = seg.isCRP && !isPast;
            const isSleep   = seg.isSleep && !isPast;
            const specialBg = isSpecial ? `${c.gold}15` : isSleep ? `${c.purple}12` : null;

            // Tooltip info
            const segTime = fmtMin(seg.startMin);
            const segLabel = seg.isCRP ? 'CRP recovery' : seg.isSleep ? 'Sleep window' : seg.hasMRM ? `Cycle ${i + 1} · MRM` : `Cycle ${i + 1}`;

            return (
              <Pressable
                key={i}
                onPress={() => setTappedSeg(tappedSeg === i ? null : i)}
                style={{
                  position: 'absolute',
                  left,
                  top: 0,
                  width: segW,
                  height: SEG_H_ACTIVE + 8,
                }}
              >
                {/* Tooltip */}
                {tappedSeg === i && (
                  <View style={[tl.tooltip, { bottom: SEG_H_ACTIVE + 10 }]}>
                    <Text style={[tl.tooltipTime, { color: c.accent }]}>{segTime}</Text>
                    <Text style={[tl.tooltipLabel, { color: c.textMuted }]}>{segLabel}</Text>
                  </View>
                )}
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: top,
                    width: segW,
                    height: h,
                    borderRadius: SEG_R,
                    backgroundColor: specialBg ?? bgColor,
                    borderWidth: borderW,
                    borderColor,
                    overflow: 'hidden',
                  }}
                >
                {/* Progress fill — only on active segment */}
                {isCurr && (
                  <View style={{
                    position: 'absolute',
                    top: 0, bottom: 0, left: 0,
                    width: `${progress * 100}%` as any,
                    backgroundColor: c.accent,
                    opacity: 0.35,
                    borderRadius: SEG_R - 1,
                  }} />
                )}

                {/* CRP flash icon — centered in segment */}
                {isSpecial && (
                  <View style={tl.segIcon}>
                    <Ionicons name="flash" size={8} color={c.gold} style={{ opacity: 0.6 }} />
                  </View>
                )}

                {/* Sleep moon icon — centered in segment */}
                {isSleep && (
                  <View style={tl.segIcon}>
                    <Ionicons name="moon" size={8} color={c.purple} style={{ opacity: 0.5 }} />
                  </View>
                )}
              </View>
              </Pressable>
            );
          })}

          {/* ── Cursor — refined vertical line with glow ── */}
          {isActive && cursorX >= 0 && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: cursorX - CURSOR_GLOW_W / 2,
                top: 0,
                bottom: 0,
                width: CURSOR_GLOW_W,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Glow — soft pulse */}
              <Animated.View style={{
                position: 'absolute',
                width: CURSOR_GLOW_W,
                height: SEG_H_ACTIVE + 8,
                borderRadius: CURSOR_GLOW_W / 2,
                backgroundColor: c.accent,
                opacity: glowOpacity.interpolate({
                  inputRange: [0.4, 1],
                  outputRange: [0.06, 0.15],
                }),
              }} />

              {/* Line — sharp, high contrast */}
              <View style={{
                width: CURSOR_W,
                height: SEG_H_ACTIVE + 4,
                borderRadius: CURSOR_W / 2,
                backgroundColor: '#FFFFFF',
                shadowColor: c.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 4,
                elevation: 6,
              }} />

              {/* Top dot — small accent cap */}
              <View style={{
                position: 'absolute',
                top: -1,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#FFFFFF',
                shadowColor: c.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 4,
                elevation: 8,
              }} />
            </View>
          )}

          {/* marker badges removed — events shown below status line */}
        </View>

        {/* ── Status line ── */}
        <Text style={[tl.statusLabel, { color: c.textMuted }]}>{statusLabel}</Text>

        {/* ── Event chips — MRM / CRP ── */}
        {eventChips.length > 0 && (
          <View style={tl.eventRow}>
            {eventChips.map((chip) => {
              const isCRP = chip.type === 'crp';
              const chipColor = isCRP ? c.gold : '#F59E0B'; // amber for MRM
              return (
                <View
                  key={chip.type}
                  style={[
                    tl.eventChip,
                    {
                      backgroundColor: isCRP ? `${c.gold}22` : '#F59E0B22',
                      borderColor:     isCRP ? `${c.gold}55` : '#F59E0B55',
                    },
                  ]}
                >
                  <Ionicons
                    name={isCRP ? 'flash' : 'bed'}
                    size={10}
                    color={chipColor}
                  />
                  <Text style={[tl.eventChipText, { color: chipColor }]}>
                    {chip.label}
                  </Text>
                </View>
              );
            })}
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
    paddingHorizontal: spacing.screen,
    marginTop:         12,
    gap:               4,
  },

  // Time anchors row
  timeRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   4,
  },
  timeAnchor: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  timeLabel: {
    fontSize:   11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tapHint: {
    fontSize:   11,
    fontWeight: '600',
  },

  // Track container
  track: {
    position: 'relative',
  },

  // Icon centered in special segments
  segIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Event chips row (MRM / CRP — below status line)
  eventRow: {
    flexDirection: 'row',
    gap:           6,
    marginTop:     2,
  },
  eventChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius:    20,
    borderWidth:     1,
  },
  eventChipText: {
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.1,
  },

  // Status label
  statusLabel: {
    fontSize:      13,
    fontWeight:    '500',
    letterSpacing: -0.1,
  },

  // Tooltip (on segment tap)
  tooltip: {
    position:        'absolute',
    alignSelf:       'center',
    backgroundColor: '#141466',
    borderRadius:    8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth:     1,
    borderColor:     'rgba(28,159,218,0.20)',
    alignItems:      'center',
    zIndex:          100,
    minWidth:        60,
  },
  tooltipTime: {
    fontSize:   11,
    fontWeight: '700',
  },
  tooltipLabel: {
    fontSize:   9,
    fontWeight: '600',
  },
});
