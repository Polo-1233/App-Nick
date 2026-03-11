import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Image, TextInput, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
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
import { formatTime } from "../../lib/mock-data";
import type { ReadinessZone, UserProfile } from "@r90/types";

const ZONE_PILL: Record<ReadinessZone, { label: string; color: string }> = {
  green:  { label: "Ready",    color: "#22C55E" },
  yellow: { label: "Building", color: "#EAB308" },
  orange: { label: "Recovery", color: "#F97316" },
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const { dayPlan, loading: localLoading, error: localError, needsOnboarding, refreshPlan, applyConflictOption } =
    useDayPlanContext();
  const { payload: backendPayload, loading: backendLoading, refresh: refreshBackend } = useBackendHome();
  const { recordUsage } = usePremium();
  const { openChat } = useChatContext();
  const router = useRouter();
  const [showPostEvent, setShowPostEvent] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inputText, setInputText] = useState("");
  const hasMountedFocus = useRef(false);
  const hasRedirected = useRef(false);

  // Backend payload: primary recommendation action handler
  const handleRecommendationAction = useCallback(async (
    recId: string,
    action: 'actioned' | 'dismissed'
  ) => {
    await actionRecommendation(recId, action);
    void refreshBackend();
  }, [refreshBackend]);

  // Prefer backend payload for sleep onset display; fall back to local engine
  const tonightOnset  = backendPayload?.tonight_sleep_onset ?? null;
  const fallbackOnset = backendPayload?.fallback_onset ?? null;
  const weeklyTotal   = backendPayload?.weekly_balance?.total  ?? dayPlan?.readiness.weeklyTotal ?? 0;
  const weeklyTarget  = backendPayload?.weekly_balance?.target ?? dayPlan?.readiness.weeklyTarget ?? 35;
  const primaryRec    = backendPayload?.primary_recommendation ?? null;

  // Redirect to onboarding if profile is missing or invalid
  useEffect(() => {
    if (needsOnboarding && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace("/onboarding");
    }
  }, [needsOnboarding, router]);

  // Refresh both local + backend when screen regains focus
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedFocus.current) {
        hasMountedFocus.current = true;
        return;
      }
      refreshPlan();
      void refreshBackend();
    }, [refreshPlan, refreshBackend])
  );

  // Load profile for post-event sheet
  useEffect(() => {
    loadProfile().then(setProfile);
  }, []);

  // Show conflict sheet when conflicts detected
  useEffect(() => {
    if (dayPlan && dayPlan.conflicts.length > 0) {
      setShowConflicts(true);
    }
  }, [dayPlan]);

  const handleAlarmPress = useCallback(async () => {
    if (!profile || !dayPlan) return;
    void HapticsLight();
    const suggestion = getSuggestedAlarmTime(profile, dayPlan);
    const result = await openAlarmApp(suggestion);
    if (!result.ok) {
      Alert.alert(
        'Wake-up alarm',
        result.reason ?? `Set your alarm for ${formatAlarmSuggestion(suggestion)} to protect your anchor time.`,
      );
    }
  }, [profile, dayPlan]);

  const loading = localLoading && backendLoading;

  if (loading) {
    return <HomeSkeletonScreen />;
  }

  if ((localError || !dayPlan) && !backendPayload) {
    return (
      <View style={[styles.root, styles.errorContainer]}>
        <Text style={styles.errorText}>
          {localError ?? 'Could not load your sleep plan.'}
        </Text>
        <Pressable style={styles.retryBtn} onPress={() => { refreshPlan(); void refreshBackend(); }}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const action = dayPlan?.nextAction;
  // Readiness zone: prefer backend gate state, fall back to local
  const isGateBlocked = backendPayload?.gate_blocked ?? false;
  const readinessZone = isGateBlocked ? 'yellow' : (dayPlan?.readiness.zone ?? 'green') as ReadinessZone;
  const pill = ZONE_PILL[readinessZone];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>

      {/* ── Layer 1: Full-screen background image ────────────────────────── */}
      <Image
        source={require("../../assets/images/fire-camp.png")}
        style={styles.bgImage}
        resizeMode="cover"
      />

      {/* ── Layer 2: Gradient overlay for text readability ───────────────── */}
      <LinearGradient
        colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.70)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Layer 3: UI content — top/left/right safe area only (no bottom) ─ */}
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Today</Text>
            <Text style={styles.t7Label}>
              {weeklyTotal}/{weeklyTarget} cycles this week
            </Text>
          </View>

          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: pill.color }]} />
            <Text style={styles.statusText}>{pill.label}</Text>
          </View>
        </View>

        {/* ── Center fill — background shows through ── */}
        <View style={styles.centerFill} />

        {/* ── Bottom section ── */}
        <View style={styles.bottomSection}>

          {/* Next Action glass card — prefers backend primary recommendation */}
          <Pressable
            style={styles.actionCard}
            onPress={() => {
              if (primaryRec) {
                void handleRecommendationAction(primaryRec.id, 'actioned');
              }
              router.push("/log-night");
            }}
            accessibilityRole="button"
            accessibilityLabel={`Next action: ${primaryRec?.message_key ?? action?.title ?? 'Log sleep'}`}
          >
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>NEXT ACTION</Text>
              <Text style={styles.actionTitle}>
                {primaryRec ? primaryRec.message_key.replace(/_/g, ' ') : (action?.title ?? 'Log last night')}
              </Text>
              {!primaryRec && action?.scheduledAt != null && (
                <Text style={styles.actionSubtitle}>
                  · {formatTime(action.scheduledAt)}
                </Text>
              )}
              {tonightOnset && (
                <Text style={styles.actionSubtitle}>
                  Tonight → {tonightOnset}{fallbackOnset ? ` (or ${fallbackOnset})` : ''}
                </Text>
              )}
            </View>

            <View style={styles.actionBtn}>
              <Text style={styles.actionBtnIcon}>›</Text>
            </View>
          </Pressable>

          {/* Alarm + Late event pills row */}
          {profile && (
            <View style={styles.pillRow}>
              <Pressable
                style={({ pressed }) => [styles.alarmPill, styles.pillFlex, pressed && styles.alarmPillPressed]}
                onPress={() => { void handleAlarmPress(); }}
                accessibilityRole="button"
                accessibilityLabel="Set wake-up alarm"
              >
                <Text style={styles.alarmPillText}>
                  {'⏰  ' + formatAlarmSuggestion(getSuggestedAlarmTime(profile, dayPlan))}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.alarmPill, styles.pillFlex, pressed && styles.alarmPillPressed]}
                onPress={() => setShowPostEvent(true)}
                accessibilityRole="button"
                accessibilityLabel="Late event protocol"
              >
                <Text style={styles.alarmPillText}>🌙  Late event</Text>
              </Pressable>
            </View>
          )}

          {/* Ask Airloop input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask Airloop..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={inputText}
              onChangeText={setInputText}
              returnKeyType="send"
            />
            <Pressable
              style={styles.sendBtn}
              onPress={() => { openChat(); setInputText(""); }}
              accessibilityRole="button"
              accessibilityLabel="Send message to Airloop"
            >
              <Text style={styles.sendIcon}>↑</Text>
            </Pressable>
          </View>

        </View>

        {/* Backend recommendation from nick_brain */}
        {backendPayload?.primary_recommendation && (
          <View style={styles.recCard}>
            <Text style={styles.recLabel}>RECOMMENDATION</Text>
            <Text style={styles.recText}>
              {backendPayload.primary_recommendation.message_key.replace(/_/g, " ")}
            </Text>
            <View style={styles.recActions}>
              <Pressable
                style={styles.recActionBtn}
                onPress={() => {
                  const rec = backendPayload.primary_recommendation!;
                  void actionRecommendation(rec.id, "actioned");
                  void refreshBackend();
                }}
              >
                <Text style={styles.recActionText}>Done</Text>
              </Pressable>
              <Pressable
                style={[styles.recActionBtn, styles.recDismissBtn]}
                onPress={() => {
                  const rec = backendPayload.primary_recommendation!;
                  void actionRecommendation(rec.id, "dismissed");
                  void refreshBackend();
                }}
              >
                <Text style={styles.recDismissText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* ── Sheets (render above everything, modal-level) ────────────────── */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  bgImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  t7Label: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "400",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
  centerFill: {
    flex: 1,
  },
  bottomSection: {
    gap: 12,
    paddingBottom: 12,
  },
  actionCard: {
    width: "90%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,30,40,0.55)",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 10,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  actionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  actionSubtitle: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 14,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnIcon: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 28,
  },
  inputRow: {
    width: "90%",
    alignSelf: "center",
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,30,40,0.65)",
    borderRadius: 999,
    paddingHorizontal: 20,
    gap: 10,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  sendIcon: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  pillRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
  },
  pillFlex: {
    flex: 1,
    alignSelf: "auto",
  },
  alarmPill: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
  },
  alarmPillPressed: {
    opacity: 0.7,
  },
  alarmPillText: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 13,
    fontWeight: "500",
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    padding: 32,
  },
  errorText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  retryBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  recCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  recLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  recText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  recActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  recActionBtn: {
    flex: 1,
    backgroundColor: "#22C55E",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  recDismissBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  recActionText: { color: "#000000", fontWeight: "600", fontSize: 13 },
  recDismissText: { color: "rgba(255,255,255,0.6)", fontWeight: "600", fontSize: 13 },
});
