/**
 * ProfileScreen — R90 Navigator V2
 *
 * Layout:
 *   1. Header — avatar initials + name
 *   2. Cycle Progress Widget — circular arc (pure RN, no SVG)
 *   3. Two main cards — Premium + Sleep History
 *   4. Secondary menu — 4 options
 *   5. Settings modal (bottom sheet inline)
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  Switch,
  Alert,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Chronotype, NightRecord, UserProfile } from '@r90/types';
import { usePremiumGate } from '../../lib/use-premium-gate';
import {
  loadProfile,
  saveProfile,
  loadWeekHistory,
  clearAllStorage,
  loadOnboardingData,
} from '../../lib/storage';
import { useTheme } from '../../lib/theme-context';
import type { ThemeMode } from '../../lib/theme';
import { useAuth } from '../../lib/auth-context';
import { ProfileSkeletonScreen } from '../SkeletonLoader';
import { GoogleCalendarConnect } from '../GoogleCalendarConnect';
import { HapticsLight } from '../../utils/haptics';
import {
  loadWindDownEnabled,
  saveWindDownEnabled,
  loadWindDownMusicEnabled,
  saveWindDownMusicEnabled,
} from '../../lib/wind-down';

// ── Constants ─────────────────────────────────────────────────────────────────

const C = {
  bg:        '#0B1220',
  card:      '#1A2436',
  surface2:  '#243046',
  accent:    '#F5A623',
  secondary: '#4DA3FF',
  success:   '#3DDC97',
  text:      '#E6EDF7',
  textSub:   '#9FB0C5',
  textMuted: '#6B7F99',
  error:     '#F87171',
  border:    'rgba(255,255,255,0.07)',
};

const APP_VERSION = '0.1.0';

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesToDate(m: number): Date {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

function formatMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ── Circular Progress (pure RN — no SVG) ─────────────────────────────────────
// Uses two rotating half-discs to draw an arc.
// progress: 0.0 → 1.0

const RING = 180;
const STROKE = 10;
const HALF = RING / 2;

function CircularProgress({ progress, done, total }: { progress: number; done: number; total: number }) {
  const clamp = Math.min(Math.max(progress, 0), 1);

  // Right half always shows accent when progress > 0
  // Left half shows accent only when progress > 0.5
  const rightDeg = clamp <= 0.5 ? clamp * 360 : 180;
  const leftDeg  = clamp > 0.5  ? (clamp - 0.5) * 360 : 0;

  return (
    <View style={cp.wrap}>
      {/* Background ring */}
      <View style={cp.bgRing} />

      {/* Right half progress */}
      <View style={[cp.halfBox, cp.rightBox]}>
        <View style={[cp.halfMask, { transform: [{ rotate: `${rightDeg}deg` }] }]}>
          <View style={cp.halfDisc} />
        </View>
      </View>

      {/* Left half progress — only visible when > 50% */}
      {clamp > 0.5 && (
        <View style={[cp.halfBox, cp.leftBox]}>
          <View style={[cp.halfMask, { transform: [{ rotate: `${leftDeg}deg` }] }]}>
            <View style={[cp.halfDisc, { left: 0 }]} />
          </View>
        </View>
      )}

      {/* Center content */}
      <View style={cp.center} pointerEvents="none">
        <Text style={cp.doneText}>{done}</Text>
        <Text style={cp.slashText}>/ {total}</Text>
        <Text style={cp.labelText}>cycles</Text>
      </View>
    </View>
  );
}

