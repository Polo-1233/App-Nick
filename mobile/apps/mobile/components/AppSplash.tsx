/**
 * AppSplash — in-app animated splash screen.
 *
 * R-Lo mascot centered on dark navy background (#0B1220) with a slow
 * breathing circle animation — calm and premium, like a wellness app.
 *
 * Breathing animation: scale 1.0 → 1.18 → 1.0 over 3s, loops infinitely.
 * Uses native driver for 60fps performance.
 */

import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

const ROLO = require('../assets/mascot/Enthousisate.png');

export function AppSplash() {
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue:         1.18,
          duration:        1500,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue:         1.0,
          duration:        1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.container}>
      <StatusBar style="light" />

      {/* Breathing glow ring */}
      <Animated.View
        style={[
          s.ring,
          { transform: [{ scale: breathe }] },
        ]}
      />

      {/* R-Lo mascot */}
      <Image
        source={ROLO}
        style={s.mascot}
        resizeMode="contain"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#0B1220',
    justifyContent:  'center',
    alignItems:      'center',
  },
  ring: {
    position:        'absolute',
    width:           220,
    height:          220,
    borderRadius:    110,
    borderWidth:     2,
    borderColor:     'rgba(245,166,35,0.25)',
    backgroundColor: 'rgba(245,166,35,0.06)',
  },
  mascot: {
    width:  160,
    height: 160,
  },
});
