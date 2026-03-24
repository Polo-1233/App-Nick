/**
 * FullClockView — R90 Day Clock v3
 *
 * Visual hierarchy (what the eye sees first):
 *   1. Current time dot (glowing, unmissable)
 *   2. Sleep zone (dark arc, clearly different)
 *   3. MRM / CRP markers (subtle ticks)
 *   4. Energy outer ring (very faint opacity variation)
 *   5. Cycle gaps (separators only)
 *
 * Two concentric rings:
 *   - Outer thin ring  → energy layer (opacity = high/neutral/low)
 *   - Inner thick ring → 16 × 90min cycle segments + sleep zone
 *
 * No text on clock. Tap → tooltip only.
 * Full 360° = 24h starting at wakeMin.
 */

import { useEffect, useRef, useState, memo } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData, CYCLE } from '../../lib/rhythm-clock';
import { getEnergyMap, type PeakPreference } from '../../lib/energy-model';

// ─── Palette ──────────────────────────────────────────────────────────────────
const ACCENT   = '#1c9fda';
const NAVY     = '#141466';
const TEXT_D   = '#002060';
const TEXT_M   = '#5A7A9A';
const TEXT_F   = '#9BB5CC';
const BG       = '#F5F9FF';

// Ring colors
const C_WAKE   = NAVY;                            // cycles = navy (like reference image)
const C_SLEEP  = '#0a1840';                       // sleep zone = deeper navy
const C_RING   = 'rgba(28,159,218,0.09)';         // base ring (empty)
const C_ENERGY = ACCENT;                          // energy outer ring (opacity varies)
const C_CURSOR = '#FFFFFF';

// ─── Layout ───────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const D        = SW - 64;               // total clock diameter
const R        = D / 2;
const CX       = R;
const CY       = R;

// Main ring
const R1_O  = R - 6;                    // outer radius
const R1_I  = R - 50;                   // inner radius (44px thick)
const R1_M  = (R1_O + R1_I) / 2;

// Energy ring (thin, just inside main ring)
const R2_O  = R - 58;
const R2_I  = R - 66;
const R2_M  = (R2_O + R2_I) / 2;

const DAY_CYCLES  = 16;
const SEG_DEG     = 360 / DAY_CYCLES;  // 22.5°
const GAP_DEG     = 8;                 // clean gap
const ARC_DEG     = SEG_DEG - GAP_DEG; // 14.5° arc

// ─── Arc renderer — smooth fill + rounded caps ────────────────────────────────

function arcChunks(
  startDeg: number,
  spanDeg:  number,
  rO:       number,
  rI:       number,
  color:    string,
  opacity:  number,
) {
  if (spanDeg <= 0) return [];
  const STEP = 0.5;
  const cnt  = Math.ceil(spanDeg / STEP);
  const h    = rO - rI;
  const rM   = rI + h / 2;
  const w    = Math.max(3, 2 * rM * Math.sin((STEP * Math.PI) / 180) * 1.6 + 1);

  const chunks = Array.from({ length: cnt }, (_, i) => {
    const deg = startDeg + i * STEP + STEP / 2;
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: CX + rM * Math.cos(rad), y: CY + rM * Math.sin(rad), w, h, deg, color, opacity, cap: false };
  });

  // Rounded caps — circles at start and end of arc
  const capRadius = h / 2;
  const addCap = (deg: number) => {
    const rad = (deg - 90) * (Math.PI / 180);
    chunks.push({ x: CX + rM * Math.cos(rad), y: CY + rM * Math.sin(rad), w: h, h, deg: 0, color, opacity, cap: true });
  };
  addCap(startDeg);
  addCap(startDeg + spanDeg);

  return chunks;
}

// Static arc — memo'd to avoid re-render on every frame
const StaticArc = memo(function StaticArc({
  chunks,
}: {
  chunks: ReturnType<typeof arcChunks>;
}) {
  return (
    <>
      {chunks.map((c, i) => (
        <View
          key={i}
          style={{
            position:        'absolute',
            left:            c.x - c.w / 2,
            top:             c.y - c.h / 2,
            width:           c.w,
            height:          c.h,
            backgroundColor: c.color,
            opacity:         c.opacity,
            borderRadius:    c.cap ? c.h / 2 : 0,
            transform:       c.cap ? undefined : [{ rotate: `${c.deg}deg` }],
          }}
        />
      ))}
    </>
  );
});

// ─── Props / Tooltip ──────────────────────────────────────────────────────────

interface FullClockViewProps {
  visible:         boolean;
  onClose:         () => void;
  wakeMin:         number;
  idealCycles:     number;
  peakPreference?: PeakPreference;
}

