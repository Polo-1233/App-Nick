-- =============================================================================
-- R90 ENGINE — SEED TEST DATA
-- Migration: 003_r90_seed_data  (DEV/TEST ONLY — do not run in production)
-- Date: 2026-03-11
-- Purpose: Populate 5 test users covering different states and scenarios.
-- =============================================================================
-- NOTE: These UUIDs are deterministic for test reproducibility.
--
-- auth_user_id values:
--   In production, auth_user_id references auth.users (populated by Supabase
--   Auth on signup). In this seed file we use valid, deterministic UUIDs that
--   do NOT exist in auth.users. This is safe because:
--     1. The schema defines auth_user_id as UUID UNIQUE NOT NULL with no
--        formal FK constraint to auth.users.
--     2. Migrations run as the postgres role, which bypasses RLS.
--     3. For authenticated-client testing, create real auth users via
--        supabase.auth.admin.createUser() and UPDATE users SET auth_user_id
--        to the returned id.
-- =============================================================================

-- =============================================================================
-- TEST USER 1: "Alice" — Aligned user, 5-cycle AMer, stable ARP
-- Represents: US-01 (Aligned), ideal state
-- =============================================================================

INSERT INTO users (id, auth_user_id, onboarding_completed, onboarding_step, timezone) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'aa110000-0000-0000-0000-000000000001', TRUE, 5, 'Europe/London');

INSERT INTO user_profiles (id, user_id, arp_committed, arp_time, chronotype, chronotype_confidence, cycle_target, caffeine_use, caffeine_cutoff_time, tracker_in_use, sleep_partner, schedule_consistency) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   TRUE, '06:30', 'AMer', 'self_reported', 5, 'moderate', '14:00', FALSE, TRUE, 'consistent');

INSERT INTO arp_configs (id, user_id, arp_time, cycle_times, phase_1_start, phase_2_start, phase_3_start, phase_4_start, crp_window_open, crp_window_close, sleep_onset_6cycle, sleep_onset_5cycle, sleep_onset_4cycle, sleep_onset_3cycle, pre_sleep_window_open, pre_sleep_window_ideal, pre_sleep_window_floor, deep_sleep_window_open, deep_sleep_window_close, mrm_times) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   '06:30',
   ARRAY['06:30','08:00','09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30','23:00','00:30','02:00','03:30','05:00']::TIME[],
   '06:30', '12:30', '18:30', '00:30',
   '14:00', '18:30',
   '21:30', '23:00', '00:30', '02:00',
   '21:30', '23:00', '00:30',
   '23:00', '02:00',
   ARRAY['08:00','09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30']::TIME[]);

INSERT INTO environment_contexts (id, user_id, bedroom_temperature, blackout_provision, dws_device, morning_light_access, evening_light_environment, tv_in_bedroom, work_items_in_bedroom) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'cool', TRUE, TRUE, 'outdoor', 'amber_managed', FALSE, FALSE);

-- Alice's week: solid 5-cycle nights, good CRP and MRM adherence
INSERT INTO sleep_logs (id, user_id, date, intended_sleep_onset, actual_sleep_onset, wake_time, arp_maintained, cycles_completed, onset_latency_minutes, night_wakings, pre_sleep_routine_done, post_sleep_routine_done, subjective_energy_on_waking) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-05', '23:00', '23:05', '06:30', TRUE, 5, 5, 0, TRUE, TRUE, 4),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-06', '23:00', '22:55', '06:30', TRUE, 5, 10, 0, TRUE, TRUE, 4),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-07', '23:00', '23:10', '06:35', TRUE, 5, 8, 0, TRUE, TRUE, 5),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-08', '23:00', '23:00', '06:30', TRUE, 5, 5, 0, TRUE, TRUE, 4),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-09', '23:00', '23:15', '06:30', TRUE, 5, 12, 1, TRUE, TRUE, 3),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-10', '23:00', '23:00', '06:30', TRUE, 5, 5, 0, TRUE, TRUE, 4),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-11', '23:00', '23:05', '06:30', TRUE, 5, 7, 0, TRUE, TRUE, 4);

