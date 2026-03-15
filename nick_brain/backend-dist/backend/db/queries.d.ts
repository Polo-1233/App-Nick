/**
 * R90 Backend — Database Read Queries
 *
 * All functions return typed records ready for the EngineContext assembler.
 * TIME values from Supabase are "HH:MM:SS" — use toHHMM() to normalise.
 */
import type { AppClient } from "./client.js";
/** Supabase returns TIME columns as "HH:MM:SS". Strip seconds → "HH:MM". */
export declare function toHHMM(t: string | null | undefined): string | null;
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
    stress_level: string | null;
    sleep_environment: string | null;
    exercise_frequency: string | null;
    alcohol_use: string | null;
    work_start_time: string | null;
    lifestyle_updated_at: string | null;
}
export interface LifeEventRow {
    id: string;
    user_id: string;
    event_type: string;
    title: string;
    event_date: string;
    end_date: string | null;
    notes: string | null;
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
    mood_score: number | null;
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
export declare function fetchUser(client: AppClient, userId: string): Promise<UserRow | null>;
export declare function fetchUserProfile(client: AppClient, userId: string): Promise<UserProfileRow | null>;
export declare function fetchARPConfig(client: AppClient, userId: string): Promise<ARPConfigRow | null>;
/**
 * Fetch recent sleep logs for a user, sorted descending (most recent first).
 * @param days  How many days to look back (default 10 — enough for rolling week + buffer)
 */
export declare function fetchRecentSleepLogs(client: AppClient, userId: string, days?: number): Promise<SleepLogRow[]>;
/**
 * Fetch recent daily logs, sorted descending.
 */
export declare function fetchRecentDailyLogs(client: AppClient, userId: string, days?: number): Promise<DailyLogRow[]>;
/**
 * Fetch the current active weekly balance (status = 'active').
 * Returns the most recent one if multiple exist (shouldn't happen).
 */
export declare function fetchActiveWeeklyBalance(client: AppClient, userId: string): Promise<WeeklyBalanceRow | null>;
/**
 * Fetch all active event contexts for a user.
 */
export declare function fetchActiveEvents(client: AppClient, userId: string): Promise<EventContextRow[]>;
/**
 * Fetch the environment context for a user (1:1 relationship).
 */
export declare function fetchEnvironmentContext(client: AppClient, userId: string): Promise<EnvironmentContextRow | null>;
/**
 * Fetch all recommendation cooldowns for a user.
 */
export declare function fetchCooldowns(client: AppClient, userId: string): Promise<RecommendationCooldownRow[]>;
/**
 * Fetch recent life events for a user (last 14 days + next 7 days).
 * Used to inject upcoming/recent events into the LLM context.
 */
export declare function fetchRecentLifeEvents(client: AppClient, userId: string, lookbackDays?: number, lookaheadDays?: number): Promise<LifeEventRow[]>;
