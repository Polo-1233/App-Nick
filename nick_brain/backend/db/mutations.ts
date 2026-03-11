/**
 * R90 Backend — Database Write Operations
 *
 * All functions take an AppClient (service role) and a userId.
 * Callers must verify ownership before calling these functions.
 */

import type { AppClient } from "./client.js";
import type {
  SleepLogInput,
  DailyLogInput,
  CheckInInput,
  EventInput,
  ProfileUpdateInput,
  EnvironmentInput,
  RecommendationAction,
} from "../types.js";
import type {
  DetectedState,
  RecommendationOutput,
  WeeklyAccountingOutput,
} from "../../engine/types.js";
import { REC_CATEGORY, REC_COOLDOWN_HOURS, REC_DELIVERY_CHANNEL } from "./rec-metadata.js";

// ─── Users ────────────────────────────────────────────────────────────────────

export async function createUser(
  client: AppClient,
  authUid: string,
  timezone = "Europe/London"
): Promise<{ id: string } | null> {
  const { data, error } = await client
    .from("users")
    .insert({ auth_user_id: authUid, timezone })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[mutations] createUser failed:", error?.message);
    return null;
  }
  return data as { id: string };
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function createUserProfile(
  client: AppClient,
  userId: string,
  input: ProfileUpdateInput
): Promise<boolean> {
  const { error } = await client
    .from("user_profiles")
    .insert({ user_id: userId, ...sanitiseProfileInput(input) });

  if (error) {
    console.error("[mutations] createUserProfile failed:", error.message);
    return false;
  }
  return true;
}

export async function updateUserProfile(
  client: AppClient,
  userId: string,
  input: ProfileUpdateInput
): Promise<boolean> {
  const { error } = await client
    .from("user_profiles")
    .update(sanitiseProfileInput(input))
    .eq("user_id", userId);

  if (error) {
    console.error("[mutations] updateUserProfile failed:", error.message);
    return false;
  }

  // Sync onboarding fields to users table if provided
  if (
    input.onboarding_step !== undefined ||
    input.onboarding_completed !== undefined
  ) {
    await client
      .from("users")
      .update({
        ...(input.onboarding_step !== undefined && { onboarding_step: input.onboarding_step }),
        ...(input.onboarding_completed !== undefined && { onboarding_completed: input.onboarding_completed }),
      })
      .eq("id", userId);
  }

  return true;
}

function sanitiseProfileInput(input: ProfileUpdateInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.arp_time !== undefined) out["arp_time"] = input.arp_time;
  if (input.arp_committed !== undefined) {
    out["arp_committed"] = input.arp_committed;
    if (input.arp_committed) out["arp_committed_at"] = new Date().toISOString();
  }
  if (input.chronotype !== undefined) out["chronotype"] = input.chronotype;
  if (input.cycle_target !== undefined) out["cycle_target"] = input.cycle_target;
  if (input.caffeine_use !== undefined) out["caffeine_use"] = input.caffeine_use;
  if (input.tracker_in_use !== undefined) out["tracker_in_use"] = input.tracker_in_use;
  if (input.user_reported_anxiety !== undefined) out["user_reported_anxiety"] = input.user_reported_anxiety;
  if (input.user_reported_tracker_anxiety !== undefined) out["user_reported_tracker_anxiety"] = input.user_reported_tracker_anxiety;
  if (input.user_reported_screen_use !== undefined) out["user_reported_screen_use"] = input.user_reported_screen_use;
  if (input.occupation_schedule !== undefined) out["occupation_schedule"] = input.occupation_schedule;
  return out;
}

// ─── ARP Config ───────────────────────────────────────────────────────────────

/**
 * Upsert the computed ARP config into the DB.
 * Called by the engine service after generateARPConfig().
 */
