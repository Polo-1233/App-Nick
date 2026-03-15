/**
 * permissions.tsx — Sequential permission flow (Calendar → Notifications)
 *
 * Shown once after login/register, before entering Home.
 * Never shows both at the same time.
 * Stores result in AsyncStorage so flow is never repeated.
 *
 * Flow:
 *   1. Calendar pre-prompt → native request (or skip)
 *   2. Notification pre-prompt → native request (or skip)
 *   3. router.replace('/(tabs)')
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { useRouter }     from 'expo-router';
import { Ionicons }      from '@expo/vector-icons';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import * as Calendar     from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import { MascotImage }   from '../components/ui/MascotImage';
import { PERMISSION_KEYS, setOnboardingPhase } from '../lib/storage';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0B1220',
  card:    '#1A2436',
  surface2:'#243046',
  accent:  '#4DA3FF',
  success: '#3DDC97',
  text:    '#E6EDF7',
  sub:     '#9FB0C5',
  muted:   '#6B7F99',
  border:  'rgba(255,255,255,0.08)',
};

type Step = 'calendar' | 'notifications' | 'done';

interface PermissionConfig {
  step:        Step;
  emotion:     'encourageant' | 'rassurante';
  rloMessage:  string;
  icon:        string;
  iconColor:   string;
  title:       string;
  description: string;
  allowLabel:  string;
  skipLabel:   string;
}

const STEPS: PermissionConfig[] = [
  {
    step:        'calendar',
    emotion:     'encourageant',
    rloMessage:  'Let me see your schedule so I can protect your sleep.',
    icon:        'calendar-outline',
    iconColor:   C.accent,
    title:       'Connect your calendar',
    description: 'R-Lo can analyze your daily schedule to anticipate late events, early mornings, and help you maintain your ideal sleep rhythm.',
    allowLabel:  'Allow calendar access',
    skipLabel:   'Skip for now',
  },
  {
    step:        'notifications',
    emotion:     'rassurante',
    rloMessage:  "I'll remind you when it's time to sleep.",
    icon:        'notifications-outline',
    iconColor:   C.success,
    title:       'Stay on rhythm',
    description: 'Enable notifications so R-Lo can remind you when to go to bed and help maintain your recovery rhythm.',
    allowLabel:  'Enable notifications',
    skipLabel:   'Skip for now',
  },
];

// ─── Permission helpers ───────────────────────────────────────────────────────
async function requestCalendarPermission(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return status === 'granted';
  } catch { return false; }
}

// ─── Single permission card ───────────────────────────────────────────────────
function PermissionCard({
  config,
  onAllow,
  onSkip,
  loading,
}: {
  config:   PermissionConfig;
  onAllow:  () => void;
  onSkip:   () => void;
  loading:  boolean;
}) {
  // Fade-in on mount
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <Animated.View style={[pc.wrap, { opacity: fade }]}>
      {/* R-Lo message bubble */}
      <View style={pc.bubbleRow}>
        <MascotImage emotion={config.emotion} style={{ width: 44, height: 44, flexShrink: 0 }} />
        <View style={pc.bubble}>
          <Text style={pc.bubbleText}>{config.rloMessage}</Text>
        </View>
      </View>

      {/* Permission card */}
      <View style={pc.card}>
        {/* Icon */}
        <View style={[pc.iconCircle, { backgroundColor: `${config.iconColor}15`, borderColor: `${config.iconColor}30` }]}>
          <Ionicons name={config.icon as any} size={32} color={config.iconColor} />
        </View>

        {/* Text */}
        <Text style={pc.title}>{config.title}</Text>
        <Text style={pc.description}>{config.description}</Text>

        {/* Divider */}
        <View style={pc.divider} />

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [pc.allowBtn, { backgroundColor: config.iconColor }, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
          onPress={onAllow}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0B1220" />
            : <>
                <Ionicons name={config.icon as any} size={18} color="#0B1220" />
                <Text style={pc.allowTxt}>{config.allowLabel}</Text>
              </>
          }
        </Pressable>

        <Pressable
          style={({ pressed }) => [pc.skipBtn, pressed && { opacity: 0.6 }]}
          onPress={onSkip}
          disabled={loading}
        >
          <Text style={pc.skipTxt}>{config.skipLabel}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const pc = StyleSheet.create({
  wrap:        { flex: 1, justifyContent: 'center', paddingHorizontal: 20, gap: 20 },
  bubbleRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bubble:      { flex: 1, backgroundColor: C.card, borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 14, paddingHorizontal: 16 },
  bubbleText:  { fontSize: 16, color: C.text, lineHeight: 24, fontWeight: '500' },
  card:        { backgroundColor: C.card, borderRadius: 24, padding: 28, alignItems: 'center', gap: 12 },
  iconCircle:  { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:       { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center', lineHeight: 30 },
  description: { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 24 },
  divider:     { height: 1, backgroundColor: C.border, width: '100%', marginVertical: 6 },
  allowBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, justifyContent: 'center', marginTop: 4 },
  allowTxt:    { fontSize: 16, fontWeight: '800', color: '#0B1220' },
  skipBtn:     { paddingVertical: 12, paddingHorizontal: 20 },
  skipTxt:     { fontSize: 14, color: C.muted, textAlign: 'center' },
});

// ─── Progress dots ────────────────────────────────────────────────────────────
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={pd.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[pd.dot, i === current && pd.dotActive]} />
      ))}
    </View>
  );
}
const pd = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.surface2 },
  dotActive:{ width: 18, backgroundColor: C.accent },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PermissionsScreen() {
  const router              = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const config = STEPS[stepIdx];

  async function markAndAdvance(key: string, granted: boolean) {
    await AsyncStorage.setItem(key, granted ? 'granted' : 'skipped');
    const isLast = stepIdx >= STEPS.length - 1;
    if (isLast) {
      await AsyncStorage.setItem(PERMISSION_KEYS.PROMPT_SHOWN, 'true');
      // Ensure onboarding phase is cleared so no calendar overlay blocks home
      await setOnboardingPhase('done');
      router.replace('/(tabs)');
    } else {
      setStepIdx(i => i + 1);
    }
  }

  async function handleAllow() {
    if (!config) return;
    setLoading(true);
    try {
      if (config.step === 'calendar') {
        const ok = await requestCalendarPermission();
        await markAndAdvance(PERMISSION_KEYS.CALENDAR, ok);
      } else {
        const ok = await requestNotificationPermission();
        await markAndAdvance(PERMISSION_KEYS.NOTIFICATIONS, ok);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    if (!config) return;
    const key = config.step === 'calendar'
      ? PERMISSION_KEYS.CALENDAR
      : PERMISSION_KEYS.NOTIFICATIONS;
    await markAndAdvance(key, false);
  }

  if (!config) return null;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <ProgressDots current={stepIdx} total={STEPS.length} />
      </View>

      {/* Card */}
      <PermissionCard
        config={config}
        onAllow={handleAllow}
        onSkip={handleSkip}
        loading={loading}
      />

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerTxt}>
          {config.step === 'calendar'
            ? 'Your calendar data stays on your device and is never shared.'
            : 'You can manage notification settings anytime in your phone settings.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  header:    { paddingTop: 16, paddingBottom: 8, alignItems: 'center' },
  footer:    { paddingHorizontal: 28, paddingBottom: 20, alignItems: 'center' },
  footerTxt: { fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 18 },
});
