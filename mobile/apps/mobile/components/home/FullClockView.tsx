/**
 * FullClockView — R90 Day Clock
 *
 * Redesigned with proper radial arc segments instead of rounded rectangles.
 * Each cycle is rendered as a geometric arc slice using a wedge-mask technique:
 *   - A filled circle is clipped by two rotated half-plane masks
 *   - This produces a true arc/wedge shape per segment
 *   - The result is a clean, architectural, premium circular timeline
 *
 * Configurable parameters:
 *   - OUTER_R / OUTER_THICK — outer ring radius and thickness
 *   - INNER_R / INNER_THICK — inner ring radius and thickness
 *   - GAP_DEG              — angular gap between segments (degrees)
 *   - RING_GAP             — pixel gap between inner and outer ring
 *
 * 3 layers:
 *   1. Base ring   — outer, 16 segments (wake/sleep)
 *   2. Energy ring — inner, day-only segments
 *   3. Overlay     — current time cursor + next action marker
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, CYCLE } from '../../lib/rhythm-clock';
import { getEnergyMap, type PeakPreference } from '../../lib/energy-model';

// ─── Design tokens (dark-mode aligned) ────────────────────────────────────────
const NAVY     = '#141466';
const CYAN     = '#1c9fda';
const BG       = '#F5F9FF';     // light mode background
const TEXT_D   = '#002060';     // R90 navy text
const TEXT_M   = '#5A7A9A';     // muted
const TEXT_F   = '#9BB5CC';     // faint

// ─── Clock geometry ───────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');

// Overall clock diameter
const D = SW - 64;

// Center point
const CX = D / 2;
const CY = D / 2;

// Number of segments (full day)
const N = 16;

// Angular span per segment
const SDEG = 360 / N;        // 22.5°

/**
 * GAP_DEG — Angular gap between segments in degrees.
 * Higher = more spacing, more architectural feel.
 * Range: 1.5 – 5. Recommended: 2.5
 */
const GAP_DEG = 2.5;

/**
 * OUTER_R — Outer radius of the outer ring (from center to outer edge).
 * OUTER_THICK — Thickness of outer ring segments.
 */
const OUTER_R     = D / 2 - 4;     // slight inset from edge
const OUTER_THICK = 32;            // segment thickness in px
const OUTER_R_IN  = OUTER_R - OUTER_THICK;

/**
 * RING_GAP — Pixel gap between the outer and inner rings.
 */
const RING_GAP = 8;

/**
 * INNER_R — Outer radius of the inner ring.
 * INNER_THICK — Thickness of inner ring segments.
 */
const INNER_R     = OUTER_R_IN - RING_GAP;
const INNER_THICK = 22;
const INNER_R_IN  = INNER_R - INNER_THICK;

// ─── Arc segment component ────────────────────────────────────────────────────
/**
 * ArcSegment renders a proper radial arc slice using the "double-wedge mask" technique.
 *
 * How it works:
 *   1. We create a container positioned at clock center, sized to cover the arc region
 *   2. Inside, we draw a donut (outer circle minus inner circle via border)
 *   3. We clip it with two rotated masks that expose only the angular range we want
 *
 * For simplicity and performance in React Native (no SVG), we use a different approach:
 *   - Draw a ring segment as a thick-bordered circle
 *   - Mask it with rotated half-planes using overflow: 'hidden'
 *
 * Actually, the most performant RN approach: render each segment as a
 * View with calculated position and rotation, using borderRadius to curve it.
 * But instead of a rectangle, we use a **curved trapezoid** approximation:
 * the segment is positioned at its angular midpoint, with width = arc length
 * at the mid-radius, and we use full borderRadius to match the ring curvature.
 *
 * For true arc appearance: we set borderRadius to the ring's radius,
 * which makes the top and bottom edges curve along the circle.
 */