INSERT INTO daily_logs (id, user_id, date, crp_taken, crp_count, crp_duration_minutes, crp_start_time, mrm_count, morning_light_achieved, evening_light_managed, caffeine_doses, caffeine_last_time) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-05', TRUE, 1, 30, '14:30', 7, TRUE, TRUE, 2, '13:00'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-06', TRUE, 1, 30, '14:00', 8, TRUE, TRUE, 2, '12:30'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-07', TRUE, 1, 20, '15:00', 7, TRUE, TRUE, 1, '11:00'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-08', FALSE, 0, NULL, NULL, 6, TRUE, TRUE, 2, '13:30'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-09', TRUE, 1, 30, '14:00', 7, TRUE, TRUE, 1, '10:00'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-10', TRUE, 1, 30, '14:30', 7, TRUE, TRUE, 2, '13:00'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-11', TRUE, 1, 30, '14:00', 6, TRUE, TRUE, 2, '12:00');

INSERT INTO weekly_cycle_balances (id, user_id, week_start, week_end, day_number, status, nocturnal_cycles, crp_cycles, total_nocturnal_cycles, total_crp_cycles, weekly_cycle_total, cycle_deficit, projected_weekly_total, on_track, deficit_risk_flag, mrm_total, crp_count_total, arp_variance_minutes, arp_stable) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', '2026-03-05', '2026-03-11', 7, 'closed',
   '{5,5,5,5,5,5,5}', '{1,1,1,0,1,1,1}', 35, 6, 41, -6, 41, TRUE, FALSE, 48, 6, 5, TRUE);

INSERT INTO user_states (id, user_id, state_id, active, priority, trigger_signals, detection_source) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 'US-01', TRUE, 5,
   ARRAY['weekly_cycle_total: 41', 'arp_stable: true', 'mrm_avg: 6.9/day'], 'weekly_balance');

-- =============================================================================
-- TEST USER 2: "Bob" — Mild deficit PMer, needs CRP nudge
-- Represents: US-02 (Mild Cycle Deficit), US-05 (Chronotype Conflict)
-- =============================================================================

INSERT INTO users (id, auth_user_id, onboarding_completed, onboarding_step, timezone) VALUES
  ('a1000000-0000-0000-0000-000000000002', 'aa110000-0000-0000-0000-000000000002', TRUE, 5, 'Europe/London');

INSERT INTO user_profiles (id, user_id, arp_committed, arp_time, chronotype, cycle_target, caffeine_use, caffeine_cutoff_time, tracker_in_use, sleep_partner) VALUES
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   TRUE, '06:30', 'PMer', 5, 'high', '16:00', FALSE, FALSE);

INSERT INTO arp_configs (id, user_id, arp_time, cycle_times, phase_1_start, phase_2_start, phase_3_start, phase_4_start, crp_window_open, crp_window_close, sleep_onset_6cycle, sleep_onset_5cycle, sleep_onset_4cycle, sleep_onset_3cycle, pre_sleep_window_open, pre_sleep_window_ideal, pre_sleep_window_floor, deep_sleep_window_open, deep_sleep_window_close, mrm_times) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   '06:30',
   ARRAY['06:30','08:00','09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30','23:00','00:30','02:00','03:30','05:00']::TIME[],
   '06:30', '12:30', '18:30', '00:30',
   '14:00', '18:30',
   '21:30', '23:00', '00:30', '02:00',
   '21:30', '23:00', '00:30',
   '23:00', '02:00',
   ARRAY['08:00','09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30']::TIME[]);

INSERT INTO environment_contexts (id, user_id, bedroom_temperature, blackout_provision, dws_device, morning_light_access, evening_light_environment, tv_in_bedroom, work_items_in_bedroom) VALUES
  ('d1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   'comfortable', TRUE, FALSE, 'window', 'mixed', FALSE, FALSE);

-- Bob: 4-cycle nights, no CRPs — mild deficit mid-week
INSERT INTO sleep_logs (id, user_id, date, intended_sleep_onset, actual_sleep_onset, wake_time, arp_maintained, cycles_completed, onset_latency_minutes, night_wakings, subjective_energy_on_waking) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', '2026-03-09', '23:00', '00:45', '06:30', TRUE, 4, 20, 0, 3),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', '2026-03-10', '23:00', '00:30', '06:30', TRUE, 4, 15, 1, 3),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', '2026-03-11', '23:00', '01:00', '06:25', TRUE, 4, 25, 0, 2);

INSERT INTO daily_logs (id, user_id, date, crp_taken, crp_count, mrm_count, morning_light_achieved, evening_light_managed, caffeine_doses, caffeine_last_time) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', '2026-03-09', FALSE, 0, 3, FALSE, FALSE, 4, '16:30'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', '2026-03-10', FALSE, 0, 4, TRUE, FALSE, 3, '15:00'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', '2026-03-11', FALSE, 0, 2, FALSE, FALSE, 4, '17:00');

