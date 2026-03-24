/**
 * FullClockView — Circular rhythm clock
 *
 * 24h circle divided into 90-min cycle segments.
 * Readable in 2 seconds.
 *
 * Elements:
 *   - Circle segments (one per cycle)
 *   - Current segment highlighted + animated cursor
 *   - MRM dot on each segment
 *   - CRP icon (⚡)
 *   - Sleep arc (last cycles)
 *   - Sun (top) + Moon marker
 *   - Center: current time + cycle label
 */

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, type RhythmSegment, CYCLE } from '../../lib/rhythm-clock';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const DEEP         = '#141466';
const ACCENT       = '#1c9fda';
const GOLD         = '#F5A623';
const SLEEP_COLOR  = '#0a0a3a';
const EMPTY_ARC    = 'rgba(28,100,160,0.25)';
const FILLED_ARC   = '#1c9fda';
const PAST_ARC     = 'rgba(28,159,218,0.45)';
const TEXT_MAIN    = '#002060';
const TEXT_MUTED   = '#7A9BBC';
const WHITE        = '#FFFFFF';

const { width: SW } = Dimensions.get('window');
const R_OUTER = SW * 0.38;   // outer arc radius
const R_INNER = SW * 0.24;   // inner (hole)
const CX      = SW * 0.5;
const CY      = SW * 0.5;
const ARC_GAP = 3;           // degrees gap between segments

// ─── Math helpers ─────────────────────────────────────────────────────────────

