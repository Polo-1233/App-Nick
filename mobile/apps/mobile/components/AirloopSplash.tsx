/**
 * AirloopSplash
 *
 * Opening screen for the onboarding flow.
 * Fades in, holds briefly, then calls onDone to advance.
 *
 * Design: no animation loops, no mascot energy.
 * Just the mark, the name, and the positioning line.
 */

import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface Props {
  onDone: () => void;
}

export function AirloopSplash({ onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Fade in over 600ms, hold 1.6s, then advance
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start(() => {
      timer = setTimeout(onDone, 1600);
    });

    // Cleanup: cancel timer if component unmounts before it fires
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [onDone]); // stable ref — parent must memoize or it's a new function each render

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity }]}>
        {/* Airloop mark */}
        <View style={styles.mark}>
          <Text style={styles.markLetter}>A</Text>
        </View>

        <Text style={styles.name}>Airloop</Text>
        <Text style={styles.tagline}>Your recovery companion.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E3A5F',
    borderWidth: 1.5,
    borderColor: '#60A5FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  markLetter: {
    color: '#60A5FA',
    fontSize: 28,
    fontWeight: '700',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  tagline: {
    color: '#525252',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