INSERT INTO weekly_cycle_balances (id, user_id, week_start, week_end, day_number, status, nocturnal_cycles, crp_cycles, total_nocturnal_cycles, total_crp_cycles, weekly_cycle_total, cycle_deficit, projected_weekly_total, on_track, deficit_risk_flag, mrm_total, crp_count_total, arp_variance_minutes, arp_stable) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', '2026-03-09', '2026-03-15', 3, 'active',
   '{4,4,4,0,0,0,0}', '{0,0,0,0,0,0,0}', 12, 0, 12, 23, 32, TRUE, FALSE, 9, 0, 5, TRUE);

INSERT INTO user_states (id, user_id, state_id, active, priority, trigger_signals, detection_source) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', 'US-02', TRUE, 3,
   ARRAY['weekly_cycle_total: 12', 'day_number: 3', 'no_crp_taken'], 'weekly_balance'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', 'US-05', TRUE, 3,
   ARRAY['chronotype: PMer', 'arp_time: 06:30 (< 07:00)'], 'user_report');

-- =============================================================================
-- TEST USER 3: "Carol" — Sleep anxiety loop, high onset latency
-- Represents: US-07 (Sleep Anxiety Loop — CRITICAL), US-08 (Electronic Insomnia)
-- =============================================================================

INSERT INTO users (id, auth_user_id, onboarding_completed, onboarding_step, timezone) VALUES
  ('a1000000-0000-0000-0000-000000000003', 'aa110000-0000-0000-0000-000000000003', TRUE, 5, 'America/New_York');

INSERT INTO user_profiles (id, user_id, arp_committed, arp_time, chronotype, cycle_target, caffeine_use, caffeine_cutoff_time, tracker_in_use, user_reported_anxiety, user_reported_screen_use) VALUES
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
   TRUE, '07:00', 'In-betweener', 5, 'low', '14:00', TRUE, TRUE, TRUE);

INSERT INTO arp_configs (id, user_id, arp_time, cycle_times, phase_1_start, phase_2_start, phase_3_start, phase_4_start, crp_window_open, crp_window_close, sleep_onset_6cycle, sleep_onset_5cycle, sleep_onset_4cycle, sleep_onset_3cycle, pre_sleep_window_open, pre_sleep_window_ideal, pre_sleep_window_floor, deep_sleep_window_open, deep_sleep_window_close, mrm_times) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
   '07:00',
   ARRAY['07:00','08:30','10:00','11:30','13:00','14:30','16:00','17:30','19:00','20:30','22:00','23:30','01:00','02:30','04:00','05:30']::TIME[],
   '07:00', '13:00', '19:00', '01:00',
   '14:30', '19:00',
   '22:00', '23:30', '01:00', '02:30',
   '22:00', '23:30', '01:00',
   '23:30', '02:30',
   ARRAY['08:30','10:00','11:30','13:00','14:30','16:00','17:30','19:00','20:30','22:00']::TIME[]);

INSERT INTO environment_contexts (id, user_id, bedroom_temperature, blackout_provision, dws_device, morning_light_access, evening_light_environment, tv_in_bedroom, work_items_in_bedroom) VALUES
  ('d1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
   'variable', FALSE, FALSE, 'none', 'bright_blue', TRUE, TRUE);

-- Carol: high onset latency 3 consecutive nights, screen use, anxiety
INSERT INTO sleep_logs (id, user_id, date, intended_sleep_onset, actual_sleep_onset, wake_time, arp_maintained, cycles_completed, onset_latency_minutes, night_wakings, night_waking_2_to_4am, pre_sleep_routine_done, subjective_energy_on_waking) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', '2026-03-09', '23:30', '00:15', '07:00', TRUE, 4, 45, 2, TRUE, FALSE, 2),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', '2026-03-10', '23:30', '00:30', '07:00', TRUE, 4, 60, 1, FALSE, FALSE, 2),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', '2026-03-11', '23:30', '00:45', '07:05', TRUE, 4, 75, 3, TRUE, FALSE, 1);

INSERT INTO daily_logs (id, user_id, date, crp_taken, crp_count, mrm_count, morning_light_achieved, evening_light_managed, caffeine_doses, caffeine_last_time) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', '2026-03-09', FALSE, 0, 2, FALSE, FALSE, 1, '10:00'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', '2026-03-10', FALSE, 0, 1, FALSE, FALSE, 1, '09:00'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', '2026-03-11', FALSE, 0, 3, FALSE, FALSE, 0, NULL);