function toRad(deg: number): number { return (deg * Math.PI) / 180; }

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = toRad(deg - 90); // 0° = top
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number, cy: number,
  rOuter: number, rInner: number,
  startDeg: number, endDeg: number,
): string {
  const gap   = ARC_GAP / 2;
  const s     = startDeg + gap;
  const e     = endDeg   - gap;
  const p1    = polarToXY(cx, cy, rOuter, s);
  const p2    = polarToXY(cx, cy, rOuter, e);
  const p3    = polarToXY(cx, cy, rInner, e);
  const p4    = polarToXY(cx, cy, rInner, s);
  const large = e - s > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

// ─── Clock segment ─────────────────────────────────────────────────────────────

interface ClockSegmentProps {
  seg:        RhythmSegment;
  startDeg:   number;
  endDeg:     number;
  totalCycles: number;
  onPress:    (seg: RhythmSegment) => void;
}

function ClockSegment({ seg, startDeg, endDeg, totalCycles, onPress }: ClockSegmentProps) {
  const fill = seg.isCurrent
    ? ACCENT
    : seg.isPast
    ? PAST_ARC
    : seg.isSleep
    ? SLEEP_COLOR
    : EMPTY_ARC;

  const path = arcPath(CX, CY, R_OUTER, R_INNER, startDeg, endDeg);
  const midDeg = (startDeg + endDeg) / 2;

  // MRM dot — at 80min into cycle = ~88% of arc
  const mrmDeg = startDeg + (endDeg - startDeg) * 0.88;
  const mrmR   = (R_OUTER + R_INNER) / 2;
  const mrmPt  = polarToXY(CX, CY, mrmR, mrmDeg);

  // CRP flash — center of arc
  const crpPt  = polarToXY(CX, CY, mrmR, midDeg);

  return (
    <G>
      <Path d={path} fill={fill} onPress={() => onPress(seg)} />
      {/* MRM dot */}
      {seg.hasMRM && !seg.isPast && !seg.isSleep && (
        <Circle cx={mrmPt.x} cy={mrmPt.y} r={3} fill="rgba(255,255,255,0.45)" />
      )}
      {/* CRP ⚡ — approximate via circle */}
      {seg.isCRP && !seg.isPast && (
        <Circle cx={crpPt.x} cy={crpPt.y} r={5} fill={GOLD} />
      )}
    </G>
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
  const [selected, setSelected] = useState<RhythmSegment | null>(null);

  useEffect(() => {
    if (!visible) return;
    setData(computeRhythmData(nowMin(), wakeMin, idealCycles));
    const id = setInterval(() => setData(computeRhythmData(nowMin(), wakeMin, idealCycles)), 30_000);
    return () => clearInterval(id);
  }, [visible, wakeMin, idealCycles]);

  // Cursor animation
  const cursorPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorPulse, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(cursorPulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const { segments, totalCycles, currentIdx, cursorPct } = data;
  const degPerCycle = 360 / totalCycles;

  // Cursor position
  const cursorDeg = currentIdx >= 0
    ? currentIdx * degPerCycle + cursorPct * degPerCycle
    : 0;
  const cursorR   = (R_OUTER + R_INNER) / 2;
  const cursorPt  = polarToXY(CX, CY, cursorR, cursorDeg);

  // Sun + Moon positions
  const sunPt  = polarToXY(CX, CY, R_OUTER + 18, 0);    // top
  const moonPt = polarToXY(CX, CY, R_OUTER + 18, (totalCycles > 0 ? (totalCycles - 1) * degPerCycle + degPerCycle / 2 : 180));

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

        <ScrollView
          contentContainerStyle={fc.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Clock */}
          <View style={[fc.clockWrap, { width: SW, height: SW }]}>
            <Svg width={SW} height={SW}>
              {/* Segments */}
              {segments.map((seg, i) => (
                <ClockSegment
                  key={seg.index}
                  seg={seg}
                  startDeg={i * degPerCycle}
                  endDeg={(i + 1) * degPerCycle}
                  totalCycles={totalCycles}
                  onPress={setSelected}
                />
              ))}

              {/* Cursor dot */}
              <Circle
                cx={cursorPt.x}
                cy={cursorPt.y}
                r={7}
                fill={WHITE}
                opacity={0.95}
              />
            </Svg>

            {/* Center info */}
            <View style={fc.center}>
              <Text style={fc.centerTime}>{fmtMin(data.nowMin)}</Text>
              <Text style={fc.centerCycle}>
                {currentIdx >= 0 && currentIdx < totalCycles
                  ? `Cycle ${currentIdx + 1}/${totalCycles}`
                  : '—'}
              </Text>
            </View>

            {/* Sun top / Moon near sleep */}
            <View style={[fc.sunWrap, { top: 4, left: CX - 10 }]}>
              <Text style={{ fontSize: 18 }}>☀️</Text>
            </View>
          </View>

          {/* Legend */}
          <View style={fc.legend}>
            <View style={fc.legendItem}>
              <View style={[fc.dot, { backgroundColor: ACCENT }]} />
              <Text style={fc.legendTxt}>Current / past cycle</Text>
            </View>
            <View style={fc.legendItem}>
              <View style={[fc.dot, { backgroundColor: EMPTY_ARC, borderWidth: 1, borderColor: ACCENT }]} />
              <Text style={fc.legendTxt}>Upcoming cycle</Text>
            </View>
            <View style={fc.legendItem}>
              <View style={[fc.dot, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
              <Text style={fc.legendTxt}>MRM marker</Text>
            </View>
            <View style={fc.legendItem}>
              <View style={[fc.dot, { backgroundColor: GOLD }]} />
              <Text style={fc.legendTxt}>CRP window</Text>
            </View>
            <View style={fc.legendItem}>
              <View style={[fc.dot, { backgroundColor: SLEEP_COLOR }]} />
              <Text style={fc.legendTxt}>Sleep window</Text>
            </View>
          </View>

          {/* Selected segment detail */}
          {selected !== null && (
            <View style={fc.detail}>
              <Text style={fc.detailTitle}>{selected.label}</Text>
              <Text style={fc.detailSub}>
                {fmtMin(selected.startMin)} → {fmtMin(selected.endMin)}
                {selected.isCRP ? '  ·  CRP window' : ''}
                {selected.hasMRM ? `  ·  MRM at ${fmtMin(selected.startMin + 80)}` : ''}
                {selected.isSleep ? '  ·  Sleep window' : ''}
              </Text>
              <Pressable onPress={() => setSelected(null)} style={fc.detailClose}>
                <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '600' }}>Close</Text>
              </Pressable>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const fc = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5EEF5',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TEXT_MAIN },
  closeBtn:    { padding: 4 },
  scroll:      { alignItems: 'center' },

  clockWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  center: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  centerTime: {
    fontSize:      28,
    fontWeight:    '700',
    color:         TEXT_MAIN,
    letterSpacing: -0.5,
  },
  centerCycle: {
    fontSize:  13,
    color:     TEXT_MUTED,
    marginTop:  4,
    fontWeight: '500',
  },
  sunWrap:  { position: 'absolute' },

  legend: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            12,
    paddingHorizontal: 24,
    marginTop:      8,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:        { width: 10, height: 10, borderRadius: 5 },
  legendTxt:  { fontSize: 12, color: TEXT_MUTED },

  detail: {
    marginHorizontal: 20,
    marginTop:        20,
    padding:          16,
    borderRadius:     16,
    backgroundColor:  '#EAF4FB',
    gap:              6,
  },
  detailTitle: { fontSize: 15, fontWeight: '700', color: TEXT_MAIN },
  detailSub:   { fontSize: 13, color: TEXT_MUTED, lineHeight: 18 },
  detailClose: { alignSelf: 'flex-start', marginTop: 4 },
});
