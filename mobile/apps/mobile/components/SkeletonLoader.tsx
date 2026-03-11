/**
 * SkeletonLoader
 *
 * Pulsing placeholder for async content.
 * Used in tab loading states instead of text spinners.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface SkeletonBarProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

function SkeletonBar({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonBarProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.bar,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

/** Home tab skeleton */
export function HomeSkeletonScreen() {
  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerRow}>
        <SkeletonBar width={120} height={28} borderRadius={8} />
        <SkeletonBar width={60} height={20} borderRadius={10} />
      </View>
      {/* Message card */}
      <View style={styles.card}>
        <SkeletonBar width={80} height={12} style={{ marginBottom: 10 }} />
        <SkeletonBar height={14} style={{ marginBottom: 6 }} />
        <SkeletonBar width="70%" height={14} />
      </View>
      {/* Action card */}
      <View style={styles.card}>
        <SkeletonBar width="50%" height={12} style={{ marginBottom: 10 }} />
        <SkeletonBar height={18} style={{ marginBottom: 6 }} />
        <SkeletonBar width="85%" height={13} />
      </View>
    </View>
  );
}

/** Calendar tab skeleton */
export function CalendarSkeletonScreen() {
  return (
    <View style={styles.screen}>
      <SkeletonBar width={100} height={28} borderRadius={8} style={{ marginBottom: 24 }} />
      {[48, 56, 40, 64, 48].map((h, i) => (
        <View key={i} style={[styles.timelineRow, { marginBottom: 8 }]}>
          <SkeletonBar width={36} height={12} borderRadius={4} />
          <SkeletonBar height={h} borderRadius={8} style={{ flex: 1, marginLeft: 12 }} />
        </View>
      ))}
    </View>
  );
}

/** Profile tab skeleton */
export function ProfileSkeletonScreen() {
  return (
    <View style={styles.screen}>
      <SkeletonBar width={100} height={28} borderRadius={8} style={{ marginBottom: 24 }} />
      {/* Chart area */}
      <View style={styles.card}>
        <SkeletonBar width="40%" height={12} style={{ marginBottom: 16 }} />
        <View style={styles.chartRow}>
          {[40, 56, 32, 48, 56, 24, 48].map((h, i) => (
            <SkeletonBar key={i} width={28} height={h} borderRadius={4} />
          ))}
        </View>
      </View>
      {/* History rows */}
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.listRow}>
          <SkeletonBar width={80} height={13} />
          <SkeletonBar width={30} height={13} />
          <SkeletonBar width={40} height={13} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#262626',
  },
  screen: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0A0A0A',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 64,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
});