export async function upsertARPConfig(
  client: AppClient,
  userId: string,
  config: {
    arp_time: string;
    cycle_times: string[];
    phase_1_start: string;
    phase_2_start: string;
    phase_3_start: string;
    phase_4_start: string;
    crp_window_open: string;
    crp_window_close: string;
    sleep_onset_6cycle: string;
    sleep_onset_5cycle: string;
    sleep_onset_4cycle: string;
    sleep_onset_3cycle: string;
    mrm_times: string[];
  }
): Promise<boolean> {
  // Compute pre_sleep_window fields from cycle_times (C11, C12, C13 = indices 10, 11, 12)
  const cycleArr = config.cycle_times;
  const preSleepOpen  = cycleArr[10] ?? config.sleep_onset_4cycle;
  const preSleepIdeal = cycleArr[11] ?? config.sleep_onset_5cycle;
  const preSleepFloor = cycleArr[12] ?? config.sleep_onset_4cycle;

  // Deep sleep window: nocturnal start ~1h after sleep onset (approximation)
  const deepSleepOpen  = config.sleep_onset_5cycle;
  const deepSleepClose = config.arp_time;

  const { error } = await client
    .from("arp_configs")
    .upsert(
      {
        user_id: userId,
        arp_time: config.arp_time,
        cycle_times: config.cycle_times,
        phase_1_start: config.phase_1_start,
        phase_2_start: config.phase_2_start,
        phase_3_start: config.phase_3_start,
        phase_4_start: config.phase_4_start,
        crp_window_open: config.crp_window_open,
        crp_window_close: config.crp_window_close,
        sleep_onset_6cycle: config.sleep_onset_6cycle,
        sleep_onset_5cycle: config.sleep_onset_5cycle,
        sleep_onset_4cycle: config.sleep_onset_4cycle,
        sleep_onset_3cycle: config.sleep_onset_3cycle,
        mrm_times: config.mrm_times,
        pre_sleep_window_open: preSleepOpen,
        pre_sleep_window_ideal: preSleepIdeal,
        pre_sleep_window_floor: preSleepFloor,
        deep_sleep_window_open: deepSleepOpen,
        deep_sleep_window_close: deepSleepClose,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[mutations] upsertARPConfig failed:", error.message);
    return false;
  }
  return true;
}

// ─── Sleep Logs ───────────────────────────────────────────────────────────────

export async function upsertSleepLog(
  client: AppClient,
  userId: string,
  input: SleepLogInput & {
    arp_maintained?: boolean;
    computed_cycles?: number | null;
  }
): Promise<{ id: string } | null> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    date: input.date,
  };

  if (input.wake_time !== undefined)           payload["wake_time"]           = input.wake_time;
  if (input.actual_sleep_onset !== undefined)  payload["actual_sleep_onset"]  = input.actual_sleep_onset;
  if (input.arp_maintained !== undefined)      payload["arp_maintained"]      = input.arp_maintained;
  if (input.disruption_event_id !== undefined) payload["disruption_event_id"] = input.disruption_event_id;
  if (input.night_waking_2_to_4am !== undefined) payload["night_waking_2_to_4am"] = input.night_waking_2_to_4am;
  if (input.onset_latency_minutes !== undefined) payload["onset_latency_minutes"] = input.onset_latency_minutes;
  if (input.pre_sleep_routine_done !== undefined) payload["pre_sleep_routine_done"] = input.pre_sleep_routine_done;
  if (input.post_sleep_routine_done !== undefined) payload["post_sleep_routine_done"] = input.post_sleep_routine_done;
  if (input.subjective_energy_on_waking !== undefined) payload["subjective_energy_on_waking"] = input.subjective_energy_on_waking;
  if (input.notes !== undefined) payload["notes"] = input.notes;

  // cycles_completed: use provided value, or formula result, or null (never coerce to 0)
  const finalCycles =
    input.cycles_completed !== undefined
      ? input.cycles_completed
      : input.computed_cycles !== undefined
        ? input.computed_cycles
        : undefined;

  if (finalCycles !== undefined) payload["cycles_completed"] = finalCycles;

  const { data, error } = await client
    .from("sleep_logs")
    .upsert(payload, { onConflict: "user_id,date" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[mutations] upsertSleepLog failed:", error?.message);
    return null;
  }
  return data as { id: string };
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

export async function upsertDailyLog(
  client: AppClient,
  userId: string,
  input: DailyLogInput & {
    crp_in_window?: boolean;
    caffeine_after_cutoff?: boolean;
  }
): Promise<{ id: string } | null> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    date: input.date,
  };

  if (input.mrm_count !== undefined)           payload["mrm_count"]           = input.mrm_count;
  if (input.crp_taken !== undefined)           payload["crp_taken"]           = input.crp_taken;
  if (input.crp_duration_minutes !== undefined) payload["crp_duration_minutes"] = input.crp_duration_minutes;
  if (input.crp_start_time !== undefined)      payload["crp_start_time"]      = input.crp_start_time;
  if (input.crp_in_window !== undefined)       payload["crp_in_window"]       = input.crp_in_window;
  if (input.morning_light_achieved !== undefined) payload["morning_light_achieved"] = input.morning_light_achieved;
  if (input.evening_light_managed !== undefined)  payload["evening_light_managed"]  = input.evening_light_managed;
  if (input.caffeine_doses !== undefined)      payload["caffeine_doses"]      = input.caffeine_doses;
  if (input.caffeine_last_time !== undefined)  payload["caffeine_last_time"]  = input.caffeine_last_time;
  if (input.caffeine_after_cutoff !== undefined) payload["caffeine_after_cutoff"] = input.caffeine_after_cutoff;
  if (input.subjective_energy_midday !== undefined) payload["subjective_energy_midday"] = input.subjective_energy_midday;
  if (input.subjective_energy_evening !== undefined) payload["subjective_energy_evening"] = input.subjective_energy_evening;
  if (input.disruption_event_id !== undefined) payload["disruption_event_id"] = input.disruption_event_id;

  const { data, error } = await client
    .from("daily_logs")
    .upsert(payload, { onConflict: "user_id,date" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[mutations] upsertDailyLog failed:", error?.message);
    return null;
  }
  return data as { id: string };
}

