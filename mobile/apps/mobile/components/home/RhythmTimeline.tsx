/**
 * RhythmTimeline — Home layer (fast read, next 3 cycles only)
 *
 * Shows ONLY:
 *   - Current cycle (highlighted)
 *   - Next 2 cycles
 *   - MRM dot on upcoming cycles
 *   - CRP icon if within range
 *   - Animated cursor at current position
 *
 * Tap → opens FullClockView
 */

import { useEffect, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nowMin, fmtMin } from '../../lib/time-utils';
import { computeRhythmData } from '../../lib/rhythm-clock';
import { FullClockView } from './FullClockView';

const ACCENT       = '#1c9fda';
const FILLED       = '#1c9fda';
const EMPTY_BG     = 'rgba(28,100,160,0.22)';
const EMPTY_BORDER = 'rgba(28,159,218,0.35)';
const GOLD         = '#F5A623';
const TEXT_MUTED   = '#7A9BBC';
const TEXT_LABEL   = '#002060';
const SEG_H        = 14;
const GAP          = 5;
const VISIBLE      = 3; // current + 2 next

interface RhythmTimelineProps {
  wakeMin:     number;
  idealCycles: number;
}

export const RhythmTimeline = memo(function RhythmTimeline({
  wakeMin, idealCycles,
}: RhythmTimelineProps) {
  const W   = Dimensions.get('window').width;
  const TW  = W - 40;   // paddingHorizontal 20 each side
  const [clockOpen, setClockOpen] = useState(false);

  // Compute data
  const [data, setData] = useState(() => computeRhythmData(nowMin(), wakeMin, idealCycles));

  useEffect(() => {
    const id = setInterval(() => setData(computeRhythmData(nowMin(), wakeMin, idealCycles)), 30_000);
    return () => clearInterval(id);
  }, [wakeMin, idealCycles]);

  // Cursor pulse
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Visible window: currentIdx-0 to currentIdx+2
  const { segments, currentIdx, totalCycles } = data;
  const startIdx   = Math.max(0, currentIdx);
  const endIdx     = Math.min(totalCycles - 1, startIdx + VISIBLE - 1);
  const visible    = segments.slice(startIdx, endIdx + 1);
  const visCount   = visible.length;

  // Segment width
  const segW = (TW - (visCount - 1) * GAP) / Math.max(visCount, 1);

  // Cursor position within visible area
  const progressInCycle = ((data.nowMin - segments[currentIdx]?.startMin + 1440) % 1440) / 90;
  const clampedProgress = Math.max(0, Math.min(1, progressInCycle));
  const cursorX = currentIdx >= startIdx
    ? (currentIdx - startIdx) * (segW + GAP) + clampedProgress * segW
    : 0;

  const cycleLabel = currentIdx >= 0 && currentIdx < totalCycles
    ? `Cycle ${currentIdx + 1}/${totalCycles}`
    : `${totalCycles} cycles`;

  return (
    <>
      <Pressable onPress={() => setClockOpen(true)} style={tl.outer}>

        {/* Icon row */}
        <View style={[tl.iconRow, { width: TW }]}>
          <Ionicons name="sunny" size={14} color={GOLD} />
          <View style={{ flex: 1 }} />
          {data.currentIdx >= 0 && data.currentIdx < totalCycles - 1 && (
            <Text style={tl.tapHint}>View full rhythm ›</Text>
          )}
          <View style={{ flex: 1 }} />
          <Ionicons name="moon" size={12} color={GOLD} />
        </View>

        {/* Segments */}
        <View style={[tl.segRow, { width: TW }]}>
          {visible.map((seg, i) => (
            <View key={seg.index} style={tl.segWrap}>
              <View
                style={[
                  tl.seg,
                  {
                    width:           segW,
                    backgroundColor: seg.isCurrent || seg.isPast ? FILLED : EMPTY_BG,
                    borderColor:     seg.isCurrent || seg.isPast ? 'transparent' : EMPTY_BORDER,
                    borderWidth:     seg.isCurrent || seg.isPast ? 0 : 1,
                    opacity:         seg.isPast ? 0.5 : 1,
                    marginRight:     i < visCount - 1 ? GAP : 0,
                  },
                ]}
              />
              {/* MRM dot below */}
              {seg.hasMRM && !seg.isPast && (
                <View style={[tl.mrmDot, { left: segW * 0.85 - 3 }]} />
              )}
              {/* CRP icon below */}
              {seg.isCRP && !seg.isPast && (
                <View style={[tl.crpIcon, { left: segW / 2 - 5 }]}>
                  <Ionicons name="flash" size={9} color={GOLD} />
                </View>
              )}
            </View>
          ))}

          {/* Animated cursor */}
          {currentIdx >= startIdx && currentIdx <= endIdx && (
            <Animated.View
              pointerEvents="none"
              style={[tl.cursor, {
                left:      cursorX - 6,
                transform: [{ scale: pulse }],
              }]}
            />
          )}
        </View>

        {/* Labels */}
        <View style={[tl.labels, { width: TW }]}>
          <Text style={tl.labelSide}>{fmtMin(wakeMin)}</Text>
          <Text style={tl.labelCenter}>{cycleLabel}</Text>
          <Text style={tl.labelSide}>{fmtMin(data.bedtimeMin)}</Text>
        </View>
      </Pressable>

      {/* Full clock modal */}
      <FullClockView
        visible={clockOpen}
        onClose={() => setClockOpen(false)}
        wakeMin={wakeMin}
        idealCycles={idealCycles}
      />
    </>
  );
});

const tl = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    marginTop:         14,
    gap:               4,
  },
  iconRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   4,
  },
  tapHint: {
    fontSize:   10,
    color:      TEXT_MUTED,
    fontWeight: '500',
    textAlign:  'center',
  },
  segRow: {
    flexDirection: 'row',
    alignItems:    'center',
    height:        SEG_H + 16,
    position:      'relative',
  },
  segWrap: {
    position:   'relative',
    alignItems: 'flex-start',
  },
  seg: {
    height:       SEG_H,
    borderRadius: 7,
  },
  mrmDot: {
    position:        'absolute',
    top:             SEG_H + 3,
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(28,159,218,0.5)',
  },
  crpIcon: {
    position: 'absolute',
    top:      SEG_H + 2,
  },
  cursor: {
    position:        'absolute',
    top:             (SEG_H + 16 - 12) / 2,
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: '#FFFFFF',
    shadowColor:     '#FFFFFF',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    8,
    elevation:       6,
  },
  labels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:       6,
  },
  labelSide: {
    fontSize:   11,
    color:      TEXT_MUTED,
    fontWeight: '500',
    width:      44,
  },
  labelCenter: {
    fontSize:   12,
    fontWeight: '700',
    color:      TEXT_LABEL,
    textAlign:  'center',
    flex:       1,
  },
});