interface Tip { text: string; sub: string; x: number; y: number }

type Layer = 'cycles' | 'energy' | 'mrm' | 'crp' | 'sleep';

const LAYERS: { id: Layer; label: string; icon: string }[] = [
  { id: 'cycles', label: 'Cycles',  icon: 'refresh-outline'       },
  { id: 'energy', label: 'Energy',  icon: 'flash-outline'          },
  { id: 'mrm',    label: 'MRM',     icon: 'radio-button-on-outline'},
  { id: 'crp',    label: 'CRP',     icon: 'ellipse-outline'        },
  { id: 'sleep',  label: 'Sleep',   icon: 'moon-outline'           },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FullClockView({
  visible, onClose, wakeMin, idealCycles, peakPreference = 'morning',
}: FullClockViewProps) {
  const [data,   setData]   = useState(() => computeRhythmData(nowMin(), wakeMin, DAY_CYCLES));
  const [time,   setTime]   = useState(() => fmtMin(nowMin()));
  const [tip,    setTip]    = useState<Tip | null>(null);
  const [active, setActive] = useState<Layer>('cycles');

  const glow      = useRef(new Animated.Value(0.6)).current;
  const glowScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const tick = () => {
      setData(computeRhythmData(nowMin(), wakeMin, DAY_CYCLES));
      setTime(fmtMin(nowMin()));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [visible, wakeMin]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(glow,      { toValue: 0,   duration: 1200, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 2.2, duration: 1200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(glow,      { toValue: 0.6, duration: 0, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1,   duration: 0, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, glow, glowScale]);

  const { segments, currentIdx } = data;
  const energyMap  = getEnergyMap(DAY_CYCLES, peakPreference);
  const now        = nowMin();
  const isActive   = currentIdx >= 0 && currentIdx < DAY_CYCLES;
  const curSeg     = isActive ? segments[currentIdx] : null;
  const elapsed    = curSeg ? ((now - curSeg.startMin + 1440) % 1440) : 0;
  const pct        = Math.min(1, elapsed / CYCLE);
  const remaining  = isActive ? Math.max(0, CYCLE - elapsed) : 0;

  // Sleep segment range
  const sleepStart = DAY_CYCLES - idealCycles;

  // Cursor angle
  const cursorDeg = isActive
    ? currentIdx * SEG_DEG + pct * SEG_DEG
    : Math.max(0, currentIdx) * SEG_DEG;
  const cursorRad = (cursorDeg - 90) * (Math.PI / 180);
  const cursorPt  = {
    x: CX + R1_M * Math.cos(cursorRad),
    y: CY + R1_M * Math.sin(cursorRad),
  };

  // Pre-compute all arc chunks (main ring)
  const allChunks = segments.map((seg, i) => {
    const start    = i * SEG_DEG + GAP_DEG / 2;
    const isSleep  = i >= sleepStart;
    const isCurr   = seg.isCurrent && isActive;
    const isPast   = seg.isPast || (!isActive && currentIdx >= DAY_CYCLES);
    const energy   = energyMap[i];

    const color    = isCurr ? ACCENT : isSleep ? C_SLEEP : C_WAKE;
    const opacity  = isCurr   ? 1
      : isPast    ? 0.45
      : isSleep   ? 0.65
      : energy?.level === 'high'    ? 0.85
      : energy?.level === 'neutral' ? 0.65
      : 0.35;

    return arcChunks(start, ARC_DEG, R1_O, R1_I, color, opacity);
  });

  // Energy outer ring chunks
  const energyChunks = segments.map((seg, i) => {
    const start   = i * SEG_DEG + GAP_DEG / 2;
    const isSleep = i >= sleepStart;
    const energy  = energyMap[i];
    if (isSleep) return [];
    const op = energy?.level === 'high' ? 0.55 : energy?.level === 'neutral' ? 0.25 : 0.08;
    return arcChunks(start, ARC_DEG, R2_O, R2_I, C_ENERGY, op);
  });

  // MRM marker positions
  const mrmMarkers = segments
    .filter((s, i) => s.hasMRM && !s.isPast && i < sleepStart)
    .map((s, i) => {
      const idx   = segments.indexOf(s);
      const deg   = idx * SEG_DEG + (80 / CYCLE) * SEG_DEG;
      const rad   = (deg - 90) * Math.PI / 180;
      return {
        x: CX + (R1_I - 6) * Math.cos(rad),
        y: CY + (R1_I - 6) * Math.sin(rad),
        deg,
      };
    });

  // CRP marker
  const crpSeg  = segments.find((s, i) => s.isCRP && !s.isPast && i < sleepStart);
  const crpIdx  = crpSeg ? segments.indexOf(crpSeg) : -1;
  const crpPt   = crpIdx >= 0 ? (() => {
    const deg = crpIdx * SEG_DEG + SEG_DEG / 2;
    const rad = (deg - 90) * Math.PI / 180;
    return { x: CX + R1_M * Math.cos(rad), y: CY + R1_M * Math.sin(rad), deg };
  })() : null;

  // Tooltip helper
  const showTip = (text: string, sub: string, x: number, y: number) =>
    setTip({ text, sub, x, y });

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
          <Pressable onPress={() => setTip(null)}>
            <View style={{ width: D, height: D }}>

              {/* ── Background ring (faint) ── */}
              <View style={[s.ringBase, {
                width: R1_O * 2, height: R1_O * 2,
                borderRadius: R1_O, borderWidth: R1_O - R1_I,
                left: CX - R1_O, top: CY - R1_O,
              }]} />



              {/* ── Main ring segments ── */}
              {allChunks.map((chunks, i) => {
                const seg     = segments[i]!;
                const isSleep = i >= sleepStart;
                const isCurr  = seg.isCurrent && isActive;

                // Layer filter — hide non-relevant segments
                if (active === 'sleep'  && !isSleep)  return null;
                if (active === 'mrm'    && isSleep)   return null;
                if (active === 'crp'    && !seg.isCRP) return null;
                if (active === 'energy' && isSleep)   return null;
                const midDeg  = i * SEG_DEG + SEG_DEG / 2;
                const midRad  = (midDeg - 90) * Math.PI / 180;
                const tx      = CX + R1_M * Math.cos(midRad);
                const ty      = CY + R1_M * Math.sin(midRad);

                return (
                  <Pressable
                    key={`s${i}`}
                    style={{ position: 'absolute', width: D, height: D }}
                    onPress={() => showTip(
                      isSleep ? 'Sleep cycle' : isCurr ? 'You are here' : `Cycle ${i + 1}`,
                      `${fmtMin(seg.startMin)} → ${fmtMin(seg.endMin)}`,
                      tx, ty,
                    )}
                  >
                    <StaticArc chunks={chunks} />
                  </Pressable>
                );
              })}

              {/* ── MRM markers ── */}
              {(active === 'mrm' || active === 'cycles') && mrmMarkers.map((m, i) => (
                <Pressable
                  key={`mrm${i}`}
                  onPress={() => showTip('MRM', 'Micro reset moment', m.x, m.y)}
                  style={[s.mrmMark, {
                    left:      m.x - 1.5,
                    top:       m.y - 5,
                    transform: [{ rotate: `${m.deg}deg` }],
                  }]}
                />
              ))}

              {/* ── CRP marker ── */}
              {(active === 'crp' || active === 'cycles') && crpPt && (
                <Pressable
                  onPress={() => showTip('CRP', 'Controlled recovery period', crpPt.x, crpPt.y)}
                  style={[s.crpMark, { left: crpPt.x - 5, top: crpPt.y - 5 }]}
                />
              )}

              {/* ── ☀️ Wake marker at 0° (top) ── */}
              {(() => {
                const pt = { x: CX, y: CY - R1_O - 14 };
                return (
                  <View style={[s.marker, { left: pt.x - 9, top: pt.y - 9 }]}>
                    <Ionicons name="sunny" size={14} color="#D97706" />
                  </View>
                );
              })()}

              {/* ── 🌙 Sleep start marker ── */}
              {(() => {
                const deg = sleepStart * SEG_DEG;
                const rad = (deg - 90) * Math.PI / 180;
                const pt  = { x: CX + (R1_O + 14) * Math.cos(rad), y: CY + (R1_O + 14) * Math.sin(rad) };
                return (
                  <View style={[s.marker, { left: pt.x - 8, top: pt.y - 8 }]}>
                    <Ionicons name="moon" size={12} color="#8B5CF6" />
                  </View>
                );
              })()}

              {/* ── Cursor: glow ring + solid dot ── */}
              {isActive && (
                <>
                  <Animated.View style={[s.cursorGlow, {
                    left:    cursorPt.x - 11,
                    top:     cursorPt.y - 11,
                    opacity: glow,
                    transform: [{ scale: glowScale }],
                  }]} />
                  <View style={[s.cursorDot, { left: cursorPt.x - 6, top: cursorPt.y - 6 }]} />
                </>
              )}

              {/* ── Center ── */}
              <View style={s.center} pointerEvents="none">
                <Text style={s.timeText}>{time}</Text>
                <Text style={s.r90}  >R90</Text>
                {isActive && remaining > 0 && (
                  <Text style={s.rem}>{Math.round(remaining)} min left</Text>
                )}
              </View>

              {/* ── Tooltip ── */}
              {tip && (
                <Pressable
                  onPress={() => setTip(null)}
                  style={[s.tip, {
                    left: Math.max(8, Math.min(D - 170, tip.x - 80)),
                    top:  Math.max(8, Math.min(D - 68,  tip.y - 40)),
                  }]}
                >
                  <Text style={s.tipText}>{tip.text}</Text>
                  <Text style={s.tipSub}>{tip.sub}</Text>
                </Pressable>
              )}

            </View>
          </Pressable>

          {/* ── Layer selector ── */}
          <View style={s.layerBar}>
            {LAYERS.map(({ id, label, icon }) => {
              const on = active === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setActive(id)}
                  style={[s.layerChip, on && s.layerChipOn]}
                >
                  <Ionicons name={icon as any} size={13} color={on ? '#FFFFFF' : TEXT_M} />
                  <Text style={[s.layerLabel, on && s.layerLabelOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Cycle list ── */}
          <View style={s.list}>
            {segments.map((seg, i) => {
              const isCurr  = seg.isCurrent && isActive;
              const isSleep = i >= sleepStart;
              return (
                <View key={i} style={[s.row, isCurr && s.rowActive]}>
                  <View style={[s.dot, {
                    backgroundColor: isCurr ? ACCENT : isSleep ? C_SLEEP : 'rgba(28,159,218,0.2)',
                  }]} />
                  <Text style={[s.rowTime, isCurr && { color: ACCENT, fontWeight: '700' }]}>
                    {fmtMin(seg.startMin)} — {fmtMin(seg.endMin)}
                  </Text>
                  <Text style={s.rowMeta}>
                    {isSleep ? 'Sleep' : seg.isCRP ? 'CRP' : `C${i + 1}`}
                  </Text>
                  {seg.hasMRM && !seg.isPast && !isSleep && (
                    <View style={s.badge}><Text style={s.badgeTxt}>MRM</Text></View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title:  { fontSize: 18, fontWeight: '700', color: TEXT_D },
  scroll: { alignItems: 'center', paddingBottom: 48 },

  ringBase: {
    position:    'absolute',
    borderColor: C_RING,
  },

  // Cursor
  cursorGlow: {
    position:        'absolute',
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: ACCENT,
  },
  cursorDot: {
    position:        'absolute',
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: C_CURSOR,
    shadowColor:     ACCENT,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    8,
    elevation:       10,
  },

  // Markers
  marker: { position: 'absolute' },
  mrmMark: {
    position:        'absolute',
    width:           3,
    height:          10,
    backgroundColor: 'rgba(28,159,218,0.55)',
    borderRadius:    1,
  },
  crpMark: {
    position:        'absolute',
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: '#D97706',
    opacity:         0.8,
  },

  // Center
  center: {
    position:   'absolute',
    left:       CX - 70,
    top:        CY - 44,
    width:      140,
    alignItems: 'center',
    gap:        2,
  },
  timeText: { fontSize: 40, fontWeight: '800', color: TEXT_D, letterSpacing: -1.5 },
  r90:      { fontSize: 11, fontWeight: '800', color: ACCENT, letterSpacing: 4 },
  rem:      { fontSize: 11, color: TEXT_F, marginTop: 2 },

  // Tooltip
  tip: {
    position:        'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    paddingHorizontal: 12,
    paddingVertical:   8,
    minWidth:          140,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.10,
    shadowRadius:      12,
    elevation:         8,
    borderWidth:       1,
    borderColor:       'rgba(28,159,218,0.15)',
  },
  tipText: { fontSize: 13, fontWeight: '700', color: TEXT_D },
  tipSub:  { fontSize: 11, color: TEXT_M, marginTop: 2 },

  // Layer selector
  layerBar:     { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' },
  layerChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(28,159,218,0.08)', borderWidth: 1, borderColor: 'rgba(28,159,218,0.18)' },
  layerChipOn:  { backgroundColor: ACCENT, borderColor: ACCENT },
  layerLabel:   { fontSize: 12, fontWeight: '600', color: TEXT_M },
  layerLabelOn: { color: '#FFFFFF' },

  // List
  list:     { width: '100%', paddingHorizontal: 24, marginTop: 28 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(28,159,218,0.10)' },
  rowActive:{ backgroundColor: 'rgba(28,159,218,0.06)', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  dot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  rowTime:  { fontSize: 13, color: TEXT_M, flex: 1 },
  rowMeta:  { fontSize: 12, color: TEXT_F },
  badge:    { backgroundColor: 'rgba(28,159,218,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '700', color: ACCENT },
});