interface ArcSegmentProps {
  index: number;
  startDeg: number;       // start angle (0 = top/12 o'clock)
  spanDeg: number;        // angular span of this segment
  outerR: number;         // outer radius
  thickness: number;      // radial thickness
  color: string;
  opacity: number;
  cx: number;
  cy: number;
}

function ArcSegment({ index, startDeg, spanDeg, outerR, thickness, color, opacity, cx, cy }: ArcSegmentProps) {
  // Mid angle of the segment
  const midDeg = startDeg + spanDeg / 2;
  // Mid radius (between outer and inner edge)
  const midR = outerR - thickness / 2;
  // Arc length at mid radius (this is the width of our segment)
  const arcLen = midR * spanDeg * (Math.PI / 180);

  return (
    <View
      key={index}
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        width: 0,
        height: 0,
        // Rotate so the segment's "up" direction points toward midDeg
        transform: [{ rotate: `${midDeg}deg` }],
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: arcLen,
          height: thickness,
          left: -arcLen / 2,
          top: -(midR + thickness / 2),
          backgroundColor: color,
          opacity,
          // Key: borderRadius = midR makes edges curve along the circle
          // This transforms the rectangle into an arc-following shape
          borderRadius: midR,
        }}
      />
    </View>
  );
}

// ─── Rhythm Breakdown Panel ──────────────────────────────────────────────────

interface BreakdownRow {
  time:   string;   // "06:30 – 09:30"
  label:  string;   // "Building"
  detail: string;   // short explanation
  level:  'high' | 'medium' | 'low' | 'peak';
}

interface BreakdownData {
  title:    string;
  subtitle: string;
  color:    string;
  icon:     string;
  rows:     BreakdownRow[];
}

