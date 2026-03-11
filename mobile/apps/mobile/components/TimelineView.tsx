import { View, Text, StyleSheet } from "react-native";
import type { TimeBlock, BlockType } from "@r90/types";

/** Format MinuteOfDay to HH:MM */
function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface Props {
  blocks: TimeBlock[];
}

const BLOCK_COLORS: Record<BlockType, string> = {
  wake: "#22C55E",
  calendar_event: "#6366F1",
  pre_sleep: "#A78BFA",
  down_period: "#7C3AED",
  sleep_cycle: "#1E3A5F",
  crp: "#EAB308",
  free: "#262626",
};

export function TimelineView({ blocks }: Props) {
  // Show only the most relevant blocks (wake, calendar, pre-sleep, down-period, sleep)
  const displayBlocks = blocks.filter(
    (b) => b.type !== "free"
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>TODAY</Text>
      {displayBlocks.map((block, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.timeColumn}>
            <Text style={styles.time}>{formatTime(block.start)}</Text>
          </View>
          <View style={styles.lineColumn}>
            <View
              style={[
                styles.dot,
                { backgroundColor: BLOCK_COLORS[block.type] },
              ]}
            />
            {i < displayBlocks.length - 1 && <View style={styles.line} />}
          </View>
          <View style={styles.labelColumn}>
            <Text style={styles.label}>{block.label}</Text>
            <Text style={styles.duration}>
              {((block.end - block.start + 1440) % 1440) || 1440} min
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  sectionTitle: {
    color: "#525252",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    minHeight: 48,
    marginBottom: 4,
  },
  timeColumn: {
    width: 50,
    alignItems: "flex-end",
    paddingRight: 12,
    paddingTop: 2,
  },
  time: {
    color: "#737373",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  lineColumn: {
    width: 20,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  line: {
    width: 1,
    flex: 1,
    backgroundColor: "#262626",
    marginVertical: 2,
  },
  labelColumn: {
    flex: 1,
    paddingLeft: 12,
  },
  label: {
    color: "#D4D4D4",
    fontSize: 14,
    fontWeight: "500",
  },
  duration: {
    color: "#525252",
    fontSize: 12,
    marginTop: 2,
  },
});
