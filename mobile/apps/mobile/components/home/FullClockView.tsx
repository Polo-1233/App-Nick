/**
 * FullClockView — Radial rhythm clock
 *
 * Design matches reference:
 *   - Center circle: current time + cycle label
 *   - Inner arc: progress through the day (filled = done, outline = remaining)
 *   - Spokes radiating outward:
 *     · Solid dark navy  = main cycle boundaries (every 3rd cycle)
 *     · Dashed light blue = regular cycle boundaries (MRM)
 *     · Dashed red/gold  = CRP window
 *   - Current position = animated white cursor spoke
 */

import { useEffect, useRef, useState, memo } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, type RhythmSegment, CYCLE } from '../../lib/rhythm-clock';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const DEEP        = '#141466';
const ACCENT      = '#1c9fda';
const GOLD        = '#F5A623';
const CRP_COLOR   = '#E05555';   // red dashed for CRP (matches reference)
const WHITE       = '#FFFFFF';
const TEXT_MAIN   = '#002060';
const TEXT_MUTED  = '#7A9BBC';
const BG          = '#FFFFFF';

const { width: SW } = Dimensions.get('window');
const SIZE     = SW - 40;       // full clock diameter
const CX       = SIZE / 2;
const CY       = SIZE / 2;
const R_ARC_O  = SIZE * 0.24;   // outer arc radius
const R_ARC_I  = SIZE * 0.17;   // inner arc radius (donut)
const R_SPOKE_START = SIZE * 0.27;   // spoke starts just outside arc
const R_SPOKE_MAIN  = SIZE * 0.47;   // long spoke (main)
const R_SPOKE_SUB   = SIZE * 0.40;   // short spoke (sub)
const R_CENTER = SIZE * 0.15;        // center circle