INSERT INTO user_states (id, user_id, state_id, active, priority, trigger_signals, detection_source) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 'US-07', TRUE, 1,
   ARRAY['onset_latency: [45, 60, 75] over 3 nights', 'user_reported_anxiety: true'], 'sleep_log'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 'US-08', TRUE, 2,
   ARRAY['user_reported_screen_use: true', 'pre_sleep_routine_done: false x3'], 'sleep_log'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 'US-11', TRUE, 3,
   ARRAY['environment_friction_score: 4 (temp+light+TV+work)'], 'onboarding');

-- =============================================================================
-- TEST USER 4: "Dave" — Post-travel recovery with active event context
-- Represents: US-06 (Post-Disruption), active EventContext
-- =============================================================================

INSERT INTO users (id, auth_user_id, onboarding_completed, onboarding_step, timezone) VALUES
  ('a1000000-0000-0000-0000-000000000004', 'aa110000-0000-0000-0000-000000000004', TRUE, 5, 'Europe/London');

INSERT INTO user_profiles (id, user_id, arp_committed, arp_time, chronotype, cycle_target, caffeine_use, caffeine_cutoff_time, tracker_in_use, sleep_partner, travel_frequency) VALUES
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
   TRUE, '06:00', 'AMer', 5, 'moderate', '13:00', FALSE, TRUE, 'weekly');

INSERT INTO arp_configs (id, user_id, arp_time, cycle_times, phase_1_start, phase_2_start, phase_3_start, phase_4_start, crp_window_open, crp_window_close, sleep_onset_6cycle, sleep_onset_5cycle, sleep_onset_4cycle, sleep_onset_3cycle, pre_sleep_window_open, pre_sleep_window_ideal, pre_sleep_window_floor, deep_sleep_window_open, deep_sleep_window_close, mrm_times) VALUES
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
   '06:00',
   ARRAY['06:00','07:30','09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00','22:30','00:00','01:30','03:00','04:30']::TIME[],
   '06:00', '12:00', '18:00', '00:00',
   '13:30', '18:00',
   '21:00', '22:30', '00:00', '01:30',
   '21:00', '22:30', '00:00',
   '22:30', '01:30',
   ARRAY['07:30','09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00']::TIME[]);

INSERT INTO environment_contexts (id, user_id, bedroom_temperature, blackout_provision, dws_device, morning_light_access, evening_light_environment, tv_in_bedroom, work_items_in_bedroom) VALUES
  ('d1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
   'cool', TRUE, TRUE, 'dws', 'amber_managed', FALSE, FALSE);

-- Dave's active travel event (must be inserted BEFORE sleep_logs/daily_logs that reference it)
INSERT INTO event_contexts (id, user_id, event_type, severity, start_date, end_date, destination_timezone, timezone_offset_hours, direction, expected_recovery_days, cycle_floor_override, arp_locked) VALUES
  ('e1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
   'travel', 'moderate', '2026-03-08', '2026-03-12', 'America/New_York', -5, 'westward', 3, 3, TRUE);

-- Dave: reduced cycles during travel, using event disruption link
INSERT INTO sleep_logs (id, user_id, date, intended_sleep_onset, actual_sleep_onset, wake_time, arp_maintained, cycles_completed, onset_latency_minutes, subjective_energy_on_waking, disruption_event_id) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', '2026-03-09', '22:30', '01:00', '06:15', TRUE, 3, 30, 2, 'e1000000-0000-0000-0000-000000000004'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', '2026-03-10', '22:30', '00:30', '06:00', TRUE, 4, 20, 3, 'e1000000-0000-0000-0000-000000000004'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', '2026-03-11', '22:30', '23:00', '06:00', TRUE, 5, 10, 3, 'e1000000-0000-0000-0000-000000000004');

INSERT INTO daily_logs (id, user_id, date, crp_taken, crp_count, crp_duration_minutes, crp_start_time, mrm_count, morning_light_achieved, caffeine_doses, disruption_event_id) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', '2026-03-09', TRUE, 1, 30, '14:00', 4, TRUE, 2, 'e1000000-0000-0000-0000-000000000004'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', '2026-03-10', TRUE, 1, 30, '13:30', 5, TRUE, 2, 'e1000000-0000-0000-0000-000000000004'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', '2026-03-11', TRUE, 1, 20, '15:00', 6, TRUE, 1, 'e1000000-0000-0000-0000-000000000004');

INSERT INTO user_states (id, user_id, state_id, active, priority, trigger_signals, detection_source) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 'US-06', TRUE, 3,
   ARRAY['event: travel westward -5h', 'reduced_cycles: [3,4,5]', 'recovery_day: 3/3'], 'weekly_balance');

