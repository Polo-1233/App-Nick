import { View, Text, StyleSheet } from "react-native";
import type { ReadinessZone } from "@r90/types";
import { ZONE_COLORS, ZONE_BG_COLORS } from "../lib/mock-data";

interface Props {
  zone: ReadinessZone;
  weeklyTotal: number;
  weeklyTarget: number;
  zoneStatus?: "confirmed" | "experimental";
}

export function ReadinessIndicator({ zone, weeklyTotal, weeklyTarget, zoneStatus = "experimental" }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { backgroundColor: ZONE_BG_COLORS[zone] }]}>
        <View style={[styles.dot, { backgroundColor: ZONE_COLORS[zone] }]} />
        <Text style={[styles.text, { color: ZONE_COLORS[zone] }]}>
          {weeklyTotal}/{weeklyTarget}
        </Text>
      </View>
      {zoneStatus === "experimental" && (
        <Text style={styles.experimentalLabel}>Experimental thresholds</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 4,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  experimentalLabel: {
    fontSize: 10,
    color: "#737373",
    fontStyle: "italic",
  },
});
