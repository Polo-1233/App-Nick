/**
 * R90 Backend — EngineContext Assembler
 *
 * Reads all required Supabase records for a user and assembles a valid
 * EngineContext ready to be passed to runEngineSafe().
 *
 * This is the bridge between the Supabase data layer and the pure engine.
 */
import { fetchUser, fetchUserProfile, fetchARPConfig, fetchRecentSleepLogs, fetchRecentDailyLogs, fetchActiveWeeklyBalance, fetchActiveEvents, fetchEnvironmentContext, fetchCooldowns, } from "../db/queries.js";
// ─── Field mapping helpers ────────────────────────────────────────────────────
function toChronotype(v) {
    if (v === "AMer" || v === "PMer" || v === "In-betweener")
        return v;
    return "Unknown";
}
function toEventType(v) {
    const valid = ["travel", "illness", "injury", "social_disruption", "shift_change", "pre_event"];
    return valid.includes(v) ? v : "social_disruption";
}
function toBedroomTemp(v) {
    if (v === "hot" || v === "comfortable" || v === "cool" || v === "variable")
        return v;
    return null;
}
function toEveningLight(v) {
    if (v === "bright_blue" || v === "mixed" || v === "amber_managed")
        return v;
    return null;
}
function toOccupationSchedule(v) {
    const valid = ["standard", "early_starts", "flexible", "freelance", "shift_work"];
    if (v && valid.includes(v))
        return v;
    return null; // includes late_finishes, irregular → null (engine doesn't use them)
}
function daysBetween(a, b) {
    return Math.max(0, Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000));
}
// ─── Main assembler ───────────────────────────────────────────────────────────
/**
 * Assemble a complete EngineContext for a user from the Supabase database.
 *
 * @param client   Service-role Supabase client
 * @param userId   App-level users.id (not auth_user_id)
 * @param now      ISO timestamp for the evaluation point (default: new Date())
 */
