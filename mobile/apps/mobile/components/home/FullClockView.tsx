/**
 * FullClockView — Full Day Rhythm Clock
 *
 * A circular clock showing the entire day as a ring.
 * Each segment = 1 cycle of 90 min.
 *
 * Visual layers (outer → inner):
 *   1. Event markers (sun, moon, MRM dots, CRP icon, wind-down)
 *   2. Main ring (segmented, current cycle highlighted)
 *   3. Current time cursor (dot on the ring, animated)
 *   4. Center (current time + cycle label)
 *
 * Angle 0° = top = Wake time (ARP).
 * Clockwise = forward in time.
 * Full 360° = 24 hours.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, type RhythmSegment, CYCLE } from '../../lib/rhythm-clock';

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT      = '#1c9fda';
const DEEP        = '#141466';
const GOLD        = '#F5A623';
const CRP_COLOR   = '#E05555';
const WIND_COLOR  = '#A78BFA';
const WHITE       = '#FFFFFF';
const TEXT_MAIN   = '#002060';
const TEXT_MUTED  = '#7A9BBC';
const RING_EMPTY  = 'rgba(28,100,160,0.18)';
const RING_PAST   = 'rgba(28,159,218,0.45)';
const RING_CURR   = '#1c9fda';
const RING_SLEEP  = '#0a1840';

// ─── Layout ──────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const CLOCK_D    = SW - 48;          // clock diameter
const CLOCK_R    = CLOCK_D / 2;      // clock radius
const CX         = CLOCK_R;
const CY         = CLOCK_R;
const RING_O     = CLOCK_R - 2;      // outer ring radius
const RING_I     = CLOCK_R - 44;     // inner ring radius (ring thickness = 42)
const RING_MID   = (RING_O + RING_I) / 2;
const CENTER_R   = RING_I - 18;      // center circle radius
const SEG_GAP    = 2;                // gap degrees between segments
const DAY_MIN    = 24 * 60;          // 1440 min

// ─── Math helpers ─────────────────────────────────────────────────────────────

function minToDeg(wakeMin: number, targetMin: number): number {
  // 0° = top = wakeMin. Clockwise. Full circle = 24h.
  const diff = ((targetMin - wakeMin) + DAY_MIN) % DAY_MIN;
  return (diff / DAY_MIN) * 360;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Build SVG arc path for a ring segment
function ringSegPath(
  startDeg: number,
  endDeg:   number,
  ro:       number,
  ri:       number,
): { outer1: {x:number,y:number}, outer2: {x:number,y:number}, inner1: {x:number,y:number}, inner2: {x:number,y:number}, large: number } {
  return {
    outer1: polar(CX, CY, ro, startDeg),
    outer2: polar(CX, CY, ro, endDeg),
    inner1: polar(CX, CY, ri, endDeg),
    inner2: polar(CX, CY, ri, startDeg),
    large:  endDeg - startDeg > 180 ? 1 : 0,
  };
}

// ─── Ring segment (rendered as positioned View using border trick) ─────────────

interface RingSegmentProps {
  startDeg: number;
  endDeg:   number;
  color:    string;
  glow?:    boolean;
}

function RingSegment({ startDeg, endDeg, color, glow }: RingSegmentProps) {
  // Render each segment as a thin arc overlay using absolute positioned views
  // Strategy: clip a colored view to show only the angular slice

  const segCount  = Math.max(1, Math.round((endDeg - startDeg) / 2));
  const views     = [];
  const step      = (endDeg - startDeg) / segCount;

  for (let i = 0; i < segCount; i++) {
    const midDeg = startDeg + i * step + step / 2;
    const pt     = polar(CX, CY, RING_MID, midDeg);
    const w      = RING_O - RING_I + 2;

    views.push(
      <View
        key={i}
        style={{
          position:        'absolute',
          left:            pt.x - step * 1.2,
          top:             pt.y - (RING_O - RING_I) / 2,
          width:           step * 2.4,
          height:          RING_O - RING_I,
          backgroundColor: color,
          transform:       [{ rotate: `${midDeg}deg` }],
          borderRadius:    2,
          ...(glow && {
            shadowColor:   color,
            shadowOffset:  { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius:  8,
            elevation:     4,
          }),
        }}
      />
    );
  }
  return <>{views}</>;
}

// ─── Ring segment via radial painting (overlay circular arc) ─────────────────

// We use a simpler, reliable technique:
// Render a large ring (annulus) and overlay colored arc slices
// by rotating a View that masks with overflow:hidden

interface ArcSliceProps {
  startDeg: number;
  spanDeg:  number;
  color:    string;
  ro:       number;
  ri:       number;
}

function ArcSlice({ startDeg, spanDeg, color, ro, ri }: ArcSliceProps) {
  if (spanDeg <= 0) return null;

  // We subdivide wide arcs into 2° chunks rendered as radial lines
  const chunks: JSX.Element[] = [];
  const CHUNK  = 2;
  const count  = Math.ceil(spanDeg / CHUNK);
  const thick  = ro - ri;

  for (let i = 0; i < count; i++) {
    const deg = startDeg + i * CHUNK + CHUNK / 2;
    const pt  = polar(CX, CY, ri + thick / 2, deg);
    chunks.push(
      <View
        key={i}
        style={{
          position:        'absolute',
          left:            pt.x - 1.5,
          top:             pt.y - thick / 2,
          width:           3,
          height:          thick,
          backgroundColor: color,
          borderRadius:    1,
          transform:       [{ rotate: `${deg}deg` }],
        }}
      />
    );
  }

  return <>{chunks}</>;
}

// ─── Event marker ─────────────────────────────────────────────────────────────

interface MarkerProps {
  deg:     number;
  r:       number;   // where on the ring (RING_MID or outside)
  size?:   number;
  color:   string;
  icon?:   string;
  onPress?: () => void;
}

function Marker({ deg, r, size = 10, color, icon, onPress }: MarkerProps) {
  const pt = polar(CX, CY, r, deg);
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      hitSlop={12}
      style={{
        position:       'absolute',
        left:           pt.x - size / 2,
        top:            pt.y - size / 2,
        width:          size,
        height:         size,
        borderRadius:   size / 2,
        backgroundColor: icon ? 'transparent' : color,
        alignItems:     'center',
        justifyContent: 'center',
        shadowColor:    color,
        shadowOffset:   { width: 0, height: 0 },
        shadowOpacity:  icon ? 0 : 0.6,
        shadowRadius:   4,
        elevation:      3,
      }}
    >
      {icon && <Text style={{ fontSize: size * 0.9 }}>{icon}</Text>}
    </Wrapper>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface Tooltip {
  label:   string;
  sub:     string;
  x:       number;
  y:       number;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FullClockViewProps {
  visible:     boolean;
  onClose:     () => void;
  wakeMin:     number;
  idealCycles: number;
}

export function FullClockView({ visible, onClose, wakeMin, idealCycles }: FullClockViewProps) {
  const [data,    setData]    = useState(() => computeRhythmData(nowMin(), wakeMin, idealCycles));
  const [timeStr, setTime]    = useState(() => fmtMin(nowMin()));
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

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
    if (!visible) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const { segments, totalCycles, currentIdx } = data;

  // Current cursor angle
  const nowMins    = nowMin();
  const nowDeg     = minToDeg(wakeMin, nowMins);

  // Key event angles
  const crpSeg     = segments.find(s => s.isCRP);
  const crpDeg     = crpSeg ? minToDeg(wakeMin, crpSeg.startMin + 45) : null;
  const sleepDeg   = minToDeg(wakeMin, segments[segments.length - 1]?.startMin ?? wakeMin + idealCycles * CYCLE);
  const winddownDeg = sleepDeg > 60 ? sleepDeg - (60 / DAY_MIN) * 360 : sleepDeg;
  const arp30Deg   = (30 / DAY_MIN) * 360;

  function showTooltip(label: string, sub: string, deg: number, r: number) {
    const pt = polar(CX, CY, r, deg);
    setTooltip({ label, sub, x: pt.x, y: pt.y });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={fc.root} edges={['top']}>
        <View style={fc.header}>
          <Text style={fc.title}>Your Day</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color={TEXT_MUTED} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={fc.scroll} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => setTooltip(null)}>
            <View style={{ width: CLOCK_D, height: CLOCK_D }}>

              {/* ── Background ring (empty) ── */}
              <View style={fc.ringBg} />

              {/* ── Colored arc slices per segment ── */}
              {segments.map((seg, i) => {
                const startDeg = minToDeg(wakeMin, seg.startMin);
                const endDeg   = minToDeg(wakeMin, seg.endMin);
                const span     = ((endDeg - startDeg) + 360) % 360 || 360 / totalCycles;
                const gapDeg   = (SEG_GAP / DAY_MIN) * 360;
                const color    = seg.isSleep
                  ? RING_SLEEP
                  : seg.isCurrent
                  ? RING_CURR
                  : seg.isPast
                  ? RING_PAST
                  : RING_EMPTY;

                return (
                  <ArcSlice
                    key={i}
                    startDeg={startDeg + gapDeg}
                    spanDeg={span - gapDeg * 2}
                    color={color}
                    ro={RING_O}
                    ri={RING_I}
                  />
                );
              })}

              {/* ── MRM dots (inside ring, at 80min of each cycle) ── */}
              {segments
                .filter(s => s.hasMRM && !s.isPast)
                .map((seg, i) => {
                  const mrmMin = seg.startMin + 80;
                  const deg    = minToDeg(wakeMin, mrmMin);
                  return (
                    <Marker
                      key={`mrm-${i}`}
                      deg={deg}
                      r={RING_MID}
                      size={7}
                      color={WHITE}
                      onPress={() => showTooltip('MRM', '2-min reset', deg, RING_O + 20)}
                    />
                  );
                })}

              {/* ── CRP marker ── */}
              {crpDeg !== null && (
                <Marker
                  deg={crpDeg}
                  r={RING_O + 20}
                  size={26}
                  color={CRP_COLOR}
                  icon="⚡"
                  onPress={() => showTooltip('CRP', '20-min recovery', crpDeg, RING_O + 30)}
                />
              )}

              {/* ── Wind-down marker ── */}
              <Marker
                deg={winddownDeg}
                r={RING_O + 20}
                size={22}
                color={WIND_COLOR}
                icon="🌅"
                onPress={() => showTooltip('Wind-down', 'Prepare for sleep', winddownDeg, RING_O + 30)}
              />

              {/* ── Sleep marker (moon) ── */}
              <Marker
                deg={sleepDeg}
                r={RING_O + 20}
                size={22}
                color={DEEP}
                icon="🌙"
                onPress={() => showTooltip('Sleep', fmtMin(segments[segments.length - 1]?.startMin ?? 0), sleepDeg, RING_O + 30)}
              />

              {/* ── Wake marker (sun) at 0° ── */}
              <Marker
                deg={0}
                r={RING_O + 20}
                size={26}
                color={GOLD}
                icon="☀️"
                onPress={() => showTooltip('Wake time', fmtMin(wakeMin), 0, RING_O + 30)}
              />

              {/* ── +30 min tick ── */}
              <Marker
                deg={arp30Deg}
                r={RING_O + 14}
                size={7}
                color={GOLD}
              />

              {/* ── Current time cursor (animated dot on ring) ── */}
              {(() => {
                const pt = polar(CX, CY, RING_MID, nowDeg);
                return (
                  <Animated.View
                    style={{
                      position:        'absolute',
                      left:            pt.x - 8,
                      top:             pt.y - 8,
                      width:           16,
                      height:          16,
                      borderRadius:    8,
                      backgroundColor: WHITE,
                      borderWidth:     2,
                      borderColor:     ACCENT,
                      shadowColor:     WHITE,
                      shadowOffset:    { width: 0, height: 0 },
                      shadowOpacity:   1,
                      shadowRadius:    10,
                      elevation:       8,
                      transform:       [{ scale: pulse }],
                    }}
                  />
                );
              })()}

              {/* ── Center circle ── */}
              <View style={[fc.center, { width: CENTER_R * 2, height: CENTER_R * 2, borderRadius: CENTER_R, left: CX - CENTER_R, top: CY - CENTER_R }]}>
                <Text style={fc.centerTime}>{timeStr}</Text>
                <Text style={fc.centerCycle}>
                  {currentIdx >= 0 && currentIdx < totalCycles
                    ? `Cycle ${currentIdx + 1}/${totalCycles}`
                    : `${totalCycles} cycles`}
                </Text>
              </View>

              {/* ── Tooltip ── */}
              {tooltip && (
                <View style={[
                  fc.tooltip,
                  {
                    left: Math.max(8, Math.min(CLOCK_D - 140, tooltip.x - 64)),
                    top:  Math.max(8, Math.min(CLOCK_D - 70,  tooltip.y - 35)),
                  },
                ]}>
                  <Text style={fc.tooltipLabel}>{tooltip.label}</Text>
                  <Text style={fc.tooltipSub}>{tooltip.sub}</Text>
                </View>
              )}

            </View>
          </Pressable>

          {/* Legend */}
          <View style={fc.legend}>
            {[
              { color: RING_CURR,  label: 'Current cycle' },
              { color: RING_PAST,  label: 'Past cycles' },
              { color: RING_EMPTY, label: 'Upcoming' },
              { color: RING_SLEEP, label: 'Sleep window' },
            ].map(({ color, label }) => (
              <View key={label} style={fc.legendItem}>
                <View style={[fc.legendDot, { backgroundColor: color }]} />
                <Text style={fc.legendTxt}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Segment list */}
          <View style={fc.list}>
            {segments.map((seg) => (
              <View key={seg.index} style={[fc.listRow, seg.isCurrent && fc.listRowActive]}>
                <View style={[fc.listDot, {
                  backgroundColor: seg.isCRP ? CRP_COLOR : seg.isSleep ? DEEP : seg.isPast ? RING_PAST : ACCENT
                }]} />
                <Text style={[fc.listLabel, seg.isCurrent && { color: ACCENT, fontWeight: '700' }]}>
                  {seg.label}
                </Text>
                <Text style={fc.listTime}>{fmtMin(seg.startMin)} → {fmtMin(seg.endMin)}</Text>
                {seg.hasMRM && !seg.isPast && (
                  <Text style={fc.listTag}>MRM {fmtMin(seg.startMin + 80)}</Text>
                )}
                {seg.isCRP && (
                  <Text style={[fc.listTag, { color: CRP_COLOR }]}>CRP</Text>
                )}
                {seg.isSleep && (
                  <Text style={[fc.listTag, { color: DEEP }]}>Sleep</Text>
                )}
              </View>
            ))}
          </View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const fc = StyleSheet.create({
  root:   { flex: 1, backgroundColor: WHITE },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5EEF5',
  },
  title:  { fontSize: 17, fontWeight: '700', color: TEXT_MAIN },
  scroll: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 20 },

  ringBg: {
    position:        'absolute',
    left:            RING_I,
    top:             RING_I,
    width:           (RING_O - RING_I) * 2 + (CLOCK_D - 2 * RING_O),
    height:          (RING_O - RING_I) * 2 + (CLOCK_D - 2 * RING_O),
    borderRadius:    RING_O,
    borderWidth:     RING_O - RING_I,
    borderColor:     RING_EMPTY,
    backgroundColor: 'transparent',
  },

  center: {
    position:        'absolute',
    backgroundColor: DEEP,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     DEEP,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.25,
    shadowRadius:    14,
    elevation:       6,
  },
  centerTime:  { fontSize: 26, fontWeight: '800', color: WHITE, letterSpacing: -0.5 },
  centerCycle: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 },

  tooltip: {
    position:        'absolute',
    backgroundColor: DEEP,
    borderRadius:    10,
    paddingVertical:  7,
    paddingHorizontal: 12,
    minWidth:         120,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.15,
    shadowRadius:     10,
    elevation:        8,
  },
  tooltipLabel: { fontSize: 13, fontWeight: '700', color: WHITE },
  tooltipSub:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  legend: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            12,
    marginTop:      16,
    justifyContent: 'center',
    width:          '100%',
  },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendTxt:   { fontSize: 11, color: TEXT_MUTED },

  list:     { width: '100%', marginTop: 16, gap: 2 },
  listRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  listRowActive: { backgroundColor: '#EAF4FB' },
  listDot:  { width: 8, height: 8, borderRadius: 4 },
  listLabel:{ fontSize: 13, color: TEXT_MAIN, width: 66 },
  listTime: { fontSize: 12, color: TEXT_MUTED, flex: 1 },
  listTag:  { fontSize: 11, fontWeight: '700', color: ACCENT },
});
