/**
 * NightHistoryList
 *
 * Shows the last 7 nights in reverse-chronological order.
 * Each row: date, cycle count (colour-coded), anchor deviation if available.
 */

import { View, Text, StyleSheet } from "react-native";
import type { NightRecord, UserProfile } from "@r90/types";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function cycleColor(cycles: number, ideal: number): string {
  if (cycles >= ideal) return "#22C55E";
  if (cycles >= 3) return "#EAB308";
  return "#F97316";
}

/**
 * Signed deviation in minutes between actualWakeTime and anchorTime.
 * Normalised to -720..+720 so midnight wraparound is handled correctly.
 */
function anchorDeviation(actualWakeTime: number, anchorTime: number): number {
  const raw = ((actualWakeTime - anchorTime + 1440) % 1440);
  return raw > 720 ? raw - 1440 : raw;
}

function formatDeviation(minutes: number): string {
  const abs = Math.abs(minutes);
  const sign = minutes >= 0 ? "+" : "–";
  if (abs < 1) return "on time";
  return `${sign}${abs}m`;
}

interface Props {
  nights: NightRecord[];
  profile: UserProfile;
}

export function NightHistoryList({ nights, profile }: Props) {
  if (nights.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No nights logged yet.</Text>
      </View>
    );
  }

  // Most-recent first
  const sorted = [...nights].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View>
      {/* Column headers */}
      <View style={styles.headerRow}>
        <Text style={[styles.col, styles.colDate, styles.headerText]}>Date</Text>
        <Text style={[styles.col, styles.colCycles, styles.headerText]}>Cycles</Text>
        <Text style={[styles.col, styles.colDev, styles.headerText]}>Anchor</Text>
      </View>

      {sorted.map((night) => {
        const color = cycleColor(night.cyclesCompleted, profile.idealCyclesPerNight);
        const dev = night.actualWakeTime !== undefined
          ? anchorDeviation(night.actualWakeTime, profile.anchorTime)
          : null;

        return (
          <View key={night.date} style={styles.row}>
            <Text style={[styles.col, styles.colDate, styles.dateText]}>
              {formatDate(night.date)}
            </Text>
            <View style={[styles.col, styles.colCycles, styles.cyclesCell]}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.cyclesText, { color }]}>
                {night.cyclesCompleted}
              </Text>
            </View>
            <Text
              style={[
                styles.col,
                styles.colDev,
                styles.devText,
                dev !== null && Math.abs(dev) > 30 && styles.devLate,
              ]}
            >
              {dev !== null ? formatDeviation(dev) : "–"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#525252",
    fontSize: 13,
  },
  headerRow: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    marginBottom: 4,
  },
  headerText: {
    color: "#444",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#111",
  },
  col: {
    // base style for alignment
  },
  colDate: {
    flex: 1,
  },
  colCycles: {
    width: 70,
    alignItems: "center",
  },
  colDev: {
    width: 60,
    textAlign: "right",
  },
  dateText: {
    color: "#D4D4D4",
    fontSize: 13,
  },
  cyclesCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cyclesText: {
    fontSize: 14,
    fontWeight: "600",
  },
  devText: {
    color: "#525252",
    fontSize: 12,
  },
  devLate: {
    color: "#F97316",
  },
});
