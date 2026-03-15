/**
 * lifestyle.tsx — Lifestyle profile setup
 *
 * Collects: stress level, sleep environment, exercise frequency, alcohol use, work start time.
 * These feed directly into the R-Lo AI context for personalized coaching.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { useRouter }     from 'expo-router';
import { Ionicons }      from '@expo/vector-icons';
import { updateLifestyle, type LifestyleInput } from '../lib/api';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#0B1220', card: '#1A2436', surface2: '#243046',
  accent: '#4DA3FF', text: '#E6EDF7', sub: '#9FB0C5',
  muted: '#6B7F99', border: 'rgba(255,255,255,0.06)',
  success: '#3DDC97',
};

// ─── Option sets ──────────────────────────────────────────────────────────────
const STRESS_OPTS = [
  { value: 'low',      label: 'Low',      sub: 'Generally calm and relaxed',        icon: '😌' },
  { value: 'medium',   label: 'Medium',   sub: 'Some stress, manageable most days', icon: '😐' },
  { value: 'high',     label: 'High',     sub: 'Frequently under pressure',         icon: '😤' },
  { value: 'variable', label: 'Variable', sub: 'Depends heavily on the week',       icon: '🔄' },
];
const ENV_OPTS = [
  { value: 'quiet',     label: 'Very quiet',   sub: 'No noise disruptions',         icon: '🌙' },
  { value: 'moderate',  label: 'Moderate',     sub: 'Occasional noises',            icon: '🏠' },
  { value: 'noisy',     label: 'Noisy',        sub: 'Regular disruptions',          icon: '🔊' },
  { value: 'very_noisy',label: 'Very noisy',   sub: 'Frequent loud disruptions',    icon: '🚨' },
];
const EXERCISE_OPTS = [
  { value: 'none',     label: 'None',     sub: 'No regular exercise',               icon: '🛋️' },
  { value: 'light',    label: 'Light',    sub: 'Walks, gentle movement',            icon: '🚶' },
  { value: 'moderate', label: 'Moderate', sub: '3–4 sessions/week',                icon: '🏃' },
  { value: 'heavy',    label: 'Heavy',    sub: 'Daily or intense training',         icon: '🏋️' },
];
const ALCOHOL_OPTS = [
  { value: 'none',       label: 'None',         sub: 'I don\'t drink',              icon: '💧' },
  { value: 'occasional', label: 'Occasional',   sub: 'A few times a month',         icon: '🍷' },
  { value: 'regular',    label: 'Regular',      sub: 'Several times a week',        icon: '🍺' },
];

// ─── Components ───────────────────────────────────────────────────────────────
function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionSub}>{sub}</Text>
    </View>
  );
}

function OptionRow({
  option, selected, onPress,
}: { option: { value: string; label: string; sub: string; icon: string }; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[s.option, selected && s.optionSelected]}
      onPress={onPress}
    >
      <Text style={s.optionIcon}>{option.icon}</Text>
      <View style={s.optionText}>
        <Text style={[s.optionLabel, selected && { color: '#000' }]}>{option.label}</Text>
        <Text style={[s.optionSub, selected && { color: 'rgba(0,0,0,0.6)' }]}>{option.sub}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={20} color="#000" />}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LifestyleScreen() {
  const router = useRouter();

  const [stress,    setStress]    = useState<string>('medium');
  const [env,       setEnv]       = useState<string>('moderate');
  const [exercise,  setExercise]  = useState<string>('light');
  const [alcohol,   setAlcohol]   = useState<string>('none');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const input: LifestyleInput = {
        stress_level:       stress,
        sleep_environment:  env,
        exercise_frequency: exercise,
        alcohol_use:        alcohol,
      };
      const result = await updateLifestyle(input);
      if (!result.ok) {
        Alert.alert('Error', result.error ?? 'Failed to save. Please try again.');
        return;
      }
      setSaved(true);
      setTimeout(() => router.back(), 900);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>Lifestyle profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={s.intro}>
          <Text style={s.introText}>
            R-Lo uses these details to personalize your coaching. The more accurate you are, the better the advice.
          </Text>
        </View>

        {/* Stress */}
        <SectionTitle title="Baseline stress level" sub="How stressed are you on a typical week?" />
        {STRESS_OPTS.map(opt => (
          <OptionRow key={opt.value} option={opt} selected={stress === opt.value} onPress={() => setStress(opt.value)} />
        ))}

        {/* Environment */}
        <SectionTitle title="Sleep environment" sub="How noisy is your bedroom at night?" />
        {ENV_OPTS.map(opt => (
          <OptionRow key={opt.value} option={opt} selected={env === opt.value} onPress={() => setEnv(opt.value)} />
        ))}

        {/* Exercise */}
        <SectionTitle title="Exercise frequency" sub="How often do you exercise?" />
        {EXERCISE_OPTS.map(opt => (
          <OptionRow key={opt.value} option={opt} selected={exercise === opt.value} onPress={() => setExercise(opt.value)} />
        ))}

        {/* Alcohol */}
        <SectionTitle title="Alcohol consumption" sub="How often do you drink alcohol?" />
        {ALCOHOL_OPTS.map(opt => (
          <OptionRow key={opt.value} option={opt} selected={alcohol === opt.value} onPress={() => setAlcohol(opt.value)} />
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Save button */}
      <View style={s.footer}>
        <Pressable
          style={[s.saveBtn, saved && { backgroundColor: C.success }]}
          onPress={() => { void handleSave(); }}
          disabled={saving || saved}
        >
          {saving
            ? <ActivityIndicator color="#000" size="small" />
            : saved
              ? <><Ionicons name="checkmark" size={18} color="#000" /><Text style={s.saveBtnText}>Saved</Text></>
              : <Text style={s.saveBtnText}>Save profile</Text>
          }
        </Pressable>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  flex:   { flex: 1 },
  scroll: { paddingBottom: 16 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  back:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },

  intro:     { margin: 16, backgroundColor: C.card, borderRadius: 14, padding: 16 },
  introText: { fontSize: 14, color: C.sub, lineHeight: 21 },

  sectionHeader: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 10 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 3 },
  sectionSub:    { fontSize: 13, color: C.muted },

  option:         { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 8, backgroundColor: C.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: 'transparent' },
  optionSelected: { backgroundColor: C.accent, borderColor: C.accent },
  optionIcon:     { fontSize: 22, width: 30, textAlign: 'center' },
  optionText:     { flex: 1, gap: 2 },
  optionLabel:    { fontSize: 15, fontWeight: '600', color: C.text },
  optionSub:      { fontSize: 12, color: C.muted },

  footer:      { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  saveBtn:     { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