// ─── Weekly Balance ───────────────────────────────────────────────────────────

/**
 * Upsert the weekly cycle balance with freshly computed accounting values.
 * Creates a new record if none exists for the week_start date.
 */
export async function upsertWeeklyBalance(
  client: AppClient,
  userId: string,
  weekStart: string,
  weekEnd: string,
  accounting: WeeklyAccountingOutput,
  nocturnalPerDay: (number | null)[],
  crpPerDay: (number | null)[]
): Promise<boolean> {
  const { error } = await client
    .from("weekly_cycle_balances")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd,
        day_number: accounting.day_number,
        status: "active",
        nocturnal_cycles: nocturnalPerDay,
        crp_cycles: crpPerDay,
        total_nocturnal_cycles: accounting.nocturnal_total,
        total_crp_cycles: accounting.weekly_crp_total,
        weekly_cycle_total: accounting.weekly_cycle_total,
        cycle_deficit: accounting.cycle_deficit,
        projected_weekly_total: accounting.projected_end_total,
        on_track: accounting.on_track,
        deficit_risk_flag: accounting.deficit_risk_flag,
        arp_stable: accounting.arp_stable,
        mrm_total: accounting.mrm_weekly_total,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start" }
    );

  if (error) {
    console.error("[mutations] upsertWeeklyBalance failed:", error.message);
    return false;
  }
  return true;
}

// ─── User States ──────────────────────────────────────────────────────────────

/**
 * Sync detected states to the DB:
 * - Activate new states (upsert with active=true)
 * - Deactivate states that are no longer detected
 */
export async function syncUserStates(
  client: AppClient,
  userId: string,
  detectedStates: DetectedState[]
): Promise<void> {
  const now = new Date().toISOString();
  const detectedIds = new Set(detectedStates.map(s => s.state_id));

  // Deactivate states that are no longer detected
  await client
    .from("user_states")
    .update({ active: false, resolved_at: now, auto_resolved: true })
    .eq("user_id", userId)
    .eq("active", true)
    .not("state_id", "in", `(${[...detectedIds].map(id => `"${id}"`).join(",")})`);

  // Upsert active states
  for (const state of detectedStates) {
    await client
      .from("user_states")
      .upsert(
        {
          user_id: userId,
          state_id: state.state_id,
          active: true,
          priority: state.priority,
          detection_source: "sleep_log",
          trigger_signals: [],
          active_days: state.active_days,
          // detected_at: only set on first activation (handled by partial unique index)
        },
        {
          onConflict: "user_id,state_id",
          ignoreDuplicates: false,
        }
      );
  }
}

// ─── Recommendations ──────────────────────────────────────────────────────────

/**
 * Replace all pending/delivered recommendations for a user with the new engine output.
 * Previous recommendations that are 'actioned' or 'dismissed' are preserved.
 */
export async function persistRecommendations(
  client: AppClient,
  userId: string,
  recommendations: RecommendationOutput[]
): Promise<void> {
  const now = new Date().toISOString();

  // Expire old pending/delivered recommendations
  await client
    .from("recommendations")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .in("status", ["pending", "delivered"]);

  // Insert new recommendations
  if (recommendations.length === 0) return;

  const rows = recommendations.map(rec => ({
    user_id: userId,
    recommendation_type: rec.rec_type,
    category: REC_CATEGORY[rec.rec_type] ?? "foundation",
    triggered_by_states: rec.triggered_by ? [rec.triggered_by] : [],
    priority: rec.priority,
    priority_label: rec.priority_label,
    status: "pending" as const,
    delivery_channel: REC_DELIVERY_CHANNEL[rec.rec_type] ?? "in_app_card",
    generated_at: now,
    deliver_at: now,
    coaching_message: "", // populated by coaching copy at delivery time
    action_payload: rec.action_payload,
    cooldown_hours: REC_COOLDOWN_HOURS[rec.rec_type] ?? 24,
  }));

  const { error } = await client.from("recommendations").insert(rows);
  if (error) {
    console.error("[mutations] persistRecommendations failed:", error.message);
  }
}

