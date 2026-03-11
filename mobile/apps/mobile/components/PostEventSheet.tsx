/**
 * Post-Event Bottom Sheet
 *
 * Allows user to trigger post-event protocol after a late event.
 * Step 1: Select event type (Physical / Mental / Social)
 * Step 2: Enter event end time
 * Step 3: Preview new sleep window, confirm to update plan
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { UserProfile, CycleWindow } from '@r90/types';
import { calculatePostEventWindow, formatTime } from '@r90/core';

type EventType = 'Physical' | 'Mental' | 'Social';

interface Props {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onConfirm?: (window: CycleWindow) => void;
}

const EVENT_TYPE_DESCRIPTIONS: Record<EventType, string> = {
  Physical: 'Exercise or physical exertion raises core body temperature. Allow extra wind-down time.',
  Mental:   'Cognitive load and screen exposure delay melatonin onset. Protect your pre-sleep window.',
  Social:   'Social stimulation elevates cortisol. Give your nervous system time to settle.',
};

export function PostEventSheet({ visible, profile, onClose, onConfirm }: Props) {
  const [eventType, setEventType] = useState<EventType>('Physical');
  const [eventEndTime, setEventEndTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  const eventEndMinutes = eventEndTime.getHours() * 60 + eventEndTime.getMinutes();
  const newWindow = calculatePostEventWindow(profile, eventEndMinutes);

  const handleConfirm = () => {
    if (!newWindow) { onClose(); return; }
    onConfirm?.(newWindow);
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
            <Text style={styles.title}>Late Event Protocol</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Event Type Selector */}
          <Text style={styles.sectionLabel}>EVENT TYPE</Text>
          <View style={styles.typeRow}>
            {(['Physical', 'Mental', 'Social'] as EventType[]).map((type) => {
              const isSelected = eventType === type;
              return (
                <Pressable
                  key={type}
                  style={[styles.typeBtn, isSelected && styles.typeBtnSelected]}
                  onPress={() => setEventType(type)}
                >
                  <Text style={[styles.typeBtnText, isSelected && styles.typeBtnTextSelected]}>
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.typeDescription}>
            {EVENT_TYPE_DESCRIPTIONS[eventType]}
          </Text>

          {/* Event End Time */}
          <Text style={styles.sectionLabel}>EVENT END TIME</Text>

          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={eventEndTime}
              mode="time"
              display="spinner"
              onChange={(_, d) => { if (d) setEventEndTime(d); }}
              style={styles.picker}
            />
          ) : (
            <>
              <Pressable
                style={styles.androidButton}
                onPress={() => setShowPicker(true)}
              >
                <Text style={styles.androidButtonText}>
                  {eventEndTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Pressable>
              {showPicker && (
                <DateTimePicker
                  value={eventEndTime}
                  mode="time"
                  display="default"
                  onChange={(_, d) => {
                    setShowPicker(false);
                    if (d) setEventEndTime(d);
                  }}
                />
              )}
            </>
          )}

          {/* New Sleep Window Preview */}
          {newWindow ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>NEW SLEEP WINDOW</Text>
              <Text style={styles.resultTime}>
                {formatTime(newWindow.bedtime)} → {formatTime(newWindow.wakeTime)}
              </Text>
              <Text style={styles.resultCycles}>
                {newWindow.cycleCount} cycles · {newWindow.cycleCount * 90} min
              </Text>
            </View>
          ) : (
            <View style={[styles.resultCard, styles.resultCardWarning]}>
              <Text style={styles.resultLabel}>NO WINDOW AVAILABLE</Text>
              <Text style={styles.resultWarningText}>
                Event ends too late to fit the minimum 2 cycles before your anchor time.
              </Text>
            </View>
          )}

          <Pressable
            style={[styles.confirmButton, !newWindow && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!newWindow}
          >
            <Text style={styles.confirmButtonText}>
              {newWindow ? 'Update Sleep Plan' : 'Close'}
            </Text>
          </Pressable>
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
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
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
    fontSize: 16,
    color: '#A3A3A3',
  },
  sectionLabel: {
    color: '#525252',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#262626',
  },
  typeBtnSelected: {
    backgroundColor: '#1E3A5F',
    borderColor: '#60A5FA',
  },
  typeBtnText: {
    color: '#737373',
    fontSize: 13,
    fontWeight: '600',
  },
  typeBtnTextSelected: {
    color: '#60A5FA',
  },
  typeDescription: {
    color: '#525252',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  picker: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 20,
  },
  androidButton: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  androidButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  resultCardWarning: {
    borderColor: '#F9731644',
  },
  resultLabel: {
    color: '#525252',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  resultTime: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultCycles: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '600',
  },
  resultWarningText: {
    color: '#F97316',
    fontSize: 13,
    lineHeight: 18,
  },
  confirmButton: {
    backgroundColor: '#22C55E',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#1A1A1A',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
