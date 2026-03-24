/**
 * Lifestyle — personalisation screen
 * Accessible depuis Profile > Personalisation
 */

import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useRouter }    from 'expo-router';
import { useTheme }     from '../lib/theme-context';
import { AmbientBackground } from '../components/ui/AmbientBackground';
import { updateLifestyle, type LifestyleInput } from '../lib/api';
import { HapticsLight } from '../utils/haptics';

const ACCENT   = '#1c9fda';
const CARD     = '#141466';
const TEXT_W   = '#FFFFFF';
const TEXT_M   = '#A0B0CC';
const TEXT_F   = '#7A8FAA';
const BORDER   = 'rgba(255,255,255,0.07)';
const SURFACE2 = '#1c1c7a';

// ─── Chip selector ────────────────────────────────────────────────────────────
function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label:    string;
  options:  { value: T; label: string }[];
  value:    T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={ls.group}>
      <Text style={ls.groupLabel}>{label}</Text>
      <View style={ls.chips}>
        {options.map(opt => (
          <Pressable
            key={opt.value}
            style={[ls.chip, value === opt.value && ls.chipActive]}
            onPress={() => { HapticsLight(); onChange(opt.value); }}
          >
            <Text style={[ls.chipTxt, value === opt.value && ls.chipTxtActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LifestyleScreen() {
  const { theme } = useTheme();
  const router    = useRouter();

  const [stress,   setStress]   = useState<string>('medium');
  const [env,      setEnv]      = useState<string>('moderate');
  const [exercise, setExercise] = useState<string>('light');
  const [alcohol,  setAlcohol]  = useState<string>('none');
  const [saving,   setSaving]   = useState(false);

  async function handleSave() {
    setSaving(true);
    const input: LifestyleInput = {
      stress_level:       stress,
      sleep_environment:  env,
      exercise_frequency: exercise,
      alcohol_use:        alcohol,
    };
    const res = await updateLifestyle(input).catch(() => null);
    setSaving(false);
    if (res?.ok === false) {
      Alert.alert('Error', 'Could not save. Please try again.');
      return;
    }
    router.back();
  }

  return (
    <AmbientBackground style={{ flex: 1 }}>
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          <Text style={[s.backLabel, { color: theme.colors.text }]}>Profile</Text>
        </Pressable>
        <Text style={[s.title, { color: theme.colors.text }]}>Lifestyle</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <Text style={s.intro}>
          Help R-Lo understand your lifestyle so your sleep plan stays accurate.
        </Text>

        <View style={s.card}>
          <ChipGroup
            label="Stress level"
            value={stress}
            onChange={setStress}
            options={[
              { value: 'low',      label: 'Low'      },
              { value: 'medium',   label: 'Medium'   },
              { value: 'high',     label: 'High'     },
              { value: 'variable', label: 'Variable' },
            ]}
          />
          <View style={s.divider} />
          <ChipGroup
            label="Exercise frequency"
            value={exercise}
            onChange={setExercise}
            options={[
              { value: 'none',     label: 'None'     },
              { value: 'light',    label: 'Light'    },
              { value: 'moderate', label: 'Moderate' },
              { value: 'heavy',    label: 'Intense'  },
            ]}
          />
          <View style={s.divider} />
          <ChipGroup
            label="Alcohol use"
            value={alcohol}
            onChange={setAlcohol}
            options={[
              { value: 'none',       label: 'None'       },
              { value: 'occasional', label: 'Occasional' },
              { value: 'regular',    label: 'Regular'    },
            ]}
          />
          <View style={s.divider} />
          <ChipGroup
            label="Sleep environment"
            value={env}
            onChange={setEnv}
            options={[
              { value: 'poor',     label: 'Poor'     },
              { value: 'moderate', label: 'Moderate' },
              { value: 'good',     label: 'Good'     },
            ]}
          />
        </View>

        <Pressable
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={() => { HapticsLight(); void handleSave(); }}
          disabled={saving}
        >
          <Text style={s.saveTxt}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>
      </ScrollView>

    </SafeAreaView>
    </AmbientBackground>
  );
}

// ─── Chip styles ──────────────────────────────────────────────────────────────
const ls = StyleSheet.create({
  group:      { gap: 10 },
  groupLabel: { fontSize: 12, fontWeight: '700', color: TEXT_F, textTransform: 'uppercase', letterSpacing: 0.8 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: SURFACE2, borderWidth: 1, borderColor: BORDER },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipTxt:    { fontSize: 13, fontWeight: '600', color: TEXT_M },
  chipTxtActive: { color: '#FFFFFF' },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: 'transparent' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 },
  backLabel: { fontSize: 15, fontWeight: '500' },
  title:   { fontSize: 17, fontWeight: '700', textAlign: 'center', flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  intro:   { fontSize: 14, color: TEXT_M, lineHeight: 20 },
  card:    { backgroundColor: CARD, borderRadius: 20, padding: 20, gap: 18, borderWidth: 1, borderColor: BORDER },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER },
  saveBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
