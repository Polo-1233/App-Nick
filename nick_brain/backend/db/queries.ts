/**
 * R90 Backend — Database Read Queries
 *
 * All functions return typed records ready for the EngineContext assembler.
 * TIME values from Supabase are "HH:MM:SS" — use toHHMM() to normalise.
 */

import type { AppClient } from "./client.js";

// ─── Time normalisation ───────────────────────────────────────────────────────

/** Supabase returns TIME columns as "HH:MM:SS". Strip seconds → "HH:MM". */
export function toHHMM(t: string | null | undefined): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

/** Normalise an array of TIME strings (e.g., cycle_times[16]). */
function toHHMMArray(arr: string[] | null | undefined): string[] {
  if (!arr) return [];
  return arr.map(t => t.slice(0, 5));
}

// ─── Row shape types (raw DB output) ─────────────────────────────────────────

export interface UserRow {
  id: string;
  auth_user_id: string;
  created_at: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  timezone: string;
}

export interface UserProfileRow {
  id: string;
  user_id: string;
  arp_committed: boolean;
  arp_time: string | null;
  arp_committed_at: string | null;
  chronotype: string;
  cycle_target: number;
  multishift_enabled: boolean;
  shift_arp_day: string | null;
  shift_arp_night: string | null;
  active_shift: string | null;
  caffeine_use: string | null;
  caffeine_cutoff_time: string | null;
  tracker_in_use: boolean;
  occupation_schedule: string | null;
  user_reported_anxiety: boolean;
  user_reported_tracker_anxiety: boolean;
  user_reported_screen_use: boolean;
  profile_version: number;
  updated_at: string;
  // Phase 1 — lifestyle fields
  stress_level:        string | null;
  sleep_environment:   string | null;
  exercise_frequency:  string | null;
  alcohol_use:         string | null;
  work_start_time:     string | null;
  lifestyle_updated_at: string | null;
}

// ─── life_events ──────────────────────────────────────────────────────────────

export interface LifeEventRow {
  id:         string;
  user_id:    string;
  event_type: string;
  title:      string;
  event_date: string;
  end_date:   string | null;
  notes:      string | null;
  created_at: string;
}

export interface ARPConfigRow {
  id: string;
  user_id: string;
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
  generated_at: string;
}

export interface SleepLogRow {
  id: string;
  user_id: string;
  date: string;
  wake_time: string | null;
  actual_sleep_onset: string | null;
  cycles_completed: number | null;
  onset_latency_minutes: number | null;
  onset_latency_flag: boolean | null;
  night_waking_2_to_4am: boolean | null;
  arp_maintained: boolean | null;
  disruption_event_id: string | null;
}

export interface DailyLogRow {
  id: string;
  user_id: string;
  date: string;
  mrm_count: number | null;
  crp_taken: boolean | null;
  crp_duration_minutes: number | null;
  crp_start_time: string | null;
  crp_cycle_credited: boolean | null;
  crp_in_window: boolean | null;
  caffeine_doses: number | null;
  caffeine_after_cutoff: boolean | null;
  morning_light_achieved: boolean | null;
  evening_light_managed: boolean | null;
  subjective_energy_midday: number | null;
  // Phase 1 — subjective tracking
  mood_score:   number | null;
  stress_score: number | null;
}

export interface WeeklyBalanceRow {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  day_number: number;
  status: string;
  nocturnal_cycles: number[];
  crp_cycles: number[];
  total_nocturnal_cycles: number;
  total_crp_cycles: number;
  weekly_cycle_total: number;
  cycle_deficit: number;
  deficit_risk_flag: boolean;
  arp_stable: boolean;
  mrm_total: number | null;
}

export interface EventContextRow {
  id: string;
  user_id: string;
  event_type: string;
  start_date: string;
  end_date: string | null;
  active: boolean;
  timezone_offset_hours: number | null;
  cycle_floor_override: number | null;
  arp_locked: boolean;
}

export interface EnvironmentContextRow {
  id: string;
  user_id: string;
  bedroom_temperature: string | null;
  evening_light_environment: string | null;
  tv_in_bedroom: boolean | null;
  work_items_in_bedroom: boolean | null;
  blackout_provision: boolean | null;
  dws_device: boolean | null;
  environment_friction_score: number | null;
  blackout_without_dws: boolean | null;
}

