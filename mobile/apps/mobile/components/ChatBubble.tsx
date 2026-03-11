import { View, Text, StyleSheet } from "react-native";

export interface ChatMessage {
  id: string;
  type: "user" | "airloop";
  text: string;
}

interface Props {
  message: ChatMessage;
}

export function ChatBubble({ message }: Props) {
  const isAirloop = message.type === "airloop";

  return (
    <View style={[styles.row, isAirloop ? styles.rowAirloop : styles.rowUser]}>
      {isAirloop && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isAirloop ? styles.bubbleAirloop : styles.bubbleUser,
        ]}
      >
        <Text
          style={[
            styles.text,
            isAirloop ? styles.textAirloop : styles.textUser,
          ]}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 12,
    gap: 8,
  },
  rowAirloop: {
    justifyContent: "flex-start",
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1E3A5F",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: "#60A5FA",
    fontSize: 13,
    fontWeight: "700",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    padding: 12,
  },
  bubbleAirloop: {
    // Light grey — readable on the white translucent panel
    backgroundColor: "#EFEFEF",
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    // Solid blue — readable on the white translucent panel
    backgroundColor: "#1E3A5F",
    borderBottomRightRadius: 4,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  textAirloop: {
    color: "#111111",
  },
  textUser: {
    color: "#DBEAFE",
  },
});
