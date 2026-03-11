/**
 * Night logging screen - Manual sleep cycle entry
 *
 * User selects:
 *   - Which night (J-1, J-2, J-3)
 *   - Cycles completed (2-6)
 *   - Actual bedtime (optional, power users)
 *   - Actual wake time (optional, power users)
 *
 * Saves NightRecord to storage and navigates back to home.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NightRecord } from '@r90/types';
import { saveNightRecord, loadProfile } from '../lib/storage';
import { submitSleepLog } from '../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateStringForOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { label: 'Last night',   offset: -1 },
  { label: '2 nights ago', offset: -2 },
  { label: '3 nights ago', offset: -3 },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogNightScreen() {
  const router = useRouter();

  // ── Date ──────────────────────────────────────────────────────────────────
  const [selectedOffset, setSelectedOffset] = useState(-1);

  // ── Cycles ────────────────────────────────────────────────────────────────
  const [cycleCount, setCycleCount] = useState(5);

  // ── Optional: actual bedtime ───────────────────────────────────────────────
  const [showBedtimePicker, setShowBedtimePicker] = useState(false);
  const [actualBedtimeEnabled, setActualBedtimeEnabled] = useState(false);
  const [actualBedtimeDate, setActualBedtimeDate] = useState(() => {
    const d = new Date();
    d.setHours(23, 0, 0, 0);
    return d;
  });

  // ── Optional: actual wake time ─────────────────────────────────────────────
  const [showWakePicker, setShowWakePicker] = useState(false);
  const [actualWakeEnabled, setActualWakeEnabled] = useState(false);
  const [actualWakeDate, setActualWakeDate] = useState(() => {
    const d = new Date();
    d.setHours(6, 30, 0, 0);
    return d;
  });

  const [saving, setSaving] = useState(false);

  const selectedDateString = dateStringForOffset(selectedOffset);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setSaving(true);
    try {
      const profile = await loadProfile();

      if (!profile) {
        setSaving(false);
        Alert.alert(
          'Profile not found',
          'Could not load your profile. Please restart the app and try again.',
          [{ text: 'OK' }],
        );
        return;
      }

      const record: NightRecord = {
        date:             selectedDateString,
        cyclesCompleted:  cycleCount,
        anchorTime:       profile.anchorTime,
        // Optional fields — only included when user has enabled them
        ...(actualBedtimeEnabled  && { actualBedtime:  dateToMinutes(actualBedtimeDate) }),
        ...(actualWakeEnabled     && { actualWakeTime: dateToMinutes(actualWakeDate) }),
      };

      // 1 — Save locally (offline fallback)
      await saveNightRecord(record);

      // 2 — Submit to backend (best-effort, non-blocking on failure)
      const toHHMM = (min: number) =>
        `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

      void submitSleepLog({
        date:                selectedDateString,
        cycles_completed:    cycleCount,
        wake_time:           profile ? toHHMM(profile.anchorTime) : undefined,
        actual_sleep_onset:  (actualBedtimeEnabled)
          ? toHHMM(dateToMinutes(actualBedtimeDate)) : undefined,
        pre_sleep_routine_done: false, // will be enriched in future
      });

      router.back();
    } catch {
      Alert.alert(
        'Could not save',
        'Something went wrong saving your night record. Please try again.',
        [{ text: 'Try again', style: 'default' }, { text: 'Cancel', style: 'cancel' }],
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Log Last Night</Text>
        <Text style={styles.subtitle}>
          How many 90-minute sleep cycles did you complete?
        </Text>

        {/* Date selector */}
        <View style={styles.dateSelector}>
          {DATE_OPTIONS.map((opt) => {
            const active = selectedOffset === opt.offset;
            return (
              <Pressable
                key={opt.offset}
                style={[styles.datePill, active && styles.datePillActive]}
                onPress={() => setSelectedOffset(opt.offset)}
              >
                <Text style={[styles.datePillLabel, active && styles.datePillLabelActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Selected date display */}
        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>Night of</Text>
          <Text style={styles.dateValue}>{formatDateLabel(selectedDateString)}</Text>
        </View>

        {/* Cycle Count Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Cycles Completed</Text>
          <View style={styles.cycleButtons}>
            {[2, 3, 4, 5, 6].map((count) => (
              <Pressable
                key={count}
                style={[
                  styles.cycleButton,
                  cycleCount === count && styles.cycleButtonSelected,
                ]}
                onPress={() => setCycleCount(count)}
              >
                <Text
                  style={[
                    styles.cycleButtonText,
                    cycleCount === count && styles.cycleButtonTextSelected,
                  ]}
                >
                  {count}
                </Text>
                <Text
                  style={[
                    styles.cycleButtonSubtext,
                    cycleCount === count && styles.cycleButtonSubtextSelected,
                  ]}
                >
                  {count * 90} min
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>
            1 cycle ≈ 90 minutes of sleep. Count complete cycles only.
          </Text>
        </View>

        {/* ── Optional: actual times ── */}
        <View style={styles.section}>
          <Text style={styles.optionalLabel}>OPTIONAL — ACTUAL TIMES</Text>

          {/* Bedtime */}
          <Pressable
            style={styles.optionalRow}
            onPress={() => {
              setActualBedtimeEnabled(true);
              setShowBedtimePicker(v => !v);
            }}
          >
            <View style={styles.optionalLeft}>
              <Text style={styles.optionalTitle}>Actual bedtime</Text>
              <Text style={styles.optionalValue}>
                {actualBedtimeEnabled
                  ? formatMinutes(dateToMinutes(actualBedtimeDate))
                  : 'Tap to set'}
              </Text>
            </View>
            {actualBedtimeEnabled && (
              <Pressable
                style={styles.clearBtn}
                onPress={() => { setActualBedtimeEnabled(false); setShowBedtimePicker(false); }}
                hitSlop={8}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            )}
          </Pressable>

          {showBedtimePicker && (
            Platform.OS === 'ios' ? (
              <DateTimePicker
                value={actualBedtimeDate}
                mode="time"
                display="spinner"
                onChange={(_, d) => { if (d) setActualBedtimeDate(d); }}
                style={styles.iosPicker}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ textColor: '#FFFFFF' } as any)}
              />
            ) : (
              <DateTimePicker
                value={actualBedtimeDate}
                mode="time"
                display="default"
                onChange={(_, d) => {
                  setShowBedtimePicker(false);
                  if (d) setActualBedtimeDate(d);
                }}
              />
            )
          )}

          {/* Wake time */}
          <Pressable
            style={[styles.optionalRow, { borderBottomWidth: 0 }]}
            onPress={() => {
              setActualWakeEnabled(true);
              setShowWakePicker(v => !v);
            }}
          >
            <View style={styles.optionalLeft}>
              <Text style={styles.optionalTitle}>Actual wake time</Text>
              <Text style={styles.optionalValue}>
                {actualWakeEnabled
                  ? formatMinutes(dateToMinutes(actualWakeDate))
                  : 'Tap to set'}
              </Text>
            </View>
            {actualWakeEnabled && (
              <Pressable
                style={styles.clearBtn}
                onPress={() => { setActualWakeEnabled(false); setShowWakePicker(false); }}
                hitSlop={8}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            )}
          </Pressable>

          {showWakePicker && (
            Platform.OS === 'ios' ? (
              <DateTimePicker
                value={actualWakeDate}
                mode="time"
                display="spinner"
                onChange={(_, d) => { if (d) setActualWakeDate(d); }}
                style={styles.iosPicker}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ textColor: '#FFFFFF' } as any)}
              />
            ) : (
              <DateTimePicker
                value={actualWakeDate}
                mode="time"
                display="default"
                onChange={(_, d) => {
                  setShowWakePicker(false);
                  if (d) setActualWakeDate(d);
                }}
              />
            )
          )}
        </View>

        {/* Confirm Button */}
        <Pressable
          style={[styles.confirmButton, saving && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={saving}
        >
          <Text style={styles.confirmButtonText}>
            {saving ? 'Saving...' : 'Save Night Record'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  backButton: {
    marginBottom: 16,
  },
  backText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A3A3A3',
    marginBottom: 24,
    lineHeight: 24,
  },
  // Date selector
  dateSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  datePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: '#262626',
  },
  datePillActive: {
    borderColor: '#22C55E',
    backgroundColor: '#052E16',
  },
  datePillLabel: {
    color: '#737373',
    fontSize: 12,
    fontWeight: '600',
  },
  datePillLabelActive: {
    color: '#22C55E',
  },
  // Date card
  dateCard: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#262626',
  },
  dateLabel: {
    fontSize: 12,
    color: '#737373',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Cycle selector
  section: {
    marginBottom: 32,
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  cycleButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  cycleButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cycleButtonSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#052E16',
  },
  cycleButtonText: {
    color: '#A3A3A3',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  cycleButtonTextSelected: {
    color: '#22C55E',
  },
  cycleButtonSubtext: {
    color: '#737373',
    fontSize: 12,
  },
  cycleButtonSubtextSelected: {
    color: '#16A34A',
  },
  hint: {
    fontSize: 14,
    color: '#737373',
    lineHeight: 20,
  },
  // Optional times
  optionalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#525252',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  optionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#262626',
  },
  optionalLeft: {
    flex: 1,
  },
  optionalTitle: {
    color: '#D4D4D4',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  optionalValue: {
    color: '#737373',
    fontSize: 13,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1A1A1A',
  },
  clearBtnText: {
    color: '#737373',
    fontSize: 12,
    fontWeight: '600',
  },
  iosPicker: {
    height: 140,
    marginBottom: 8,
  },
  // Confirm
  confirmButton: {
    backgroundColor: '#22C55E',
    padding: 18,
    borderRadius: 12,
    marginTop: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#166534',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
