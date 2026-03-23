/**
 * RhythmTimeline — Barre horizontale ARP → Sleep Window
 *
 * - Segments = cycles de 90 min (type sleep_cycle)
 * - Curseur "vous êtes ici" pulsant
 * - Marqueurs MRM (dots), CRP (éclair doré), Sleep (lune)
 * - Texte "Cycle X/Y" centré sous la barre
 */

import { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TimeBlock } from '@r90/types';

const ACCENT  = '#1c9fda';
const GOLD    = '#F5A623';
const TEXT    = '#FFFFFF';
const MUTED   = '#6B8CAE';
const TRACK_H = 28;

function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function fmt(m: number): string {
  const h   = Math.floor(((m % 1440) + 1440) % 1440 / 60);
  const min = ((m % 1440) + 1440) % 1440 % 60;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

interface RhythmTimelineProps {
  blocks:     TimeBlock[];
  wakeTime:   number;   // minutes from midnight (ARP)
  bedtime:    number;   // minutes from midnight
  anchorTime: number;
}

export const RhythmTimeline = memo(function RhythmTimeline({
  blocks, wakeTime, bedtime, anchorTime,
}: RhythmTimelineProps) {
  const { width: W } = Dimensions.get('window');
  const PAD = 20;
  const TW  = W - PAD * 2;
  const DAY = 1440;

  const spanStart = anchorTime;
  const spanEnd   = bedtime <= anchorTime ? bedtime + DAY : bedtime;
  const spanTotal = Math.max(spanEnd - spanStart, 1);

  const now  = nowMin();
  let nowAdj = now < spanStart ? now + DAY : now;
  const pct  = Math.max(0, Math.min(1, (nowAdj - spanStart) / spanTotal));
  const nowX = pct * TW;

  function xOf(min: number): number {
    let m = min < spanStart ? min + DAY : min;
    return Math.max(0, Math.min(TW, ((m - spanStart) / spanTotal) * TW));
  }

  // Pulse animation
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
    return () => pulse.stopAnimation();
  }, [pulse]);

  const cycleBlocks  = blocks.filter(b => b.type === 'sleep_cycle');
  const crpBlocks    = blocks.filter(b => b.type === 'crp');
  const mrmBlocks    = blocks.filter(b => b.type === 'down_period');
  const preSleep     = blocks.find(b => b.type === 'pre_sleep');

  // Current cycle index
  const currentCycle = cycleBlocks.findIndex(b => {
    const s = b.start < spanStart ? b.start + DAY : b.start;
    const e = b.end   < spanStart ? b.end   + DAY : b.end;
    return nowAdj >= s && nowAdj < e;
  });
  const totalCycles  = cycleBlocks.length;
  const cycleLabel   = currentCycle >= 0
    ? `Cycle ${currentCycle + 1}/${totalCycles}`
    : nowAdj < spanStart
    ? `${totalCycles} cycles tonight`
    : `${totalCycles} cycles today`;

  return (
    <View style={tl.wrap}>
      {/* Track */}
      <View style={[tl.track, { width: TW }]}>
        {/* Background */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `${ACCENT}18`, borderRadius: 8 }]} />

        {/* Sleep cycles */}
        {cycleBlocks.map((b, i) => {
          const x1  = xOf(b.start);
          const x2  = xOf(b.end);
          const isCurrent = i === currentCycle;
          return (
            <View
              key={i}
              style={[
                tl.cycleBar,
                {
                  left:            x1,
                  width:           Math.max(4, x2 - x1 - 2),
                  backgroundColor: isCurrent ? ACCENT : `${ACCENT}40`,
                  height:          isCurrent ? TRACK_H - 4 : TRACK_H - 8,
                  top:             isCurrent ? 2 : 4,
                },
              ]}
            />
          );
        })}

        {/* Pre-sleep zone */}
        {preSleep && (
          <View style={[
            tl.preSleepBar,
            { left: xOf(preSleep.start), width: Math.max(4, xOf(preSleep.end) - xOf(preSleep.start)) },
          ]} />
        )}

        {/* MRM dots */}
        {mrmBlocks.map((b, i) => (
          <View key={`mrm-${i}`} style={[tl.dotMRM, { left: xOf(b.start) - 3 }]} />
        ))}

        {/* CRP marker */}
        {crpBlocks.map((b, i) => (
          <View key={`crp-${i}`} style={[tl.markerCRP, { left: xOf(b.start) - 7 }]}>
            <Ionicons name="flash" size={11} color={GOLD} />
          </View>
        ))}

        {/* ARP (start) */}
        <View style={tl.markerARP}>
          <Ionicons name="sunny" size={12} color={GOLD} />
        </View>

        {/* Sleep window (end) */}
        <View style={[tl.markerSleep, { left: Math.min(TW - 16, xOf(bedtime) - 8) }]}>
          <Ionicons name="moon" size={12} color={ACCENT} />
        </View>
      </View>

      {/* "You are here" cursor */}
      <View style={[tl.cursorLayer, { width: TW }]} pointerEvents="none">
        <Animated.View style={[tl.cursor, { left: nowX - 7, transform: [{ scale: pulse }] }]} />
      </View>

      {/* Labels row */}
      <View style={[tl.labelRow, { width: TW }]}>
        <Text style={tl.labelSide}>{fmt(anchorTime)}</Text>
        <Text style={tl.labelCenter}>{cycleLabel}</Text>
        <Text style={tl.labelSide}>{fmt(bedtime)}</Text>
      </View>
    </View>
  );
});

const tl = StyleSheet.create({
  wrap:        { paddingHorizontal: 20, marginTop: 8 },
  track:       { height: TRACK_H, position: 'relative', borderRadius: 8, overflow: 'visible', marginBottom: 4 },
  cycleBar:    { position: 'absolute', borderRadius: 5 },
  preSleepBar: { position: 'absolute', top: 6, bottom: 6, backgroundColor: 'rgba(255,200,80,0.18)', borderRadius: 4 },
  dotMRM:      { position: 'absolute', top: '50%', width: 6, height: 6, borderRadius: 3, backgroundColor: MUTED, marginTop: -3 },
  markerCRP:   { position: 'absolute', top: -8, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  markerARP:   { position: 'absolute', left: -7, top: -8, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  markerSleep: { position: 'absolute', top: -8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  cursorLayer: { height: 0, position: 'relative' },
  cursor:      { position: 'absolute', top: -28, width: 14, height: 14, borderRadius: 7, backgroundColor: TEXT, borderWidth: 2, borderColor: ACCENT },
  labelRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  labelSide:   { fontSize: 11, color: MUTED, width: 40 },
  labelCenter: { fontSize: 12, fontWeight: '700', color: TEXT, textAlign: 'center', flex: 1 },
});