-- =============================================================================
-- TEST USER 5: "Eve" — New user, mid-onboarding (Framework Gap)
-- Represents: US-12 (Framework Gap), incomplete onboarding
-- =============================================================================

INSERT INTO users (id, auth_user_id, onboarding_completed, onboarding_step, timezone) VALUES
  ('a1000000-0000-0000-0000-000000000005', 'aa110000-0000-0000-0000-000000000005', FALSE, 2, 'Europe/Paris');

INSERT INTO user_profiles (id, user_id, arp_committed, arp_time, chronotype, cycle_target) VALUES
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005',
   TRUE, '07:00', 'Unknown', 5);

-- Eve has ARP config computed but no logs yet (just onboarded ARP)
INSERT INTO arp_configs (id, user_id, arp_time, cycle_times, phase_1_start, phase_2_start, phase_3_start, phase_4_start, crp_window_open, crp_window_close, sleep_onset_6cycle, sleep_onset_5cycle, sleep_onset_4cycle, sleep_onset_3cycle, pre_sleep_window_open, pre_sleep_window_ideal, pre_sleep_window_floor, deep_sleep_window_open, deep_sleep_window_close, mrm_times) VALUES
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005',
   '07:00',
   ARRAY['07:00','08:30','10:00','11:30','13:00','14:30','16:00','17:30','19:00','20:30','22:00','23:30','01:00','02:30','04:00','05:30']::TIME[],
   '07:00', '13:00', '19:00', '01:00',
   '14:30', '19:00',
   '22:00', '23:30', '01:00', '02:30',
   '22:00', '23:30', '01:00',
   '23:30', '02:30',
   ARRAY['08:30','10:00','11:30','13:00','14:30','16:00','17:30','19:00','20:30','22:00']::TIME[]);

INSERT INTO user_states (id, user_id, state_id, active, priority, trigger_signals, detection_source) VALUES
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000005', 'US-12', TRUE, 2,
   ARRAY['onboarding_completed: false', 'onboarding_step: 2', 'no_logs_yet'], 'onboarding');

-- =============================================================================
-- SAMPLE RECOMMENDATIONS
-- =============================================================================

INSERT INTO recommendations (id, user_id, recommendation_type, category, triggered_by_states, priority, priority_label, status, delivery_channel, deliver_at, coaching_message, cooldown_hours) VALUES
  -- Bob: CRP scheduling recommendation
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', 'REC-03', 'scheduling',
   ARRAY['US-02']::user_state_id[], 3, 'MEDIUM', 'pending', 'in_app_card',
   '2026-03-11T12:30:00+00:00',
   'You averaged 4 cycles over the last 3 nights — your week is tracking toward a mild deficit. A 30-minute rest between 14:00 and 18:30 today counts as a full cycle.',
   24),
  -- Carol: Cycle reframe (anxiety)
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 'REC-13', 'anxiety_mindset',
   ARRAY['US-07']::user_state_id[], 1, 'CRITICAL', 'delivered', 'in_app_card',
   '2026-03-11T07:00:00-05:00',
   'Your body does not need a perfect night to function. Even 3 cycles gives you a foundation. The system is designed so that CRPs, MRMs, and your weekly balance compensate for any single night.',
   72),
  -- Carol: Phase 3 wind-down
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 'REC-08', 'environment_light',
   ARRAY['US-08']::user_state_id[], 2, 'HIGH', 'pending', 'push_notification',
   '2026-03-11T19:00:00-05:00',
   'Phase 3 starts now. Switch screens to amber mode or put devices down. Your pre-sleep routine window opens in 3 hours.',
   24),
  -- Dave: Post-disruption rebalancing
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 'REC-22', 'scheduling',
   ARRAY['US-06']::user_state_id[], 3, 'MEDIUM', 'delivered', 'in_app_card',
   '2026-03-11T06:00:00+00:00',
   'Day 3 of travel recovery. Your cycles are improving (3 then 4 then 5). Continue holding your ARP at 06:00 and prioritise a CRP this afternoon.',
   48),
  -- Eve: Framework reset (onboarding)
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000005', 'REC-20', 'foundation',
   ARRAY['US-12']::user_state_id[], 2, 'HIGH', 'pending', 'onboarding_step',
   '2026-03-11T08:00:00+01:00',
   'Welcome to R90. Your ARP is set to 07:00 — this is your anchor. Next step: tell us about your chronotype so we can personalise your schedule.',
   0);