export async function assembleEngineContext(client, userId, now) {
    const evaluationTime = now ?? new Date().toISOString();
    const today = evaluationTime.slice(0, 10); // "YYYY-MM-DD"
    // Fetch all required data in parallel
    const [userRow, profileRow, arpConfigRow, rawSleepLogs, rawDailyLogs, weeklyBalanceRow, rawEvents, environmentRow, rawCooldowns,] = await Promise.all([
        fetchUser(client, userId),
        fetchUserProfile(client, userId),
        fetchARPConfig(client, userId),
        fetchRecentSleepLogs(client, userId, 10),
        fetchRecentDailyLogs(client, userId, 10),
        fetchActiveWeeklyBalance(client, userId),
        fetchActiveEvents(client, userId),
        fetchEnvironmentContext(client, userId),
        fetchCooldowns(client, userId),
    ]);
    if (!userRow || !profileRow) {
        throw new Error(`User ${userId} not found or missing profile`);
    }
    // ── Map UserProfile ───────────────────────────────────────────────────────
    const profile = {
        id: profileRow.id,
        user_id: userId,
        arp_committed: profileRow.arp_committed,
        arp_time: profileRow.arp_time ?? null,
        chronotype: toChronotype(profileRow.chronotype),
        tracker_in_use: profileRow.tracker_in_use ?? false,
        user_reported_tracker_anxiety: profileRow.user_reported_tracker_anxiety ?? false,
        user_reported_anxiety: profileRow.user_reported_anxiety ?? false,
        user_reported_screen_use_in_phase_3: profileRow.user_reported_screen_use ?? false,
        onboarding_completed: userRow.onboarding_completed,
        onboarding_step: userRow.onboarding_step,
        caffeine_use: profileRow.caffeine_use ?? null,
        occupation_schedule: toOccupationSchedule(profileRow.occupation_schedule),
        multishift_enabled: profileRow.multishift_enabled ?? false,
        shift_arp_day: profileRow.shift_arp_day ?? null,
        shift_arp_night: profileRow.shift_arp_night ?? null,
        active_shift: profileRow.active_shift ?? null,
        arp_committed_at: profileRow.arp_committed_at
            ? profileRow.arp_committed_at.slice(0, 10)
            : null,
        profile_version: profileRow.profile_version,
        updated_at: profileRow.updated_at,
    };
    // ── Map ARPConfig ─────────────────────────────────────────────────────────
    const arpConfig = arpConfigRow
        ? {
            arp_time: arpConfigRow.arp_time,
            cycle_times: arpConfigRow.cycle_times,
            crp_window_open: arpConfigRow.crp_window_open,
            crp_window_close: arpConfigRow.crp_window_close,
            sleep_onset_6cycle: arpConfigRow.sleep_onset_6cycle,
            sleep_onset_5cycle: arpConfigRow.sleep_onset_5cycle,
            sleep_onset_4cycle: arpConfigRow.sleep_onset_4cycle,
            sleep_onset_3cycle: arpConfigRow.sleep_onset_3cycle,
            mrm_times: arpConfigRow.mrm_times,
            phase_1_start: arpConfigRow.phase_1_start,
            phase_2_start: arpConfigRow.phase_2_start,
            phase_3_start: arpConfigRow.phase_3_start,
            phase_4_start: arpConfigRow.phase_4_start,
            generated_at: arpConfigRow.generated_at,
        }
        : null;
    // ── Map SleepLogs ─────────────────────────────────────────────────────────
    const sleepLogs = rawSleepLogs.map(row => ({
        id: row.id,
        user_id: row.user_id,
        date: row.date,
        wake_time: row.wake_time,
        actual_sleep_onset: row.actual_sleep_onset,
        cycles_completed: row.cycles_completed,
        onset_latency_minutes: row.onset_latency_minutes,
        // DB onset_latency_flag is BOOLEAN (> 15 min); engine uses it only indirectly
        onset_latency_flag: null,
        night_waking_2_to_4am: row.night_waking_2_to_4am,
        arp_maintained: row.arp_maintained,
        disruption_event_id: row.disruption_event_id,
    }));
    // ── Map DailyLogs ─────────────────────────────────────────────────────────
    const dailyLogs = rawDailyLogs.map(row => ({
        id: row.id,
        user_id: row.user_id,
        date: row.date,
        mrm_count: row.mrm_count,
        crp_taken: row.crp_taken,
        crp_duration_minutes: row.crp_duration_minutes,
        crp_start_time: row.crp_start_time,
        crp_cycle_credited: row.crp_cycle_credited,
        crp_in_window: row.crp_in_window,
        caffeine_doses: row.caffeine_doses,
        caffeine_after_cutoff: row.caffeine_after_cutoff,
        morning_light_achieved: row.morning_light_achieved,
        evening_light_managed: row.evening_light_managed,
    }));
    // ── Map WeeklyCycleBalance ────────────────────────────────────────────────
    // day_number is stored in the DB; we use it directly.
    // The engine-runner will recompute and inject a fresh balance before detection.
    const weeklyBalance = weeklyBalanceRow
        ? {
            id: weeklyBalanceRow.id,
            user_id: weeklyBalanceRow.user_id,
            week_start: weeklyBalanceRow.week_start,
            nocturnal_cycles: weeklyBalanceRow.nocturnal_cycles,
            crp_cycles: weeklyBalanceRow.crp_cycles,
            weekly_cycle_total: weeklyBalanceRow.weekly_cycle_total,
            weekly_crp_total: weeklyBalanceRow.total_crp_cycles,
            cycle_deficit: weeklyBalanceRow.cycle_deficit,
            arp_stable: weeklyBalanceRow.arp_stable,
            deficit_risk_flag: weeklyBalanceRow.deficit_risk_flag,
            day_number: weeklyBalanceRow.day_number,
        }
        : null;
    // ── Map EventContexts ─────────────────────────────────────────────────────
    const events = rawEvents.map(row => ({
        id: row.id,
        user_id: row.user_id,
        event_type: toEventType(row.event_type),
        start_date: row.start_date,
        end_date: row.end_date,
        active: row.active,
        timezone_offset_hours: row.timezone_offset_hours,
        cycle_floor_override: row.cycle_floor_override,
        arp_locked: row.arp_locked,
    }));
    // ── Map EnvironmentContext ────────────────────────────────────────────────
    const environment = environmentRow
        ? {
            id: environmentRow.id,
            user_id: environmentRow.user_id,
            bedroom_temperature: toBedroomTemp(environmentRow.bedroom_temperature),
            evening_light_environment: toEveningLight(environmentRow.evening_light_environment),
            tv_in_bedroom: environmentRow.tv_in_bedroom,
            work_items_in_bedroom: environmentRow.work_items_in_bedroom,
            blackout_provision: environmentRow.blackout_provision,
            dws_device: environmentRow.dws_device,
            environment_friction_score: environmentRow.environment_friction_score,
            blackout_without_dws: environmentRow.blackout_without_dws,
        }
        : null;
    // ── Map Cooldowns ─────────────────────────────────────────────────────────
    const cooldowns = rawCooldowns.map(row => ({
        rec_type: row.rec_type,
        last_delivered_at: row.last_triggered_at, // DB: last_triggered_at
        dismissed_count: row.dismissed_count,
    }));
    // ── App usage days ────────────────────────────────────────────────────────
    const appUsageDays = daysBetween(userRow.created_at.slice(0, 10), today) + 1;
    return {
        now: evaluationTime,
        today,
        profile,
        arp_config: arpConfig,
        sleep_logs: sleepLogs,
        daily_logs: dailyLogs,
        weekly_balance: weeklyBalance,
        events,
        environment,
        cooldowns,
        app_usage_days: appUsageDays,
    };
}
//# sourceMappingURL=assembler.js.map