const cp = StyleSheet.create({
  wrap: {
    width:           RING,
    height:          RING,
    alignItems:      'center',
    justifyContent:  'center',
  },
  bgRing: {
    position:        'absolute',
    width:           RING,
    height:          RING,
    borderRadius:    HALF,
    borderWidth:     STROKE,
    borderColor:     C.surface2,
  },
  halfBox: {
    position:        'absolute',
    width:           HALF,
    height:          RING,
    overflow:        'hidden',
  },
  rightBox: { left: HALF },
  leftBox:  { left: 0 },
  halfMask: {
    width:           HALF,
    height:          RING,
    overflow:        'hidden',
    transformOrigin: 'left center',
  },
  halfDisc: {
    position:        'absolute',
    right:           0,
    width:           HALF,
    height:          RING,
    borderTopRightRadius:    HALF,
    borderBottomRightRadius: HALF,
    backgroundColor: C.accent,
  },
  center: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:            0,
  },
  doneText: {
    fontSize:   42,
    fontWeight: '900',
    color:      C.text,
    lineHeight: 48,
  },
  slashText: {
    fontSize:   18,
    fontWeight: '600',
    color:      C.textSub,
    marginTop:  2,
  },
  labelText: {
    fontSize:   12,
    fontWeight: '500',
    color:      C.textMuted,
    marginTop:  2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

// ── Settings Modal ────────────────────────────────────────────────────────────

interface SettingsModalProps {
  visible:         boolean;
  onClose:         () => void;
  profile:         UserProfile;
  themeMode:       ThemeMode;
  onThemeChange:   (m: ThemeMode) => void;
  onSave:          (updates: Partial<UserProfile>) => Promise<void>;
  onSignOut:       () => void;
  onReset:         () => void;
  windDownEnabled:      boolean;
  windDownMusicEnabled: boolean;
  onWindDownChange:      (v: boolean) => void;
  onWindDownMusicChange: (v: boolean) => void;
}

function SettingsModal({
  visible, onClose, profile, themeMode, onThemeChange,
  onSave, onSignOut, onReset, windDownEnabled, windDownMusicEnabled,
  onWindDownChange, onWindDownMusicChange,
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
          {/* Sleep settings */}
          <Text style={sm.section}>Sleep</Text>
          <View style={sm.group}>
            <Row
              icon="time-outline"
              label="Wake-up time (ARP)"
              value={formatMinutes(anchorMin)}
              onPress={() => setShowAnchorPicker(v => !v)}
            />
            {showAnchorPicker && (
              <DateTimePicker
                value={editAnchorDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => d && setEditAnchorDate(d)}
              />
            )}
            <Row
              icon="body-outline"
              label="Chronotype"
              value={CHRONOTYPE_LABEL[editChronotype]}
              onPress={() => setShowChronoExpand(v => !v)}
            />
            {showChronoExpand && (
              <View style={sm.expandBox}>
                {(['AMer', 'Neither', 'PMer'] as Chronotype[]).map(ct => (
                  <Pressable key={ct} style={sm.expandRow} onPress={() => setEditChronotype(ct)}>
                    <Text style={[sm.expandLabel, editChronotype === ct && { color: C.accent }]}>
                      {CHRONOTYPE_LABEL[ct]}
                    </Text>
                    {editChronotype === ct && <Ionicons name="checkmark" size={16} color={C.accent} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Wind-down */}
          <Text style={sm.section}>Wind-down</Text>
          <View style={sm.group}>
            <View style={sm.row}>
              <View style={sm.rowLeft}>
                <Ionicons name="moon-outline" size={18} color={C.textSub} />
                <Text style={sm.rowLabel}>Wind-down reminder</Text>
              </View>
              <Switch
                value={windDownEnabled}
                onValueChange={onWindDownChange}
                trackColor={{ false: C.surface2, true: C.accent }}
                thumbColor={C.text}
              />
            </View>
            <View style={sm.row}>
              <View style={sm.rowLeft}>
                <Ionicons name="musical-notes-outline" size={18} color={C.textSub} />
                <Text style={sm.rowLabel}>Wind-down music</Text>
              </View>
              <Switch
                value={windDownMusicEnabled}
                onValueChange={onWindDownMusicChange}
                trackColor={{ false: C.surface2, true: C.accent }}
                thumbColor={C.text}
              />
            </View>
          </View>

          {/* Appearance */}
          <Text style={sm.section}>Appearance</Text>
          <View style={sm.group}>
            <Row
              icon="contrast-outline"
              label="Theme"
              value={APPEARANCE_LABEL[themeMode]}
              onPress={() => setShowAppearanceExpand(v => !v)}
            />
            {showAppearanceExpand && (
              <View style={sm.expandBox}>
                {(['system', 'light', 'dark'] as ThemeMode[]).map(m => (
                  <Pressable key={m} style={sm.expandRow} onPress={() => onThemeChange(m)}>
                    <Text style={[sm.expandLabel, themeMode === m && { color: C.accent }]}>
                      {APPEARANCE_LABEL[m]}
                    </Text>
                    {themeMode === m && <Ionicons name="checkmark" size={16} color={C.accent} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Calendar */}
          <Text style={sm.section}>Calendar</Text>
          <View style={sm.group}>
            <GoogleCalendarConnect />
          </View>

          {/* Account */}
          <Text style={sm.section}>Account</Text>
          <View style={sm.group}>
            <Row icon="log-out-outline" label="Sign out" danger onPress={onSignOut} />
          </View>

          {/* Reset */}
          <Text style={sm.section}>Data</Text>
          <View style={sm.group}>
            <Row
              icon="refresh-outline"
              label="Reset & restart onboarding"
              danger
              onPress={onReset}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Save button */}
        <View style={sm.footer}>
          <Pressable
            style={[sm.saveBtn, { backgroundColor: C.accent }]}
            onPress={() => { void handleSave(); }}
            disabled={isSaving}
          >
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

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { session, logout } = useAuth();
  const router = useRouter();
  const { isPremium } = usePremiumGate();

  const [profile,     setProfile]     = useState<UserProfile | null>(null);
  const [weekHistory, setWeekHistory] = useState<NightRecord[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError,   setDataError]   = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [windDownEnabled,      setWindDownEnabled]      = useState(false);
  const [windDownMusicEnabled, setWindDownMusicEnabled] = useState(false);

  useEffect(() => { void loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setDataLoading(true);
    setDataError(null);
    try {
      const [p, history, onboarding, wd, wdm] = await Promise.all([
        loadProfile(),
        loadWeekHistory(),
        loadOnboardingData(),
        loadWindDownEnabled(),
        loadWindDownMusicEnabled(),
      ]);
      if (!p) { setDataError('Could not load your profile.'); return; }
      setProfile(p);
      setWeekHistory(history);
      setWindDownEnabled(wd);
      setWindDownMusicEnabled(wdm);

      const rawName = onboarding?.firstName ?? session?.user?.email ?? '';
      const firstWord = rawName.split(/[\s@]/)[0] ?? '';
      setDisplayName(firstWord || 'You');
    } catch {
      setDataError('Could not load your profile. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }

  async function handleSaveProfile(updates: Partial<UserProfile>) {
    if (!profile) return;
    const updated = { ...profile, ...updates };
    setProfile(updated);
    await saveProfile(updated);
  }

  async function handleSignOut() {
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
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await clearAllStorage();
            await logout();
            router.replace('/onboarding');
          },
        },
      ],
    );
  }

  async function handleWindDownChange(v: boolean) {
    setWindDownEnabled(v);
    await saveWindDownEnabled(v);
  }

  async function handleWindDownMusicChange(v: boolean) {
    setWindDownMusicEnabled(v);
    await saveWindDownMusicEnabled(v);
  }

  // ── Loading / error ──
  if (dataLoading) return <ProfileSkeletonScreen />;
  if (dataError || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.textSub, fontSize: 15, textAlign: 'center', paddingHorizontal: 32 }}>
          {dataError ?? 'Profile not available.'}
        </Text>
        <Pressable style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: C.accent, borderRadius: 12 }} onPress={() => { void loadData(); }}>
          <Text style={{ color: '#0B1220', fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Stats ──
  const weekCycles  = weekHistory.reduce((s, n) => s + n.cyclesCompleted, 0);
  const weekTarget  = profile.weeklyTarget ?? 35;
  const progress    = weekTarget > 0 ? weekCycles / weekTarget : 0;
  const remaining   = Math.max(weekTarget - weekCycles, 0);
  const avatarLetter = displayName.charAt(0).toUpperCase() || '?';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Settings button top-right ── */}
        <Pressable style={s.settingsBtn} onPress={() => setShowSettings(true)} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={C.textSub} />
        </Pressable>

        {/* ── 1. Header ── */}
        <View style={s.header}>
          <View style={[s.avatar, { backgroundColor: C.accent }]}>
            <Text style={s.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={s.userName}>{displayName}</Text>
        </View>

        {/* ── 2. Cycle progress widget ── */}
        <View style={s.widgetCard}>
          <Text style={s.widgetTitle}>This week</Text>
          <View style={s.widgetRing}>
            <CircularProgress progress={progress} done={weekCycles} total={weekTarget} />
          </View>
          <Text style={s.widgetSub}>
            {remaining === 0
              ? '🎉 Weekly goal reached!'
              : `${remaining} cycles remaining to reach your goal`}
          </Text>
        </View>

        {/* ── 3. Cards ── */}
        <View style={s.cards}>
          {/* Premium card */}
          <Pressable
            style={[s.card, isPremium && { borderColor: `${C.accent}40`, borderWidth: 1 }]}
            onPress={() => { HapticsLight(); router.push('/subscription'); }}
          >
            <View style={[s.cardIcon, { backgroundColor: `${C.accent}18` }]}>
              <Ionicons name={isPremium ? 'star' : 'star-outline'} size={22} color={C.accent} />
            </View>
            <Text style={s.cardTitle}>{isPremium ? 'Premium' : 'Upgrade'}</Text>
            <Text style={s.cardSub}>
              {isPremium ? 'Active ✓' : 'Advanced insights'}
            </Text>
          </Pressable>

          {/* Sleep History card */}
          <Pressable
            style={s.card}
            onPress={() => { HapticsLight(); router.push('/sleep-history'); }}
          >
            <View style={[s.cardIcon, { backgroundColor: `${C.secondary}18` }]}>
              <Ionicons name="bar-chart-outline" size={22} color={C.secondary} />
            </View>
            <Text style={s.cardTitle}>Sleep History</Text>
            <Text style={s.cardSub}>Data & trends</Text>
          </Pressable>
        </View>

        {/* ── 4. Secondary menu ── */}
        <View style={s.menu}>
          {[
            { icon: 'moon-outline',     label: 'Sleep History', onPress: () => router.push('/sleep-history') },
            { icon: 'book-outline',     label: 'Learning',      onPress: () => router.push('/learning') },
            { icon: 'settings-outline', label: 'Settings',      onPress: () => setShowSettings(true) },
            { icon: 'headset-outline',  label: 'Support',       onPress: () => { void Linking.openURL('mailto:support@r90navigator.com'); } },
          ].map(({ icon, label, onPress }, i, arr) => (
            <Pressable
              key={label}
              style={[
                s.menuRow,
                i === 0            && s.menuRowFirst,
                i === arr.length-1 && s.menuRowLast,
              ]}
              onPress={() => { HapticsLight(); onPress(); }}
            >
              <View style={s.menuRowLeft}>
                <Ionicons name={icon as any} size={18} color={C.textSub} />
                <Text style={s.menuRowLabel}>{label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
            </Pressable>
          ))}
        </View>

        {/* App version */}
        <Text style={s.version}>R90 Navigator v{APP_VERSION}</Text>

      </ScrollView>

      {/* Settings modal */}
      {showSettings && profile && (
        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          profile={profile}
          themeMode={themeMode}
          onThemeChange={m => { HapticsLight(); setThemeMode(m); }}
          onSave={handleSaveProfile}
          onSignOut={() => { setShowSettings(false); void handleSignOut(); }}
          onReset={() => { setShowSettings(false); handleReset(); }}
          windDownEnabled={windDownEnabled}
          windDownMusicEnabled={windDownMusicEnabled}
          onWindDownChange={v => { void handleWindDownChange(v); }}
          onWindDownMusicChange={v => { void handleWindDownMusicChange(v); }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 48 },

  // Settings button
  settingsBtn: {
    position: 'absolute', top: 20, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },

  // Header
  header: {
    alignItems:     'center',
    paddingTop:     40,
    paddingBottom:  28,
    gap:            12,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28, fontWeight: '700', color: '#0B1220',
  },
  userName: {
    fontSize: 22, fontWeight: '700', color: C.text,
  },

  // Widget
  widgetCard: {
    backgroundColor: C.card,
    borderRadius:    20,
    marginHorizontal: 16,
    padding:         24,
    alignItems:      'center',
    gap:             16,
    marginBottom:    16,
  },
  widgetTitle: {
    fontSize: 13, fontWeight: '600', color: C.textSub,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  widgetRing: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  widgetSub: {
    fontSize: 13, color: C.textSub, textAlign: 'center',
  },

  // Cards
  cards: {
    flexDirection:   'row',
    marginHorizontal: 16,
    gap:             12,
    marginBottom:    16,
  },
  card: {
    flex:          1,
    backgroundColor: C.card,
    borderRadius:  16,
    padding:       16,
    gap:           8,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15, fontWeight: '600', color: C.text,
  },
  cardSub: {
    fontSize: 12, color: C.textSub,
  },

  // Menu
  menu: {
    backgroundColor: C.card,
    borderRadius:    16,
    marginHorizontal: 16,
    overflow:        'hidden',
    marginBottom:    24,
  },
  menuRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
    paddingVertical:   15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  menuRowFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  menuRowLast:  { borderBottomWidth: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  menuRowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuRowLabel: { fontSize: 15, fontWeight: '500', color: C.text },

  version: {
    textAlign: 'center', fontSize: 12, color: C.textMuted, marginTop: 4,
  },
});
