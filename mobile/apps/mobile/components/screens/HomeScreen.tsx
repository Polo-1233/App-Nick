import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { HomeSkeletonScreen } from "../SkeletonLoader";
import { PostEventSheet } from "../PostEventSheet";
import { ConflictSheet } from "../ConflictSheet";
import { useDayPlanContext } from "../../lib/day-plan-context";
import { loadProfile } from "../../lib/storage";
import { useBackendHome } from "../../lib/use-backend-home";
import { actionRecommendation } from "../../lib/api";
import { getSuggestedAlarmTime, openAlarmApp, formatAlarmSuggestion } from "../../lib/alarm";
import { HapticsLight } from "../../utils/haptics";
import { usePremium } from "../../lib/use-premium";
import { useChatContext } from "../../lib/chat-context";
import { useTheme } from "../../lib/theme-context";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";
import { MascotImage } from "../ui/MascotImage";
import type { ReadinessZone, UserProfile } from "@r90/types";

// ─── Zone helpers ─────────────────────────────────────────────────────────────

const ZONE_COLOR: Record<ReadinessZone, string> = {
  green:  '#3DDC97',
  yellow: '#F5A623',
  orange: '#F97316',
};

const ZONE_LABEL: Record<ReadinessZone, string> = {
  green:  'Ready',
  yellow: 'Building',
  orange: 'Recovery',
};

