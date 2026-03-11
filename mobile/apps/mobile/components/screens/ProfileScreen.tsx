/**
 * Profile screen — R90 premium redesign.
 *
 * Layout (top → bottom):
 *   1. Header — first name + chronotype · wake-time meta
 *   2. WeeklyCycleRing — animated, tappable → BottomSheetStats
 *   3. Horizontal row — PerformanceCard | SubscriptionCard
 *   4. Airloop coaching card
 *   5. Settings list — chevron rows with expandable pickers
 *   6. Support / Privacy rows
 *   7. About + delete-data section
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
import {
  loadProfile,
  saveProfile,
  loadWeekHistory,
  clearAllStorage,
  loadOnboardingData,
} from '../../lib/storage';
import { useTheme } from '../../lib/theme-context';
import type { ThemeMode } from '../../lib/theme';
import { ProfileSkeletonScreen } from '../SkeletonLoader';
import { CalendarSelector } from '../CalendarSelector';
import { GoogleCalendarConnect } from '../GoogleCalendarConnect';
import { WriteBackCalendarPicker } from '../WriteBackCalendarPicker';
import { CalendarSyncStatus } from '../CalendarSyncStatus';
import { WeeklyCycleRing }   from '../WeeklyCycleRing';
import { BottomSheetStats }  from '../BottomSheetStats';
import { PerformanceCard }   from '../PerformanceCard';
import { SubscriptionCard }  from '../SubscriptionCard';
import { DEFAULT_SUBSCRIPTION } from '../../lib/subscription';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesToDate(minutes: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

function formatMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function computeStreak(history: NightRecord[], ideal: number): number {
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const n of sorted) {
    if (n.cyclesCompleted >= ideal) streak++;
    else break;
  }
  return streak;
}

function weekSummaryMessage(weeklyTotal: number, weeklyTarget: number): string {
  const remaining = weeklyTarget - weeklyTotal;
  if (remaining <= 0) return 'Strong week — you\'ve hit your cycle target.';
  if (remaining <= 4) return `${remaining} more cycles and you\'ll have a strong week.`;
  return `${remaining} cycles left this week. Keep your anchor time consistent.`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { theme, mode: themeMode, setMode: setThemeMode, immersiveMode, setImmersiveMode } = useTheme();
  const { dayPlan, refreshPlan } = useDayPlanContext();
  const router = useRouter();

  const [profile,     setProfile]     = useState<UserProfile | null>(null);
  const [weekHistory, setWeekHistory] = useState<NightRecord[]>([]);
  const [firstName,   setFirstName]   = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError,   setDataError]   = useState<string | null>(null);

  // Bottom sheet
  const [showStats, setShowStats] = useState(false);

  // Settings edit state
  const [editAnchorDate,      setEditAnchorDate]      = useState(new Date());
  const [editChronotype,      setEditChronotype]      = useState<Chronotype>('Neither');
  const [showAnchorPicker,    setShowAnchorPicker]    = useState(false);
  const [showChronoExpand,    setShowChronoExpand]    = useState(false);
  const [showAppearanceExpand,setShowAppearanceExpand]= useState(false);
  const [hasChanges,          setHasChanges]          = useState(false);
  const [isSaving,            setIsSaving]            = useState(false);
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
      <View style={[s.rootWrapper, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 32 }]}>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
          {dataError ?? 'Profile not available.'}
        </Text>
        <Pressable
          style={{ backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' }}
          onPress={() => { void loadData(); }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const weeklyTotal    = dayPlan?.readiness.weeklyTotal
    ?? weekHistory.reduce((s, n) => s + n.cyclesCompleted, 0);
  const weeklyTarget   = profile.weeklyTarget ?? 35;
  const zone           = dayPlan?.readiness.zone ?? 'green';
  const streak         = computeStreak(weekHistory, profile.idealCyclesPerNight);
  const zoneStatus     = dayPlan?.zoneStatus ?? 'experimental';

  const c = theme.colors;

  return (
    <View style={[s.rootWrapper, { backgroundColor: c.background }]}>
      <SafeAreaView style={[s.container, { backgroundColor: c.background }]} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {/* ── Header ── */}
          <View style={s.header}>
            <Text style={[s.title, { color: c.text }]}>{firstName || 'You'}</Text>
            <View style={s.metaRow}>
              <Text style={[s.metaText, { color: c.textMuted }]}>{CHRONOTYPE_LABEL[profile.chronotype]}</Text>
              <Text style={[s.metaDivider, { color: c.border }]}>·</Text>
              <Text style={[s.metaText, { color: c.textMuted }]}>Wake {formatMinutes(profile.anchorTime)}</Text>
            </View>
          </View>

          {/* ── Weekly ring ── */}
          <View style={s.ringWrap}>
            <WeeklyCycleRing
              current={weeklyTotal}
              target={weeklyTarget}
              zone={zone}
              streak={streak}
              onPress={() => setShowStats(true)}
            />
            {zoneStatus === 'experimental' && (
              <View style={s.experimentalBadge}>
                <Text style={s.experimentalText}>Readiness zones: pending validation</Text>
              </View>
            )}
          </View>

          {/* ── Performance + Subscription cards ── */}
          <View style={s.cardsRow}>
            <PerformanceCard
              weekHistory={weekHistory}
              idealCyclesPerNight={profile.idealCyclesPerNight}
            />
            <SubscriptionCard
              subscription={DEFAULT_SUBSCRIPTION}
              onPress={() => router.push('/subscription')}
            />
          </View>

          {/* ── Airloop coaching message ── */}
          <View style={[s.airloopCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={s.airloopLabel}>AIRLOOP</Text>
            <Text style={[s.airloopText, { color: c.text }]}>
              {weekSummaryMessage(weeklyTotal, weeklyTarget)}
            </Text>
          </View>

          {/* ── Settings ── */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: c.textFaint }]}>SETTINGS</Text>

            <SettingsRowSwitch
              iconName="moon-outline"
              label="Wind-down reminders"
              value={windDownEnabled}
              onValueChange={(val) => { void handleWindDownToggle(val); }}
            />
            <SettingsRowSwitch
              iconName="musical-notes-outline"
              label="Wind-down music"
              value={windDownMusicEnabled}
              onValueChange={(val) => { void handleWindDownMusicToggle(val); }}
            />

            {/* Anchor Time */}
            <SettingsRow
              iconName="time-outline"
              label="Anchor Time"
              value={formatMinutes(
                editAnchorDate.getHours() * 60 + editAnchorDate.getMinutes(),
              )}
              onPress={() => setShowAnchorPicker(v => !v)}
              expanded={showAnchorPicker}
            />
            {showAnchorPicker && (
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
            )}

            {/* Chronotype */}
            <SettingsRow
              iconName="sunny-outline"
              label="Chronotype"
              value={CHRONOTYPE_LABEL[editChronotype]}
              onPress={() => setShowChronoExpand(v => !v)}
              expanded={showChronoExpand}
            />
            {showChronoExpand && (
              <View style={s.expandRow}>
                {(['AMer', 'Neither', 'PMer'] as const).map(type => {
                  const selected = editChronotype === type;
                  return (
                    <Pressable
                      key={type}
                      style={[
                        s.expandBtn,
                        { backgroundColor: c.surface, borderColor: c.border },
                        selected && s.expandBtnSelected,
                      ]}
                      onPress={() => onChronotypeChange(type)}
                    >
                      <Text style={[
                        s.expandBtnText,
                        { color: c.textMuted },
                        selected && s.expandBtnTextSelected,
                      ]}>
                        {CHRONOTYPE_LABEL[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Appearance */}
            <SettingsRow
              iconName="contrast-outline"
              label="Appearance"
              value={APPEARANCE_LABEL[themeMode]}
              onPress={() => setShowAppearanceExpand(v => !v)}
              expanded={showAppearanceExpand}
            />
            {showAppearanceExpand && (
              <View style={s.expandRow}>
                {(['system', 'light', 'dark'] as const).map(m => {
                  const selected = themeMode === m;
                  return (
                    <Pressable
                      key={m}
                      style={[
                        s.expandBtn,
                        { backgroundColor: c.surface, borderColor: c.border },
                        selected && s.expandBtnSelected,
                      ]}
                      onPress={() => {
                        void setThemeMode(m);
                        setShowAppearanceExpand(false);
                      }}
                    >
                      <Text style={[
                        s.expandBtnText,
                        { color: c.textMuted },
                        selected && s.expandBtnTextSelected,
                      ]}>
                        {APPEARANCE_LABEL[m]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Immersive Mode — Android only */}
            {Platform.OS === 'android' && (
              <SettingsRowSwitch
                iconName="scan-outline"
                label="Immersive Mode"
                value={immersiveMode}
                onValueChange={(val) => { void setImmersiveMode(val); }}
              />
            )}

            <SettingsRow
              iconName="download-outline"
              label="Export Data"
              onPress={() => Alert.alert('Export', 'Data export coming soon.')}
            />
          </View>

          {/* ── Calendars ── */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: c.textFaint }]}>CALENDARS</Text>
            <Text style={[s.calendarHint, { color: c.textMuted }]}>
              Connect your calendar accounts and choose which calendars R90 Navigator reads.
            </Text>

            {/* Connected accounts */}
            <Text style={[s.calendarSubLabel, { color: c.textFaint }]}>ACCOUNTS</Text>
            <GoogleCalendarConnect onConnectionChange={refreshPlan} />

            {/* Device calendars */}
            <Text style={[s.calendarSubLabel, { color: c.textFaint, marginTop: 16 }]}>DEVICE CALENDARS</Text>
            <CalendarSelector onSelectionChange={refreshPlan} />

            {/* Write-back target */}
            <Text style={[s.calendarSubLabel, { color: c.textFaint, marginTop: 16 }]}>WRITE SLEEP BLOCKS TO</Text>
            <WriteBackCalendarPicker />

            {/* Sync status */}
            <CalendarSyncStatus />

            {hasChanges && (
              <Pressable
                style={[s.saveBtn, isSaving && s.saveBtnDisabled]}
                onPress={handleSaveSettings}
                disabled={isSaving}
              >
                <Text style={s.saveBtnText}>
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* ── Support / Legal ── */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: c.textFaint }]}>SUPPORT</Text>
            <SettingsRow
              iconName="help-circle-outline"
              label="Help & Feedback"
              onPress={() => Alert.alert('Support', 'support@r90app.com')}
            />
            <SettingsRow
              iconName="lock-closed-outline"
              label="Privacy Policy"
              onPress={() =>
                Alert.alert('Privacy', 'Full policy available at r90app.com/privacy.')
              }
            />
          </View>

          {/* ── About ── */}
          <View style={[s.section, { marginTop: 8, marginBottom: 60 }]}>
            <View style={[s.aboutRow, { borderBottomColor: c.borderSub }]}>
              <Text style={[s.aboutLabel, { color: c.textMuted }]}>Version</Text>
              <Text style={[s.aboutValue, { color: c.textMuted }]}>{APP_VERSION}</Text>
            </View>
            <Pressable style={s.deleteBtn} onPress={handleDeleteData}>
              <Text style={s.deleteBtnText}>Delete all my data</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ── Bottom sheet stats ── */}
      <BottomSheetStats
        visible={showStats}
        weekHistory={weekHistory}
        weeklyTotal={weeklyTotal}
        weeklyTarget={weeklyTarget}
        zone={zone}
        idealCyclesPerNight={profile.idealCyclesPerNight}
        onClose={() => setShowStats(false)}
      />
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
}

function SettingsRow({ iconName, label, value, onPress, expanded }: RowProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      style={({ pressed }) => [
        s.settingsRow,
        { borderBottomColor: c.borderSub },
        pressed && s.settingsRowPressed,
      ]}
      onPress={onPress}
      hitSlop={4}
    >
      <View style={s.settingsIconWrap}>
        <Ionicons name={iconName} size={20} color={c.textMuted} />
      </View>

      <Text style={[s.settingsLabel, { color: c.text }]}>{label}</Text>

      <View style={s.settingsRight}>
        {value ? <Text style={[s.settingsValue, { color: c.textMuted }]}>{value}</Text> : null}
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
      <View style={s.settingsIconWrap}>
        <Ionicons name={iconName} size={20} color={c.textMuted} />
      </View>
      <Text style={[s.settingsLabel, { color: c.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: '#22C55E' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    // backgroundColor injected from theme
  },
  container: {
    flex: 1,
    // backgroundColor injected from theme
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop:        8,
    paddingBottom:     20,
  },

  // ── Header ──
  header: {
    marginBottom: 28,
    marginTop:    4,
  },
  title: {
    fontSize:      34,
    fontWeight:    '700',
    letterSpacing: -0.5,
    marginBottom:  6,
    // color injected from theme
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  metaText:    { fontSize: 13, fontWeight: '500' },
  metaDivider: { fontSize: 13 },

  // ── Ring ──
  ringWrap: {
    alignItems:   'center',
    marginBottom: 28,
  },
  experimentalBadge: {
    marginTop:       10,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:    20,
    backgroundColor: 'rgba(234,179,8,0.12)',
    borderWidth:     1,
    borderColor:     'rgba(234,179,8,0.30)',
  },
  experimentalText: {
    color:         '#EAB308',
    fontSize:      11,
    fontWeight:    '500',
    letterSpacing: 0.2,
  },

  // ── Cards row ──
  cardsRow: {
    flexDirection: 'row',
    gap:           12,
    marginBottom:  12,
  },

  // ── Airloop card ──
  airloopCard: {
    borderRadius: 18,
    padding:      20,
    marginBottom: 36,
    borderWidth:  1,
    // backgroundColor, borderColor injected from theme
  },
  airloopLabel: {
    color:         '#60A5FA',  // Airloop brand blue — constant
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  10,
  },
  airloopText: {
    fontSize:   15,
    lineHeight: 23,
    // color injected from theme
  },

  // ── Section ──
  section: {
    marginBottom: 36,
  },
  sectionLabel: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  4,
    // color injected from theme
  },

  // ── Settings rows ──
  settingsRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   15,
    borderBottomWidth: 1,
    // borderBottomColor injected from theme
  },
  settingsRowPressed: {
    opacity: 0.6,
  },
  settingsIconWrap: {
    width:          34,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    4,
  },
  settingsLabel: {
    flex:       1,
    fontSize:   15,
    fontWeight: '500',
    // color injected from theme
  },
  settingsRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  settingsValue: {
    fontSize: 14,
    // color injected from theme
  },

  // ── Expand (Chronotype / Appearance) ──
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
    // backgroundColor, borderColor injected from theme
  },
  expandBtnSelected: {
    backgroundColor: '#052E16',
    borderColor:     '#22C55E',
  },
  expandBtnText: {
    fontSize:   13,
    fontWeight: '600',
    // color injected from theme
  },
  expandBtnTextSelected: {
    color: '#22C55E',
  },

  // ── Picker ──
  pickerWrap: {
    marginBottom: 4,
  },
  picker: {
    backgroundColor: '#111111',
    borderRadius:    12,
  },

  // ── Calendar hint ──
  calendarHint: {
    fontSize:     13,
    lineHeight:   20,
    marginBottom: 12,
  },
  calendarSubLabel: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.5,
    marginBottom:  4,
    marginTop:     4,
  },

  // ── Save button ──
  saveBtn: {
    backgroundColor: '#22C55E',
    padding:         14,
    borderRadius:    10,
    marginTop:       20,
    alignItems:      'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#1A3A1A',
  },
  saveBtnText: {
    color:      '#000000',
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
    // borderBottomColor injected from theme
  },
  aboutLabel: {
    fontSize: 14,
    // color injected from theme
  },
  aboutValue: {
    fontSize: 14,
    // color injected from theme
  },
  deleteBtn: {
    backgroundColor: '#0A0000',
    padding:         14,
    borderRadius:    10,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     '#2A0000',
  },
  deleteBtnText: {
    color:      '#EF4444',
    fontSize:   14,
    fontWeight: '600',
  },
});