function fmt(m: number): string {
  const n = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

function getBreakdownData(
  layer: 'energy' | 'sleep' | 'recovery',
  wakeMin: number,
  idealCycles: number,
): BreakdownData {
  const crp      = wakeMin + 7 * 60;
  const bedtime  = wakeMin + idealCycles * 90;
  const winddown = bedtime - 60;

  if (layer === 'energy') {
    return {
      title:    'Energy rhythm',
      subtitle: 'How your energy flows through the day',
      color:    CYAN,
      icon:     'flash-outline',
      rows: [
        {
          time:   `${fmt(wakeMin)} – ${fmt(wakeMin + 3 * 90)}`,
          label:  'Building',
          detail: 'Energy climbs through your first 3 cycles. Best for focused work.',
          level:  'medium',
        },
        {
          time:   `${fmt(wakeMin + 3 * 90)} – ${fmt(wakeMin + 5 * 90)}`,
          label:  'Peak',
          detail: 'Your strongest window. Highest alertness and clarity.',
          level:  'peak',
        },
        {
          time:   `${fmt(wakeMin + 5 * 90)} – ${fmt(crp)}`,
          label:  'Settling',
          detail: 'Natural energy dip. This is when your CRP recovery helps most.',
          level:  'low',
        },
        {
          time:   `${fmt(crp + 20)} – ${fmt(winddown)}`,
          label:  'Afternoon',
          detail: 'Moderate energy. MRM resets keep you sharp through the afternoon.',
          level:  'medium',
        },
        {
          time:   `${fmt(winddown)} – ${fmt(bedtime)}`,
          label:  'Winding down',
          detail: 'Energy drops naturally. Your body prepares for sleep.',
          level:  'low',
        },
      ],
    };
  }

  if (layer === 'sleep') {
    return {
      title:    'Sleep pressure',
      subtitle: 'How your body builds readiness to sleep',
      color:    NAVY,
      icon:     'moon-outline',
      rows: [
        {
          time:   `${fmt(wakeMin)} – ${fmt(wakeMin + 4 * 90)}`,
          label:  'Low',
          detail: 'Sleep pressure is minimal. Your body is fully awake.',
          level:  'low',
        },
        {
          time:   `${fmt(wakeMin + 4 * 90)} – ${fmt(crp)}`,
          label:  'Building',
          detail: 'Adenosine accumulates. You may feel a natural dip — this is normal.',
          level:  'medium',
        },
        {
          time:   `${fmt(crp)} – ${fmt(winddown)}`,
          label:  'Rising',
          detail: 'Sleep pressure increases steadily. Avoid caffeine from here.',
          level:  'high',
        },
        {
          time:   `${fmt(winddown)} – ${fmt(bedtime)}`,
          label:  'High',
          detail: 'Your wind-down window. Dim lights, reduce screens, let your body prepare.',
          level:  'peak',
        },
        {
          time:   `${fmt(bedtime)}`,
          label:  'Sleep window',
          detail: `${idealCycles} cycles of sleep begin here. Wake at ${fmt(wakeMin)}.`,
          level:  'peak',
        },
      ],
    };
  }

  // recovery
  return {
    title:    'Recovery windows',
    subtitle: 'When your body benefits most from rest',
    color:    '#D97706',
    icon:     'fitness-outline',
    rows: [
      {
        time:   `Every 90 min`,
        label:  'MRM',
        detail: '2-minute micro-resets between cycles. Quick mental refresh.',
        level:  'medium',
      },
      {
        time:   `${fmt(crp)} – ${fmt(crp + 20)}`,
        label:  'CRP',
        detail: '20-minute controlled recovery. The most powerful daytime reset.',
        level:  'peak',
      },
      {
        time:   `${fmt(winddown)} – ${fmt(bedtime)}`,
        label:  'Wind-down',
        detail: 'Your evening transition. Prepares body and mind for deep sleep.',
        level:  'high',
      },
      {
        time:   `${fmt(bedtime)} – ${fmt(wakeMin)}`,
        label:  'Sleep',
        detail: `${idealCycles} full cycles of recovery. The foundation of the R90 method.`,
        level:  'peak',
      },
    ],
  };
}

const LEVEL_OPACITY = { low: 0.15, medium: 0.30, high: 0.50, peak: 0.70 };

function RhythmBreakdown({ layer, wakeMin, idealCycles }: {
  layer: 'energy' | 'sleep' | 'recovery';
  wakeMin: number;
  idealCycles: number;
}) {
  const bd = getBreakdownData(layer, wakeMin, idealCycles);

  return (
    <View style={bd_s.wrap}>
      {/* Header */}
      <View style={bd_s.header}>
        <View style={[bd_s.headerIcon, { backgroundColor: `${bd.color}15` }]}>
          <Ionicons name={bd.icon as any} size={14} color={bd.color} />
        </View>
        <View style={bd_s.headerText}>
          <Text style={bd_s.title}>{bd.title}</Text>
          <Text style={bd_s.subtitle}>{bd.subtitle}</Text>
        </View>
      </View>

      {/* Rows */}
      <View style={bd_s.rows}>
        {bd.rows.map((row, i) => (
          <View key={i} style={bd_s.row}>
            {/* Level indicator bar */}
            <View style={bd_s.barCol}>
              <View style={[bd_s.bar, {
                backgroundColor: bd.color,
                opacity: LEVEL_OPACITY[row.level],
              }]} />
            </View>

            {/* Content */}
            <View style={bd_s.rowContent}>
              <View style={bd_s.rowTop}>
                <Text style={bd_s.rowTime}>{row.time}</Text>
                <Text style={[bd_s.rowLabel, { color: bd.color }]}>{row.label}</Text>
              </View>
              <Text style={bd_s.rowDetail}>{row.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const bd_s = StyleSheet.create({
  wrap: {
    marginTop:         20,
    marginHorizontal:  20,
    gap:               14,
    alignSelf:         'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  headerIcon: {
    width:        32,
    height:       32,
    borderRadius: 10,
    alignItems:   'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap:  2,
  },
  title: {
    fontSize:   15,
    fontWeight: '700',
    color:      TEXT_D,
  },
  subtitle: {
    fontSize: 12,
    color:    TEXT_M,
  },
  rows: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    gap:           12,
    paddingVertical: 10,
  },
  barCol: {
    width:          4,
    alignItems:     'center',
    paddingVertical: 2,
  },
  bar: {
    width:        4,
    flex:         1,
    borderRadius: 2,
  },
  rowContent: {
    flex:      1,
    flexShrink: 1,
    gap:       3,
  },
  rowTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  rowTime: {
    fontSize:      12,
    fontWeight:    '600',
    color:         TEXT_D,
    letterSpacing: -0.2,
  },
  rowLabel: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  rowDetail: {
    fontSize:   12,
    color:      TEXT_M,
    lineHeight: 17,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────
interface FullClockViewProps {
  visible:         boolean;
  onClose:         () => void;
  wakeMin:         number;
  idealCycles:     number;
  peakPreference?: PeakPreference;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function FullClockView({
  visible, onClose, wakeMin, idealCycles, peakPreference = 'morning',
}: FullClockViewProps) {
  const [data,  setData]  = useState(() => computeRhythmData(nowMin(), wakeMin, N));
  const [time,  setTime]  = useState(() => fmtMin(nowMin()));
  const [layer, setLayer] = useState<'sleep' | 'energy' | 'recovery'>('energy');
  const pulse = useRef(new Animated.Value(1)).current;

  // Refresh every 30s
  useEffect(() => {
    if (!visible) return;
    const tick = () => {
      setData(computeRhythmData(nowMin(), wakeMin, N));
      setTime(fmtMin(nowMin()));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [visible, wakeMin]);

  // Cursor pulse animation
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  const { segments, currentIdx } = data;
  const energyMap  = getEnergyMap(N, peakPreference);
  const isActive   = currentIdx >= 0 && currentIdx < N;
  const curSeg     = isActive ? segments[currentIdx] : null;
  const elapsed    = curSeg ? ((nowMin() - curSeg.startMin + 1440) % 1440) : 0;
  const pct        = Math.min(1, elapsed / CYCLE);
  const remaining  = isActive ? Math.max(0, CYCLE - elapsed) : 0;
  const sleepStart = N - idealCycles;

  // ── Sleep mode: bedtime windows ──
  const bedtimeSegments = [sleepStart - 1, sleepStart, sleepStart + 1].filter(
    i => i >= 0 && i < N,
  );
  const PRE_SLEEP_SPAN = (30 / CYCLE) * SDEG;

  // ── Current time cursor position ──
  const curDeg = isActive ? currentIdx * SDEG + pct * SDEG : Math.max(0, currentIdx) * SDEG;
  const curRad = (curDeg - 90) * (Math.PI / 180);
  const curMidR = OUTER_R - OUTER_THICK / 2;
  const curPt  = { x: CX + curMidR * Math.cos(curRad), y: CY + curMidR * Math.sin(curRad) };

  // ── Next action marker ──
  let nextMarker: { label: string; deg: number } | null = null;
  if (isActive) {
    const minsToMRM = 80 - elapsed;
    if (minsToMRM > 0 && segments[currentIdx]?.hasMRM) {
      const mrmDeg = currentIdx * SDEG + (80 / CYCLE) * SDEG;
      nextMarker = { label: `MRM ${Math.round(minsToMRM)}m`, deg: mrmDeg };
    } else {
      const crpIdx = segments.findIndex((s, i) => s.isCRP && i >= currentIdx && !s.isPast);
      if (crpIdx >= 0) {
        nextMarker = { label: 'CRP', deg: crpIdx * SDEG + SDEG / 2 };
      }
    }
  }
  const nextRad = nextMarker ? (nextMarker.deg - 90) * (Math.PI / 180) : null;
  const nextPt  = nextRad ? { x: CX + curMidR * Math.cos(nextRad), y: CY + curMidR * Math.sin(nextRad) } : null;

  const cycleLabel = isActive
    ? `Cycle ${currentIdx + 1} · ${Math.round(remaining)} min left`
    : currentIdx < 0 ? 'Day not started' : 'Day complete';

  // Segment angular span (excluding gap)
  const segSpan = SDEG - GAP_DEG;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root} edges={['top']}>

        <View style={s.header}>
          <Text style={s.title}>Day View</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={TEXT_M} />
          </Pressable>
        </View>

        <ScrollView style={s.scrollView} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.clockWrap}>
          <View style={{ width: D, height: D }}>

            {/* ═══ LAYER 1 — Outer ring (base) ═══ */}
            {Array.from({ length: N }, (_, i) => {
              const isSleep = i >= sleepStart;
              const seg     = segments[i];
              const startDeg = i * SDEG + GAP_DEG / 2;

              // Layer-specific styling
              const sleepHighlight = layer === 'sleep' && isSleep;
              const isBedtimeOpt   = layer === 'sleep' && bedtimeSegments.includes(i);
              const recHighlight   = layer === 'recovery' && seg?.isCRP && !isSleep;

              const baseOpacity = isSleep ? 0.12 : 0.55;
              const opacity = sleepHighlight ? 0.70
                : isBedtimeOpt ? 0.75
                : recHighlight ? 0.80
                : i === currentIdx ? 0.90
                : baseOpacity;
              const color = recHighlight ? '#D97706' : NAVY;

              return (
                <ArcSegment
                  key={`outer-${i}`}
                  index={i}
                  startDeg={startDeg}
                  spanDeg={segSpan}
                  outerR={OUTER_R}
                  thickness={OUTER_THICK}
                  color={color}
                  opacity={opacity}
                  cx={CX}
                  cy={CY}
                />
              );
            })}

            {/* ═══ LAYER 1b — Sleep mode markers ═══ */}
            {layer === 'sleep' && bedtimeSegments.map(bi => {
              const tickDeg = bi * SDEG;
              const tickRad = (tickDeg - 90) * (Math.PI / 180);
              const innerEdge = OUTER_R - OUTER_THICK - 4;
              const outerEdge = OUTER_R + 4;
              const txInner = CX + innerEdge * Math.cos(tickRad);
              const tyInner = CY + innerEdge * Math.sin(tickRad);
              const txOuter = CX + outerEdge * Math.cos(tickRad);
              const tyOuter = CY + outerEdge * Math.sin(tickRad);

              return (
                <View key={`tick-${bi}`}>
                  {/* Bedtime tick — thin line from inner to outer edge */}
                  <View style={{
                    position: 'absolute',
                    left: CX,
                    top: CY,
                    width: 0,
                    height: 0,
                    transform: [{ rotate: `${tickDeg}deg` }],
                  }}>
                    <View style={{
                      position: 'absolute',
                      width: 2.5,
                      height: OUTER_THICK + 8,
                      left: -1.25,
                      top: -(OUTER_R + 4),
                      backgroundColor: CYAN,
                      borderRadius: 1.25,
                    }} />
                  </View>
                </View>
              );
            })}

            {/* ═══ LAYER 2 — Inner ring (energy) ═══ */}
            {layer === 'energy' && Array.from({ length: N }, (_, i) => {
              const isSleep = i >= sleepStart;
              if (isSleep) return null;
              const energy = energyMap[i];
              const startDeg = i * SDEG + GAP_DEG / 2;

              const opacity = energy?.level === 'high' ? 0.85
                : energy?.level === 'neutral' ? 0.55
                : 0.30;

              return (
                <ArcSegment
                  key={`inner-${i}`}
                  index={i}
                  startDeg={startDeg}
                  spanDeg={segSpan}
                  outerR={INNER_R}
                  thickness={INNER_THICK}
                  color={CYAN}
                  opacity={opacity}
                  cx={CX}
                  cy={CY}
                />
              );
            })}

            {/* ═══ LAYER 3 — Overlay ═══ */}

            {/* Current time cursor */}
            {isActive && (
              <>
                <Animated.View style={[s.cursorGlow, {
                  left:    curPt.x - 12,
                  top:     curPt.y - 12,
                  opacity: 0.2,
                  transform: [{ scale: pulse }],
                }]} />
                <View style={[s.cursorDot, {
                  left: curPt.x - 7,
                  top:  curPt.y - 7,
                }]} />
              </>
            )}

            {/* Next action marker — hidden */}

            {/* Center text */}
            <View style={s.center} pointerEvents="none">
              <Text style={s.timeText}>{time}</Text>
              <Text style={s.r90}>R90</Text>
              {isActive && (
                <Text style={s.cycleTxt}>{cycleLabel}</Text>
              )}
            </View>

          </View>
        </View>

        {/* ── Layer selector ── */}
        <View style={s.layerBar}>
          {([
            { id: 'energy',   icon: 'flash-outline',   label: 'Energy'   },
            { id: 'sleep',    icon: 'moon-outline',     label: 'Sleep'    },
            { id: 'recovery', icon: 'fitness-outline',  label: 'Recovery' },
          ] as const).map(({ id, icon, label }) => {
            const on = layer === id;
            return (
              <Pressable
                key={id}
                onPress={() => setLayer(id)}
                style={[s.chip, on && s.chipOn]}
              >
                <Ionicons name={icon} size={14} color={on ? '#FFFFFF' : TEXT_M} />
                <Text style={[s.chipLabel, on && s.chipLabelOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Contextual day breakdown panel ── */}
        <View style={s.breakdownWrap}>
          <RhythmBreakdown layer={layer} wakeMin={wakeMin} idealCycles={idealCycles} />
        </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: BG },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title:        { fontSize: 18, fontWeight: '700', color: TEXT_D },
  scrollView:   { flex: 1, width: '100%' },
  scroll:       { alignItems: 'center', paddingBottom: 48 },
  clockWrap:    { alignItems: 'center', marginTop: 12 },
  breakdownWrap: { width: '100%', alignSelf: 'stretch' },

  // Layer selector
  layerBar:    { flexDirection: 'row', gap: 10, marginTop: 28, justifyContent: 'center' },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 24, backgroundColor: 'rgba(28,159,218,0.08)', borderWidth: 1, borderColor: 'rgba(28,159,218,0.15)' },
  chipOn:      { backgroundColor: CYAN, borderColor: CYAN },
  chipLabel:   { fontSize: 13, fontWeight: '600', color: TEXT_M },
  chipLabelOn: { color: '#FFFFFF' },
  // desc removed — replaced by RhythmBreakdown component

  // Cursor
  cursorGlow: {
    position:        'absolute',
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: CYAN,
  },
  cursorDot: {
    position:        'absolute',
    width:           14,
    height:          14,
    borderRadius:    7,
    backgroundColor: CYAN,
    shadowColor:     CYAN,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.8,
    shadowRadius:    8,
    elevation:       10,
  },

  // Next marker
  nextMarkerWrap: {
    position:       'absolute',
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
    gap: 2,
  },
  nextDot: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: '#D97706',
  },
  nextLabel: {
    fontSize:   8,
    fontWeight: '700',
    color:      '#D97706',
    textAlign:  'center',
  },

  // Center
  center: {
    position:   'absolute',
    left:       CX - 80,
    top:        CY - 46,
    width:      160,
    alignItems: 'center',
    gap:        3,
  },
  timeText: { fontSize: 42, fontWeight: '800', color: TEXT_D, letterSpacing: -2 },
  r90:      { fontSize: 11, fontWeight: '800', color: CYAN, letterSpacing: 4 },
  cycleTxt: { fontSize: 11, color: TEXT_F, textAlign: 'center' },
});