/**
 * Update recommendation cooldowns after delivery.
 */
export async function updateCooldown(
  client: AppClient,
  userId: string,
  recType: string
): Promise<void> {
  await client
    .from("recommendation_cooldowns")
    .upsert(
      {
        user_id: userId,
        rec_type: recType,
        last_triggered_at: new Date().toISOString(),
        cooldown_hours: REC_COOLDOWN_HOURS[recType as keyof typeof REC_COOLDOWN_HOURS] ?? 24,
      },
      { onConflict: "user_id,rec_type" }
    );
}

/**
 * Handle user action on a recommendation (actioned / dismissed).
 */
export async function updateRecommendationStatus(
  client: AppClient,
  userId: string,
  recommendationId: string,
  action: RecommendationAction
): Promise<boolean> {
  const now = new Date().toISOString();
  const updatePayload =
    action === "actioned"
      ? { status: "actioned", actioned_at: now }
      : { status: "dismissed", dismissed_at: now };

  const { data, error } = await client
    .from("recommendations")
    .update(updatePayload)
    .eq("id", recommendationId)
    .eq("user_id", userId)
    .select("recommendation_type")
    .single();

  if (error || !data) {
    console.error("[mutations] updateRecommendationStatus failed:", error?.message);
    return false;
  }

  // Increment dismissed_count for REC-CRP-02 stigma rule.
  // Done via select-then-upsert (no RPC dependency).
  if (action === "dismissed") {
    const row = data as { recommendation_type: string };
    const recType = row.recommendation_type;

    const { data: existing } = await client
      .from("recommendation_cooldowns")
      .select("dismissed_count")
      .eq("user_id", userId)
      .eq("rec_type", recType)
      .single();

    const newCount = ((existing as { dismissed_count: number } | null)?.dismissed_count ?? 0) + 1;

    await client
      .from("recommendation_cooldowns")
      .upsert(
        { user_id: userId, rec_type: recType, dismissed_count: newCount },
        { onConflict: "user_id,rec_type" }
      );
  }

  return true;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function createEvent(
  client: AppClient,
  userId: string,
  input: EventInput
): Promise<{ id: string } | null> {
  const { data, error } = await client
    .from("event_contexts")
    .insert({
      user_id: userId,
      event_type: input.event_type,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      destination_timezone: input.destination_timezone ?? null,
      timezone_offset_hours: input.timezone_offset_hours ?? null,
      cycle_floor_override: input.cycle_floor_override ?? null,
      notes: input.notes ?? null,
      active: true,
      arp_locked: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[mutations] createEvent failed:", error?.message);
    return null;
  }
  return data as { id: string };
}

export async function resolveEvent(
  client: AppClient,
  userId: string,
  eventId: string
): Promise<boolean> {
  const { error } = await client
    .from("event_contexts")
    .update({ active: false })
    .eq("id", eventId)
    .eq("user_id", userId);

  if (error) {
    console.error("[mutations] resolveEvent failed:", error.message);
    return false;
  }
  return true;
}

// ─── Environment ──────────────────────────────────────────────────────────────

export async function upsertEnvironment(
  client: AppClient,
  userId: string,
  input: EnvironmentInput
): Promise<boolean> {
  const payload: Record<string, unknown> = { user_id: userId };

  if (input.bedroom_temperature !== undefined) payload["bedroom_temperature"] = input.bedroom_temperature;
  if (input.evening_light_environment !== undefined) payload["evening_light_environment"] = input.evening_light_environment;
  if (input.tv_in_bedroom !== undefined) payload["tv_in_bedroom"] = input.tv_in_bedroom;
  if (input.work_items_in_bedroom !== undefined) payload["work_items_in_bedroom"] = input.work_items_in_bedroom;
  if (input.blackout_provision !== undefined) payload["blackout_provision"] = input.blackout_provision;
  if (input.dws_device !== undefined) payload["dws_device"] = input.dws_device;

  const { error } = await client
    .from("environment_contexts")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("[mutations] upsertEnvironment failed:", error.message);
    return false;
  }
  return true;
}
