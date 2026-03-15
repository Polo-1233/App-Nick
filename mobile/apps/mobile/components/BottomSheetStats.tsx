/**
 * BottomSheetStats — slide-up bottom sheet with detailed weekly stats.
 *
 * Opens when WeeklyCycleRing is tapped.
 * Shows: bar chart (last 7 nights), summary row, R-Lo coaching message.
 *
 * Animation: same backdrop-fade + spring-slide pattern used throughout the app.
 * No new dependencies — pure React Native Animated API.
 */

import { useRef, useEffect } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { NightRecord, ReadinessZone } from '@r90/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible:             boolean;
  weekHistory:         NightRecord[];
  weeklyTotal:         number;
  weeklyTarget:        number;
  zone:                ReadinessZone;
  idealCyclesPerNight: number;
  onClose:             () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZONE_COLOR: Record<ReadinessZone, string> = {
  green:  '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function coachingMessage(
  weeklyTotal:  number,
  weeklyTarget: number,
  zone:         ReadinessZone,
): string {
  const remaining = weeklyTarget - weeklyTotal;
  if (remaining <= 0) {
    return zone === 'orange'
      ? 'Cycle target reached. Prioritize quality sleep tonight.'
      : 'Strong week. Your anchor time is working.';
  }
  if (remaining <= 4) return `${remaining} more cycles to reach your weekly target.`;
  return 'Keep your anchor time consistent — it\'s the single biggest lever.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomSheetStats({
  visible,
  weekHistory,
  weeklyTotal,
  weeklyTarget,
  zone,
  idealCyclesPerNight,
  onClose,
}: Props) {
  const backdropOp = useRef(new Animated.Value(0)).current;
  const cardY      = useRef(new Animated.Value(500)).current;
  const mounted    = useRef(true);

  useEffect(() => { return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (visible) {
      backdropOp.setValue(0);
      cardY.setValue(500);
      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue:  1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(cardY, {
          toValue:   0,
          damping:   22,
          stiffness: 260,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort oldest → newest, cap at 7
  const sorted    = [...weekHistory].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const maxCycles = Math.max(...sorted.map(n => n.cyclesCompleted), idealCyclesPerNight, 1);
  const BAR_MAX_H = 72;
  const zoneColor = ZONE_COLOR[zone];
  const message   = coachingMessage(weeklyTotal, weeklyTarget, zone);

  // Consecutive ideal-night streak (most recent first)
  let streak = 0;
  const desc = [...weekHistory].sort((a, b) => b.date.localeCompare(a.date));
  for (const n of desc) {
    if (n.cyclesCompleted >= idealCyclesPerNight) streak++;
    else break;
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* ── Backdrop ── */}
      <Animated.View style={[s.backdrop, { opacity: backdropOp }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Sheet ── */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: cardY }] }]}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Weekly breakdown</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
        >
          {/* ── Bar chart ── */}
          {sorted.length > 0 ? (
            <View style={s.chartWrap}>
              {sorted.map((night, i) => {
                const barH     = Math.max((night.cyclesCompleted / maxCycles) * BAR_MAX_H, 6);
                const isIdeal  = night.cyclesCompleted >= idealCyclesPerNight;
                const barColor = isIdeal ? zoneColor : '#2A2A2A';
                // Convert ISO date → day-of-week label
                const dow      = new Date(night.date + 'T12:00:00').getDay(); // 0=Sun
                const dayLabel = DAY_LABELS[(dow + 6) % 7];               // Mon=0

                return (
                  <View key={i} style={s.barCol}>
                    <Text style={s.barValue}>{night.cyclesCompleted}</Text>
                    <View style={[s.barTrack, { height: BAR_MAX_H }]}>
                      <View style={[s.bar, { height: barH, backgroundColor: barColor }]} />
                    </View>
                    <Text style={s.barDay}>{dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={s.emptyChart}>
              <Text style={s.emptyText}>No nights recorded yet.</Text>
            </View>
          )}

          {/* ── Summary row ── */}
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>{weeklyTotal}</Text>
              <Text style={s.summaryLabel}>Total cycles</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>{weeklyTarget}</Text>
              <Text style={s.summaryLabel}>Weekly target</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryValue, streak > 0 && { color: zoneColor }]}>
                {streak}
              </Text>
              <Text style={s.summaryLabel}>Night streak</Text>
            </View>
          </View>

          {/* ── Coaching message ── */}
          <View style={s.messageCard}>
            <Text style={s.messageMeta}>R-LO</Text>
            <Text style={s.messageText}>{message}</Text>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      '#131313',
    borderTopLeftRadius:  22,
    borderTopRightRadius: 22,
    maxHeight:            '78%',
    paddingHorizontal:    20,
    paddingBottom:        40,
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -8 },
    shadowOpacity:        0.45,
    shadowRadius:         24,
    elevation:            24,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: '#3A3A3A',
    alignSelf:       'center',
    marginTop:       12,
    marginBottom:    16,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   22,
  },
  headerTitle: {
    color:      '#FFFFFF',
    fontSize:   18,
    fontWeight: '700',
  },
  closeX: {
    color:      '#6B7280',
    fontSize:   16,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: 8,
  },

  // Bar chart
  chartWrap: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'space-between',
    marginBottom:   24,
  },
  barCol: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  barValue: {
    color:      '#525252',
    fontSize:   10,
    fontWeight: '600',
  },
  barTrack: {
    width:           18,
    justifyContent:  'flex-end',
    backgroundColor: '#1A1A1A',
    borderRadius:    4,
    overflow:        'hidden',
  },
  bar: {
    width:        18,
    borderRadius: 4,
  },
  barDay: {
    color:      '#3A3A3A',
    fontSize:   9,
    fontWeight: '500',
  },
  emptyChart: {
    height:         80,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   24,
  },
  emptyText: {
    color:    '#3A3A3A',
    fontSize: 13,
  },

  // Summary row
  summaryRow: {
    flexDirection:   'row',
    backgroundColor: '#1A1A1A',
    borderRadius:    14,
    padding:         16,
    marginBottom:    20,
    alignItems:      'center',
  },
  summaryItem: {
    flex:       1,
    alignItems: 'center',
  },
  summaryDivider: {
    width:           1,
    height:          32,
    backgroundColor: '#2A2A2A',
  },
  summaryValue: {
    color:         '#FFFFFF',
    fontSize:      24,
    fontWeight:    '700',
    letterSpacing: -0.5,
  },
  summaryLabel: {
    color:      '#525252',
    fontSize:   10,
    fontWeight: '500',
    marginTop:  3,
  },

  // Coaching message
  messageCard: {
    backgroundColor: '#111111',
    borderRadius:    14,
    padding:         16,
    borderWidth:     1,
    borderColor:     '#1A1A1A',
  },
  messageMeta: {
    color:         '#60A5FA',
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  8,
  },
  messageText: {
    color:      '#D4D4D4',
    fontSize:   14,
    lineHeight: 21,
  },
});
