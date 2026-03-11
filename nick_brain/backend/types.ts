/**
 * R90 Backend — Request / Response Types
 *
 * These are the shapes the API layer consumes and returns.
 * Engine types are imported from the engine package.
 */

import type {
  Chronotype,
  EventType,
  OccupationSchedule,
  BedroomTemperature,
  EveningLightEnvironment,
  DetectedState,
  RecommendationOutput,
  WeeklyAccountingOutput,
  ToneOverride,
  ARPConfig,
  GateReason,
} from "../engine/types.js";

// ─── Service Result Wrapper ───────────────────────────────────────────────────

export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ─── Log Submission Inputs ────────────────────────────────────────────────────

export interface SleepLogInput {
  date: string;                          // "YYYY-MM-DD"
  wake_time?: string;                    // "HH:MM" — defaults to ARP if omitted
  actual_sleep_onset?: string;           // "HH:MM"
  cycles_completed?: number | null;      // null = unknown (valid, not 0)
  onset_latency_minutes?: number;
  night_waking_2_to_4am?: boolean;
  pre_sleep_routine_done?: boolean;
  post_sleep_routine_done?: boolean;
  subjective_energy_on_waking?: number;  // 1–5
  disruption_event_id?: string;
  notes?: string;
}

export interface DailyLogInput {
  date: string;                          // "YYYY-MM-DD"
  mrm_count?: number;                    // 0–12
  crp_taken?: boolean;
  crp_duration_minutes?: number;
  crp_start_time?: string;              // "HH:MM"
  morning_light_achieved?: boolean;
  evening_light_managed?: boolean;
  caffeine_doses?: number;
  caffeine_last_time?: string;          // "HH:MM"
  caffeine_after_cutoff?: boolean;      // client may set directly; overridden if caffeine_last_time provided
  subjective_energy_midday?: number;    // 1–5
  subjective_energy_evening?: number;   // 1–5
  disruption_event_id?: string;
}

/**
 * CheckInInput — lightweight daily log entry (max 3 questions).
 * Submitted from the Check-In screen; written to daily_logs.
 */
export interface CheckInInput {
  date: string;                        // "YYYY-MM-DD"
  mrm_count?: number;
  morning_light_achieved?: boolean;
  evening_light_managed?: boolean;
  subjective_energy_midday?: number;
  crp_taken?: boolean;
  crp_duration_minutes?: number;
  crp_start_time?: string;
}

export interface EventInput {
  event_type: EventType;
  start_date: string;                  // "YYYY-MM-DD"
  end_date?: string;
  destination_timezone?: string;
  timezone_offset_hours?: number;
  cycle_floor_override?: number;
  notes?: string;
}

export interface ProfileUpdateInput {
  arp_time?: string;
  arp_committed?: boolean;
  chronotype?: Chronotype;
  cycle_target?: number;
  caffeine_use?: "none" | "low" | "moderate" | "high";
  tracker_in_use?: boolean;
  user_reported_anxiety?: boolean;
  user_reported_tracker_anxiety?: boolean;
  user_reported_screen_use?: boolean;
  occupation_schedule?: OccupationSchedule;
  onboarding_step?: number;
  onboarding_completed?: boolean;
}

export interface EnvironmentInput {
  bedroom_temperature?: BedroomTemperature;
  evening_light_environment?: EveningLightEnvironment;
  tv_in_bedroom?: boolean;
  work_items_in_bedroom?: boolean;
  blackout_provision?: boolean;
  dws_device?: boolean;
}

// ─── Screen Payload Types ─────────────────────────────────────────────────────

export interface WeeklyBalanceSummary {
  total: number;
  target: number;
  floor: number;
  deficit: number;
  pace_deficit: number;
  deficit_risk: boolean;
  day_number: number;
  on_track: boolean;
}

export interface HomeScreenPayload {
  user_id: string;
  today: string;
  arp_time: string | null;
  tonight_sleep_onset: string | null;    // recommended onset for tonight
  fallback_onset: string | null;         // miss the bus? catch next one
  floor_onset: string | null;            // absolute minimum
  current_phase: number | null;          // 1–4
  current_cycle: number | null;          // 1–16
  weekly_balance: WeeklyBalanceSummary | null;
  gate_blocked: boolean;
  gate_reason: GateReason | null;
  active_states: DetectedState[];
  primary_recommendation: RecommendationOutput | null;
  additional_recommendations: RecommendationOutput[];
  tone_override_active: boolean;
  show_cycle_count: boolean;
  show_deficit_warning: boolean;
  arp_config: ARPConfig | null;
}

export interface CycleTimelineEntry {
  cycle: number;
  time: string;
  phase: number;
  label: string;
  type: "arp" | "mrm" | "crp_window_open" | "crp_window_close" | "phase_boundary" | "sleep_onset";
  is_crp_window: boolean;
  is_sleep_onset: boolean;
}

export interface NotificationScheduleEntry {
  time: string;
  type: "arp_wake" | "mrm" | "crp_window_open" | "crp_window_close" | "phase_3_start" | "sleep_onset";
  message_key: string;
  payload: Record<string, unknown>;
}

export interface DayPlanPayload {
  date: string;
  arp_time: string;
  cycle_timeline: CycleTimelineEntry[];
  crp_window: { open: string; close: string };
  sleep_onset: { "6cycle": string; "5cycle": string; "4cycle": string; "3cycle": string };
  phase_boundaries: { "1": string; "2": string; "3": string; "4": string };
  notification_schedule: NotificationScheduleEntry[];
}

export interface CheckInQuestion {
  id: string;
  type: "boolean" | "number" | "scale";
  label_key: string;
  min?: number;
  max?: number;
}

export interface CheckInPayload {
  daily_log_date: string;
  questions: CheckInQuestion[];
  prefilled: Partial<CheckInInput>;
  active_states: DetectedState[];
  show_crp_question: boolean;
}

// ─── Recommendation Action ────────────────────────────────────────────────────

export type RecommendationAction = "actioned" | "dismissed";

export interface RecommendationActionInput {
  recommendation_id: string;
  action: RecommendationAction;
}
