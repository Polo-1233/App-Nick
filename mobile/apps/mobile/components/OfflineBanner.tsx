/**
 * OfflineBanner — shows when the nick_brain backend is unreachable.
 *
 * Positioned at the top of the screen (below the safe area).
 * Disappears automatically when the backend comes back online.
 * Does not block the UI — the app continues with local data.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { healthCheck } from '../lib/api';

const CHECK_INTERVAL_MS = 30_000; // 30s

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function check() {
      const ok = await healthCheck();
      setOffline(!ok);
    }

    void check();
    const interval = setInterval(() => { void check(); }, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue:         offline ? 1 : 0,
      duration:        300,
      useNativeDriver: true,
    }).start();
  }, [offline, opacity]);

  if (!offline) return null;

  return (
    <Animated.View style={[s.banner, { opacity }]}>
      <Text style={s.text}>⚡ Offline — using local data</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    backgroundColor: '#B45309',
    paddingVertical:   8,
    alignItems:      'center',
    zIndex:          999,
  },
  text: {
    color:      '#FFFFFF',
    fontSize:   12,
    fontWeight: '600',
  },
});
