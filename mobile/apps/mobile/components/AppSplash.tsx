/**
 * AppSplash — in-app animated splash screen.
 *
 * Shown while the root layout loads the user profile from storage.
 * Renders the same ecran4.png background used by the native splash,
 * creating a seamless hand-off once the native splash hides.
 *
 * On mount:
 *   1. Calls SplashScreen.hideAsync() → native splash fades out,
 *      this component is already visible behind it.
 *   2. Starts an infinite, slow gear rotation (Animated loop, native driver).
 *
 * The parent (_layout.tsx) unmounts this component and mounts the
 * Stack navigator once both the storage check AND the 1 200 ms
 * minimum display time have elapsed.
 */

import { useEffect, useRef } from 'react';
import { Animated, ImageBackground, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';

const BG = require('../assets/images/ecran4.png');

export function AppSplash() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hand off from native splash as soon as our animated one is rendered
    SplashScreen.hideAsync().catch(() => {});

    // Slow continuous rotation — 4 s per revolution, native driver
    Animated.loop(
      Animated.timing(rotation, {
        toValue:         1,
        duration:        4000,
        useNativeDriver: true,
      }),
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = rotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <ImageBackground source={BG} style={s.bg} resizeMode="cover">
      <StatusBar style="light" />
      <View style={s.overlay} />

      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Ionicons
          name="settings-outline"
          size={52}
          color="rgba(255,255,255,0.55)"
        />
      </Animated.View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
});