export interface RecommendationCooldownRow {
  rec_type: string;
  last_triggered_at: string | null;
  dismissed_count: number;
}

// ─── calendar_events ─────────────────────────────────────────────────────────

export interface CalendarEventRow {
  id:              string;
  user_id:         string;
  external_id:     string;
  title:           string;
  start_time:      string;
  end_time:        string;
  all_day:         boolean;
  source:          string;
  event_type_hint: string;
  synced_at:       string;
}

// ─── Query functions ──────────────────────────────────────────────────────────

export async function fetchUser(
  client: AppClient,
  userId: string
): Promise<UserRow | null> {
  const { data, error } = await client
    .from("users")
    .select("id, auth_user_id, created_at, onboarding_completed, onboarding_step, timezone")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as UserRow;
}

export async function fetchUserProfile(
  client: AppClient,
  userId: string
): Promise<UserProfileRow | null> {
  const { data, error } = await client
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  const row = data as UserProfileRow;
  // Normalise TIME fields
  return {
    ...row,
    arp_time: toHHMM(row.arp_time),
    caffeine_cutoff_time: toHHMM(row.caffeine_cutoff_time),
    shift_arp_day: toHHMM(row.shift_arp_day),
    shift_arp_night: toHHMM(row.shift_arp_night),
  };
}

export async function fetchARPConfig(
  client: AppClient,
  userId: string
): Promise<ARPConfigRow | null> {
  const { data, error } = await client
    .from("arp_configs")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  const row = data as ARPConfigRow;
  return {
    ...row,
    arp_time: toHHMM(row.arp_time) ?? row.arp_time,
    cycle_times: toHHMMArray(row.cycle_times),
    phase_1_start: toHHMM(row.phase_1_start) ?? row.phase_1_start,
    phase_2_start: toHHMM(row.phase_2_start) ?? row.phase_2_start,
    phase_3_start: toHHMM(row.phase_3_start) ?? row.phase_3_start,
    phase_4_start: toHHMM(row.phase_4_start) ?? row.phase_4_start,
    crp_window_open: toHHMM(row.crp_window_open) ?? row.crp_window_open,
    crp_window_close: toHHMM(row.crp_window_close) ?? row.crp_window_close,
    sleep_onset_6cycle: toHHMM(row.sleep_onset_6cycle) ?? row.sleep_onset_6cycle,
    sleep_onset_5cycle: toHHMM(row.sleep_onset_5cycle) ?? row.sleep_onset_5cycle,
    sleep_onset_4cycle: toHHMM(row.sleep_onset_4cycle) ?? row.sleep_onset_4cycle,
    sleep_onset_3cycle: toHHMM(row.sleep_onset_3cycle) ?? row.sleep_onset_3cycle,
    mrm_times: toHHMMArray(row.mrm_times),
  };
}

/**
 * Fetch recent sleep logs for a user, sorted descending (most recent first).
 * @param days  How many days to look back (default 10 — enough for rolling week + buffer)
 */
export async function fetchRecentSleepLogs(
  client: AppClient,
  userId: string,
  days = 10
): Promise<SleepLogRow[]> {
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await client
    .from("sleep_logs")
    .select(
      "id, user_id, date, wake_time, actual_sleep_onset, cycles_completed, " +
      "onset_latency_minutes, onset_latency_flag, night_waking_2_to_4am, " +
      "arp_maintained, disruption_event_id"
    )
    .eq("user_id", userId)
    .gte("date", since)
    .order("date", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as SleepLogRow[]).map(row => ({
    ...row,
    wake_time: toHHMM(row.wake_time),
    actual_sleep_onset: toHHMM(row.actual_sleep_onset),
  }));
}

/**
 * Fetch recent daily logs, sorted descending.
 */
