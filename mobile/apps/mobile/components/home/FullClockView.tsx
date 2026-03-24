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
  View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions, ScrollView,
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
const GDEG  = 3;                      // gap between segments
const VDEG  = SDEG - GDEG;            // visible arc degrees

// Ring 1 — outer ring (thick)
const R1 = R - 19;    // mid radius
const H1 = 34;        // height

// Ring 2 — inner ring (same segments, thinner)
const R2 = R - 62;
const H2 = 22;

// Width fills the full arc chord with slight overlap for clean look
function segW(r: number) {
  return 2 * r * Math.sin((VDEG / 2) * (Math.PI / 180)) * 1.08;
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
  const [data,   setData]   = useState(() => computeRhythmData(nowMin(), wakeMin, N));
  const [time,   setTime]   = useState(() => fmtMin(nowMin()));
  const [layer,  setLayer]  = useState<'sleep' | 'energy' | 'recovery'>('energy');
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

  // ── Sleep mode: 3 optimal bedtime windows + 30-min pre-sleep zones ──────────
  // R90 rule: bedtime = ARP - (cycles × 90min), so 3 options = ±1 cycle
  // Each option = 1 segment. Pre-sleep = 30min before = 1/3 of a segment.
  const SLEEP_DEG = 360 / N;  // = SDEG
  const bedtimeSegments = [sleepStart - 1, sleepStart, sleepStart + 1].filter(
    i => i >= 0 && i < N,
  );
  // Pre-sleep = 30min = (30/90) × SDEG = 1/3 segment before each bedtime
  const PRE_SLEEP_SPAN = (30 / CYCLE) * SDEG;

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

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.clockWrap}>
          <View style={{ width: D, height: D }}>

            {/* ═══ LAYER 1 — Base ring ═══ */}
            {Array.from({ length: N }, (_, i) => {
              const isSleep = i >= sleepStart;
              const midDeg  = i * SDEG;
              const midRad  = (midDeg - 90) * (Math.PI / 180);
              const x = CX + R1 * Math.cos(midRad);
              const y = CY + R1 * Math.sin(midRad);
              const w = segW(R1);

              // Sleep layer — highlight sleep + optimal bedtime windows
              const sleepHighlight    = layer === 'sleep' && isSleep;
              const isBedtimeOpt      = layer === 'sleep' && bedtimeSegments.includes(i);
              // Recovery layer — highlight CRP segment
              const seg = segments[i];
              const recHighlight   = layer === 'recovery' && seg?.isCRP && !isSleep;

              const baseOpacity = isSleep ? 0.18 : 0.75;
              const opacity     = sleepHighlight  ? 0.80
                : isBedtimeOpt  ? 0.80
                : recHighlight  ? 0.80
                : baseOpacity;
              const color       = sleepHighlight ? NAVY
                : isBedtimeOpt  ? NAVY
                : recHighlight  ? '#D97706'
                : NAVY;

              return (
                <View
                  key={`b${i}`}
                  style={{
                    position:        'absolute',
                    width:           w,
                    height:          H1,
                    borderRadius:    5,
                    backgroundColor: color,
                    opacity,
                    left:            x - w / 2,
                    top:             y - H1 / 2,
                    transform:       [{ rotate: `${midDeg}deg` }],
                  }}
                />
              );
            })}

            {/* ═══ LAYER 1b — Sleep mode: pre-sleep zones + bedtime markers ═══ */}
            {layer === 'sleep' && bedtimeSegments.map(bi => {
              // Pre-sleep zone: thin segment, 30min before this bedtime option
              const preDeg   = bi * SDEG - PRE_SLEEP_SPAN;
              const preRad   = (preDeg - 90) * (Math.PI / 180);
              const px       = CX + R1 * Math.cos(preRad);
              const py       = CY + R1 * Math.sin(preRad);
              const pw       = segW(R1) * (PRE_SLEEP_SPAN / SDEG);

              // Bedtime marker: small bright tick at the boundary
              const tickDeg  = bi * SDEG;
              const tickRad  = (tickDeg - 90) * (Math.PI / 180);
              const tx       = CX + (R1) * Math.cos(tickRad);
              const ty       = CY + (R1) * Math.sin(tickRad);

              return (
                <View key={`pre${bi}`}>
                  {/* Pre-sleep arc — same color as sleep, 50% opacity */}
                  <View style={{
                    position:        'absolute',
                    width:           pw,
                    height:          H1,
                    borderRadius:    5,
                    backgroundColor: NAVY,
                    opacity:         0.40,
                    left:            px - pw / 2,
                    top:             py - H1 / 2,
                    transform:       [{ rotate: `${preDeg}deg` }],
                  }} />
                  {/* Optimal bedtime tick — thin bright line */}
                  <View style={{
                    position:        'absolute',
                    width:           4,
                    height:          H1 + 12,
                    borderRadius:    2,
                    backgroundColor: CYAN,
                    opacity:         1,
                    left:            tx - 2,
                    top:             ty - (H1 + 12) / 2,
                    transform:       [{ rotate: `${tickDeg}deg` }],
                  }} />
                </View>
              );
            })}

            {/* ═══ LAYER 2 — Energy ring (visible only on 'energy' layer) ═══ */}
            {layer === 'energy' && Array.from({ length: N }, (_, i) => {
              const isSleep = i >= sleepStart;
              if (isSleep) return null;
              const energy  = energyMap[i];
              const opacity = energy?.level === 'high' ? 0.75
                : energy?.level === 'neutral'          ? 0.75
                : 0.75;
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
                    borderRadius:    4,
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

        {/* ── Layer selector ── */}
        <View style={s.layerBar}>
          {([
            { id: 'energy',   icon: 'flash-outline',   label: 'Energy'   },
            { id: 'sleep',    icon: 'moon-outline',    label: 'Sleep'    },
            { id: 'recovery', icon: 'fitness-outline', label: 'Recovery' },
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

        {/* ── Layer description ── */}
        <View style={s.desc}>
          {layer === 'energy' && (
            <Text style={s.descText}>Inner ring shows your energy level across 90-min cycles. Brighter = higher energy.</Text>
          )}
          {layer === 'sleep' && (
            <Text style={s.descText}>
              Navy = sleep window ({idealCycles} cycles). Cyan ticks = 3 optimal bedtimes. Faded zones = 30-min wind-down before each.
            </Text>
          )}
          {layer === 'recovery' && (
            <Text style={s.descText}>Your CRP recovery window — the best moment to rest during the day.</Text>
          )}
        </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: BG },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title:     { fontSize: 18, fontWeight: '700', color: TEXT_D },
  scroll:    { alignItems: 'center', paddingBottom: 48 },
  clockWrap: { alignItems: 'center', marginTop: 20 },

  // Panel
  layerBar:     { flexDirection: 'row', gap: 10, marginTop: 28, justifyContent: 'center' },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 24, backgroundColor: 'rgba(20,20,102,0.07)', borderWidth: 1, borderColor: 'rgba(20,20,102,0.10)' },
  chipOn:       { backgroundColor: CYAN, borderColor: CYAN },
  chipLabel:    { fontSize: 13, fontWeight: '600', color: TEXT_M },
  chipLabelOn:  { color: '#FFFFFF' },
  desc:         { marginTop: 16, paddingHorizontal: 32 },
  descText:     { fontSize: 13, color: TEXT_M, textAlign: 'center', lineHeight: 20 },

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
