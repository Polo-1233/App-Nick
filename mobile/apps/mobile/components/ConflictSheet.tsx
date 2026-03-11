/**
 * Conflict Sheet Component
 *
 * Shows conflicts detected between calendar events and sleep schedule.
 * Displays R-Lo message and allows user to acknowledge.
 */

import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import type { Conflict } from '@r90/types';

interface Props {
  visible: boolean;
  conflicts: Conflict[];
  onClose: () => void;
  onAcknowledge?: () => void;
}

export function ConflictSheet({ visible, conflicts, onClose, onAcknowledge }: Props) {
  if (conflicts.length === 0) {
    return null;
  }

  const handleAcknowledge = () => {
    if (onAcknowledge) {
      onAcknowledge();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Schedule Conflicts</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.message}>
            {conflicts.length === 1
              ? "I've noticed a conflict with your sleep schedule."
              : `I've noticed ${conflicts.length} conflicts with your sleep schedule.`}
          </Text>

          <ScrollView style={styles.conflictList}>
            {conflicts.map((conflict, index) => (
              <View key={index} style={styles.conflictCard}>
                <Text style={styles.conflictType}>
                  {conflict.overlapsWith === 'sleep_cycle' && '💤 Sleep Overlap'}
                  {conflict.overlapsWith === 'pre_sleep' && '🌙 Pre-Sleep Overlap'}
                  {conflict.overlapsWith === 'down_period' && '⏰ Down-Period Overlap'}
                  {conflict.overlapsWith === 'crp' && '☕ CRP Overlap'}
                </Text>
                <Text style={styles.conflictEvent}>{conflict.event.title}</Text>
                <Text style={styles.conflictMessage}>{conflict.description}</Text>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.hint}>
            Consider moving your event, or adjusting your sleep window for tonight.
          </Text>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.buttonSecondary]}
              onPress={onClose}
            >
              <Text style={styles.buttonTextSecondary}>Dismiss</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleAcknowledge}
            >
              <Text style={styles.buttonTextPrimary}>Got It</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#A3A3A3',
  },
  message: {
    fontSize: 16,
    color: '#D4D4D4',
    lineHeight: 24,
    marginBottom: 20,
  },
  conflictList: {
    marginBottom: 20,
  },
  conflictCard: {
    backgroundColor: '#431407',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F97316',
  },
  conflictType: {
    fontSize: 12,
    color: '#F97316',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    fontWeight: '700',
  },
  conflictEvent: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  conflictMessage: {
    fontSize: 14,
    color: '#D4D4D4',
    lineHeight: 20,
  },
  hint: {
    fontSize: 13,
    color: '#A3A3A3',
    lineHeight: 18,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#22C55E',
  },
  buttonSecondary: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#262626',
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    color: '#A3A3A3',
    fontSize: 16,
    fontWeight: '600',
  },
});