export async function fetchRecentDailyLogs(
  client: AppClient,
  userId: string,
  days = 10
): Promise<DailyLogRow[]> {
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await client
    .from("daily_logs")
    .select(
      "id, user_id, date, mrm_count, crp_taken, crp_duration_minutes, crp_start_time, " +
      "crp_cycle_credited, crp_in_window, caffeine_doses, caffeine_after_cutoff, " +
      "morning_light_achieved, evening_light_managed, subjective_energy_midday"
    )
    .eq("user_id", userId)
    .gte("date", since)
    .order("date", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as DailyLogRow[]).map(row => ({
    ...row,
    crp_start_time: toHHMM(row.crp_start_time),
  }));
}

/**
 * Fetch the current active weekly balance (status = 'active').
 * Returns the most recent one if multiple exist (shouldn't happen).
 */
export async function fetchActiveWeeklyBalance(
  client: AppClient,
  userId: string
): Promise<WeeklyBalanceRow | null> {
  const { data, error } = await client
    .from("weekly_cycle_balances")
    .select(
      "id, user_id, week_start, week_end, day_number, status, " +
      "nocturnal_cycles, crp_cycles, total_nocturnal_cycles, total_crp_cycles, " +
      "weekly_cycle_total, cycle_deficit, deficit_risk_flag, arp_stable, mrm_total"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("week_start", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as unknown as WeeklyBalanceRow;
}

/**
 * Fetch all active event contexts for a user.
 */
export async function fetchActiveEvents(
  client: AppClient,
  userId: string
): Promise<EventContextRow[]> {
  const { data, error } = await client
    .from("event_contexts")
    .select(
      "id, user_id, event_type, start_date, end_date, active, " +
      "timezone_offset_hours, cycle_floor_override, arp_locked"
    )
    .eq("user_id", userId)
    .eq("active", true);

  if (error || !data) return [];
  return data as unknown as EventContextRow[];
}

/**
 * Fetch the environment context for a user (1:1 relationship).
 */
export async function fetchEnvironmentContext(
  client: AppClient,
  userId: string
): Promise<EnvironmentContextRow | null> {
  const { data, error } = await client
    .from("environment_contexts")
    .select(
      "id, user_id, bedroom_temperature, evening_light_environment, " +
      "tv_in_bedroom, work_items_in_bedroom, blackout_provision, dws_device, " +
      "environment_friction_score, blackout_without_dws"
    )
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data as unknown as EnvironmentContextRow;
}

/**
 * Fetch all recommendation cooldowns for a user.
 */
export async function fetchCooldowns(
  client: AppClient,
  userId: string
): Promise<RecommendationCooldownRow[]> {
  const { data, error } = await client
    .from("recommendation_cooldowns")
    .select("rec_type, last_triggered_at, dismissed_count")
    .eq("user_id", userId);

  if (error || !data) return [];
  return data as RecommendationCooldownRow[];
}

/**
 * Fetch recent life events for a user (last 14 days + next 7 days).
 * Used to inject upcoming/recent events into the LLM context.
 */
export async function fetchRecentLifeEvents(
  client: AppClient,
  userId: string,
  lookbackDays = 14,
  lookaheadDays = 7,
): Promise<LifeEventRow[]> {
  const past   = new Date(); past.setDate(past.getDate() - lookbackDays);
  const future = new Date(); future.setDate(future.getDate() + lookaheadDays);

  const { data, error } = await client
    .from("life_events")
    .select("id, user_id, event_type, title, event_date, end_date, notes, created_at")
    .eq("user_id", userId)
    .gte("event_date", past.toISOString().slice(0, 10))
    .lte("event_date", future.toISOString().slice(0, 10))
    .order("event_date", { ascending: true });

  if (error || !data) return [];
  return data as LifeEventRow[];
}

/**
 * Fetch upcoming calendar events within the next N hours.
 */
export async function fetchUpcomingCalendarEvents(
  client: AppClient,
  userId: string,
  hoursAhead = 48,
): Promise<CalendarEventRow[]> {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + hoursAhead * 3_600_000).toISOString();

  const { data, error } = await client
    .from("calendar_events")
    .select("id, user_id, external_id, title, start_time, end_time, all_day, source, event_type_hint, synced_at")
    .eq("user_id", userId)
    .gte("start_time", now)
    .lte("start_time", future)
    .order("start_time", { ascending: true });

  if (error || !data) return [];
  return data as CalendarEventRow[];
}
