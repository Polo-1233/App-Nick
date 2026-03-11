import { View, Text, StyleSheet } from "react-native";
import type { NextAction } from "@r90/types";
import { formatTime } from "../lib/mock-data";

interface Props {
  action: NextAction;
}

export function NextActionCard({ action }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>NEXT</Text>
      <Text style={styles.title}>{action.title}</Text>
      <Text style={styles.description}>{action.description}</Text>
      {action.scheduledAt != null && (
        <Text style={styles.time}>{formatTime(action.scheduledAt)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: "#60A5FA",
  },
  label: {
    color: "#60A5FA",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  description: {
    color: "#A3A3A3",
    fontSize: 14,
    lineHeight: 20,
  },
  time: {
    color: "#60A5FA",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
  },
});
