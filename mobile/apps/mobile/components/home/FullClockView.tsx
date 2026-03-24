/**
 * FullClockView — R90 Technique Clock
 *
 * Inspired by the official R90 methodology diagram:
 *   - Outer ring: dark navy, divided into N cycle segments (gaps between)
 *   - Inner ring: thinner dark navy, full circle
 *   - Cyan arc: current cycle progress (you are here)
 *   - Center: current time + "R90" + cycle label
 *   - Tap segment → tooltip
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, CYCLE } from '../../lib/rhythm-clock';
import { getEnergyMap, type PeakPreference } from '../../lib/energy-model';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const NAVY        = '#141466';
const NAVY_DIM    = 'rgba(20,20,102,0.18)';
const NAVY_MED    = 'rgba(20,20,102,0.55)';
const CYAN        = '#1c9fda';
const CYAN_DIM    = 'rgba(28,159,218,0.15)';
const TEXT_MAIN   = '#002060';
const TEXT_MUTED  = '#5A7A9A';
const TEXT_FAINT  = '#9BB5CC';
const GOLD        = '#D97706';
const PURPLE      = '#8B5CF6';
const BG          = '#F7FAFF';

// ─── Layout ───────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const SIZE      = SW - 80;
const R         = SIZE / 2;
const CX        = R;
const CY        = R;

// Outer ring (cycle segments)
const R_OUT_O   = R - 2;
const R_OUT_I   = R - 38;
const R_OUT_MID = (R_OUT_O + R_OUT_I) / 2;
const OUT_THICK = R_OUT_O - R_OUT_I;

// Inner ring (progress arc)
const R_IN_O    = R_OUT_I - 12;
const R_IN_I    = R_IN_O - 22;
const R_IN_MID  = (R_IN_O + R_IN_I) / 2;
const IN_THICK  = R_IN_O - R_IN_I;

const DAY_MIN   = 24 * 60;
const SEG_GAP   = 7;   // gap in degrees between segments

// ─── Math helpers ─────────────────────────────────────────────────────────────

function degToRad(d: number) { return (d - 90) * (Math.PI / 180); }

function polar(r: number, deg: number) {
  const rad = degToRad(deg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function minToDeg(wakeMin: number, t: number): number {
  return (((t - wakeMin) + DAY_MIN) % DAY_MIN / DAY_MIN) * 360;
}

// ─── Arc renderer ─────────────────────────────────────────────────────────────
// Renders a filled arc using 2° radial line chunks — no SVG needed.

interface ArcProps {
  startDeg: number;
  spanDeg:  number;
  rOuter:   number;
  rInner:   number;
  color:    string;
  opacity?: number;
}

function Arc({ startDeg, spanDeg, rOuter, rInner, color, opacity = 1 }: ArcProps) {
  if (spanDeg <= 0) return null;
  const STEP  = 1;   // 1° steps → no visible gaps
  const count = Math.ceil(spanDeg / STEP);
  const thick = rOuter - rInner;
  const rMid  = rInner + thick / 2;
  // Chunk width = chord length for STEP degrees + 1px overlap buffer
  const chunkW = Math.max(4, 2 * rMid * Math.sin((STEP * Math.PI) / 180) + 2);

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const deg = startDeg + i * STEP + STEP / 2;
        const pt  = polar(rMid, deg);
        return (
          <View
            key={i}
            style={{
              position:        'absolute',
              left:            pt.x - chunkW / 2,
              top:             pt.y - thick / 2,
              width:           chunkW,
              height:          thick,
              backgroundColor: color,
              opacity,
              transform:       [{ rotate: `${deg}deg` }],
            }}
          />
        );
      })}
    </>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FullClockViewProps {
  visible:         boolean;
  onClose:         () => void;
  wakeMin:         number;
  idealCycles:     number;
  peakPreference?: PeakPreference;
}

interface TooltipData { text: string; sub: string; x: number; y: number }

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FullClockView({
  visible, onClose, wakeMin, idealCycles, peakPreference = 'morning',
}: FullClockViewProps) {
  const [data,    setData]    = useState(() => computeRhythmData(nowMin(), wakeMin, idealCycles));
  const [timeStr, setTime]    = useState(() => fmtMin(nowMin()));
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

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
        Animated.timing(pulse, { toValue: 1.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  // Full day = 16 cycles of 90 min (24h ÷ 90 = 16)
  const FULL_DAY_CYCLES = 16;
  const fullData    = computeRhythmData(nowMin(), wakeMin, FULL_DAY_CYCLES);
  const { segments, currentIdx } = fullData;
  const totalCycles = FULL_DAY_CYCLES;

  const energyMap  = getEnergyMap(totalCycles, peakPreference);
  const now        = nowMin();

  const isActive   = currentIdx >= 0 && currentIdx < totalCycles;
  const currentSeg = isActive ? segments[currentIdx] : null;
  const elapsed    = currentSeg ? ((now - currentSeg.startMin + 1440) % 1440) : 0;
  const progressPct = Math.min(1, elapsed / CYCLE);

  // For labels, use idealCycles from props
  const userCycleLabel = isActive
    ? `Cycle ${currentIdx + 1} · ${idealCycles} sleep cycles`
    : currentIdx < 0 ? `${idealCycles} sleep cycles planned` : 'Day complete';

  const remaining = isActive ? Math.max(0, CYCLE - elapsed) : 0;

  // 16 equal segments → 22.5° each
  const segDeg = 360 / FULL_DAY_CYCLES;

  // Cursor position in ring
  const clampedIdx = currentIdx >= totalCycles ? totalCycles - 1 : Math.max(0, currentIdx);
  const nowDeg     = isActive
    ? clampedIdx * segDeg + progressPct * segDeg
    : clampedIdx * segDeg;

  // Inner arc: progress within current cycle
  const innerArcStart = isActive ? clampedIdx * segDeg : 0;
  const innerArcSpan  = isActive ? progressPct * segDeg : 0;

  // Sleep window indices (last idealCycles cycles of the day = sleep)
  const sleepStartIdx = FULL_DAY_CYCLES - idealCycles;

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

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Clock ── */}
          <Pressable onPress={() => setTooltip(null)} style={s.clockWrap}>
            <View style={{ width: SIZE, height: SIZE }}>

              {/* ── Base rings (dim background) ── */}
              {/* Outer ring base */}
              <View style={s.outerRingBg} />
              {/* Inner ring base */}
              <View style={s.innerRingBg} />

              {/* ── Outer ring: cycle segments — full 360° ── */}
              {segments.map((seg, i) => {
                const startDeg  = i * segDeg + SEG_GAP / 2;
                const spanDeg   = segDeg - SEG_GAP;

                const isCurr  = seg.isCurrent && isActive;
                const isPast  = seg.isPast || (!isActive && currentIdx >= totalCycles);
                const isSleep = i >= sleepStartIdx;
                const energy  = energyMap[i];

                const color   = isSleep ? `rgba(10,24,64,0.9)` : NAVY;
                const opacity = isCurr
                  ? 1
                  : isPast
                    ? 0.55
                    : isSleep
                      ? 0.30
                      : energy?.level === 'low'
                        ? 0.15
                        : energy?.level === 'high'
                          ? 0.45
                          : 0.28;

                const midDeg  = i * segDeg + segDeg / 2;

                return (
                  <Pressable
                    key={i}
                    style={{ position: 'absolute', width: SIZE, height: SIZE }}
                    onPress={() => {
                      const pt = polar(R_OUT_MID, midDeg);
                      const label = isCurr
                        ? 'Current cycle'
                        : isPast
                          ? 'Completed'
                          : energy?.tooltip ?? 'Upcoming cycle';
                      setTooltip({
                        text: label,
                        sub:  `Cycle ${i + 1} · ${fmtMin(seg.startMin)} → ${fmtMin(seg.endMin)}`,
                        x:    pt.x,
                        y:    pt.y,
                      });
                    }}
                  >
                    <Arc
                      startDeg={startDeg}
                      spanDeg={spanDeg}
                      rOuter={R_OUT_O}
                      rInner={R_OUT_I}
                      color={color}
                      opacity={opacity}
                    />
                  </Pressable>
                );
              })}

              {/* ── Inner ring: cyan progress arc ── */}
              {isActive && innerArcSpan > 0 && (
                <Arc
                  startDeg={innerArcStart}
                  spanDeg={innerArcSpan}
                  rOuter={R_IN_O}
                  rInner={R_IN_I}
                  color={CYAN}
                  opacity={1}
                />
              )}

              {/* ── Cursor dot at current position (outer ring) ── */}
              {isActive && (() => {
                const pt = polar(R_OUT_MID, nowDeg);
                return (
                  <>
                    <Animated.View
                      pointerEvents="none"
                      style={[s.cursorRing, {
                        left:      pt.x - 9,
                        top:       pt.y - 9,
                        transform: [{ scale: pulse }],
                      }]}
                    />
                    <View
                      pointerEvents="none"
                      style={[s.cursorDot, { left: pt.x - 5, top: pt.y - 5 }]}
                    />
                  </>
                );
              })()}

              {/* ── Wake marker (top = 0°) ── */}
              {(() => {
                const pt = polar(R_OUT_O + 18, 0);
                return (
                  <View style={[s.markerWrap, { left: pt.x - 10, top: pt.y - 10 }]}>
                    <Ionicons name="sunny" size={16} color={GOLD} />
                  </View>
                );
              })()}

              {/* ── Sleep marker — début du bloc sommeil ── */}
              {(() => {
                const sleepDeg = sleepStartIdx * segDeg;
                const pt       = polar(R_OUT_O + 16, sleepDeg);
                return (
                  <View style={[s.markerWrap, { left: pt.x - 8, top: pt.y - 8 }]}>
                    <Ionicons name="moon" size={13} color={PURPLE} />
                  </View>
                );
              })()}

              {/* ── Center ── */}
              <View style={s.center} pointerEvents="none">
                <Text style={s.timeStr}>{timeStr}</Text>
                <Text style={s.r90Label}>R90</Text>
                <Text style={s.cycleLabel}>{userCycleLabel}</Text>
                {remaining > 0 && (
                  <Text style={s.remaining}>{Math.round(remaining)} min left</Text>
                )}
              </View>

              {/* ── Tooltip ── */}
              {tooltip && (
                <Pressable
                  onPress={() => setTooltip(null)}
                  style={[s.tooltip, {
                    left: Math.max(8, Math.min(SIZE - 170, tooltip.x - 80)),
                    top:  Math.max(8, Math.min(SIZE - 72,  tooltip.y - 46)),
                  }]}
                >
                  <Text style={s.tooltipText}>{tooltip.text}</Text>
                  <Text style={s.tooltipSub}>{tooltip.sub}</Text>
                </Pressable>
              )}

            </View>
          </Pressable>

          {/* ── Cycle list ── */}
          <View style={s.cycleList}>
            {segments.map((seg, i) => {
              const isCurr  = seg.isCurrent && isActive;
              const energy  = energyMap[i];
              return (
                <View key={i} style={[s.cycleRow, isCurr && s.cycleRowActive]}>
                  <View style={[s.cycleDot, { backgroundColor: isCurr ? CYAN : NAVY_DIM }]} />
                  <Text style={[s.cycleTime, isCurr && { color: CYAN, fontWeight: '700' }]}>
                    {fmtMin(seg.startMin)} — {fmtMin(seg.endMin)}
                  </Text>
                  <Text style={s.cycleMeta}>
                    {i >= sleepStartIdx ? 'Sleep' : seg.isCRP ? 'CRP' : `Cycle ${i + 1}`}
                  </Text>
                  {energy && !seg.isPast && (
                    <View style={[s.energyDot, {
                      backgroundColor:
                        energy.level === 'high'    ? CYAN :
                        energy.level === 'neutral' ? NAVY_DIM : 'transparent',
                      borderWidth:   energy.level === 'low' ? 1 : 0,
                      borderColor:   NAVY_DIM,
                    }]} />
                  )}
                  {seg.hasMRM && !seg.isPast && (
                    <View style={s.mrmBadge}>
                      <Text style={s.mrmTxt}>MRM</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  title:  { fontSize: 18, fontWeight: '700', color: TEXT_MAIN },
  scroll: { alignItems: 'center', paddingBottom: 48 },

  clockWrap: { marginTop: 8 },

  // Background rings
  outerRingBg: {
    position:     'absolute',
    left:         R - R_OUT_O,
    top:          R - R_OUT_O,
    width:        R_OUT_O * 2,
    height:       R_OUT_O * 2,
    borderRadius: R_OUT_O,
    borderWidth:  OUT_THICK,
    borderColor:  NAVY_DIM,
  },
  innerRingBg: {
    position:     'absolute',
    left:         R - R_IN_O,
    top:          R - R_IN_O,
    width:        R_IN_O * 2,
    height:       R_IN_O * 2,
    borderRadius: R_IN_O,
    borderWidth:  IN_THICK,
    borderColor:  NAVY_DIM,
  },

  // Cursor
  cursorRing: {
    position:     'absolute',
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  1.5,
    borderColor:  CYAN,
    opacity:      0.5,
  },
  cursorDot: {
    position:        'absolute',
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: CYAN,
    shadowColor:     CYAN,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.9,
    shadowRadius:    6,
    elevation:       8,
  },

  markerWrap: { position: 'absolute' },

  // Center
  center: {
    position:   'absolute',
    left:       R - 72,
    top:        R - 52,
    width:      144,
    alignItems: 'center',
    gap:        2,
  },
  timeStr:    { fontSize: 38, fontWeight: '800', color: TEXT_MAIN, letterSpacing: -1 },
  r90Label:   { fontSize: 11, fontWeight: '800', color: CYAN, letterSpacing: 3, textTransform: 'uppercase' },
  cycleLabel: { fontSize: 12, fontWeight: '600', color: TEXT_MUTED, textAlign: 'center' },
  remaining:  { fontSize: 11, color: TEXT_FAINT, marginTop: 2 },

  // Tooltip
  tooltip: {
    position:        'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    padding:         10,
    minWidth:        150,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.10,
    shadowRadius:    12,
    elevation:       8,
    borderWidth:     1,
    borderColor:     CYAN_DIM,
  },
  tooltipText: { fontSize: 13, fontWeight: '700', color: TEXT_MAIN },
  tooltipSub:  { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },

  // Cycle list
  cycleList:     { width: '100%', paddingHorizontal: 24, marginTop: 28, gap: 0 },
  cycleRow:      {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingVertical:   11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(20,20,102,0.08)',
  },
  cycleRowActive: {
    backgroundColor: `${CYAN}0D`,
    borderRadius:    10,
    paddingHorizontal: 8,
    marginHorizontal:  -8,
  },
  cycleDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  cycleTime:  { fontSize: 13, color: TEXT_MUTED, flex: 1 },
  cycleMeta:  { fontSize: 12, color: TEXT_FAINT },
  energyDot:  { width: 7, height: 7, borderRadius: 4, marginLeft: 4 },
  mrmBadge:   { backgroundColor: CYAN_DIM, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
  mrmTxt:     { fontSize: 10, fontWeight: '700', color: CYAN },
});
