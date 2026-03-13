/**
 * api.ts - HTTP client for the nick_brain backend.
 *
 * All data flows through this module. UI components never call fetch directly.
 *
 * Architecture:
 *   Mobile app -> api.ts -> nick_brain backend (HTTP + JWT) -> Supabase DB
 *
 * Base URL:
 *   Development: http://localhost:3000 (iOS Simulator) or http://10.0.2.2:3000 (Android Emulator)
 *   Production: set EXPO_PUBLIC_NICK_BRAIN_API_URL in environment
 *
 * Auth:
 *   Every request (except /health) includes the Supabase JWT as Bearer token.
 *   getAccessToken() from supabase.ts handles auto-refresh.
 */

import { Platform } from 'react-native';
import { getAccessToken } from './supabase';

// ─── Config ───────────────────────────────────────────────────────────────────

const LOCALHOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const DEV_BASE_URL = `http://${LOCALHOST}:3000`;

// Production URL — hardcoded fallback so the app works even if .env isn't loaded
const PROD_URL = "https://app-nick-production.up.railway.app";

const ENV_BASE_URL = process.env.EXPO_PUBLIC_NICK_BRAIN_API_URL?.trim();

export const BASE_URL =
  ENV_BASE_URL && ENV_BASE_URL.length > 0
    ? ENV_BASE_URL.replace(/\/+$/, '')
    : __DEV__ ? DEV_BASE_URL : PROD_URL;

// ─── Core HTTP helper ─────────────────────────────────────────────────────────

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  status: number;
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  skipAuth = false,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!skipAuth) {
    const token = await getAccessToken();
    if (!token) {
      return { ok: false, error: 'Not authenticated', code: 'NO_AUTH', status: 401 };
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const resp = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await resp.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text };
    }

    if (!resp.ok) {
      const err = json as { error?: string; code?: string };
      return {
        ok: false,
        error: err.error ?? `HTTP ${resp.status}`,
        code: err.code,
        status: resp.status,
      };
    }

    return { ok: true, data: json as T, status: resp.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, error: msg, code: 'NETWORK_ERROR', status: 0 };
  }
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body: unknown) => request<T>('POST', path, body);

// ─── /users ───────────────────────────────────────────────────────────────────

export interface CreateUserResponse {
  user_id: string;
  is_new: boolean;
}

/**
 * Bootstrap the backend user record after Supabase signup.
 * Idempotent - safe to call multiple times.
 */
export async function bootstrapUser(timezone?: string): Promise<ApiResponse<CreateUserResponse>> {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return post<CreateUserResponse>('/users', { timezone: tz });
}

// ─── /profile ─────────────────────────────────────────────────────────────────

export interface ProfileUpdateInput {
  arp_time?: string; // "HH:MM"
  arp_committed?: boolean;
  chronotype?: 'AMer' | 'PMer' | 'In-betweener' | 'Unknown';
  cycle_target?: number;
  onboarding_step?: number;
  onboarding_completed?: boolean;
  caffeine_use?: 'none' | 'low' | 'moderate' | 'high';
  tracker_in_use?: boolean;
  occupation_schedule?: 'standard' | 'early_starts' | 'flexible' | 'freelance' | 'shift_work';
  // Fields collected during the in-app R-Lo conversation (steps 6–9)
  first_name?: string;
  self_reported_wake_time?: string; // "HH:MM"
  sleep_main_issue?: string;
  chronotype_estimate?: string;     // e.g. "7–8"
}

export async function updateProfile(input: ProfileUpdateInput): Promise<ApiResponse<{ ok: boolean }>> {
  return post('/profile', input);
}

// ─── /screen/home ─────────────────────────────────────────────────────────────

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

export interface RecommendationOutput {
  id: string;
  rec_type: string;
  priority: number;
  priority_label: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  triggered_by: string | null;
  suppression_reason: string | null;
  action_payload: Record<string, unknown>;
  message_key: string;
}