// ─── Math ────────────────────────────────────────────────────────────────────
function toRad(deg: number) { return (deg * Math.PI) / 180; }

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = toRad(deg - 90); // 0° = top
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number, cy: number,
  ro: number, ri: number,
  startDeg: number, endDeg: number,
): string {
  if (endDeg - startDeg >= 360) endDeg = startDeg + 359.9;
  const p1 = polar(cx, cy, ro, startDeg);
  const p2 = polar(cx, cy, ro, endDeg);
  const p3 = polar(cx, cy, ri, endDeg);
  const p4 = polar(cx, cy, ri, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${ro} ${ro} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${ri} ${ri} 0 ${large} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

// ─── Spoke component ─────────────────────────────────────────────────────────
interface SpokeProps {
  deg:       number;
  r1:        number;   // start radius
  r2:        number;   // end radius
  color:     string;
  width?:    number;
  dashed?:   boolean;
  dashLen?:  number;
}

function Spoke({ deg, r1, r2, color, width = 2, dashed = false, dashLen = 6 }: SpokeProps) {
  const p1 = polar(CX, CY, r1, deg);
  const p2 = polar(CX, CY, r2, deg);
  return (
    <Line
      x1={p1.x} y1={p1.y}
      x2={p2.x} y2={p2.y}
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashed ? `${dashLen} ${dashLen * 0.8}` : undefined}
      strokeLinecap="round"
    />
  );
}

// ─── Arrowhead ───────────────────────────────────────────────────────────────
function Arrowhead({ deg, r, color, size = 6 }: { deg: number; r: number; color: string; size?: number }) {
  const tip  = polar(CX, CY, r, deg);
  const base1 = polar(CX, CY, r - size, deg - 15);
  const base2 = polar(CX, CY, r - size, deg + 15);
  return (
    <Path
      d={`M ${tip.x} ${tip.y} L ${base1.x} ${base1.y} L ${base2.x} ${base2.y} Z`}
      fill={color}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface FullClockViewProps {
  visible:     boolean;
  onClose:     () => void;
  wakeMin:     number;
  idealCycles: number;
}

export function FullClockView({ visible, onClose, wakeMin, idealCycles }: FullClockViewProps) {
  const [data, setData] = useState(() => computeRhythmData(nowMin(), wakeMin, idealCycles));
  const [selectedSeg, setSelectedSeg] = useState<RhythmSegment | null>(null);

  // Current time string
  const [timeStr, setTimeStr] = useState(() => fmtMin(nowMin()));

  useEffect(() => {
    if (!visible) return;
    const refresh = () => {
      const d = computeRhythmData(nowMin(), wakeMin, idealCycles);
      setData(d);
      setTimeStr(fmtMin(nowMin()));
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [visible, wakeMin, idealCycles]);

  // Cursor pulse
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const { segments, totalCycles, currentIdx, cursorPct } = data;
  const degPerCycle = 360 / totalCycles;

  // Progress arc: from wake (top = 0°) to current position
  const currentDeg = currentIdx >= 0
    ? currentIdx * degPerCycle + cursorPct * degPerCycle
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={fc.root} edges={['top']}>

        {/* Header */}
        <View style={fc.header}>
          <Text style={fc.headerTitle}>Your Rhythm</Text>
          <Pressable onPress={onClose} style={fc.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={20} color={TEXT_MUTED} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={fc.scroll} showsVerticalScrollIndicator={false}>

          {/* Clock */}
          <View style={{ width: SIZE, height: SIZE }}>
            <Svg width={SIZE} height={SIZE}>

              {/* ── Spokes for each cycle boundary ── */}
              {segments.map((seg, i) => {
                const deg     = i * degPerCycle;
                const isPast  = seg.isPast;
                const isCurr  = seg.isCurrent;
                const isCRP   = seg.isCRP;
                const isMain  = i % 3 === 0; // main spoke every 3 cycles

                const color = isCRP
                  ? CRP_COLOR
                  : isMain
                  ? DEEP
                  : ACCENT;

                const r2    = isMain ? R_SPOKE_MAIN : R_SPOKE_SUB;
                const dashed = !isMain;

                return (
                  <G key={i}>
                    <Spoke
                      deg={deg}
                      r1={R_SPOKE_START}
                      r2={r2 - 8}
                      color={color}
                      width={isMain ? 2.5 : 1.8}
                      dashed={dashed}
                    />
                    {/* Arrowhead at tip */}
                    <Arrowhead
                      deg={deg}
                      r={r2}
                      color={color}
                      size={isMain ? 8 : 6}
                    />
                  </G>
                );
              })}

              {/* ── Progress arc (filled = done, outline = remaining) ── */}
              {/* Full outline ring */}
              <Path
                d={arcPath(CX, CY, R_ARC_O, R_ARC_I, 0, 359.9)}
                fill="rgba(28,100,160,0.15)"
              />
              {/* Filled progress */}
              {currentDeg > 0 && (
                <Path
                  d={arcPath(CX, CY, R_ARC_O, R_ARC_I, 0, currentDeg)}
                  fill={ACCENT}
                  opacity={0.9}
                />
              )}

              {/* ── Current position spoke — solid white, animated ── */}
              {currentIdx >= 0 && (
                <G>
                  <Spoke
                    deg={currentDeg}
                    r1={R_ARC_I - 4}
                    r2={R_SPOKE_MAIN - 4}
                    color={WHITE}
                    width={3}
                  />
                  {/* Glow dot at cursor tip */}
                  {(() => {
                    const pt = polar(CX, CY, R_SPOKE_MAIN - 4, currentDeg);
                    return (
                      <Circle cx={pt.x} cy={pt.y} r={6} fill={WHITE} opacity={0.95} />
                    );
                  })()}
                </G>
              )}

              {/* ── Center circle ── */}
              <Circle cx={CX} cy={CY} r={R_CENTER} fill={DEEP} />
              <Circle cx={CX} cy={CY} r={R_CENTER - 2} fill={DEEP} />

            </Svg>

            {/* Center text overlay */}
            <View style={fc.centerOverlay}>
              <Text style={fc.centerTime}>{timeStr}</Text>
              <Text style={fc.centerCycle}>
                {currentIdx >= 0 && currentIdx < totalCycles
                  ? `Cycle ${currentIdx + 1}/${totalCycles}`
                  : `${totalCycles} cycles`}
              </Text>
            </View>
          </View>

          {/* Legend */}
          <View style={fc.legend}>
            <LegendItem color={DEEP}      label="Main boundary"  dashed={false} />
            <LegendItem color={ACCENT}    label="Cycle boundary"  dashed={true}  />
            <LegendItem color={CRP_COLOR} label="CRP window"      dashed={true}  />
            <LegendItem color={WHITE}     label="Current position" dashed={false} bg={DEEP} />
          </View>

          {/* Segment details */}
          <View style={fc.details}>
            {segments.map((seg, i) => {
              const isCurrent = seg.isCurrent;
              return (
                <View key={i} style={[fc.detailRow, isCurrent && fc.detailRowActive]}>
                  <View style={[fc.detailDot, {
                    backgroundColor: seg.isCRP ? CRP_COLOR : seg.isPast ? 'rgba(28,159,218,0.4)' : ACCENT
                  }]} />
                  <Text style={[fc.detailLabel, isCurrent && { color: ACCENT, fontWeight: '700' }]}>
                    {seg.label}
                  </Text>
                  <Text style={fc.detailTime}>
                    {fmtMin(seg.startMin)} → {fmtMin(seg.endMin)}
                  </Text>
                  {seg.hasMRM && (
                    <Text style={fc.detailTag}>MRM {fmtMin(seg.startMin + 80)}</Text>
                  )}
                  {seg.isCRP && (
                    <Text style={[fc.detailTag, { color: CRP_COLOR }]}>CRP</Text>
                  )}
                </View>
              );
            })}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Legend item ──────────────────────────────────────────────────────────────
function LegendItem({ color, label, dashed, bg }: { color: string; label: string; dashed: boolean; bg?: string }) {
  return (
    <View style={fc.legendItem}>
      <View style={[fc.legendLine, { backgroundColor: bg ?? 'transparent' }]}>
        <View style={[
          fc.legendLineInner,
          {
            backgroundColor:  dashed ? 'transparent' : color,
            borderColor:       color,
            borderStyle:       dashed ? 'dashed' : 'solid',
            borderWidth:       dashed ? 1.5 : 0,
          }
        ]} />
      </View>
      <Text style={fc.legendTxt}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const fc = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5EEF5',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TEXT_MAIN },
  closeBtn:    { padding: 4 },
  scroll:      { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },

  centerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  centerTime: {
    fontSize:      26,
    fontWeight:    '800',
    color:         WHITE,
    letterSpacing: -0.5,
  },
  centerCycle: {
    fontSize:  12,
    color:     'rgba(255,255,255,0.7)',
    marginTop:  3,
    fontWeight: '500',
  },

  // Legend
  legend: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            12,
    marginTop:      16,
    justifyContent: 'center',
    width:          '100%',
  },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine:      { width: 24, height: 12, justifyContent: 'center', borderRadius: 4 },
  legendLineInner: { height: 2, width: '100%', borderRadius: 1 },
  legendTxt:       { fontSize: 11, color: TEXT_MUTED },

  // Details list
  details: {
    width:     '100%',
    marginTop:  16,
    gap:        2,
  },
  detailRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingVertical:  8,
    paddingHorizontal: 12,
    borderRadius:    10,
  },
  detailRowActive: {
    backgroundColor: '#EAF4FB',
  },
  detailDot:   { width: 8, height: 8, borderRadius: 4 },
  detailLabel: { fontSize: 13, color: TEXT_MAIN, width: 70 },
  detailTime:  { fontSize: 12, color: TEXT_MUTED, flex: 1 },
  detailTag:   { fontSize: 11, fontWeight: '700', color: ACCENT },
});
