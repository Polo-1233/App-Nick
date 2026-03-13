/**
 * Profile screen — R90 Navigator redesign.
 *
 * Layout (top → bottom):
 *   1. Identity — avatar (initials) · name/email · Free/Premium badge
 *   2. Readiness Zone — elevated card with zone badge, thresholds
 *   3. Stats Week — 2×2 grid (cycles / target / avg / best night)
 *   4. Calendar Sync — GoogleCalendarConnect + CalendarSelector + WriteBackCalendarPicker + CalendarSyncStatus
 *   5. Settings — ARP Time · Chronotype · Notifications · Theme · Premium · Sign out
 *   6. About — version · delete data
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Chronotype, NightRecord, UserProfile } from '@r90/types';
import { useDayPlanContext } from '../../lib/day-plan-context';
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
import { CalendarSelector } from '../CalendarSelector';
import { GoogleCalendarConnect } from '../GoogleCalendarConnect';
import { WriteBackCalendarPicker } from '../WriteBackCalendarPicker';
import { CalendarSyncStatus } from '../CalendarSyncStatus';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { HapticsLight } from '../../utils/haptics';
import {
  loadWindDownEnabled,
  saveWindDownEnabled,
  loadWindDownMusicEnabled,
  saveWindDownMusicEnabled,
  ensureNotificationsPermissionSoft,
  cancelWindDownNotification,
} from '../../lib/wind-down';

// ── Constants ─────────────────────────────────────────────────────────────────

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

const ZONE_CONFIG = {
  green:  { label: 'Ready',    color: '#3DDC97', icon: 'checkmark-circle-outline' as const },
  yellow: { label: 'Building', color: '#F5A623', icon: 'trending-up-outline' as const },
  orange: { label: 'Recovery', color: '#F87171', icon: 'moon-outline' as const },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesToDate(minutes: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

function formatMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { theme, mode: themeMode, setMode: setThemeMode, immersiveMode, setImmersiveMode } = useTheme();
  const { dayPlan, refreshPlan } = useDayPlanContext();
  const { session, logout } = useAuth();
  const router = useRouter();
  const { isPremium } = usePremiumGate();

  const [profile,     setProfile]     = useState<UserProfile | null>(null);
  const [weekHistory, setWeekHistory] = useState<NightRecord[]>([]);
  const [firstName,   setFirstName]   = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError,   setDataError]   = useState<string | null>(null);

  // Settings edit state
  const [editAnchorDate,       setEditAnchorDate]       = useState(new Date());
  const [editChronotype,       setEditChronotype]       = useState<Chronotype>('Neither');
  const [showAnchorPicker,     setShowAnchorPicker]     = useState(false);
  const [showChronoExpand,     setShowChronoExpand]     = useState(false);
  const [showAppearanceExpand, setShowAppearanceExpand] = useState(false);
  const [hasChanges,           setHasChanges]           = useState(false);
  const [isSaving,             setIsSaving]             = useState(false);
  const [windDownEnabled,      setWindDownEnabled]      = useState(false);
  const [windDownMusicEnabled, setWindDownMusicEnabled] = useState(false);

  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setDataLoading(true);
    setDataError(null);
    try {
      const [p, history, onboarding, windDownEn, windDownMusicEn] = await Promise.all([
        loadProfile(),
        loadWeekHistory(),
        loadOnboardingData(),
        loadWindDownEnabled(),
        loadWindDownMusicEnabled(),
      ]);
      if (p) {
        setProfile(p);
        setEditAnchorDate(minutesToDate(p.anchorTime));
        setEditChronotype(p.chronotype);
      }
      setWeekHistory(history);
      if (onboarding?.firstName) setFirstName(onboarding.firstName);
      setWindDownEnabled(windDownEn);
      setWindDownMusicEnabled(windDownMusicEn);
    } catch {
      setDataError('Could not load your profile. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }

  function onAnchorChange(date: Date) {
    setEditAnchorDate(date);
    if (!profile) return;
    const newMin = date.getHours() * 60 + date.getMinutes();
    setHasChanges(newMin !== profile.anchorTime || editChronotype !== profile.chronotype);
  }

  function onChronotypeChange(type: Chronotype) {
    setEditChronotype(type);
    setShowChronoExpand(false);
    if (!profile) return;
    const newMin = editAnchorDate.getHours() * 60 + editAnchorDate.getMinutes();
    setHasChanges(type !== profile.chronotype || newMin !== profile.anchorTime);
  }

  async function handleWindDownToggle(val: boolean) {
    if (val) {
      const status = await ensureNotificationsPermissionSoft();
      if (status !== 'granted') {
        Alert.alert(
          'Notifications required',
          'Enable notifications in your device Settings to use wind-down reminders.',
        );
        return;
      }
    } else {
      await cancelWindDownNotification();
    }
    await saveWindDownEnabled(val);
    setWindDownEnabled(val);
  }

  async function handleWindDownMusicToggle(val: boolean) {
    await saveWindDownMusicEnabled(val);
    setWindDownMusicEnabled(val);
  }

  async function handleSaveSettings() {
    if (!profile || !hasChanges) return;
    setIsSaving(true);
    try {
      const updated: UserProfile = {
        ...profile,
        anchorTime: editAnchorDate.getHours() * 60 + editAnchorDate.getMinutes(),
        chronotype: editChronotype,
      };
      await saveProfile(updated);
      setProfile(updated);
      setHasChanges(false);
      HapticsLight();
      refreshPlan();
    } catch {
      Alert.alert('Error', 'Could not save settings. Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteData() {
    Alert.alert(
      'Delete all data',
      'This will erase your profile, sleep history, and all records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await clearAllStorage();
            router.replace('/onboarding');
          },
        },
      ],
    );
  }

  if (dataLoading) return <ProfileSkeletonScreen />;

  if (dataError || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 32 }}>
        <Text style={{ color: theme.colors.textSub, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
          {dataError ?? 'Profile not available.'}
        </Text>
        <Pressable
          style={{ backgroundColor: theme.colors.surface, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}
          onPress={() => { void loadData(); }}
        >
          <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const c = theme.colors;

  const weeklyTotal  = dayPlan?.readiness.weeklyTotal
    ?? weekHistory.reduce((sum, n) => sum + n.cyclesCompleted, 0);
  const weeklyTarget = profile.weeklyTarget ?? 35;
  const zone         = dayPlan?.readiness.zone ?? 'green';
  const zoneStatus   = dayPlan?.zoneStatus ?? 'experimental';
  const zoneConfig   = ZONE_CONFIG[zone] ?? ZONE_CONFIG.yellow;

  const avgCycles = weekHistory.length > 0
    ? (weekHistory.reduce((sum, n) => sum + n.cyclesCompleted, 0) / weekHistory.length).toFixed(1)
    : '—';
  const bestNight = weekHistory.length > 0
    ? Math.max(...weekHistory.map(n => n.cyclesCompleted))
    : 0;

  const userEmail    = session?.user?.email ?? '';
  const avatarLetter = (firstName?.[0] ?? userEmail[0] ?? 'U').toUpperCase();
  const displayName  = firstName || userEmail || 'You';

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >

          {/* ── Section 1 — Identity ── */}
          <View style={s.identitySection}>
            <View style={[s.avatar, { backgroundColor: c.accent }]}>
              <Text style={s.avatarText}>{avatarLetter}</Text>
            </View>
            <View style={s.identityInfo}>
              <Text style={[s.identityName, { color: c.text }]}>{displayName}</Text>
              {userEmail && userEmail !== displayName ? (
                <Text style={[s.identityEmail, { color: c.textSub }]}>{userEmail}</Text>
              ) : null}
              <View style={{ marginTop: 6 }}>
                <Badge label="Free" color="muted" size="sm" />
              </View>
            </View>
          </View>

          {/* ── Premium Banner ── */}
          <Pressable
            onPress={() => router.push('/subscription')}
            style={[
              s.premiumBanner,
              isPremium
                ? { backgroundColor: `${c.accent}18`, borderColor: `${c.accent}40` }
                : { backgroundColor: `${c.accent}10`, borderColor: `${c.accent}30` },
            ]}
          >
            <View style={s.premiumBannerLeft}>
              <Ionicons
                name={isPremium ? 'star' : 'star-outline'}
                size={22}
                color={c.accent}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={[s.premiumBannerTitle, { color: c.text }]}>
                  {isPremium ? 'R90 Premium' : 'Upgrade to Premium'}
                </Text>
                <Text style={[s.premiumBannerSub, { color: c.textSub }]}>
                  {isPremium ? 'Active — thank you 🙌' : 'Unlock advanced insights & coaching'}
                </Text>
              </View>
            </View>
            {!isPremium && (
              <View style={[s.premiumBannerCta, { backgroundColor: c.accent }]}>
                <Text style={s.premiumBannerCtaText}>Upgrade</Text>
              </View>
            )}
          </Pressable>

          {/* ── Section 2 — Readiness Zone ── */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.textSub }]}>Readiness Zone</Text>
            <Card variant="elevated">
              <View style={s.zoneRow}>
                <Ionicons name={zoneConfig.icon} size={32} color={zoneConfig.color} />
                <Text style={[s.zoneLabel, { color: zoneConfig.color }]}>{zoneConfig.label}</Text>
              </View>
              <Text style={[s.zoneBase, { color: c.textMuted }]}>Based on your last 3 nights</Text>
              <Text style={[s.zoneThresholds, { color: c.textMuted }]}>
                {'≥4.5 cycles · Ready · ≥3.0 · Building · <3.0 · Recovery'}
              </Text>
              {zoneStatus === 'experimental' ? (
                <View style={[s.experimentalBadge, { backgroundColor: `${c.textMuted}18`, borderColor: `${c.textMuted}30` }]}>
                  <Text style={[s.experimentalText, { color: c.textMuted }]}>pending validation</Text>
                </View>
              ) : null}
            </Card>
          </View>

          {/* ── Section 3 — Stats Week ── */}
          <View style={s.statsGrid}>
            <StatCard label="This Week"   value={String(weeklyTotal)} />
            <StatCard label="Target"      value={String(weeklyTarget)} />
            <StatCard label="Avg / night" value={String(avgCycles)} />
            <StatCard label="Best Night"  value={bestNight > 0 ? String(bestNight) : '—'} />
          </View>

          {/* ── Section 4 — Calendar Sync ── */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.textSub }]}>Calendar Sync</Text>
            <Text style={[s.calHint, { color: c.textMuted }]}>
              Connect your calendar accounts and choose which calendars R90 reads.
            </Text>
            <Text style={[s.subLabel, { color: c.textFaint }]}>ACCOUNTS</Text>
            <GoogleCalendarConnect onConnectionChange={refreshPlan} />
            <Text style={[s.subLabel, { color: c.textFaint, marginTop: 16 }]}>DEVICE CALENDARS</Text>
            <CalendarSelector onSelectionChange={refreshPlan} />
            <Text style={[s.subLabel, { color: c.textFaint, marginTop: 16 }]}>WRITE SLEEP BLOCKS TO</Text>
            <WriteBackCalendarPicker />
            <CalendarSyncStatus />
          </View>

          {/* ── Section 5 — Settings ── */}
          <View style={s.section}>
            {/* ARP Time */}
            <SettingsRow
              iconName="time-outline"
              label="ARP Time"
              value={formatMinutes(editAnchorDate.getHours() * 60 + editAnchorDate.getMinutes())}
              onPress={() => setShowAnchorPicker(v => !v)}
              expanded={showAnchorPicker}
            />
            {showAnchorPicker ? (
              <View style={s.pickerWrap}>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={editAnchorDate}
                    mode="time"
                    display="spinner"
                    onChange={(_, d) => { if (d) onAnchorChange(d); }}
                    style={s.picker}
                  />
                ) : (
                  <DateTimePicker
                    value={editAnchorDate}
                    mode="time"
                    display="default"
                    onChange={(_, d) => {
                      setShowAnchorPicker(false);
                      if (d) onAnchorChange(d);
                    }}
                  />
                )}
              </View>
            ) : null}

            {/* Chronotype */}
            <SettingsRow
              iconName="sunny-outline"
              label="Chronotype"
              value={CHRONOTYPE_LABEL[editChronotype]}
              onPress={() => setShowChronoExpand(v => !v)}
              expanded={showChronoExpand}
            />
            {showChronoExpand ? (
              <View style={s.expandRow}>
                {(['AMer', 'Neither', 'PMer'] as const).map(type => {
                  const sel = editChronotype === type;
                  return (
                    <Pressable
                      key={type}
                      style={[
                        s.expandBtn,
                        { backgroundColor: sel ? `${c.accent}20` : c.surface, borderColor: sel ? c.accent : c.border },
                      ]}
                      onPress={() => onChronotypeChange(type)}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? c.accent : c.textMuted }}>
                        {CHRONOTYPE_LABEL[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Notifications */}
            <SettingsRowSwitch
              iconName="notifications-outline"
              label="Notifications"
              value={windDownEnabled}
              onValueChange={(val) => { void handleWindDownToggle(val); }}
            />
            <SettingsRowSwitch
              iconName="musical-notes-outline"
              label="Wind-down Music"
              value={windDownMusicEnabled}
              onValueChange={(val) => { void handleWindDownMusicToggle(val); }}
            />

            {/* Theme */}
            <SettingsRow
              iconName="contrast-outline"
              label="Theme"
              value={APPEARANCE_LABEL[themeMode]}
              onPress={() => setShowAppearanceExpand(v => !v)}
              expanded={showAppearanceExpand}
            />
            {showAppearanceExpand ? (
              <View style={s.expandRow}>
                {(['system', 'light', 'dark'] as const).map(m => {
                  const sel = themeMode === m;
                  return (
                    <Pressable
                      key={m}
                      style={[
                        s.expandBtn,
                        { backgroundColor: sel ? `${c.accent}20` : c.surface, borderColor: sel ? c.accent : c.border },
                      ]}
                      onPress={() => {
                        void setThemeMode(m);
                        setShowAppearanceExpand(false);
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: sel ? c.accent : c.textMuted }}>
                        {APPEARANCE_LABEL[m]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Immersive Mode — Android only */}
            {Platform.OS === 'android' ? (
              <SettingsRowSwitch
                iconName="scan-outline"
                label="Immersive Mode"
                value={immersiveMode}
                onValueChange={(val) => { void setImmersiveMode(val); }}
              />
            ) : null}

            {/* Premium */}
            <SettingsRow
              iconName="star-outline"
              label="Premium"
              onPress={() => router.push('/subscription')}
            />

            {/* Sign out */}
            <SettingsRow
              iconName="log-out-outline"
              label="Sign out"
              danger
              onPress={() => {
                Alert.alert('Sign out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: () => { void logout(); } },
                ]);
              }}
            />

            {/* Save changes */}
            {hasChanges ? (
              <Pressable
                style={[s.saveBtn, { backgroundColor: c.accent }, isSaving && { opacity: 0.6 }]}
                onPress={() => { void handleSaveSettings(); }}
                disabled={isSaving}
              >
                <Text style={[s.saveBtnText, { color: c.background }]}>
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* ── About ── */}
          <View style={[s.section, { marginBottom: 60 }]}>
            <View style={[s.aboutRow, { borderBottomColor: c.borderSub }]}>
              <Text style={{ fontSize: 14, color: c.textMuted }}>Version</Text>
              <Text style={{ fontSize: 14, color: c.textMuted }}>{APP_VERSION}</Text>
            </View>
            <Pressable
              style={[s.deleteBtn, { backgroundColor: `${c.error}10`, borderColor: `${c.error}30` }]}
              onPress={handleDeleteData}
            >
              <Text style={{ color: c.error, fontSize: 14, fontWeight: '600' }}>Delete all my data</Text>
            </Pressable>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[s.statCard, { backgroundColor: c.surface }]}>
      <Text style={[s.statValue, { color: c.accent }]}>{value}</Text>
      <Text style={[s.statLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

// ── SettingsRow ───────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface RowProps {
  iconName:  IoniconsName;
  label:     string;
  value?:    string;
  onPress?:  () => void;
  expanded?: boolean;
  danger?:   boolean;
}

function SettingsRow({ iconName, label, value, onPress, expanded, danger }: RowProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      style={({ pressed }) => [s.settingsRow, { borderBottomColor: c.borderSub }, pressed && { opacity: 0.6 }]}
      onPress={onPress}
      hitSlop={4}
    >
      <View style={s.iconWrap}>
        <Ionicons name={iconName} size={20} color={danger ? c.error : c.textMuted} />
      </View>
      <Text style={[s.rowLabel, { color: danger ? c.error : c.text }]}>{label}</Text>
      <View style={s.rowRight}>
        {value ? <Text style={[s.rowValue, { color: c.textMuted }]}>{value}</Text> : null}
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={expanded ? c.textMuted : c.textFaint}
        />
      </View>
    </Pressable>
  );
}

// ── SettingsRowSwitch ──────────────────────────────────────────────────────────

interface SwitchRowProps {
  iconName:      IoniconsName;
  label:         string;
  value:         boolean;
  onValueChange: (v: boolean) => void;
}

function SettingsRowSwitch({ iconName, label, value, onValueChange }: SwitchRowProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[s.settingsRow, { borderBottomColor: c.borderSub }]}>
      <View style={s.iconWrap}>
        <Ionicons name={iconName} size={20} color={c.textMuted} />
      </View>
      <Text style={[s.rowLabel, { color: c.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     20,
  },

  // ── Identity ──
  identitySection: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
    marginBottom:  28,
  },
  avatar: {
    width:          64,
    height:         64,
    borderRadius:   32,
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize:   28,
    fontWeight: '700',
    color:      '#0B1220',
  },
  identityInfo: {
    flex: 1,
    gap:  2,
  },
  identityName: {
    fontSize:   18,
    fontWeight: '600',
  },
  identityEmail: {
    fontSize:   13,
    fontWeight: '400',
  },

  // ── Premium banner ──
  premiumBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    borderWidth:    1,
    borderRadius:   16,
    padding:        16,
    marginBottom:   20,
  },
  premiumBannerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          1,
  },
  premiumBannerTitle: {
    fontSize:   15,
    fontWeight: '600',
  },
  premiumBannerSub: {
    fontSize:  12,
    marginTop: 2,
  },
  premiumBannerCta: {
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:    7,
    marginLeft:        12,
  },
  premiumBannerCtaText: {
    fontSize:   13,
    fontWeight: '700',
    color:      '#0B1220',
  },

  // ── Section ──
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize:     15,
    fontWeight:   '600',
    marginBottom: 12,
  },

  // ── Readiness ──
  zoneRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  8,
  },
  zoneLabel: {
    fontSize:   24,
    fontWeight: '700',
  },
  zoneBase: {
    fontSize:     12,
    marginBottom: 8,
  },
  zoneThresholds: {
    fontSize:   11,
    lineHeight: 16,
  },
  experimentalBadge: {
    alignSelf:         'flex-end',
    marginTop:          8,
    paddingHorizontal:  8,
    paddingVertical:    3,
    borderRadius:      10,
    borderWidth:        1,
  },
  experimentalText: {
    fontSize:   10,
    fontWeight: '500',
  },

  // ── Stats Grid ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           12,
    marginBottom:  28,
  },
  statCard: {
    width:        '47%',
    borderRadius: 16,
    padding:      16,
    gap:           4,
  },
  statValue: {
    fontSize:   24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },

  // ── Calendar ──
  calHint: {
    fontSize:     13,
    lineHeight:   20,
    marginBottom: 12,
  },
  subLabel: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.5,
    marginBottom:  4,
    marginTop:     4,
  },

  // ── Settings rows ──
  settingsRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   15,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width:          34,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    4,
  },
  rowLabel: {
    flex:       1,
    fontSize:   15,
    fontWeight: '500',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  rowValue: {
    fontSize: 14,
  },

  // ── Expand pickers ──
  expandRow: {
    flexDirection: 'row',
    gap:           8,
    paddingTop:    10,
    paddingBottom: 16,
  },
  expandBtn: {
    flex:            1,
    paddingVertical: 12,
    borderRadius:    10,
    borderWidth:     1,
    alignItems:      'center',
  },

  // ── Time picker ──
  pickerWrap: {
    marginBottom: 4,
  },
  picker: {
    backgroundColor: '#111111',
    borderRadius:    12,
  },

  // ── Save button ──
  saveBtn: {
    padding:      14,
    borderRadius: 10,
    marginTop:    20,
    alignItems:   'center',
  },
  saveBtnText: {
    fontSize:   15,
    fontWeight: '700',
  },

  // ── About ──
  aboutRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingVertical:   12,
    borderBottomWidth: 1,
    marginBottom:      16,
  },
  deleteBtn: {
    padding:      14,
    borderRadius: 10,
    alignItems:   'center',
    borderWidth:  1,
  },
});
