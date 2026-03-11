/**
 * check-in.tsx — Daily Check-In screen
 *
 * Fetches the day's questions from GET /screen/checkin (nick_brain backend).
 * Submits answers to POST /logs/checkin.
 *
 * Questions are dynamic — the backend decides which to show based on user state.
 * Max 3 questions per day (backend enforces this).
 *
 * Design: minimal, clean — one question at a time, premium feel.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  getCheckInPayload,
  submitCheckIn,
  type CheckInPayload,
  type CheckInInput,
} from '../lib/api';
import { useTheme } from '../lib/theme-context';
import { submitDailyLog } from '../lib/api';

// ─── Label map ────────────────────────────────────────────────────────────────

const QUESTION_LABELS: Record<string, string> = {
  mrm_count:               'How many Movement Reference Moments today?',
  morning_light_achieved:  'Did you get morning light?',
  evening_light_managed:   'Did you manage evening light (dimmed screens)?',
  subjective_energy_midday:'Energy level at midday (1–5)',
  crp_taken:               'Did you take a CRP today?',
  crp_duration_minutes:    'CRP duration (minutes)',
};

// ─── Scale selector ───────────────────────────────────────────────────────────

function ScaleSelector({
  value,
  min = 1,
  max = 5,
  onChange,
}: {
  value: number | null;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={s.scaleRow}>
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
        <Pressable
          key={n}
          style={[s.scaleDot, value === n && s.scaleDotActive]}
          onPress={() => onChange(n)}
        >
          <Text style={[s.scaleDotText, value === n && s.scaleDotTextActive]}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Number selector ──────────────────────────────────────────────────────────

function NumberSelector({
  value,
  min = 0,
  max = 12,
  step = 1,
  onChange,
}: {
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const current = value ?? min;
  return (
    <View style={s.numberRow}>
      <Pressable
        style={s.numberBtn}
        onPress={() => onChange(Math.max(min, current - step))}
      >
        <Text style={s.numberBtnText}>−</Text>
      </Pressable>
      <Text style={s.numberValue}>{current}</Text>
      <Pressable
        style={s.numberBtn}
        onPress={() => onChange(Math.min(max, current + step))}
      >
        <Text style={s.numberBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CheckInScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  const [payload,  setPayload]  = useState<CheckInPayload | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [answers,  setAnswers]  = useState<Record<string, unknown>>({});

  useEffect(() => {
    getCheckInPayload().then(result => {
      if (result.ok && result.data) {
        setPayload(result.data);
        // Pre-fill with existing data
        setAnswers(result.data.prefilled ?? {});
      } else {
        Alert.alert('Check-in unavailable', 'Could not load today\'s check-in. Try again later.');
        router.back();
      }
      setLoading(false);
    });
  }, []);

  const setAnswer = useCallback((id: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!payload) return;
    setSaving(true);
    try {
      const input: CheckInInput = {
        date:                    payload.daily_log_date,
        mrm_count:               typeof answers.mrm_count === 'number' ? answers.mrm_count : undefined,
        morning_light_achieved:  typeof answers.morning_light_achieved === 'boolean' ? answers.morning_light_achieved : undefined,
        evening_light_managed:   typeof answers.evening_light_managed  === 'boolean' ? answers.evening_light_managed  : undefined,
        subjective_energy_midday: typeof answers.subjective_energy_midday === 'number' ? answers.subjective_energy_midday : undefined,
        crp_taken:               typeof answers.crp_taken === 'boolean' ? answers.crp_taken : undefined,
        crp_duration_minutes:    typeof answers.crp_duration_minutes === 'number' ? answers.crp_duration_minutes : undefined,
      };

      const result = await submitCheckIn(input);
      if (!result.ok) {
        Alert.alert('Submit failed', result.error ?? 'Please try again.');
        return;
      }

      // Also submit as daily log for fuller data coverage
      void submitDailyLog({
        date:                    payload.daily_log_date,
        mrm_count:               input.mrm_count,
        morning_light_achieved:  input.morning_light_achieved,
        evening_light_managed:   input.evening_light_managed,
        subjective_energy_midday: input.subjective_energy_midday,
        crp_taken:               input.crp_taken,
        crp_duration_minutes:    input.crp_duration_minutes,
      });

      router.back();
    } finally {
      setSaving(false);
    }
  }, [payload, answers, router]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.text} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!payload) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Text style={[s.backText, { color: c.accent ?? '#22C55E' }]}>← Back</Text>
          </Pressable>
          <Text style={[s.title, { color: c.text }]}>Daily check-in</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>{payload.daily_log_date}</Text>
        </View>

        {/* Questions */}
        {payload.questions.map(q => {
          const label = QUESTION_LABELS[q.id] ?? q.label_key;
          const val   = answers[q.id];

          return (
            <View key={q.id} style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[s.questionLabel, { color: c.text }]}>{label}</Text>

              {q.type === 'boolean' && (
                <View style={s.switchRow}>
                  <Text style={[s.switchLabel, { color: c.textMuted }]}>
                    {val === true ? 'Yes' : 'No'}
                  </Text>
                  <Switch
                    value={val === true}
                    onValueChange={v => setAnswer(q.id, v)}
                    trackColor={{ false: c.border, true: '#22C55E' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              )}

              {q.type === 'scale' && (
                <ScaleSelector
                  value={typeof val === 'number' ? val : null}
                  min={q.min ?? 1}
                  max={q.max ?? 5}
                  onChange={v => setAnswer(q.id, v)}
                />
              )}

              {q.type === 'number' && (
                <NumberSelector
                  value={typeof val === 'number' ? val : null}
                  min={q.min ?? 0}
                  max={q.max ?? 12}
                  onChange={v => setAnswer(q.id, v)}
                />
              )}
            </View>
          );
        })}

        {/* Submit */}
        <Pressable
          style={[s.submitBtn, saving && s.submitBtnDisabled]}
          onPress={() => { void handleSubmit(); }}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={s.submitText}>Done</Text>
          }
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 28,
  },
  backBtn: {
    marginBottom: 16,
  },
  backText: {
    fontSize:   15,
    fontWeight: '600',
  },
  title: {
    fontSize:   28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  card: {
    borderWidth:  1,
    borderRadius: 16,
    padding:      20,
    marginBottom: 16,
  },
  questionLabel: {
    fontSize:     16,
    fontWeight:   '600',
    marginBottom: 16,
    lineHeight:   24,
  },
  switchRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 15,
  },
  scaleRow: {
    flexDirection: 'row',
    gap:           10,
  },
  scaleDot: {
    width:          44,
    height:         44,
    borderRadius:   22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.1)',
  },
  scaleDotActive: {
    backgroundColor: '#22C55E',
    borderColor:     '#22C55E',
  },
  scaleDotText: {
    color:      'rgba(255,255,255,0.5)',
    fontSize:   16,
    fontWeight: '600',
  },
  scaleDotTextActive: {
    color: '#FFFFFF',
  },
  numberRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            20,
  },
  numberBtn: {
    width:          44,
    height:         44,
    borderRadius:   22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems:     'center',
    justifyContent: 'center',
  },
  numberBtnText: {
    color:    '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
  },
  numberValue: {
    color:      '#FFFFFF',
    fontSize:   24,
    fontWeight: '700',
    minWidth:   40,
    textAlign:  'center',
  },
  submitBtn: {
    backgroundColor: '#22C55E',
    borderRadius:    14,
    paddingVertical: 18,
    alignItems:      'center',
    marginTop:       8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color:      '#FFFFFF',
    fontSize:   17,
    fontWeight: '700',
  },
});
