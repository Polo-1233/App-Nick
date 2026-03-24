/**
 * FullClockView — R90 Day Clock
 *
 * 16 segments (= 16 × 90min = 24h) disposés en cercle.
 * Chaque segment = rectangle arrondi rotaté sur son axe.
 * Double anneau concentrique (outer épais, inner fin).
 * Cyan = cycles actifs / passés. Navy = futurs / sommeil.
 * Heure au centre.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, CYCLE } from '../../lib/rhythm-clock';
import type { PeakPreference } from '../../lib/energy-model';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const NAVY   = '#141466';
const CYAN   = '#1c9fda';
const BG     = '#FFFFFF';
const TEXT_D = '#002060';
const TEXT_M = '#5A7A9A';
const TEXT_F = '#9BB5CC';

// ─── Layout ───────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const D    = SW - 80;      // clock diameter
const R    = D / 2;        // clock radius
const CX   = R;
const CY   = R;

// Rings — midpoint radii and heights
const OUTER_R = R - 20;    // outer ring mid radius
const OUTER_H = 34;        // segment height (thickness)
const INNER_R = R - 62;    // inner ring mid radius
const INNER_H = 22;        // segment height

const N_SEGS   = 16;       // 16 × 90min = 24h
const SEG_DEG  = 360 / N_SEGS;   // 22.5° per segment
const GAP_DEG  = 4;        // white gap in degrees
const VIS_DEG  = SEG_DEG - GAP_DEG;  // visible arc degrees

// ─── Segment width from arc length ────────────────────────────────────────────
function segWidth(r: number) {
  return 2 * r * Math.sin((VIS_DEG / 2) * (Math.PI / 180));
}

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
  visible, onClose, wakeMin, idealCycles,
}: FullClockViewProps) {
  const [data, setData] = useState(() => computeRhythmData(nowMin(), wakeMin, N_SEGS));
  const [time, setTime] = useState(() => fmtMin(nowMin()));

  // Cursor pulse
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const tick = () => {
      setData(computeRhythmData(nowMin(), wakeMin, N_SEGS));
      setTime(fmtMin(nowMin()));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [visible, wakeMin]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.5, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  const { segments, currentIdx } = data;
  const isActive   = currentIdx >= 0 && currentIdx < N_SEGS;
  const curSeg     = isActive ? segments[currentIdx] : null;
  const elapsed    = curSeg ? ((nowMin() - curSeg.startMin + 1440) % 1440) : 0;
  const pct        = Math.min(1, elapsed / CYCLE);
  const remaining  = isActive ? Math.max(0, CYCLE - elapsed) : 0;

  // Sleep window = last idealCycles segments
  const sleepStart = N_SEGS - idealCycles;

  // Cursor position on outer ring
  const cursorDeg = isActive
    ? currentIdx * SEG_DEG + pct * SEG_DEG
    : Math.max(0, currentIdx) * SEG_DEG;
  const cursorRad = (cursorDeg - 90) * (Math.PI / 180);
  const cursorPt  = {
    x: CX + OUTER_R * Math.cos(cursorRad),
    y: CY + OUTER_R * Math.sin(cursorRad),
  };

  // Center label
  const cycleLabel = isActive
    ? `Cycle ${currentIdx + 1} / ${N_SEGS}`
    : currentIdx < 0 ? 'Day starting' : 'Day complete';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Day View</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={TEXT_M} />
          </Pressable>
        </View>

        {/* Clock */}
        <View style={s.clockWrap}>
          <View style={{ width: D, height: D }}>

            {/* Segments */}
            {Array.from({ length: N_SEGS }, (_, i) => {
              const seg     = segments[i];
              const isCurr  = seg?.isCurrent && isActive;
              const isPast  = (seg?.isPast ?? false) || (!isActive && currentIdx >= N_SEGS);
              const isSleep = i >= sleepStart;

              // Color: cyan = current or past active cycles · navy = future / sleep
              const color   = (isCurr || isPast) && !isSleep ? CYAN
                : isCurr && isSleep ? CYAN
                : NAVY;
              const opacity = isCurr  ? 1
                : isPast   ? 0.55
                : isSleep  ? 0.70
                : 0.80;

              // Mid-angle for this segment (0° = top, clockwise)
              const midDeg = i * SEG_DEG;
              const midRad = (midDeg - 90) * (Math.PI / 180);

              // Outer segment
              const ox = CX + OUTER_R * Math.cos(midRad);
              const oy = CY + OUTER_R * Math.sin(midRad);
              const ow = segWidth(OUTER_R);

              // Inner segment
              const ix = CX + INNER_R * Math.cos(midRad);
              const iy = CY + INNER_R * Math.sin(midRad);
              const iw = segWidth(INNER_R);

              return (
                <View key={i}>
                  {/* Outer */}
                  <View
                    style={{
                      position:        'absolute',
                      width:           ow,
                      height:          OUTER_H,
                      borderRadius:    OUTER_H / 2,
                      backgroundColor: color,
                      opacity,
                      left:            ox - ow / 2,
                      top:             oy - OUTER_H / 2,
                      transform:       [{ rotate: `${midDeg}deg` }],
                    }}
                  />
                  {/* Inner */}
                  <View
                    style={{
                      position:        'absolute',
                      width:           iw,
                      height:          INNER_H,
                      borderRadius:    INNER_H / 2,
                      backgroundColor: color,
                      opacity,
                      left:            ix - iw / 2,
                      top:             iy - INNER_H / 2,
                      transform:       [{ rotate: `${midDeg}deg` }],
                    }}
                  />
                </View>
              );
            })}

            {/* Cursor — dot + pulse ring */}
            {isActive && (
              <>
                <Animated.View style={[s.cursorRing, {
                  left:      cursorPt.x - 12,
                  top:       cursorPt.y - 12,
                  opacity:   Animated.subtract(new Animated.Value(0.7), Animated.multiply(new Animated.Value(0.7), Animated.subtract(pulse, new Animated.Value(1)))),
                  transform: [{ scale: pulse }],
                }]} />
                <View style={[s.cursorDot, { left: cursorPt.x - 6, top: cursorPt.y - 6 }]} />
              </>
            )}

            {/* Center */}
            <View style={s.center} pointerEvents="none">
              <Text style={s.timeText}>{time}</Text>
              <Text style={s.r90}>R90</Text>
              <Text style={s.cycleTxt}>{cycleLabel}</Text>
              {remaining > 0 && (
                <Text style={s.remTxt}>{Math.round(remaining)} min</Text>
              )}
            </View>

          </View>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: BG },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title:    { fontSize: 18, fontWeight: '700', color: TEXT_D },
  clockWrap:{ alignItems: 'center', marginTop: 16 },

  cursorRing: {
    position:     'absolute',
    width:        24,
    height:       24,
    borderRadius: 12,
    borderWidth:  2,
    borderColor:  CYAN,
  },
  cursorDot: {
    position:        'absolute',
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: CYAN,
    shadowColor:     CYAN,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    8,
    elevation:       10,
  },

  center: {
    position:   'absolute',
    left:       CX - 70,
    top:        CY - 48,
    width:      140,
    alignItems: 'center',
    gap:        3,
  },
  timeText: { fontSize: 42, fontWeight: '800', color: TEXT_D, letterSpacing: -2 },
  r90:      { fontSize: 11, fontWeight: '800', color: CYAN, letterSpacing: 4 },
  cycleTxt: { fontSize: 12, fontWeight: '600', color: TEXT_M },
  remTxt:   { fontSize: 11, color: TEXT_F },
});
