/**
 * FullClockView — R90 Day Clock
 *
 * Design: single ring, light blue, divided into 90-min cycles.
 * Center: current time + cycle info.
 * Each segment = 1 cycle. Gaps = separators.
 * Current cycle = full accent. Past = faded. Future = dim outline.
 * Cursor dot = current position in the ring.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, CYCLE } from '../../lib/rhythm-clock';
import { getEnergyMap, type PeakPreference } from '../../lib/energy-model';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const ACCENT      = '#1c9fda';
const ACCENT_DIM  = 'rgba(28,159,218,0.22)';
const ACCENT_PAST = 'rgba(28,159,218,0.50)';
const ACCENT_RING = 'rgba(28,159,218,0.10)';
const GOLD        = '#D97706';
const PURPLE      = '#8B5CF6';
const TEXT_MAIN   = '#002060';
const TEXT_MUTED  = '#5A7A9A';
const TEXT_FAINT  = '#9BB5CC';
const WHITE       = '#FFFFFF';
const BG          = '#F0F8FF';

// ─── Layout ───────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const SIZE    = SW - 64;          // ring outer diameter
const R       = SIZE / 2;         // outer radius
const THICK   = 36;               // ring thickness
const R_INNER = R - THICK;        // inner radius
const CX      = R;
const CY      = R;
const DAY_MIN = 24 * 60;
const GAP_DEG = 3;                // gap between segments in degrees

// ─── Math ─────────────────────────────────────────────────────────────────────

function degToRad(d: number) { return (d - 90) * (Math.PI / 180); }

function polar(r: number, deg: number) {
  const rad = degToRad(deg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

// Convert a time (minutes since midnight) to an angle on the ring
// 0° = top = wakeMin. Full 360° = 24h.
function minToDeg(wakeMin: number, t: number): number {
  return (((t - wakeMin) + DAY_MIN) % DAY_MIN / DAY_MIN) * 360;
}

// ─── Segment renderer ─────────────────────────────────────────────────────────
// We render each segment as a series of thin radial lines (2° each).
// This avoids SVG and works natively.

interface SegmentProps {
  startDeg: number;
  endDeg:   number;
  color:    string;
  opacity:  number;
  onPress?: () => void;
}

function Segment({ startDeg, endDeg, color, opacity, onPress }: SegmentProps) {
  const span = ((endDeg - startDeg) + 360) % 360;
  if (span <= 0) return null;

  const STEP  = 2;
  const count = Math.ceil(span / STEP);
  const w     = THICK + 2;

  const lines = Array.from({ length: count }, (_, i) => {
    const deg = startDeg + i * STEP + STEP / 2;
    const pt  = polar(R_INNER + w / 2, deg);
    return (
      <View
        key={i}
        style={{
          position:        'absolute',
          left:            pt.x - 2,
          top:             pt.y - w / 2,
          width:           4,
          height:          w,
          backgroundColor: color,
          opacity,
          borderRadius:    2,
          transform:       [{ rotate: `${deg}deg` }],
        }}
      />
    );
  });

  if (onPress) {
    const midDeg = startDeg + span / 2;
    const pt     = polar(R_INNER + THICK / 2, midDeg);
    return (
      <>
        {lines}
        <Pressable
          onPress={onPress}
          style={{
            position:     'absolute',
            left:         pt.x - 20,
            top:          pt.y - 20,
            width:        40,
            height:       40,
            borderRadius: 20,
          }}
        />
      </>
    );
  }

  return <>{lines}</>;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipData { text: string; sub: string; x: number; y: number }

// ─── Props ────────────────────────────────────────────────────────────────────

interface FullClockViewProps {
  visible:         boolean;
  onClose:         () => void;
  wakeMin:         number;
  idealCycles:     number;
  peakPreference?: PeakPreference;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FullClockView({
  visible, onClose, wakeMin, idealCycles, peakPreference = 'morning',
}: FullClockViewProps) {
  const [data,    setData]    = useState(() => computeRhythmData(nowMin(), wakeMin, idealCycles));
  const [timeStr, setTime]    = useState(() => fmtMin(nowMin()));
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Cursor pulse
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const refresh = () => {
      setData(computeRhythmData(nowMin(), wakeMin, idealCycles));
      setTime(fmtMin(nowMin()));
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [visible, wakeMin, idealCycles]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.8, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  const { segments, totalCycles, currentIdx } = data;
  const energyMap = getEnergyMap(totalCycles, peakPreference);
  const now       = nowMin();
  const nowDeg    = minToDeg(wakeMin, now);
  const cursorPt  = polar(R_INNER + THICK / 2, nowDeg);

  // Cycle progress label
  const isActive   = currentIdx >= 0 && currentIdx < totalCycles;
  const cycleLabel = isActive
    ? `Cycle ${currentIdx + 1} of ${totalCycles}`
    : currentIdx < 0 ? `${totalCycles} cycles today` : 'Day complete';

  const currentSeg = isActive ? segments[currentIdx] : null;
  const elapsed    = currentSeg ? ((now - currentSeg.startMin + 1440) % 1440) : 0;
  const remaining  = isActive ? Math.max(0, CYCLE - elapsed) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.root} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Day View</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={TEXT_MUTED} />
          </Pressable>
        </View>

        {/* Clock */}
        <View style={s.clockWrap}>
          <Pressable onPress={() => setTooltip(null)}>
            <View style={{ width: SIZE, height: SIZE }}>

              {/* Base ring (faint background) */}
              <View style={s.ringBg} />

              {/* Segments */}
              {segments.map((seg, i) => {
                const startDeg = minToDeg(wakeMin, seg.startMin) + GAP_DEG / 2;
                const rawEnd   = minToDeg(wakeMin, seg.endMin);
                const endDeg   = rawEnd - GAP_DEG / 2;

                const energy  = energyMap[i];
                const isCurr  = seg.isCurrent && isActive;
                const isPast  = seg.isPast || (!isActive && currentIdx >= totalCycles);
                const isSleep = seg.isSleep;

                const color = isSleep
                  ? `rgba(10,24,64,0.7)`
                  : ACCENT;

                const opacity = isSleep
                  ? 0.5
                  : isCurr
                    ? 1
                    : isPast
                      ? 0.45
                      : energy?.level === 'high'
                        ? 0.65
                        : energy?.level === 'low'
                          ? 0.20
                          : 0.38;

                return (
                  <Segment
                    key={i}
                    startDeg={startDeg}
                    endDeg={endDeg}
                    color={color}
                    opacity={opacity}
                    onPress={() => {
                      const midDeg = startDeg + ((endDeg - startDeg) / 2);
                      const pt     = polar(R - 8, midDeg);
                      const label  = isSleep
                        ? 'Sleep window'
                        : isCurr
                          ? 'You are here'
                          : isPast
                            ? 'Completed cycle'
                            : energy?.tooltip ?? 'Upcoming cycle';
                      const sub = `Cycle ${i + 1} · ${fmtMin(seg.startMin)} → ${fmtMin(seg.endMin)}`;
                      setTooltip({ text: label, sub, x: pt.x, y: pt.y });
                    }}
                  />
                );
              })}

              {/* Cursor dot + pulse ring */}
              {isActive && (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[s.cursorRing, {
                      left:      cursorPt.x - 10,
                      top:       cursorPt.y - 10,
                      transform: [{ scale: pulse }],
                    }]}
                  />
                  <View
                    pointerEvents="none"
                    style={[s.cursorDot, {
                      left: cursorPt.x - 6,
                      top:  cursorPt.y - 6,
                    }]}
                  />
                </>
              )}

              {/* Wake marker — sun at top */}
              {(() => {
                const pt = polar(R - THICK / 2, 0);
                return (
                  <View style={[s.markerWrap, { left: pt.x - 10, top: pt.y - 10 }]}>
                    <Ionicons name="sunny" size={16} color={GOLD} />
                  </View>
                );
              })()}

              {/* Sleep marker — moon */}
              {(() => {
                const sleepDeg = minToDeg(wakeMin, segments[totalCycles - 1]?.startMin ?? 0);
                const pt       = polar(R - THICK / 2, sleepDeg);
                return (
                  <View style={[s.markerWrap, { left: pt.x - 8, top: pt.y - 8 }]}>
                    <Ionicons name="moon" size={13} color={PURPLE} />
                  </View>
                );
              })()}

              {/* Center */}
              <View style={s.center} pointerEvents="none">
                <Text style={s.timeStr}>{timeStr}</Text>
                <Text style={s.cycleLabel}>{cycleLabel}</Text>
                {isActive && remaining > 0 && (
                  <Text style={s.remaining}>{Math.round(remaining)} min left</Text>
                )}
              </View>

              {/* Tooltip */}
              {tooltip && (
                <Pressable
                  onPress={() => setTooltip(null)}
                  style={[s.tooltip, {
                    left: Math.max(8, Math.min(SIZE - 160, tooltip.x - 70)),
                    top:  Math.max(8, Math.min(SIZE - 70,  tooltip.y - 44)),
                  }]}
                >
                  <Text style={s.tooltipText}>{tooltip.text}</Text>
                  <Text style={s.tooltipSub}>{tooltip.sub}</Text>
                </Pressable>
              )}

            </View>
          </Pressable>

          {/* Legend */}
          <View style={s.legend}>
            {[
              { color: ACCENT,       opacity: 1,    label: 'Current cycle' },
              { color: ACCENT,       opacity: 0.45, label: 'Past cycles'   },
              { color: ACCENT,       opacity: 0.20, label: 'Low energy'    },
              { color: 'rgba(10,24,64,0.7)', opacity: 0.5, label: 'Sleep window' },
            ].map(({ color, opacity, label }) => (
              <View key={label} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: color, opacity }]} />
                <Text style={s.legendTxt}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Cycle list */}
          <View style={s.cycleList}>
            {segments.map((seg, i) => (
              <View key={i} style={[s.cycleRow, seg.isCurrent && isActive && s.cycleRowActive]}>
                <View style={[s.cycleDot, {
                  backgroundColor: seg.isCurrent && isActive ? ACCENT : TEXT_FAINT,
                }]} />
                <Text style={[s.cycleTime, seg.isCurrent && isActive && { color: ACCENT, fontWeight: '700' }]}>
                  {fmtMin(seg.startMin)} — {fmtMin(seg.endMin)}
                </Text>
                <Text style={s.cycleMeta}>
                  {seg.isSleep ? 'Sleep' : seg.isCRP ? 'CRP' : `Cycle ${i + 1}`}
                </Text>
                {seg.hasMRM && !seg.isPast && (
                  <View style={s.mrmBadge}><Text style={s.mrmBadgeTxt}>MRM</Text></View>
                )}
              </View>
            ))}
          </View>

        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title:  { fontSize: 18, fontWeight: '700', color: TEXT_MAIN },

  clockWrap: { alignItems: 'center', paddingBottom: 40 },

  // Ring background
  ringBg: {
    position:     'absolute',
    left:         R - R,
    top:          R - R,
    width:        SIZE,
    height:       SIZE,
    borderRadius: R,
    borderWidth:  THICK,
    borderColor:  ACCENT_DIM,
  },

  // Cursor
  cursorRing: {
    position:     'absolute',
    width:        20,
    height:       20,
    borderRadius: 10,
    borderWidth:  1.5,
    borderColor:  WHITE,
    opacity:      0.6,
  },
  cursorDot: {
    position:        'absolute',
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: WHITE,
    shadowColor:     ACCENT,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    8,
    elevation:       8,
  },

  // Markers
  markerWrap: { position: 'absolute' },

  // Center
  center: {
    position:       'absolute',
    left:           R - 70,
    top:            R - 40,
    width:          140,
    alignItems:     'center',
    gap:            4,
  },
  timeStr:    { fontSize: 36, fontWeight: '800', color: TEXT_MAIN, letterSpacing: -1 },
  cycleLabel: { fontSize: 13, fontWeight: '600', color: TEXT_MUTED },
  remaining:  { fontSize: 11, color: TEXT_FAINT },

  // Tooltip
  tooltip: {
    position:         'absolute',
    backgroundColor:  WHITE,
    borderRadius:     12,
    padding:          10,
    minWidth:         140,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.12,
    shadowRadius:     12,
    elevation:        8,
    borderWidth:      1,
    borderColor:      `${ACCENT}20`,
  },
  tooltipText: { fontSize: 13, fontWeight: '700', color: TEXT_MAIN },
  tooltipSub:  { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },

  // Legend
  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, marginTop: 20, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendTxt:  { fontSize: 12, color: TEXT_MUTED },

  // Cycle list
  cycleList:     { width: '100%', paddingHorizontal: 20, marginTop: 24, gap: 2 },
  cycleRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${ACCENT}15` },
  cycleRowActive:{ backgroundColor: `${ACCENT}08`, borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  cycleDot:      { width: 8, height: 8, borderRadius: 4 },
  cycleTime:     { fontSize: 13, color: TEXT_MUTED, flex: 1 },
  cycleMeta:     { fontSize: 12, color: TEXT_FAINT },
  mrmBadge:      { backgroundColor: `${ACCENT}18`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mrmBadgeTxt:   { fontSize: 10, fontWeight: '700', color: ACCENT },
});


