/**
 * FullClockView — Radial rhythm clock (RN Views, no SVG dependency)
 *
 * Spokes rendered with rotated thin Views.
 * Center circle with current time.
 * Arc progress via rotated Views (technique "pie slice").
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, type RhythmSegment } from '../../lib/rhythm-clock';

const DEEP       = '#141466';
const ACCENT     = '#1c9fda';
const GOLD       = '#F5A623';
const CRP_COLOR  = '#E05555';
const WHITE      = '#FFFFFF';
const TEXT_MAIN  = '#002060';
const TEXT_MUTED = '#7A9BBC';

const { width: SW }  = Dimensions.get('window');
const CLOCK_SIZE     = SW - 60;
const CLOCK_R        = CLOCK_SIZE / 2;
const CENTER_R       = CLOCK_R * 0.28;   // center circle radius
const SPOKE_W        = 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toRad(deg: number) { return (deg * Math.PI) / 180; }

// Rotate 0° = top, clockwise
function degToStyle(deg: number, r: number, len: number) {
  // A spoke is a thin View, rotated about its top center
  return {
    position:        'absolute' as const,
    top:             CLOCK_R - r,         // from center minus how far up it goes
    left:            CLOCK_R - SPOKE_W / 2,
    width:           SPOKE_W,
    height:          len,
    transformOrigin: 'top',
    transform:       [
      { translateX: 0 },
      { translateY: -(CLOCK_R - r) },     // pivot to clock center
      { rotate:     `${deg}deg` },
      { translateY: CLOCK_R - r },
    ] as any,
  };
}

// ─── Spoke ───────────────────────────────────────────────────────────────────

interface SpokeProps {
  deg:    number;
  color:  string;
  width?: number;
  inner:  number;   // inner radius
  outer:  number;   // outer radius
  dashed?: boolean;
}

function Spoke({ deg, color, width = 2, inner, outer, dashed }: SpokeProps) {
  const len    = outer - inner;
  const cx     = CLOCK_R;
  const cy     = CLOCK_R;
  const rad    = toRad(deg - 90);
  const x1     = cx + inner  * Math.cos(rad);
  const y1     = cy + inner  * Math.sin(rad);

  // Render spoke as a small rotated View
  return (
    <View
      style={{
        position:  'absolute',
        left:      x1 - width / 2,
        top:       y1 - width / 2,
        width:     width,
        height:    len,
        backgroundColor: dashed ? 'transparent' : color,
        borderLeftWidth:  dashed ? width : 0,
        borderLeftColor:  dashed ? color : 'transparent',
        borderStyle:      dashed ? 'dashed' : 'solid',
        transform: [
          { rotate: `${deg}deg` },
          { translateY: 0 },
        ],
        transformOrigin: 'top center' as any,
      }}
    />
  );
}

// ─── Clock dot at angle ───────────────────────────────────────────────────────
function ClockDot({ deg, r, size, color }: { deg: number; r: number; size: number; color: string }) {
  const rad = toRad(deg - 90);
  const x   = CLOCK_R + r * Math.cos(rad);
  const y   = CLOCK_R + r * Math.sin(rad);
  return (
    <View style={{
      position:        'absolute',
      left:            x - size / 2,
      top:             y - size / 2,
      width:           size,
      height:          size,
      borderRadius:    size / 2,
      backgroundColor: color,
      shadowColor:     color,
      shadowOffset:    { width: 0, height: 0 },
      shadowOpacity:   0.8,
      shadowRadius:    6,
      elevation:       4,
    }} />
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
  const [data, setData]   = useState(() => computeRhythmData(nowMin(), wakeMin, idealCycles));
  const [timeStr, setTime] = useState(() => fmtMin(nowMin()));

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

  // Pulse animation for cursor dot
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const { segments, totalCycles, currentIdx, cursorPct } = data;
  const degPerCycle = 360 / Math.max(totalCycles, 1);

  // Current spoke angle
  const cursorDeg = currentIdx >= 0
    ? currentIdx * degPerCycle + cursorPct * degPerCycle
    : 0;

  const INNER = CENTER_R + 8;
  const OUTER = CLOCK_R - 8;
  const MID   = (INNER + OUTER) / 2;

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
          <Text style={fc.title}>Your Rhythm</Text>
          <Pressable onPress={onClose} hitSlop={12} style={fc.closeBtn}>
            <Ionicons name="close" size={20} color={TEXT_MUTED} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={fc.scroll} showsVerticalScrollIndicator={false}>

          {/* Clock */}
          <View style={{ width: CLOCK_SIZE, height: CLOCK_SIZE }}>

            {/* Background circle */}
            <View style={[fc.bgCircle, {
              width: CLOCK_SIZE, height: CLOCK_SIZE, borderRadius: CLOCK_R,
            }]} />

            {/* Cycle boundary spokes */}
            {segments.map((seg, i) => {
              const deg     = i * degPerCycle;
              const isMain  = i % 3 === 0;
              const isCRP   = seg.isCRP;
              const color   = isCRP ? CRP_COLOR : isMain ? DEEP : ACCENT;
              const spokeW  = isMain ? 2.5 : 1.5;
              const outerR  = isMain ? OUTER : MID + 16;

              return (
                <View key={i} style={{ position: 'absolute', left: 0, top: 0, width: CLOCK_SIZE, height: CLOCK_SIZE }}>
                  {/* Spoke line using absolute positioned view + transform */}
                  {(() => {
                    const rad = toRad(deg - 90);
                    const x1  = CLOCK_R + INNER * Math.cos(rad);
                    const y1  = CLOCK_R + INNER * Math.sin(rad);
                    const x2  = CLOCK_R + outerR * Math.cos(rad);
                    const y2  = CLOCK_R + outerR * Math.sin(rad);
                    const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
                    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;

                    return (
                      <View style={{
                        position:        'absolute',
                        left:            x1 - spokeW / 2,
                        top:             y1 - len / 2,
                        width:           spokeW,
                        height:          len,
                        backgroundColor: isCRP ? CRP_COLOR : !isMain ? 'transparent' : color,
                        borderLeftWidth:  !isMain ? spokeW : 0,
                        borderLeftColor:  !isMain ? color : 'transparent',
                        borderStyle:      !isMain ? 'dashed' : 'solid',
                        borderRadius:     spokeW / 2,
                        transform:       [
                          { translateY: len / 2 - (y1 - CLOCK_R + INNER) },
                          { rotate:     `${angle}deg` },
                        ],
                        transformOrigin: 'center center' as any,
                      }} />
                    );
                  })()}

                  {/* Arrowhead dot at tip */}
                  <ClockDot
                    deg={deg}
                    r={outerR + 6}
                    size={isMain ? 8 : 5}
                    color={color}
                  />

                  {/* MRM dot inside cycle */}
                  {seg.hasMRM && !seg.isPast && (
                    <ClockDot
                      deg={deg + degPerCycle * 0.88}
                      r={MID}
                      size={5}
                      color="rgba(255,255,255,0.5)"
                    />
                  )}
                </View>
              );
            })}

            {/* Current position spoke — white, animated dot */}
            {currentIdx >= 0 && (
              <>
                {(() => {
                  const rad = toRad(cursorDeg - 90);
                  const x1  = CLOCK_R + INNER * Math.cos(rad);
                  const y1  = CLOCK_R + INNER * Math.sin(rad);
                  const x2  = CLOCK_R + OUTER * Math.cos(rad);
                  const y2  = CLOCK_R + OUTER * Math.sin(rad);
                  const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
                  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;

                  return (
                    <View style={{
                      position:        'absolute',
                      left:            x1 - 2,
                      top:             y1 - len / 2,
                      width:           3,
                      height:          len,
                      backgroundColor: WHITE,
                      borderRadius:    2,
                      transform:       [
                        { translateY: len / 2 - (y1 - CLOCK_R + INNER) },
                        { rotate:     `${angle}deg` },
                      ],
                      transformOrigin: 'center center' as any,
                      shadowColor:     WHITE,
                      shadowOffset:    { width: 0, height: 0 },
                      shadowOpacity:   0.8,
                      shadowRadius:    6,
                      elevation:       5,
                    }} />
                  );
                })()}
                {/* Animated cursor dot at tip */}
                <Animated.View style={{
                  position:  'absolute',
                  left:      CLOCK_R + OUTER * Math.cos(toRad(cursorDeg - 90)) - 8,
                  top:       CLOCK_R + OUTER * Math.sin(toRad(cursorDeg - 90)) - 8,
                  width:     16,
                  height:    16,
                  borderRadius: 8,
                  backgroundColor: WHITE,
                  shadowColor: WHITE,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 8,
                  elevation: 6,
                  transform: [{ scale: pulse }],
                }} />
              </>
            )}

            {/* Center circle */}
            <View style={[fc.centerCircle, {
              width:        CENTER_R * 2,
              height:       CENTER_R * 2,
              borderRadius: CENTER_R,
              left:         CLOCK_R - CENTER_R,
              top:          CLOCK_R - CENTER_R,
            }]}>
              <Text style={fc.centerTime}>{timeStr}</Text>
              <Text style={fc.centerCycle}>
                {currentIdx >= 0 && currentIdx < totalCycles
                  ? `Cycle ${currentIdx + 1}/${totalCycles}`
                  : `${totalCycles} cycles`}
              </Text>
            </View>

          </View>

          {/* Cycle list */}
          <View style={fc.list}>
            {segments.map((seg) => (
              <View
                key={seg.index}
                style={[fc.listRow, seg.isCurrent && fc.listRowActive]}
              >
                <View style={[fc.listDot, {
                  backgroundColor: seg.isCRP
                    ? CRP_COLOR
                    : seg.isPast
                    ? 'rgba(28,159,218,0.4)'
                    : ACCENT,
                }]} />
                <Text style={[fc.listLabel, seg.isCurrent && { color: ACCENT, fontWeight: '700' }]}>
                  {seg.label}
                </Text>
                <Text style={fc.listTime}>
                  {fmtMin(seg.startMin)} → {fmtMin(seg.endMin)}
                </Text>
                {seg.hasMRM && (
                  <Text style={fc.listTag}>MRM {fmtMin(seg.startMin + 80)}</Text>
                )}
                {seg.isCRP && (
                  <Text style={[fc.listTag, { color: CRP_COLOR }]}>CRP</Text>
                )}
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
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
  title:    { fontSize: 17, fontWeight: '700', color: TEXT_MAIN },
  closeBtn: { padding: 4 },
  scroll:   { alignItems: 'center', paddingTop: 16, paddingHorizontal: 20 },

  bgCircle: {
    position:        'absolute',
    backgroundColor: '#EAF4FB',
  },
  centerCircle: {
    position:       'absolute',
    backgroundColor: DEEP,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    DEEP,
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.3,
    shadowRadius:   12,
    elevation:      6,
  },
  centerTime:  { fontSize: 22, fontWeight: '800', color: WHITE, letterSpacing: -0.5 },
  centerCycle: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  list:        { width: '100%', marginTop: 20, gap: 2 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
  },
  listRowActive: { backgroundColor: '#EAF4FB' },
  listDot:   { width: 8, height: 8, borderRadius: 4 },
  listLabel: { fontSize: 13, color: TEXT_MAIN, width: 70 },
  listTime:  { fontSize: 12, color: TEXT_MUTED, flex: 1 },
  listTag:   { fontSize: 11, fontWeight: '700', color: ACCENT },
});