const ZONE_BADGE: Record<ReadinessZone, 'success' | 'accent' | 'warning'> = {
  green:  'success',
  yellow: 'accent',
  orange: 'warning',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const {
    dayPlan,
    loading: localLoading,
    error: localError,
    needsOnboarding,
    refreshPlan,
    applyConflictOption,
  } = useDayPlanContext();

  const { payload: backendPayload, loading: backendLoading, refresh: refreshBackend } = useBackendHome();
  const { recordUsage } = usePremium();
  const { openChat }    = useChatContext();
  const router          = useRouter();

  const [showPostEvent, setShowPostEvent] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [profile,       setProfile]       = useState<UserProfile | null>(null);
  const hasMountedFocus = useRef(false);
  const hasRedirected   = useRef(false);

  // ── Backend recommendation action handler ──────────────────────────────────
  const handleRecommendationAction = useCallback(async (
    recId:  string,
    action: 'actioned' | 'dismissed',
  ) => {
    await actionRecommendation(recId, action);
    void refreshBackend();
  }, [refreshBackend]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const weeklyTotal  = backendPayload?.weekly_balance?.total  ?? dayPlan?.readiness.weeklyTotal  ?? 0;
  const weeklyTarget = backendPayload?.weekly_balance?.target ?? dayPlan?.readiness.weeklyTarget ?? 35;
  const primaryRec   = backendPayload?.primary_recommendation ?? null;
  const tonightOnset = backendPayload?.tonight_sleep_onset    ?? null;
  const fallbackOnset = backendPayload?.fallback_onset        ?? null;
  const action       = dayPlan?.nextAction;

  // ── Redirect if onboarding needed ─────────────────────────────────────────
  useEffect(() => {
    if (needsOnboarding && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace("/onboarding");
    }
  }, [needsOnboarding, router]);

  // ── Refresh on screen focus ────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedFocus.current) {
        hasMountedFocus.current = true;
        return;
      }
      refreshPlan();
      void refreshBackend();
    }, [refreshPlan, refreshBackend]),
  );

  // ── Load profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadProfile().then(setProfile);
  }, []);

  // ── Show conflict sheet when conflicts detected ────────────────────────────
  useEffect(() => {
    if (dayPlan && dayPlan.conflicts.length > 0) {
      setShowConflicts(true);
    }
  }, [dayPlan]);

  // ── Alarm handler ──────────────────────────────────────────────────────────
  const handleAlarmPress = useCallback(async () => {
    if (!profile || !dayPlan) return;
    void HapticsLight();
    const suggestion = getSuggestedAlarmTime(profile, dayPlan);
    const result     = await openAlarmApp(suggestion);
    if (!result.ok) {
      Alert.alert(
        'Wake-up alarm',
        result.reason ?? `Set your alarm for ${formatAlarmSuggestion(suggestion)} to protect your anchor time.`,
      );
    }
  }, [profile, dayPlan]);

  // ── Loading / error states ─────────────────────────────────────────────────
  const loading = localLoading && backendLoading;

  if (loading) return <HomeSkeletonScreen />;

  if ((localError || !dayPlan) && !backendPayload) {
    return (
      <View style={[st.root, st.errorContainer, { backgroundColor: c.background }]}>
        <Text style={[st.errorText, { color: c.textSub }]}>
          {localError ?? 'Could not load your sleep plan.'}
        </Text>
        <Pressable
          style={[st.retryBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => { refreshPlan(); void refreshBackend(); }}
        >
          <Text style={[st.retryBtnText, { color: c.text }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const isGateBlocked = backendPayload?.gate_blocked ?? false;
  const readinessZone = (isGateBlocked ? 'yellow' : (dayPlan?.readiness.zone ?? 'green')) as ReadinessZone;
  const zoneColor     = ZONE_COLOR[readinessZone];
  const zoneLabel     = ZONE_LABEL[readinessZone];
  const zoneBadge     = ZONE_BADGE[readinessZone];

  const avgCycles  = weeklyTotal > 0 ? (weeklyTotal / 7).toFixed(1) : '0.0';
  const now        = new Date();
  const hour       = now.getHours();
  const greeting   = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todayStr   = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const dayOfWeek  = now.getDay();
  const weekDayNum = dayOfWeek === 0 ? 7 : dayOfWeek;
  const onTrack    = weeklyTotal >= Math.floor((weeklyTarget / 7) * weekDayNum);

  const recText = primaryRec
    ? primaryRec.message_key.replace(/_/g, ' ')
    : action?.title ?? (
        tonightOnset
          ? `Tonight → ${tonightOnset}${fallbackOnset ? ` (or ${fallbackOnset})` : ''}`
          : 'Keep tracking to get personalized recommendations.'
      );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[st.root, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Section 1: Header ─────────────────────────────────────────── */}
        <View style={st.header}>
          <View style={st.headerLeft}>
            <Text style={[st.greeting, { color: c.text }]}>{greeting}</Text>
            <Text style={[st.date, { color: c.textSub }]}>{todayStr}</Text>
          </View>
          <Pressable
            style={[st.settingsBtn, { backgroundColor: c.surface }]}
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={20} color={c.textSub} />
          </Pressable>
        </View>

        {/* ── Section 2: Readiness Card ─────────────────────────────────── */}
        <Card variant="elevated" style={st.card}>
          <Badge label={zoneLabel} color={zoneBadge} />
          <Text style={[st.avgCycles, { color: zoneColor }]}>{avgCycles}</Text>
          <Text style={[st.avgLabel, { color: c.textSub }]}>avg cycles · last 3 nights</Text>
          <View style={st.progressWrap}>
            <ProgressBar value={parseFloat(avgCycles) / 5} color={zoneColor} height={6} />
          </View>
        </Card>

        {/* ── Section 3: This week ──────────────────────────────────────── */}
        <Text style={[st.sectionLabel, { color: c.textSub }]}>This week</Text>
        <Card style={st.card}>
          <View style={st.weekRow}>
            <Text style={[st.weekCycles, { color: c.text }]}>
              {weeklyTotal} / {weeklyTarget} cycles
            </Text>
            <Text style={[st.weekStatus, { color: onTrack ? c.success : c.warning }]}>
              {onTrack ? '● On track' : '● Behind'}
            </Text>
          </View>
          <View style={st.progressWrap}>
            <ProgressBar value={weeklyTotal / weeklyTarget} color={c.accent} height={6} />
          </View>
          <Text style={[st.weekLabel, { color: c.textMuted }]}>
            Day {weekDayNum} of 7
          </Text>
        </Card>

        {/* ── Section 4: Quick actions ──────────────────────────────────── */}
        <Text style={[st.sectionLabel, { color: c.textSub }]}>Quick actions</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.pillsContent}
          style={st.pillsScroll}
        >
          {[
            { label: '+ Log night',   onPress: () => router.push('/log-night') },
            { label: '✓ Check-in',    onPress: () => router.push('/checkin')   },
            { label: '🌙 Late event', onPress: () => setShowPostEvent(true)    },
            { label: '💤 Wind-down',  onPress: () => router.push('/wind-down') },
          ].map((pill) => (
            <Pressable
              key={pill.label}
              style={({ pressed }) => [
                st.pill,
                {
                  backgroundColor: c.surface2,
                  borderColor:     c.border,
                  opacity:         pressed ? 0.7 : 1,
                },
              ]}
              onPress={pill.onPress}
            >
              <Text style={[st.pillText, { color: c.text }]}>{pill.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Section 5: Recommendation ────────────────────────────────── */}
        <Text style={[st.sectionLabel, { color: c.textMuted }]}>Airloop recommends</Text>
        <Card variant="outlined" style={st.card}>
          <View style={st.recRow}>
            <MascotImage emotion="encourageant" size="sm" />
            <View style={st.recContent}>
              <Text style={[st.recText, { color: c.text }]}>{recText}</Text>
              {primaryRec && (
                <View style={st.recActions}>
                  <Pressable
                    style={[st.recBtn, { backgroundColor: c.success }]}
                    onPress={() => void handleRecommendationAction(primaryRec.id, 'actioned')}
                  >
                    <Text style={st.recBtnText}>Done</Text>
                  </Pressable>
                  <Pressable
                    style={[st.recBtn, { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }]}
                    onPress={() => void handleRecommendationAction(primaryRec.id, 'dismissed')}
                  >
                    <Text style={[st.recBtnText, { color: c.textSub }]}>Dismiss</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
          <View style={st.askRow}>
            <Button label="Ask Airloop" variant="ghost" size="sm" onPress={openChat} />
          </View>
        </Card>

        {/* ── Section 6: Shortcuts ──────────────────────────────────────── */}
        <View style={st.shortcutRow}>
          <Button
            label="View plan"
            variant="secondary"
            size="md"
            style={st.shortcutBtn}
            onPress={() => router.push('/log-night')}
          />
          <Button
            label="Full insights"
            variant="secondary"
            size="md"
            style={st.shortcutBtn}
            onPress={() => router.push('/checkin')}
          />
        </View>

      </ScrollView>

      {/* ── Sheets ────────────────────────────────────────────────────────── */}
      {profile && (
        <PostEventSheet
          visible={showPostEvent}
          profile={profile}
          onClose={() => setShowPostEvent(false)}
          onConfirm={(window) => {
            applyConflictOption(window);
            recordUsage("post_event");
            setShowPostEvent(false);
          }}
        />
      )}

      <ConflictSheet
        visible={showConflicts}
        conflicts={dayPlan?.conflicts ?? []}
        onClose={() => setShowConflicts(false)}
        onAcknowledge={() => setShowConflicts(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 0 },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   20,
  },
  headerLeft: { gap: 3 },
  greeting: {
    fontSize:   22,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  date:        { fontSize: 14 },
  settingsBtn: {
    width:          38,
    height:         38,
    borderRadius:   19,
    justifyContent: 'center',
    alignItems:     'center',
  },

  // Cards + labels
  card:         { marginBottom: 16 },
  sectionLabel: {
    fontSize:     15,
    fontFamily:   'Inter-SemiBold',
    fontWeight:   '600',
    marginBottom: 8,
  },

  // Readiness card
  avgCycles: {
    fontSize:   42,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
    marginTop:  8,
    lineHeight: 50,
  },
  avgLabel:    { fontSize: 13, marginBottom: 8 },
  progressWrap: { marginTop: 4 },

  // This week
  weekRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   8,
  },
  weekCycles: { fontSize: 20, fontFamily: 'Inter-SemiBold', fontWeight: '600' },
  weekStatus: { fontSize: 13, fontWeight: '500' },
  weekLabel:  { fontSize: 12, marginTop: 6 },

  // Quick action pills
  pillsScroll:  { marginBottom: 16 },
  pillsContent: { gap: 8, paddingRight: 4 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:      9999,
    borderWidth:       1,
  },
  pillText: { fontSize: 14, fontWeight: '500' },

  // Recommendation
  recRow:     { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  recContent: { flex: 1, gap: 8 },
  recText:    { fontSize: 15, lineHeight: 22 },
  recActions: { flexDirection: 'row', gap: 8 },
  recBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  recBtnText: { fontSize: 13, fontWeight: '600', color: '#000' },
  askRow:     { marginTop: 12, alignItems: 'flex-start' },

  // Shortcuts
  shortcutRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  shortcutBtn: { flex: 1 },

  // Error state
  errorContainer: { justifyContent: 'center', alignItems: 'center', gap: 20, padding: 32 },
  errorText:      { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  retryBtn:       { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  retryBtnText:   { fontSize: 15, fontWeight: '600' },
});
