/**
 * R90 Engine — TypeScript Types
 * Mirrors the Supabase schema enums and tables.
 * All engine functions are pure: they accept an EngineContext and return outputs.
 */

// ─── Enums (mirror PostgreSQL enums in 001_r90_schema.sql) ──────────────────

export type Chronotype = "AMer" | "PMer" | "In-betweener" | "Unknown";

export type UserStateId =
  | "US-01" | "US-02" | "US-03" | "US-04" | "US-05"
  | "US-06" | "US-07" | "US-08" | "US-09" | "US-10"
  | "US-11" | "US-12" | "US-13" | "US-14" | "US-15"
  | "US-16" | "US-17";

export type RecommendationType =
  | "REC-01" | "REC-02" | "REC-03" | "REC-04" | "REC-05"
  | "REC-06" | "REC-07" | "REC-08" | "REC-09" | "REC-10"
  | "REC-11" | "REC-12" | "REC-13" | "REC-14" | "REC-15"
  | "REC-16" | "REC-17" | "REC-18" | "REC-19" | "REC-20"
  | "REC-21" | "REC-22" | "REC-23" | "REC-24" | "REC-25"
  | "REC-26";

export type PriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type OnsetLatencyFlag = "easy" | "difficult" | "over_15_min";

export type EventType =
  | "travel"
  | "illness"
  | "injury"
  | "social_disruption"
  | "shift_change"
  | "pre_event";

export type BedroomTemperature = "cool" | "comfortable" | "hot" | "variable";

export type EveningLightEnvironment = "bright_blue" | "amber_managed" | "mixed";

export type OccupationSchedule =
  | "standard"
  | "early_starts"
  | "flexible"
  | "freelance"
  | "shift_work";

// ─── ARP Config ─────────────────────────────────────────────────────────────

export interface ARPConfig {
  arp_time: string;          // "HH:MM" 24h
  cycle_times: string[];     // 16 entries: C1..C16 ("HH:MM")
  crp_window_open: string;   // C6 time
  crp_window_close: string;  // C9 time
  sleep_onset_6cycle: string;
  sleep_onset_5cycle: string;
  sleep_onset_4cycle: string;
  sleep_onset_3cycle: string;
  mrm_times: string[];       // waking cycle boundaries (C1..C9 approx)
  phase_1_start: string;     // ARP (C1)
  phase_2_start: string;     // C5
  phase_3_start: string;     // C9
  phase_4_start: string;     // C13 (sleep onset for 5 cycles)
  generated_at: string;      // ISO timestamp
}

// ─── Domain Records (input snapshots, not DB row types) ─────────────────────

export interface UserProfile {
  id: string;
  user_id: string;
  arp_committed: boolean;
  arp_time: string | null;           // "HH:MM"
  chronotype: Chronotype;
  tracker_in_use: boolean;
  user_reported_tracker_anxiety: boolean;
  user_reported_anxiety: boolean;
  user_reported_screen_use_in_phase_3: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  caffeine_use: "none" | "low" | "moderate" | "high" | null;
  occupation_schedule: OccupationSchedule | null;
  multishift_enabled: boolean;
  shift_arp_day: string | null;
  shift_arp_night: string | null;
  active_shift: "day" | "night" | null;
  arp_committed_at: string | null;   // ISO date string
  profile_version: number;
  updated_at: string;
}

export interface SleepLog {
  id: string;
  user_id: string;
  date: string;                          // "YYYY-MM-DD"
  wake_time: string | null;             // "HH:MM"
  actual_sleep_onset: string | null;    // "HH:MM"
  cycles_completed: number | null;
  onset_latency_minutes: number | null;
  onset_latency_flag: OnsetLatencyFlag | null;
  night_waking_2_to_4am: boolean | null;
  arp_maintained: boolean | null;       // computed by engine, not trigger
  disruption_event_id: string | null;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;                          // "YYYY-MM-DD"
  mrm_count: number | null;
  crp_taken: boolean | null;
  crp_duration_minutes: number | null;
  crp_start_time: string | null;        // "HH:MM"
  crp_cycle_credited: boolean | null;   // computed by DB trigger
  crp_in_window: boolean | null;        // computed by engine
  caffeine_doses: number | null;
  caffeine_after_cutoff: boolean | null; // computed by engine
  morning_light_achieved: boolean | null;
  evening_light_managed: boolean | null;
}

