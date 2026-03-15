/**
 * ConflictCard
 *
 * Shows a single conflict inline in the Calendar tab.
 * Displays the R-Lo explanation and, when options exist, a resolution picker.
 *
 * Rule R033: Options are always presented — never demanded.
 * The user can dismiss without choosing.
 */

import { View, Text, Pressable, StyleSheet } from "react-native";
import type { Conflict, ConflictOption } from "@r90/types";

const SEVERITY_COLORS = {
  minor: "#EAB308",  // yellow
  major: "#F97316",  // orange
};

const OVERLAP_LABELS: Record<string, string> = {
  pre_sleep: "Pre-sleep",
  sleep_cycle: "Sleep window",
  down_period: "Down period",
  crp: "CRP",
};

interface Props {
  conflict: Conflict;
  options: ConflictOption[];
  selectedOptionIndex: number | null;
  onSelectOption: (index: number, option: ConflictOption) => void;
}

export function ConflictCard({
  conflict,
  options,
  selectedOptionIndex,
  onSelectOption,
}: Props) {
  const severityColor = SEVERITY_COLORS[conflict.severity];
  const overlapLabel = OVERLAP_LABELS[conflict.overlapsWith] ?? conflict.overlapsWith;

  return (
    <View style={[styles.card, { borderLeftColor: severityColor }]}>
      {/* Header row: event title + overlap badge */}
      <View style={styles.header}>
        <Text style={styles.eventTitle} numberOfLines={1}>
          {conflict.event.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: severityColor + "22" }]}>
          <Text style={[styles.badgeText, { color: severityColor }]}>
            {overlapLabel}
          </Text>
        </View>
      </View>

      {/* R-Lo explanation */}
      <Text style={styles.description}>{conflict.description}</Text>

      {/* Resolution options (only for pre_sleep conflicts) */}
      {options.length > 0 && (
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsLabel}>Resolution</Text>
          <View style={styles.options}>
            {options.map((option, i) => {
              const isSelected = selectedOptionIndex === i;
              return (
                <Pressable
                  key={i}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => onSelectOption(i, option)}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelSelected,
                    ]}
                  >
                    {i === 0 ? "Option A" : "Option B"}
                  </Text>
                  <Text
                    style={[
                      styles.optionTitle,
                      isSelected && styles.optionTitleSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionDescription,
                      isSelected && styles.optionDescriptionSelected,
                    ]}
                  >
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* No options: major conflict info only */}
      {options.length === 0 && (
        <Text style={styles.noOptions}>
          Consider rescheduling the event or adjusting your anchor time.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111111",
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  eventTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  description: {
    color: "#A3A3A3",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  optionsContainer: {
    marginTop: 4,
  },
  optionsLabel: {
    color: "#525252",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  options: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#262626",
    padding: 12,
  },
  optionSelected: {
    backgroundColor: "#1E3A5F",
    borderColor: "#60A5FA",
  },
  optionLabel: {
    color: "#525252",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: "#60A5FA",
  },
  optionTitle: {
    color: "#D4D4D4",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: "#FFFFFF",
  },
  optionDescription: {
    color: "#737373",
    fontSize: 12,
    lineHeight: 16,
  },
  optionDescriptionSelected: {
    color: "#A3A3A3",
  },
  noOptions: {
    color: "#525252",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
});
