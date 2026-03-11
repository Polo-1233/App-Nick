/**
 * WeeklyCyclesRing
 *
 * Segmented circular ring showing weekly cycle progress.
 * Pure React Native — no SVG, no new dependencies.
 *
 * Renders `target` tick marks arranged in a full circle.
 * Completed ticks are lit in the zone color; remaining are dim.
 * Center shows the count and label.
 */

import { View, Text, StyleSheet } from "react-native";
import type { ReadinessZone } from "@r90/types";

const ZONE_COLOR: Record<ReadinessZone, string> = {
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
};

interface Props {
  current: number;
  target?: number;
  zone?: ReadinessZone;
}

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 80;   // distance from center to tick midpoint
const SEG_W = 3.5;   // tick width
const SEG_H = 13;    // tick height

export function WeeklyCyclesRing({ current, target = 35, zone = "green" }: Props) {
  const activeColor = ZONE_COLOR[zone];
  const clamped = Math.min(Math.max(current, 0), target);

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      {/* Tick marks arranged in a circle */}
      {Array.from({ length: target }, (_, i) => {
        // angle in degrees; −90 starts from 12 o'clock
        const angleDeg = (i / target) * 360 - 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = CENTER + RADIUS * Math.cos(angleRad);
        const y = CENTER + RADIUS * Math.sin(angleRad);
        const isActive = i < clamped;

        return (
          <View
            key={i}
            style={{
              position: "absolute",
              width: SEG_W,
              height: SEG_H,
              left: x - SEG_W / 2,
              top: y - SEG_H / 2,
              borderRadius: SEG_W / 2,
              backgroundColor: isActive ? activeColor : "#1E1E1E",
              // rotate so each tick points radially outward
              transform: [{ rotate: `${angleDeg + 90}deg` }],
            }}
          />
        );
      })}

      {/* Center content */}
      <View style={styles.center}>
        <Text style={styles.number}>{clamped}</Text>
        <Text style={styles.outOf}>/ {target}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  number: {
    color: "#FFFFFF",
    fontSize: 52,
    fontWeight: "700",
    letterSpacing: -2,
    lineHeight: 58,
  },
  outOf: {
    color: "#525252",
    fontSize: 16,
    fontWeight: "500",
    marginTop: -4,
  },
});
