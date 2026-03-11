/**
 * AirloopPresence
 *
 * A discrete bottom-of-screen indicator that Airloop is present.
 * Design rules (from AIRLOOP_STYLE_GUIDE.md):
 * - Discrete by default: very low opacity idle state.
 * - Animates only when there is something worth signalling (new message).
 * - No mascot energy: no bouncing, no waving, no emojis.
 * - A single dot + a short label. Nothing more.
 */

import { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import type { AirloopMessage } from "@r90/types";

interface Props {
  message: AirloopMessage | null;
}

export function AirloopPresence({ message }: Props) {
  const opacity = useRef(new Animated.Value(0.15)).current;
  const scale = useRef(new Animated.Value(1)).current;
  // Track previous message text to detect genuine changes
  const prevText = useRef<string | null>(null);

  // Idle breathing animation — runs continuously, very subtle
  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.15,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pulse animation when a new message arrives
  useEffect(() => {
    if (!message) return;
    if (prevText.current === message.text) return; // same message, no pulse
    prevText.current = message.text;

    // Quick pulse: scale up, opacity spike, settle back
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.5,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.15,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [message?.text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot,
          { opacity, transform: [{ scale }] },
        ]}
      />
      <Animated.Text style={[styles.label, { opacity }]}>
        airloop
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#60A5FA",
  },
  label: {
    color: "#60A5FA",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1.5,
  },
});