export interface WeeklyCycleBalance {
  id: string;
  user_id: string;
  week_start: string;                   // "YYYY-MM-DD"
  nocturnal_cycles: (number | null)[];  // [7] one per day
  crp_cycles: (number | null)[];        // [7] one per day
  weekly_cycle_total: number;
  weekly_crp_total: number;
  cycle_deficit: number;
  arp_stable: boolean;
  deficit_risk_flag: boolean;
  /** Day number within the rolling week (1–7). Computed by engine-runner, not stored in DB. */
  day_number: number;
}

export interface EventContext {
  id: string;
  user_id: string;
  event_type: EventType;
  start_date: string;   // "YYYY-MM-DD"
  end_date: string | null;
  active: boolean;
  timezone_offset_hours: number | null;
  cycle_floor_override: number | null;
  arp_locked: boolean;
}

export interface EnvironmentContext {
  id: string;
  user_id: string;
  bedroom_temperature: BedroomTemperature | null;
  evening_light_environment: EveningLightEnvironment | null;
  tv_in_bedroom: boolean | null;
  work_items_in_bedroom: boolean | null;
  blackout_provision: boolean | null;
  dws_device: boolean | null;
  environment_friction_score: number | null; // computed by DB trigger
  blackout_without_dws: boolean | null;       // computed by DB trigger
}

export interface RecommendationCooldown {
  rec_type: RecommendationType;
  last_delivered_at: string | null; // ISO timestamp
  dismissed_count: number;
}

// ─── Engine Context (pre-assembled snapshot passed to runEngine) ─────────────

export interface EngineContext {
  now: string;                    // ISO timestamp of engine evaluation
  today: string;                  // "YYYY-MM-DD"
  profile: UserProfile;
  arp_config: ARPConfig | null;
  sleep_logs: SleepLog[];         // last 7+ days, sorted descending (most recent first)
  daily_logs: DailyLog[];         // last 7+ days, sorted descending
  weekly_balance: WeeklyCycleBalance | null;
  events: EventContext[];
  environment: EnvironmentContext | null;
  cooldowns: RecommendationCooldown[];
  app_usage_days: number;         // days since first login
}

// ─── Engine Output ───────────────────────────────────────────────────────────

export type GateReason =
  | "no_arp_committed"
  | "no_logs"
  | "stale_config";

export interface DetectedState {
  state_id: UserStateId;
  priority: number;          // 1 = highest
  priority_label: PriorityLevel;
  active_days: number;       // how long in this state
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface RecommendationOutput {
  id: string;                // UUID generated by engine
  rec_type: RecommendationType;
  priority: number;
  priority_label: PriorityLevel;
  triggered_by: UserStateId | null;
  suppression_reason: string | null;
  action_payload: Record<string, unknown>;
  message_key: string;       // key into coaching copy system
}

export interface WeeklyAccountingOutput {
  weekly_cycle_total: number;
  weekly_crp_total: number;
  nocturnal_total: number;
  cycle_deficit: number;
  pace_deficit: number;
  projected_end_total: number;
  on_track: boolean;
  deficit_risk_flag: boolean;
  arp_stable: boolean;
  mrm_weekly_total: number;
  day_number: number;
}

export interface ToneOverride {
  active: boolean;
  reason: UserStateId | null;
  suppress_outcome_metrics: boolean;
  suppress_cycle_count_comparison: boolean;
}

export interface EngineOutput {
  // Gate signals
  gate_blocked: boolean;
  gate_reason: GateReason | null;

  // States
  active_states: DetectedState[];

  // Recommendations (max 5; REC-01 and REC-20 exempt from cap)
  recommendations: RecommendationOutput[];

  // Derived signals for UI layer
  tone_override: ToneOverride;
  show_cycle_count: boolean;
  show_deficit_warning: boolean;
  weekly_accounting: WeeklyAccountingOutput | null;

  // ARP config (echoed for UI convenience)
  arp_config: ARPConfig | null;

  // Engine metadata
  evaluated_at: string;
  engine_version: string;
}
