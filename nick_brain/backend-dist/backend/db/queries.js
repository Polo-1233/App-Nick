/**
 * R90 Backend — Database Read Queries
 *
 * All functions return typed records ready for the EngineContext assembler.
 * TIME values from Supabase are "HH:MM:SS" — use toHHMM() to normalise.
 */
// ─── Time normalisation ───────────────────────────────────────────────────────
/** Supabase returns TIME columns as "HH:MM:SS". Strip seconds → "HH:MM". */
export function toHHMM(t) {
    if (!t)
        return null;
    return t.slice(0, 5);
}
/** Normalise an array of TIME strings (e.g., cycle_times[16]). */
function toHHMMArray(arr) {
    if (!arr)
        return [];
    return arr.map(t => t.slice(0, 5));
}
// ─── Query functions ──────────────────────────────────────────────────────────
export async function fetchUser(client, userId) {
    const { data, error } = await client
        .from("users")
        .select("id, auth_user_id, created_at, onboarding_completed, onboarding_step, timezone")
        .eq("id", userId)
        .single();
    if (error || !data)
        return null;
    return data;
}
export async function fetchUserProfile(client, userId) {
    const { data, error } = await client
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
    if (error || !data)
        return null;
    const row = data;
    // Normalise TIME fields
    return {
        ...row,
        arp_time: toHHMM(row.arp_time),
        caffeine_cutoff_time: toHHMM(row.caffeine_cutoff_time),
        shift_arp_day: toHHMM(row.shift_arp_day),
        shift_arp_night: toHHMM(row.shift_arp_night),
    };
}
export async function fetchARPConfig(client, userId) {
    const { data, error } = await client
        .from("arp_configs")
        .select("*")
        .eq("user_id", userId)
        .single();
    if (error || !data)
        return null;
    const row = data;
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
export async function fetchRecentSleepLogs(client, userId, days = 10) {
    const since = new Date(Date.now() - days * 86_400_000)
        .toISOString()
        .slice(0, 10);
    const { data, error } = await client
        .from("sleep_logs")
        .select("id, user_id, date, wake_time, actual_sleep_onset, cycles_completed, " +
        "onset_latency_minutes, onset_latency_flag, night_waking_2_to_4am, " +
        "arp_maintained, disruption_event_id")
        .eq("user_id", userId)
        .gte("date", since)
        .order("date", { ascending: false });
    if (error || !data)
        return [];
    return data.map(row => ({
        ...row,
        wake_time: toHHMM(row.wake_time),
        actual_sleep_onset: toHHMM(row.actual_sleep_onset),
    }));
}
/**
 * Fetch recent daily logs, sorted descending.
 */
export async function fetchRecentDailyLogs(client, userId, days = 10) {
    const since = new Date(Date.now() - days * 86_400_000)
        .toISOString()
        .slice(0, 10);
    const { data, error } = await client
        .from("daily_logs")
        .select("id, user_id, date, mrm_count, crp_taken, crp_duration_minutes, crp_start_time, " +
        "crp_cycle_credited, crp_in_window, caffeine_doses, caffeine_after_cutoff, " +
        "morning_light_achieved, evening_light_managed, subjective_energy_midday")
        .eq("user_id", userId)
        .gte("date", since)
        .order("date", { ascending: false });
    if (error || !data)
        return [];
    return data.map(row => ({
        ...row,
        crp_start_time: toHHMM(row.crp_start_time),
    }));
}
/**
 * Fetch the current active weekly balance (status = 'active').
 * Returns the most recent one if multiple exist (shouldn't happen).
 */
export async function fetchActiveWeeklyBalance(client, userId) {
    const { data, error } = await client
        .from("weekly_cycle_balances")
        .select("id, user_id, week_start, week_end, day_number, status, " +
        "nocturnal_cycles, crp_cycles, total_nocturnal_cycles, total_crp_cycles, " +
        "weekly_cycle_total, cycle_deficit, deficit_risk_flag, arp_stable, mrm_total")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("week_start", { ascending: false })
        .limit(1)
        .single();
    if (error || !data)
        return null;
    return data;
}
/**
 * Fetch all active event contexts for a user.
 */
export async function fetchActiveEvents(client, userId) {
    const { data, error } = await client
        .from("event_contexts")
        .select("id, user_id, event_type, start_date, end_date, active, " +
        "timezone_offset_hours, cycle_floor_override, arp_locked")
        .eq("user_id", userId)
        .eq("active", true);
    if (error || !data)
        return [];
    return data;
}
/**
 * Fetch the environment context for a user (1:1 relationship).
 */
export async function fetchEnvironmentContext(client, userId) {
    const { data, error } = await client
        .from("environment_contexts")
        .select("id, user_id, bedroom_temperature, evening_light_environment, " +
        "tv_in_bedroom, work_items_in_bedroom, blackout_provision, dws_device, " +
        "environment_friction_score, blackout_without_dws")
        .eq("user_id", userId)
        .single();
    if (error || !data)
        return null;
    return data;
}
/**
 * Fetch all recommendation cooldowns for a user.
 */
export async function fetchCooldowns(client, userId) {
    const { data, error } = await client
        .from("recommendation_cooldowns")
        .select("rec_type, last_triggered_at, dismissed_count")
        .eq("user_id", userId);
    if (error || !data)
        return [];
    return data;
}
/**
 * Fetch recent life events for a user (last 14 days + next 7 days).
 * Used to inject upcoming/recent events into the LLM context.
 */
export async function fetchRecentLifeEvents(client, userId, lookbackDays = 14, lookaheadDays = 7) {
    const past = new Date();
    past.setDate(past.getDate() - lookbackDays);
    const future = new Date();
    future.setDate(future.getDate() + lookaheadDays);
    const { data, error } = await client
        .from("life_events")
        .select("id, user_id, event_type, title, event_date, end_date, notes, created_at")
        .eq("user_id", userId)
        .gte("event_date", past.toISOString().slice(0, 10))
        .lte("event_date", future.toISOString().slice(0, 10))
        .order("event_date", { ascending: true });
    if (error || !data)
        return [];
    return data;
}
/**
 * Fetch upcoming calendar events within the next N hours.
 */
export async function fetchUpcomingCalendarEvents(client, userId, hoursAhead = 48) {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + hoursAhead * 3_600_000).toISOString();
    const { data, error } = await client
        .from("calendar_events")
        .select("id, user_id, external_id, title, start_time, end_time, all_day, source, event_type_hint, synced_at")
        .eq("user_id", userId)
        .gte("start_time", now)
        .lte("start_time", future)
        .order("start_time", { ascending: true });
    if (error || !data)
        return [];
    return data;
}
/**
 * Fetch recent weekly summaries (most recent first).
 */
export async function fetchWeeklySummaries(client, userId, limit = 4) {
    const { data, error } = await client
        .from("weekly_summaries")
        .select("*")
        .eq("user_id", userId)
        .order("week_start", { ascending: false })
        .limit(limit);
    if (error || !data)
        return [];
    return data;
}
/**
 * Fetch the latest weekly report for a user.
 */
export async function fetchLatestWeeklyReport(client, userId) {
    const { data, error } = await client
        .from("weekly_reports")
        .select("*")
        .eq("user_id", userId)
        .order("week_start", { ascending: false })
        .limit(1)
        .single();
    if (error || !data)
        return null;
    return data;
}
//# sourceMappingURL=queries.js.map