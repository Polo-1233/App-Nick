import { View, Text, StyleSheet } from "react-native";
import type { RLoMessage } from "@r90/types";

interface Props {
  message: RLoMessage;
}

export function RLoCard({ message }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>A</Text>
      </View>
      <View style={styles.bubble}>
        <Text style={styles.text}>{message.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1E3A5F",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#60A5FA",
    fontSize: 18,
    fontWeight: "700",
  },
  bubble: {
    flex: 1,
    backgroundColor: "#141414",
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 16,
  },
  text: {
    color: "#E5E5E5",
    fontSize: 15,
    lineHeight: 22,
  },
});