export interface DetectedState {
  state_id: string;
  priority: number;
  priority_label: string;
  active_days: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ARPConfig {
  arp_time: string;
  cycle_times: string[];
  crp_window_open: string;
  crp_window_close: string;
  sleep_onset_6cycle: string;
  sleep_onset_5cycle: string;
  sleep_onset_4cycle: string;
  sleep_onset_3cycle: string;
  mrm_times: string[];
  phase_1_start: string;
  phase_2_start: string;
  phase_3_start: string;
  phase_4_start: string;
}

export interface HomeScreenPayload {
  user_id: string;
  today: string;
  arp_time: string | null;
  tonight_sleep_onset: string | null;
  fallback_onset: string | null;
  floor_onset: string | null;
  current_phase: number | null;
  current_cycle: number | null;
  weekly_balance: WeeklyBalanceSummary | null;
  gate_blocked: boolean;
  gate_reason: string | null;
  active_states: DetectedState[];
  primary_recommendation: RecommendationOutput | null;
  additional_recommendations: RecommendationOutput[];
  tone_override_active: boolean;
  show_cycle_count: boolean;
  show_deficit_warning: boolean;
  arp_config: ARPConfig | null;
}

export async function getHomeScreenPayload(): Promise<ApiResponse<HomeScreenPayload>> {
  return get('/screen/home');
}

// ─── /screen/day-plan ─────────────────────────────────────────────────────────

export interface CycleTimelineEntry {
  cycle: number;
  time: string;
  phase: number;
  label: string;
  type: string;
  is_crp_window: boolean;
  is_sleep_onset: boolean;
}

export interface DayPlanPayload {
  date: string;
  arp_time: string;
  cycle_timeline: CycleTimelineEntry[];
  crp_window: { open: string; close: string };
  sleep_onset: { '6cycle': string; '5cycle': string; '4cycle': string; '3cycle': string };
  phase_boundaries: { '1': string; '2': string; '3': string; '4': string };
  notification_schedule: Array<{
    time: string;
    type: string;
    message_key: string;
    payload: Record<string, unknown>;
  }>;
}

export async function getDayPlanPayload(date?: string): Promise<ApiResponse<DayPlanPayload>> {
  const query = date ? `?date=${date}` : '';
  return get(`/screen/day-plan${query}`);
}

// ─── /screen/checkin ──────────────────────────────────────────────────────────

export interface CheckInQuestion {
  id: string;
  type: 'boolean' | 'number' | 'scale';
  label_key: string;
  min?: number;
  max?: number;
}

export interface CheckInPayload {
  daily_log_date: string;
  questions: CheckInQuestion[];
  prefilled: Record<string, unknown>;
  active_states: DetectedState[];
  show_crp_question: boolean;
}

export async function getCheckInPayload(): Promise<ApiResponse<CheckInPayload>> {
  return get('/screen/checkin');
}

// ─── /logs/sleep ──────────────────────────────────────────────────────────────

export interface SleepLogInput {
  date: string; // "YYYY-MM-DD"
  wake_time?: string; // "HH:MM"
  actual_sleep_onset?: string; // "HH:MM"
  cycles_completed?: number | null;
  onset_latency_minutes?: number;
  night_waking_2_to_4am?: boolean;
  pre_sleep_routine_done?: boolean;
  post_sleep_routine_done?: boolean;
  subjective_energy_on_waking?: number; // 1-5
  notes?: string;
}

export async function submitSleepLog(input: SleepLogInput): Promise<ApiResponse<{ ok: boolean }>> {
  return post('/logs/sleep', input);
}

// ─── /logs/checkin ────────────────────────────────────────────────────────────

export interface CheckInInput {
  date: string;
  mrm_count?: number;
  morning_light_achieved?: boolean;
  evening_light_managed?: boolean;
  subjective_energy_midday?: number;
  crp_taken?: boolean;
  crp_duration_minutes?: number;
  crp_start_time?: string;
}

export async function submitCheckIn(input: CheckInInput): Promise<ApiResponse<{ ok: boolean }>> {
  return post('/logs/checkin', input);
}

// ─── /logs/daily ─────────────────────────────────────────────────────────────

export interface DailyLogInput {
  date: string;
  mrm_count?: number;
  crp_taken?: boolean;
  crp_duration_minutes?: number;
  crp_start_time?: string;
  morning_light_achieved?: boolean;
  evening_light_managed?: boolean;
  caffeine_doses?: number;
  caffeine_last_time?: string;
  subjective_energy_midday?: number;
  subjective_energy_evening?: number;
}

export async function submitDailyLog(input: DailyLogInput): Promise<ApiResponse<{ ok: boolean }>> {
  return post('/logs/daily', input);
}

// ─── /actions/recommendation ──────────────────────────────────────────────────

export async function actionRecommendation(
  recommendationId: string,
  action: 'actioned' | 'dismissed',
): Promise<ApiResponse<{ ok: boolean }>> {
  return post('/actions/recommendation', {
    recommendation_id: recommendationId,
    action,
  });
}

// ─── /health ──────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/health`);
    return resp.ok;
  } catch {
    return false;
  }
}