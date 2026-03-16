/**
 * ProfileScreen — R90 Navigator
 *
 * Purpose: account management and subscription only.
 * Sleep data → Insights screen.
 *
 * Sections:
 *   1. User identity (avatar + name)
 *   2. Premium card
 *   3. Account menu (History / Settings / Support)
 *   4. Settings modal (bottom sheet)
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  Switch,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Chronotype, UserProfile } from '@r90/types';
import { usePremiumGate } from '../../lib/use-premium-gate';
import {
  loadProfile,
  saveProfile,
  loadOnboardingData,
  clearAllStorage,
} from '../../lib/storage';
import { useTheme } from '../../lib/theme-context';
import type { ThemeMode } from '../../lib/theme';
import { useAuth } from '../../lib/auth-context';
import { HapticsLight } from '../../utils/haptics';
import {
  loadWindDownEnabled,
  saveWindDownEnabled,
  loadWindDownMusicEnabled,
  saveWindDownMusicEnabled,
} from '../../lib/wind-down';
import { GoogleCalendarConnect } from '../GoogleCalendarConnect';

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg:        '#0B1220',
  card:      '#1A2436',
  surface2:  '#243046',
  accent:          '#4DA3FF',
  accentSecondary: '#4DA3FF',
  text:      '#E6EDF7',
  textSub:   '#9FB0C5',
  textMuted: '#6B7F99',
  error:     '#F87171',
  success:   '#3DDC97',
  border:    'rgba(255,255,255,0.07)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesToDate(m: number): Date {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}
function formatMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const CHRONOTYPE_LABEL: Record<Chronotype, string> = {
  AMer:    'Morning',
  Neither: 'Flexible',
  PMer:    'Evening',
};
const APPEARANCE_LABEL: Record<ThemeMode, string> = {
  system: 'System',
  light:  'Light',
  dark:   'Dark',
};

// ─── Data Security Modal ──────────────────────────────────────────────────────
function DataSecurityModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const BULLETS = [
    'Encrypted recovery data',
    'Private sleep insights',
    'Secure account protection',
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={dm.backdrop} onPress={onClose} />
      <View style={dm.sheet}>
        <View style={dm.handle} />

        <View style={dm.iconWrap}>
          <Ionicons name="shield-checkmark" size={36} color={C.accentSecondary} />
        </View>

        <Text style={dm.title}>Your data is secure</Text>

        <Text style={dm.body}>
          Your sleep and recovery data are encrypted and stored securely.
          R-Lo never sells or shares your personal data.
        </Text>

        <View style={dm.bullets}>
          {BULLETS.map(b => (
            <View key={b} style={dm.bulletRow}>
              <Ionicons name="checkmark-circle" size={16} color={C.success} />
              <Text style={dm.bulletText}>{b}</Text>
            </View>
          ))}
        </View>

        <Pressable style={dm.closeBtn} onPress={onClose}>
          <Text style={dm.closeBtnText}>Got it</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
const dm = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 24 },
  iconWrap:    { width: 64, height: 64, borderRadius: 32, backgroundColor: `${C.accentSecondary}15`, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title:       { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 12 },
  body:        { fontSize: 15, color: C.textSub, lineHeight: 24, textAlign: 'center', marginBottom: 24 },
  bullets:     { gap: 12, marginBottom: 32 },
  bulletRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletText:  { fontSize: 15, color: C.text, fontWeight: '500' },
  closeBtn:    { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  closeBtnText:{ fontSize: 16, fontWeight: '700', color: '#000' },
});

// ─── Settings Modal ───────────────────────────────────────────────────────────

interface SettingsModalProps {
  visible:               boolean;
  onClose:               () => void;
  profile:               UserProfile;
  themeMode:             ThemeMode;
  onThemeChange:         (m: ThemeMode) => void;
  onSave:                (u: Partial<UserProfile>) => Promise<void>;
  onSignOut:             () => void;
  onReset:               () => void;
  windDownEnabled:       boolean;
  windDownMusicEnabled:  boolean;
  onWindDownChange:      (v: boolean) => void;
  onWindDownMusicChange: (v: boolean) => void;
}

function SettingsModal({
  visible, onClose, profile, themeMode, onThemeChange,
  onSave, onSignOut, onReset,
  windDownEnabled, windDownMusicEnabled, onWindDownChange, onWindDownMusicChange,
}: SettingsModalProps) {
  const [editAnchorDate,       setEditAnchorDate]       = useState(() => minutesToDate(profile.anchorTime ?? 390));
  const [editChronotype,       setEditChronotype]       = useState<Chronotype>(profile.chronotype ?? 'Neither');
  const [showAnchorPicker,     setShowAnchorPicker]     = useState(false);
  const [showChronoExpand,     setShowChronoExpand]     = useState(false);
  const [showAppearanceExpand, setShowAppearanceExpand] = useState(false);
  const [isSaving,             setIsSaving]             = useState(false);

  const anchorMin = editAnchorDate.getHours() * 60 + editAnchorDate.getMinutes();

  async function handleSave() {
    setIsSaving(true);
    await onSave({ anchorTime: anchorMin, chronotype: editChronotype });
    setIsSaving(false);
    onClose();
  }

  const Row = ({ icon, label, value, onPress, danger }: {
    icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean;
  }) => (
    <Pressable style={sm.row} onPress={onPress}>
      <View style={sm.rowLeft}>
        <Ionicons name={icon as any} size={18} color={danger ? C.error : C.textSub} />
        <Text style={[sm.rowLabel, danger && { color: C.error }]}>{label}</Text>
      </View>
      {value ? <Text style={sm.rowValue}>{value}</Text> : null}
      {onPress && !danger && <Ionicons name="chevron-forward" size={14} color={C.textMuted} />}
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={sm.root}>
        <View style={sm.header}>
          <Text style={sm.title}>Settings</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={C.textSub} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={sm.section}>Sleep</Text>
          <View style={sm.group}>
            <Row icon="time-outline" label="Wake-up time (ARP)" value={formatMinutes(anchorMin)} onPress={() => setShowAnchorPicker(v => !v)} />
            {showAnchorPicker && (
              <DateTimePicker
                value={editAnchorDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => d && setEditAnchorDate(d)}
              />
            )}
            <Row icon="body-outline" label="Chronotype" value={CHRONOTYPE_LABEL[editChronotype]} onPress={() => setShowChronoExpand(v => !v)} />
            {showChronoExpand && (
              <View style={sm.expandBox}>
                {(['AMer', 'Neither', 'PMer'] as Chronotype[]).map(ct => (
                  <Pressable key={ct} style={sm.expandRow} onPress={() => setEditChronotype(ct)}>
                    <Text style={[sm.expandLabel, editChronotype === ct && { color: C.accent }]}>{CHRONOTYPE_LABEL[ct]}</Text>
                    {editChronotype === ct && <Ionicons name="checkmark" size={16} color={C.accent} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <Text style={sm.section}>Wind-down</Text>
          <View style={sm.group}>
            <View style={sm.row}>
              <View style={sm.rowLeft}>
                <Ionicons name="moon-outline" size={18} color={C.textSub} />
                <Text style={sm.rowLabel}>Wind-down reminder</Text>
              </View>
              <Switch value={windDownEnabled} onValueChange={onWindDownChange} trackColor={{ false: C.surface2, true: C.accent }} thumbColor={C.text} />
            </View>
            <View style={sm.row}>
              <View style={sm.rowLeft}>
                <Ionicons name="musical-notes-outline" size={18} color={C.textSub} />
                <Text style={sm.rowLabel}>Wind-down music</Text>
              </View>
              <Switch value={windDownMusicEnabled} onValueChange={onWindDownMusicChange} trackColor={{ false: C.surface2, true: C.accent }} thumbColor={C.text} />
            </View>
          </View>

          <Text style={sm.section}>Appearance</Text>
          <View style={sm.group}>
            <Row icon="contrast-outline" label="Theme" value={APPEARANCE_LABEL[themeMode]} onPress={() => setShowAppearanceExpand(v => !v)} />
            {showAppearanceExpand && (
              <View style={sm.expandBox}>
                {(['system', 'light', 'dark'] as ThemeMode[]).map(m => (
                  <Pressable key={m} style={sm.expandRow} onPress={() => onThemeChange(m)}>
                    <Text style={[sm.expandLabel, themeMode === m && { color: C.accent }]}>{APPEARANCE_LABEL[m]}</Text>
                    {themeMode === m && <Ionicons name="checkmark" size={16} color={C.accent} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <Text style={sm.section}>Calendar</Text>
          <View style={sm.group}>
            <GoogleCalendarConnect />
          </View>

          <Text style={sm.section}>Account</Text>
          <View style={sm.group}>
            <Row icon="log-out-outline" label="Sign out" danger onPress={onSignOut} />
          </View>

          <Text style={sm.section}>Data</Text>
          <View style={sm.group}>
            <Row icon="refresh-outline" label="Reset & restart onboarding" danger onPress={onReset} />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={sm.footer}>
          <Pressable style={[sm.saveBtn, { backgroundColor: C.accent }]} onPress={() => { void handleSave(); }} disabled={isSaving}>
            <Text style={sm.saveBtnText}>{isSaving ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const sm = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24 },
  title:       { fontSize: 20, fontWeight: '700', color: C.text },
  section:     { fontSize: 11, fontWeight: '600', color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 20, marginTop: 20, marginBottom: 6 },
  group:       { backgroundColor: C.card, borderRadius: 14, marginHorizontal: 16, overflow: 'hidden' },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  rowLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowLabel:    { fontSize: 15, color: C.text, fontWeight: '500' },
  rowValue:    { fontSize: 14, color: C.textSub, marginRight: 6 },
  expandBox:   { backgroundColor: C.surface2, paddingHorizontal: 16 },
  expandRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  expandLabel: { fontSize: 14, color: C.textSub },
  footer:      { padding: 16, paddingBottom: 28 },
  saveBtn:     { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#0B1220' },
});

// ─── Premium Card ─────────────────────────────────────────────────────────────

const PREMIUM_FEATURES = [
  'Personalized sleep planning',
  'Advanced recovery insights',
  'Priority AI coaching',
];

function PremiumCard({ isPremium, onPress }: { isPremium: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[pc.card, isPremium && { borderColor: `${C.accent}50`, borderWidth: 1 }]}
      onPress={onPress}
    >
      {/* Header row */}
      <View style={pc.topRow}>
        <View style={pc.iconWrap}>
          <Ionicons name={isPremium ? 'star' : 'star-outline'} size={22} color={C.accent} />
        </View>
        <View style={pc.titleWrap}>
          <Text style={pc.title}>R-Lo Premium</Text>
          <Text style={pc.sub}>
            {isPremium ? 'Active — full access' : 'Unlock full recovery coaching'}
          </Text>
        </View>
        {isPremium && <Ionicons name="checkmark-circle" size={22} color={C.success} />}
      </View>

      {/* Feature list */}
      {!isPremium && (
        <>
          <View style={pc.divider} />
          {PREMIUM_FEATURES.map(f => (
            <View key={f} style={pc.featureRow}>
              <View style={[pc.featureDot, { backgroundColor: C.accent }]} />
              <Text style={pc.featureText}>{f}</Text>
            </View>
          ))}
          <View style={pc.btn}>
            <Text style={pc.btnText}>Upgrade</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const pc = StyleSheet.create({
  card:       { backgroundColor: C.card, borderRadius: 20, padding: 20, marginHorizontal: 16, gap: 0 },
  topRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  iconWrap:   { width: 44, height: 44, borderRadius: 12, backgroundColor: `${C.accent}18`, alignItems: 'center', justifyContent: 'center' },
  titleWrap:  { flex: 1 },
  title:      { fontSize: 17, fontWeight: '700', color: C.text },
  sub:        { fontSize: 13, color: C.textSub, marginTop: 2 },
  divider:    { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  featureDot: { width: 6, height: 6, borderRadius: 3 },
  featureText:{ fontSize: 14, color: C.textSub },
  btn:        { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  btnText:    { fontSize: 15, fontWeight: '700', color: '#0B1220' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { session, logout } = useAuth();
  const router = useRouter();
  const { isPremium } = usePremiumGate();

  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [displayName,  setDisplayName]  = useState('');
  const [showSettings,  setShowSettings]  = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [windDownEnabled,      setWindDownEnabled]      = useState(false);
  const [windDownMusicEnabled, setWindDownMusicEnabled] = useState(false);

  useEffect(() => { void loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const [p, onboarding, wd, wdm] = await Promise.all([
      loadProfile(), loadOnboardingData(), loadWindDownEnabled(), loadWindDownMusicEnabled(),
    ]);
    if (p) setProfile(p);
    setWindDownEnabled(wd);
    setWindDownMusicEnabled(wdm);
    const rawName  = onboarding?.firstName ?? session?.user?.email ?? '';
    const firstWord = rawName.split(/[\s@]/)[0] ?? '';
    setDisplayName(firstWord || 'You');
  }

  async function handleSaveProfile(updates: Partial<UserProfile>) {
    if (!profile) return;
    const updated = { ...profile, ...updates };
    setProfile(updated);
    await saveProfile(updated);
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void logout(); } },
    ]);
  }

  function handleReset() {
    Alert.alert(
      'Reset everything?',
      'This will delete all your sleep data and restart the onboarding. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          await clearAllStorage();
          await logout();
          router.replace('/onboarding');
        }},
      ],
    );
  }

  const avatarLetter = displayName.charAt(0).toUpperCase() || '?';

  const MENU_ITEMS = [
    {
      icon:    'time-outline',
      label:   'History',
      sub:     'Past sleep events and logs',
      onPress: () => router.push('/sleep-history'),
    },
    {
      icon:    'watch-outline',
      label:   'Wearables & Health',
      sub:     'Apple Health, Oura Ring and more',
      onPress: () => router.push('/wearables'),
    },
    {
      icon:    'fitness-outline',
      label:   'Lifestyle profile',
      sub:     'Stress, environment, exercise, alcohol',
      onPress: () => router.push('/lifestyle'),
    },
    {
      icon:    'calendar-outline',
      label:   'Life events',
      sub:     'Travel, illness, important days',
      onPress: () => router.push('/life-events'),
    },
    {
      icon:    'settings-outline',
      label:   'Settings',
      sub:     'Notifications, calendar, account',
      onPress: () => setShowSettings(true),
    },
    {
      icon:    'person-circle-outline',
      label:   'Account management',
      sub:     'Manage your account and subscription',
      onPress: () => router.push('/account'),
    },
    {
      icon:    'shield-checkmark-outline',
      label:   'Your data is secure',
      sub:     'Your recovery data is encrypted and private.',
      onPress: () => setShowDataModal(true),
    },
    {
      icon:    'headset-outline',
      label:   'Support',
      sub:     'Help and resources',
      onPress: () => router.push('/support'),
    },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── 1. Identity ── */}
        <View style={s.identity}>
          <View style={[s.avatar, { backgroundColor: C.accent }]}>
            <Text style={s.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={s.name}>{displayName}</Text>
          <Text style={s.nameSub}>R90 rhythm active</Text>
        </View>

        {/* ── 2. Premium card ── */}
        <PremiumCard
          isPremium={isPremium}
          onPress={() => { HapticsLight(); router.push(isPremium ? '/premium' : '/subscription'); }}
        />

        {/* ── 3. Account menu ── */}
        <View style={s.menu}>
          {MENU_ITEMS.map(({ icon, label, sub, onPress }, i) => (
            <Pressable
              key={label}
              style={({ pressed }) => [
                s.menuRow,
                i === 0 && s.menuFirst,
                i === MENU_ITEMS.length - 1 && s.menuLast,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => { HapticsLight(); onPress(); }}
            >
              <View style={[s.menuIcon, { backgroundColor: `${C.accent}18` }]}>
                <Ionicons name={icon as any} size={18} color={C.accent} />
              </View>
              <View style={s.menuText}>
                <Text style={s.menuLabel}>{label}</Text>
                <Text style={s.menuSub}>{sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={s.version}>R-Lo · Sleep Coach v0.1.0</Text>
      </ScrollView>

      <DataSecurityModal
        visible={showDataModal}
        onClose={() => setShowDataModal(false)}
      />

      {showSettings && (
        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          profile={profile ?? { anchorTime: 390, chronotype: 'Neither' as const, idealCyclesPerNight: 5, weeklyTarget: 35 }}
          themeMode={themeMode}
          onThemeChange={m => { HapticsLight(); setThemeMode(m); }}
          onSave={handleSaveProfile}
          onSignOut={() => { setShowSettings(false); handleSignOut(); }}
          onReset={() => { setShowSettings(false); handleReset(); }}
          windDownEnabled={windDownEnabled}
          windDownMusicEnabled={windDownMusicEnabled}
          onWindDownChange={v => { setWindDownEnabled(v); void saveWindDownEnabled(v); }}
          onWindDownMusicChange={v => { setWindDownMusicEnabled(v); void saveWindDownMusicEnabled(v); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 48 },

  // Identity
  identity: { alignItems: 'center', paddingTop: 40, paddingBottom: 32, gap: 8 },
  avatar:   { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#0B1220' },
  name:     { fontSize: 22, fontWeight: '700', color: C.text },
  nameSub:  { fontSize: 13, color: C.textMuted },

  // Menu
  menu:      { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, marginTop: 16, overflow: 'hidden' },
  menuRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  menuFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  menuLast:  { borderBottomWidth: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  menuIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuText:  { flex: 1, gap: 2 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  menuSub:   { fontSize: 12, color: C.textMuted },

  version: { textAlign: 'center', fontSize: 12, color: C.textMuted, marginTop: 24 },
});
