/**
 * OnboardingStep
 *
 * Reusable wrapper for onboarding screens.
 * Shows step indicator, an R-Lo message bubble, and children.
 */

import { View, Text, StyleSheet } from 'react-native';

interface Props {
  step: number;       // 1-indexed
  totalSteps: number;
  message: string;    // R-Lo says...
  children: React.ReactNode;
}

export function OnboardingStep({ step, totalSteps, message, children }: Props) {
  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[styles.stepDot, i + 1 === step && styles.stepDotActive]}
          />
        ))}
      </View>

      {/* R-Lo message bubble */}
      <View style={styles.messageBubble}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>R</Text>
          </View>
          <Text style={styles.avatarLabel}>R-Lo</Text>
        </View>
        <Text style={styles.messageText}>{message}</Text>
      </View>

      {/* Step content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 32,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#262626',
  },
  stepDotActive: {
    backgroundColor: '#60A5FA',
    width: 20,
  },
  messageBubble: {
    backgroundColor: '#111111',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E3A5F',
    borderWidth: 1,
    borderColor: '#60A5FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  avatarLabel: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  messageText: {
    color: '#D4D4D4',
    fontSize: 15,
    lineHeight: 22,
  },
  content: {
    flex: 1,
  },
});
