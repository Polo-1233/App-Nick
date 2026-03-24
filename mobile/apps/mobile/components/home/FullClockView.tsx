/**
 * FullClockView — R90 Day Clock (minimal)
 *
 * 3 layers:
 *   1. Base ring   — 16 segments, très légers (quasi fond)
 *   2. Energy ring — opacité seule (high/neutral/low)
 *   3. Overlay     — gros point heure courante + 1 marqueur futur
 *
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
import { getEnergyMap, type PeakPreference } from '../../lib/energy-model';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const NAVY     = '#141466';
const CYAN     = '#1c9fda';
const BG       = '#FFFFFF';
const TEXT_D   = '#002060';
const TEXT_M   = '#5A7A9A';
const TEXT_F   = '#B0C8DD';

// ─── Layout ───────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const D   = SW - 80;
const R   = D / 2;
const CX  = R;
const CY  = R;

const N     = 16;                     // 16 × 90min = 24h
const SDEG  = 360 / N;                // 22.5° per segment
const GDEG  = 5;                      // gap between segments
const VDEG  = SDEG - GDEG;            // visible arc degrees

// Ring 1 — base ring (segments)
const R1 = R - 22;    // mid radius
const H1 = 30;        // height

// Ring 2 — energy ring (thin, just inside)
const R2 = R - 60;
const H2 = 16;

function segW(r: number) {
  return 2 * r * Math.sin((VDEG / 2) * (Math.PI / 180));
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
export function FullClockView({ visible, onClose, wakeMin, idealCycles, peakPreference = 'morning' }: FullClockViewProps) {
  const [data, setData] = useState(() => computeRhythmData(nowMin(), wakeMin, N));
  const [time, setTime] = useState(() => fmtMin(nowMin()));
  const pulse = useRef(new Animated.Value(1)).current;

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

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.8, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
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

  // ── Overlay: current time dot position ──────────────────────────────────────
  const curDeg = isActive ? currentIdx * SDEG + pct * SDEG : Math.max(0, currentIdx) * SDEG;
  const curRad = (curDeg - 90) * (Math.PI / 180);
  const curPt  = { x: CX + R1 * Math.cos(curRad), y: CY + R1 * Math.sin(curRad) };

  // ── Overlay: next action (MRM or CRP) — only 1 ──────────────────────────────
  let nextMarker: { label: string; deg: number } | null = null;

  if (isActive) {
    // MRM in current cycle (~80 min)
    const minsToMRM = 80 - elapsed;
    if (minsToMRM > 0 && segments[currentIdx]?.hasMRM) {
      const mrmDeg = currentIdx * SDEG + (80 / CYCLE) * SDEG;
      nextMarker = { label: `MRM ${Math.round(minsToMRM)}m`, deg: mrmDeg };
    } else {
      // CRP upcoming
      const crpIdx = segments.findIndex((s, i) => s.isCRP && i >= currentIdx && !s.isPast);
      if (crpIdx >= 0) {
        nextMarker = { label: 'CRP', deg: crpIdx * SDEG + SDEG / 2 };
      }
    }
  }

  const nextRad = nextMarker ? (nextMarker.deg - 90) * (Math.PI / 180) : null;
  const nextPt  = nextRad ? { x: CX + R1 * Math.cos(nextRad), y: CY + R1 * Math.sin(nextRad) } : null;

  const cycleLabel = isActive
    ? `Cycle ${currentIdx + 1} · ${Math.round(remaining)} min left`
    : currentIdx < 0 ? 'Day not started' : 'Day complete';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root} edges={['top']}>

        <View style={s.header}>
          <Text style={s.title}>Day View</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={TEXT_M} />
          </Pressable>
        </View>

        <View style={s.clockWrap}>
          <View style={{ width: D, height: D }}>

            {/* ═══ LAYER 1 — Base ring (very light) ═══ */}
            {Array.from({ length: N }, (_, i) => {
              const isSleep = i >= sleepStart;
              const midDeg  = i * SDEG;
              const midRad  = (midDeg - 90) * (Math.PI / 180);
              const x = CX + R1 * Math.cos(midRad);
              const y = CY + R1 * Math.sin(midRad);
              const w = segW(R1);

              return (
                <View
                  key={`b${i}`}
                  style={{
                    position:        'absolute',
                    width:           w,
                    height:          H1,
                    borderRadius:    H1 / 2,
                    backgroundColor: isSleep ? NAVY : NAVY,
                    opacity:         isSleep ? 0.12 : 0.08,
                    left:            x - w / 2,
                    top:             y - H1 / 2,
                    transform:       [{ rotate: `${midDeg}deg` }],
                  }}
                />
              );
            })}

            {/* ═══ LAYER 2 — Energy ring (opacity only) ═══ */}
            {Array.from({ length: N }, (_, i) => {
              const isSleep = i >= sleepStart;
              if (isSleep) return null;
              const energy  = energyMap[i];
              const opacity = energy?.level === 'high' ? 0.50
                : energy?.level === 'neutral'          ? 0.28
                : 0.10;
              const midDeg = i * SDEG;
              const midRad = (midDeg - 90) * (Math.PI / 180);
              const x = CX + R2 * Math.cos(midRad);
              const y = CY + R2 * Math.sin(midRad);
              const w = segW(R2);

              return (
                <View
                  key={`e${i}`}
                  style={{
                    position:        'absolute',
                    width:           w,
                    height:          H2,
                    borderRadius:    H2 / 2,
                    backgroundColor: CYAN,
                    opacity,
                    left:            x - w / 2,
                    top:             y - H2 / 2,
                    transform:       [{ rotate: `${midDeg}deg` }],
                  }}
                />
              );
            })}

            {/* ═══ LAYER 3 — Overlay ═══ */}

            {/* Current time — gros point */}
            {isActive && (
              <>
                <Animated.View style={[s.cursorPulse, {
                  left:      curPt.x - 14,
                  top:       curPt.y - 14,
                  opacity:   0.25,
                  transform: [{ scale: pulse }],
                }]} />
                <View style={[s.cursorDot, { left: curPt.x - 9, top: curPt.y - 9 }]} />
              </>
            )}

            {/* Next action marker — 1 seul */}
            {nextMarker && nextPt && (
              <View style={[s.nextMarkerWrap, { left: nextPt.x - 20, top: nextPt.y - 20 }]}>
                <View style={s.nextDot} />
                <Text style={s.nextLabel}>{nextMarker.label}</Text>
              </View>
            )}

            {/* Center */}
            <View style={s.center} pointerEvents="none">
              <Text style={s.timeText}>{time}</Text>
              <Text style={s.r90}>R90</Text>
              {isActive && (
                <Text style={s.cycleTxt}>{cycleLabel}</Text>
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
  root:      { flex: 1, backgroundColor: BG },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title:     { fontSize: 18, fontWeight: '700', color: TEXT_D },
  clockWrap: { alignItems: 'center', marginTop: 20 },

  cursorPulse: {
    position:        'absolute',
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: CYAN,
  },
  cursorDot: {
    position:        'absolute',
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: CYAN,
    shadowColor:     CYAN,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.9,
    shadowRadius:    10,
    elevation:       12,
  },

  nextMarkerWrap: {
    position:   'absolute',
    width:      40,
    height:     40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  nextDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#D97706',
  },
  nextLabel: {
    fontSize:   8,
    fontWeight: '700',
    color:      '#D97706',
    textAlign:  'center',
  },

  center: {
    position:   'absolute',
    left:       CX - 70,
    top:        CY - 46,
    width:      140,
    alignItems: 'center',
    gap:        4,
  },
  timeText: { fontSize: 44, fontWeight: '800', color: TEXT_D, letterSpacing: -2 },
  r90:      { fontSize: 11, fontWeight: '800', color: CYAN, letterSpacing: 4 },
  cycleTxt: { fontSize: 11, color: TEXT_F, textAlign: 'center' },
});
