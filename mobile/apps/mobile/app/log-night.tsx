/**
 * Night logging screen - Manual sleep cycle entry
 *
 * User selects:
 *   - Which night (J, J-1, J-2, J-3)
 *   - Cycles completed (0-6)
 *   - Actual bedtime (optional)
 *   - Actual wake time (optional)
 *   - Notes (optional)
 *
 * Saves NightRecord to storage and navigates back to home.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { NightRecord } from '@r90/types';
import { saveNightRecord, loadProfile } from '../lib/storage';
import { submitSleepLog } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { MascotImage } from '../components/ui/MascotImage';
import { Button } from '../components/ui/Button';

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
  { label: 'J',   offset:  0 },
  { label: 'J−1', offset: -1 },
  { label: 'J−2', offset: -2 },
  { label: 'J−3', offset: -3 },
];

const CYCLES = [0, 1, 2, 3, 4, 5, 6];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogNightScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;

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

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState('');

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  const selectedDateString = dateStringForOffset(selectedOffset);

  // ── Feedback animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!saved) return;
    Animated.timing(feedbackAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => router.back(), 1000);
    return () => clearTimeout(t);
  }, [saved, router, feedbackAnim]);

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
        date:            selectedDateString,
        cyclesCompleted: cycleCount,
        anchorTime:      profile.anchorTime,
        ...(actualBedtimeEnabled  && { actualBedtime:  dateToMinutes(actualBedtimeDate) }),
        ...(actualWakeEnabled     && { actualWakeTime: dateToMinutes(actualWakeDate) }),
      };

      await saveNightRecord(record);

      const toHHMM = (min: number) =>
        `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

      void submitSleepLog({
        date:                selectedDateString,
        cycles_completed:    cycleCount,
        wake_time:           profile ? toHHMM(profile.anchorTime) : undefined,
        actual_sleep_onset:  actualBedtimeEnabled
          ? toHHMM(dateToMinutes(actualBedtimeDate)) : undefined,
        pre_sleep_routine_done: false,
      });

      setSaved(true);
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

  // ── Saved feedback overlay ─────────────────────────────────────────────────
  if (saved) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
        <Animated.View style={[s.feedbackContainer, { opacity: feedbackAnim }]}>
          <MascotImage emotion="celebration" size="lg" />
          <Text style={[s.feedbackText, { color: c.text }]}>Logged! 🌙</Text>
          <Text style={[s.feedbackSub, { color: c.textSub }]}>
            {cycleCount} cycle{cycleCount !== 1 ? 's' : ''} saved
          </Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={[s.title, { color: c.text }]}>Log last night</Text>
            <Text style={[s.subtitle, { color: c.textSub }]}>
              {formatDateLabel(selectedDateString)}
            </Text>
          </View>
          <MascotImage emotion="Fiere" size="sm" />
        </View>

        {/* Date pills */}
        <View style={s.dateRow}>
          {DATE_OPTIONS.map((opt) => {
            const active = selectedOffset === opt.offset;
            return (
              <Pressable
                key={opt.offset}
                style={[
                  s.datePill,
                  { backgroundColor: active ? c.accent : c.surface2 },
                ]}
                onPress={() => setSelectedOffset(opt.offset)}
              >
                <Text style={[
                  s.datePillText,
                  { color: active ? '#000000' : c.textSub },
                ]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Cycles selector */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: c.text }]}>Cycles completed</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.cyclesRow}
          >
            {CYCLES.map((count) => {
              const selected = cycleCount === count;
              return (
                <Pressable
                  key={count}
                  onPress={() => setCycleCount(count)}
                  style={s.cycleItem}
                >
                  <View style={[
                    s.cycleCircle,
                    {
                      width:           selected ? 52 : 44,
                      height:          selected ? 52 : 44,
                      borderRadius:    selected ? 26 : 22,
                      backgroundColor: selected ? c.accent : c.surface2,
                    },
                  ]}>
                    <Text style={[
                      s.cycleNumber,
                      {
                        color:    selected ? '#000000' : c.textSub,
                        fontSize: selected ? 22 : 18,
                      },
                    ]}>
                      {count}
                    </Text>
                  </View>
                  {selected && (
                    <Text style={[s.cycleMin, { color: c.textSub }]}>
                      {count * 90}m
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[s.hint, { color: c.textMuted }]}>
            1 cycle ≈ 90 minutes · count complete cycles only
          </Text>
        </View>

        {/* Optional: actual times */}
        <View style={[s.section, s.timesCard, { backgroundColor: c.surface }]}>
          <Text style={[s.optionalHeader, { color: c.textFaint }]}>
            OPTIONAL TIMES
          </Text>

          {/* Bedtime */}
          <Pressable
            style={[s.timeRow, { borderBottomColor: c.borderSub }]}
            onPress={() => {
              setActualBedtimeEnabled(true);
              setShowBedtimePicker(v => !v);
            }}
          >
            <Ionicons name="moon-outline" size={18} color={c.textSub} />
            <View style={s.timeLeft}>
              <Text style={[s.timeLabel, { color: c.text }]}>Bedtime</Text>
              <Text style={[s.timeValue, { color: c.textSub }]}>
                {actualBedtimeEnabled
                  ? formatMinutes(dateToMinutes(actualBedtimeDate))
                  : 'Tap to set'}
              </Text>
            </View>
            {actualBedtimeEnabled && (
              <Pressable
                hitSlop={8}
                onPress={() => { setActualBedtimeEnabled(false); setShowBedtimePicker(false); }}
              >
                <Text style={[s.clearText, { color: c.textMuted }]}>Clear</Text>
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
                style={s.iosPicker}
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
            style={[s.timeRow, { borderBottomWidth: 0 }]}
            onPress={() => {
              setActualWakeEnabled(true);
              setShowWakePicker(v => !v);
            }}
          >
            <Ionicons name="sunny-outline" size={18} color={c.textSub} />
            <View style={s.timeLeft}>
              <Text style={[s.timeLabel, { color: c.text }]}>Wake time</Text>
              <Text style={[s.timeValue, { color: c.textSub }]}>
                {actualWakeEnabled
                  ? formatMinutes(dateToMinutes(actualWakeDate))
                  : 'Tap to set'}
              </Text>
            </View>
            {actualWakeEnabled && (
              <Pressable
                hitSlop={8}
                onPress={() => { setActualWakeEnabled(false); setShowWakePicker(false); }}
              >
                <Text style={[s.clearText, { color: c.textMuted }]}>Clear</Text>
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
                style={s.iosPicker}
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

        {/* Notes */}
        <View style={s.section}>
          <TextInput
            style={[s.notesInput, { backgroundColor: c.surface2, color: c.text, borderColor: c.border }]}
            placeholder="How did you feel?"
            placeholderTextColor={c.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={280}
          />
        </View>

        {/* Buttons */}
        <View style={s.buttonsBlock}>
          <Button
            label="Save night"
            onPress={() => { void handleConfirm(); }}
            variant="primary"
            fullWidth
            loading={saving}
            icon="moon"
          />
          <Button
            label="Cancel"
            onPress={() => router.back()}
            variant="ghost"
            fullWidth
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },

  // Feedback overlay
  feedbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  feedbackText: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  feedbackSub: {
    fontSize: 15,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    fontSize: 14,
  },

  // Date pills
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  datePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  datePillText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 14,
  },

  // Cycles
  cyclesRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
    alignItems: 'center',
  },
  cycleItem: {
    alignItems: 'center',
    gap: 4,
  },
  cycleCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleNumber: {
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  cycleMin: {
    fontSize: 10,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    marginTop: 10,
  },

  // Times card
  timesCard: {
    borderRadius: 16,
    padding: 16,
  },
  optionalHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timeLeft: {
    flex: 1,
    gap: 2,
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 13,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
  },
  iosPicker: {
    height: 140,
    marginBottom: 8,
  },

  // Notes
  notesInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
  },

  // Buttons
  buttonsBlock: {
    gap: 0,
    marginTop: 8,
  },
});
