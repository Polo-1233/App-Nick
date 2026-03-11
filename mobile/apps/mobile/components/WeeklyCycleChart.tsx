/**
 * WeeklyCycleChart
 *
 * 7-bar mini chart showing cycles per night for the current week.
 * Colored by cycles relative to the ideal:
 *   >= idealCycles  → green
 *   >= 3            → yellow
 *   >= 1            → orange
 *   no data         → dark placeholder
 *
 * Design: no gamification. Just data.
 */

import { View, Text, StyleSheet } from "react-native";
import type { NightRecord } from "@r90/types";

const BAR_MAX_HEIGHT = 56; // px for idealCycles count

function barColor(cycles: number, idealCycles: number): string {
  if (cycles >= idealCycles) return "#22C55E"; // green
  if (cycles >= 3) return "#EAB308"; // yellow
  if (cycles >= 1) return "#F97316"; // orange
  return "#1A1A1A"; // empty
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00"); // noon to avoid tz edge cases
  return d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
}

interface Props {
  weekHistory: NightRecord[];
  idealCycles: number;
  weeklyTotal: number;
  weeklyTarget: number;
}

export function WeeklyCycleChart({
  weekHistory,
  idealCycles,
  weeklyTotal,
  weeklyTarget,
}: Props) {
  // Show up to 7 slots, most-recent on the right
  const slots: (NightRecord | null)[] = Array(7).fill(null);
  const sorted = [...weekHistory].sort((a, b) => a.date.localeCompare(b.date));
  const start = Math.max(0, 7 - sorted.length);
  sorted.forEach((record, i) => {
    slots[start + i] = record;
  });

  const remaining = weeklyTarget - weeklyTotal;

  return (
    <View style={styles.container}>
      {/* Summary row */}
      <View style={styles.summary}>
        <Text style={styles.totalText}>
          <Text style={styles.totalNumber}>{weeklyTotal}</Text>
          <Text style={styles.totalSep}> / </Text>
          <Text style={styles.totalTarget}>{weeklyTarget}</Text>
        </Text>
        <Text style={styles.remainingText}>
          {remaining > 0 ? `${remaining} to target` : "Target reached"}
        </Text>
      </View>

      {/* Bars */}
      <View style={styles.barsRow}>
        {slots.map((record, i) => {
          const cycles = record?.cyclesCompleted ?? 0;
          const haData = record !== null;
          const height = haData
            ? Math.max(4, (cycles / idealCycles) * BAR_MAX_HEIGHT)
            : 4;
          const color = haData ? barColor(cycles, idealCycles) : "#1A1A1A";

          return (
            <View key={i} style={styles.barSlot}>
              {/* Bar container — top-aligned, fills from bottom */}
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: color,
                      opacity: haData ? 1 : 0.4,
                    },
                  ]}
                />
              </View>
              {/* Cycle count label (only if data) */}
              {haData ? (
                <Text style={[styles.barLabel, { color }]}>{cycles}</Text>
              ) : (
                <Text style={styles.barLabelEmpty}>·</Text>
              )}
              {/* Day letter */}
              {record ? (
                <Text style={styles.dayLabel}>{shortDay(record.date)}</Text>
              ) : (
                <Text style={styles.dayLabelEmpty}>–</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  summary: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  totalText: {
    fontSize: 16,
  },
  totalNumber: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },
  totalSep: {
    color: "#444",
    fontSize: 20,
  },
  totalTarget: {
    color: "#525252",
    fontSize: 20,
    fontWeight: "600",
  },
  remainingText: {
    color: "#525252",
    fontSize: 13,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: BAR_MAX_HEIGHT + 36, // bar + labels
  },
  barSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  barContainer: {
    width: "100%",
    height: BAR_MAX_HEIGHT,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "100%",
    borderRadius: 3,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  barLabelEmpty: {
    color: "#333",
    fontSize: 11,
    marginTop: 4,
  },
  dayLabel: {
    color: "#525252",
    fontSize: 10,
    marginTop: 2,
  },
  dayLabelEmpty: {
    color: "#2A2A2A",
    fontSize: 10,
    marginTop: 2,
  },
});
