-- =============================================================================
-- R90 ENGINE — FULL SUPABASE SCHEMA
-- Migration: 001_r90_schema
-- Date: 2026-03-11
-- Source of truth: R90_DATA_MODEL.md v1.0, R90_RULE_ENGINE_SPEC.md v1.0,
--                  R90_BACKEND_API_CONTRACT.md v1.0
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CUSTOM TYPES (ENUMS)
-- =============================================================================

CREATE TYPE chronotype AS ENUM ('AMer', 'PMer', 'In-betweener', 'Unknown');
CREATE TYPE chronotype_confidence AS ENUM ('self_reported', 'inferred', 'calibrated');
CREATE TYPE caffeine_use_level AS ENUM ('none', 'low', 'moderate', 'high');
CREATE TYPE shift_type AS ENUM ('day', 'night');
CREATE TYPE occupation_schedule_type AS ENUM ('standard', 'early_starts', 'late_finishes', 'shift_work', 'irregular', 'flexible', 'freelance');
CREATE TYPE travel_frequency_type AS ENUM ('rare', 'monthly', 'weekly', 'very_frequent');
CREATE TYPE morphotype_type AS ENUM ('ectomorph', 'mesomorph', 'endomorph', 'unknown');
CREATE TYPE dominant_hand_type AS ENUM ('left', 'right', 'unknown');

CREATE TYPE bedroom_temperature_type AS ENUM ('hot', 'comfortable', 'cool', 'variable');
CREATE TYPE morning_light_access_type AS ENUM ('outdoor', 'window', 'dws', 'light_therapy', 'none');
CREATE TYPE evening_light_type AS ENUM ('bright_blue', 'mixed', 'amber_managed');
CREATE TYPE noise_profile_type AS ENUM ('silent', 'ambient', 'loud', 'managed_white_noise');

CREATE TYPE event_type AS ENUM ('travel', 'illness', 'injury', 'shift_change', 'high_stress', 'social_disruption', 'new_parent', 'pre_event');
CREATE TYPE event_severity AS ENUM ('minor', 'moderate', 'significant');
CREATE TYPE travel_direction AS ENUM ('eastward', 'westward', 'none');

CREATE TYPE user_state_id AS ENUM (
  'US-01', 'US-02', 'US-03', 'US-04', 'US-05', 'US-06', 'US-07',
  'US-08', 'US-09', 'US-10', 'US-11', 'US-12', 'US-13', 'US-14',
  'US-15', 'US-16', 'US-17'
);
CREATE TYPE detection_source_type AS ENUM ('sleep_log', 'daily_log', 'weekly_balance', 'onboarding', 'user_report', 'profile_change', 'event_context');

CREATE TYPE recommendation_type AS ENUM (
  'REC-01', 'REC-02', 'REC-03', 'REC-04', 'REC-05', 'REC-06', 'REC-07',
  'REC-08', 'REC-09', 'REC-10', 'REC-11', 'REC-12', 'REC-13', 'REC-14',
  'REC-15', 'REC-16', 'REC-17', 'REC-18', 'REC-19', 'REC-20', 'REC-21',
  'REC-22', 'REC-23', 'REC-24', 'REC-25', 'REC-26'
);
CREATE TYPE recommendation_category AS ENUM (
  'foundation', 'scheduling', 'environment_light', 'anxiety_mindset',
  'tracking_review', 'specialist'
);
CREATE TYPE recommendation_status AS ENUM ('pending', 'delivered', 'actioned', 'dismissed', 'expired');
CREATE TYPE delivery_channel AS ENUM ('push_notification', 'in_app_card', 'weekly_review', 'onboarding_step');
CREATE TYPE priority_level AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

CREATE TYPE onset_latency_flag_type AS ENUM ('easy', 'difficult', 'over_15_min');
CREATE TYPE waking_cause_type AS ENUM ('none', 'alarm', 'natural', 'partner', 'noise', 'unknown');
CREATE TYPE crp_type AS ENUM ('standard', 'nsdr', 'extended');
CREATE TYPE morning_light_method_type AS ENUM ('outdoor', 'dws', 'light_therapy', 'window', 'none');
CREATE TYPE schedule_consistency_type AS ENUM ('consistent', 'inconsistent');

-- =============================================================================
-- TABLE 1: users
-- Root account record. Identity only — no behavioural data.
-- Leverages Supabase auth.users for authentication; this is the app-level user.
-- =============================================================================

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id          UUID UNIQUE NOT NULL,  -- FK to auth.users
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  onboarding_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step       INTEGER NOT NULL DEFAULT 0
    CHECK (onboarding_step BETWEEN 0 AND 5),
  timezone              TEXT NOT NULL DEFAULT 'Europe/London',
  locale                TEXT DEFAULT 'en-GB'   -- V2: coaching message localisation
);

COMMENT ON TABLE users IS 'Root user record. Identity and onboarding status only.';
COMMENT ON COLUMN users.auth_user_id IS 'FK to Supabase auth.users for authentication.';
COMMENT ON COLUMN users.onboarding_step IS '0=not started, 1=ARP, 2=chronotype, 3=cycles, 4=environment, 5=complete';

-- =============================================================================
-- TABLE 2: user_profiles
-- Persistent characterisation. Updated during onboarding and refined over time.
-- =============================================================================

CREATE TABLE user_profiles (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- ARP (Anchor Reset Point)
  arp_committed           BOOLEAN NOT NULL DEFAULT FALSE,
  arp_time                TIME,  -- HH:MM on the hour or half-hour, range 05:00–09:00
  arp_committed_at        TIMESTAMPTZ,  -- V2: 7-day trial tracking

  -- Chronotype
  chronotype              chronotype NOT NULL DEFAULT 'Unknown',
  chronotype_confidence   chronotype_confidence DEFAULT 'self_reported',  -- V2: calibrated after 4+ weeks

  -- Cycle targets
  cycle_target            INTEGER NOT NULL DEFAULT 5
    CHECK (cycle_target BETWEEN 3 AND 6),

  -- Shift work (V2 fields included for schema completeness)
  multishift_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  shift_arp_day           TIME DEFAULT '06:00',   -- V2
  shift_arp_night         TIME DEFAULT '18:00',   -- V2
  active_shift            shift_type,              -- V2

  -- Personal context
  sleep_partner           BOOLEAN DEFAULT FALSE,
  dominant_hand           dominant_hand_type DEFAULT 'unknown',   -- V2
  morphotype              morphotype_type DEFAULT 'unknown',      -- V2

  -- Stimulant profile
  caffeine_use            caffeine_use_level,
  caffeine_cutoff_time    TIME DEFAULT '14:00',

  -- Tracker
  tracker_in_use          BOOLEAN DEFAULT FALSE,

  -- Schedule context (V2 fields)
  schedule_consistency    schedule_consistency_type DEFAULT 'consistent',
  travel_frequency        travel_frequency_type,     -- V2
  occupation_schedule     occupation_schedule_type,   -- V2

  -- Known issues (onboarding)
  known_sleep_issue       TEXT,
  user_reported_anxiety   BOOLEAN DEFAULT FALSE,  -- explicit sleep worry flag
  user_reported_tracker_anxiety BOOLEAN DEFAULT FALSE,  -- ortho-insomnia flag
  user_reported_screen_use BOOLEAN DEFAULT FALSE,  -- electronic insomnia flag

  -- Versioning
  profile_version         INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Persistent user characterisation. One per user.';
COMMENT ON COLUMN user_profiles.arp_time IS 'Fixed daily wake time. On hour/half-hour, range 05:00–09:00. Gates entire engine.';
COMMENT ON COLUMN user_profiles.cycle_target IS 'Default nocturnal cycle target per night. Range 3–6, default 5.';

-- Auto-update updated_at and profile_version
CREATE OR REPLACE FUNCTION update_profile_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.profile_version = OLD.profile_version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profile_version
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_version();

-- =============================================================================
-- TABLE 3: arp_configs
-- Computed from ARP time. All cycle times, phase boundaries, and scheduling
-- windows derive from this entity. Recalculated when arp_time changes.
-- Never input directly by the user — always derived.
-- =============================================================================

CREATE TABLE arp_configs (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Source ARP
  arp_time                TIME NOT NULL,

  -- 16 cycle times: Cn = ARP + (n-1) * 90min
  cycle_times             TIME[16] NOT NULL,

  -- Phase boundaries
  phase_1_start           TIME NOT NULL,  -- C1 = ARP
  phase_2_start           TIME NOT NULL,  -- C5 = ARP + 6h
  phase_3_start           TIME NOT NULL,  -- C9 = ARP + 12h
  phase_4_start           TIME NOT NULL,  -- C13 = ARP + 18h

  -- CRP window
  crp_window_open         TIME NOT NULL,  -- C6 = ARP + 7.5h
  crp_window_close        TIME NOT NULL,  -- C9 = ARP + 12h

  -- Sleep onset targets (count back from ARP)
  sleep_onset_6cycle      TIME NOT NULL,  -- ARP - 9h
  sleep_onset_5cycle      TIME NOT NULL,  -- ARP - 7.5h (target)
  sleep_onset_4cycle      TIME NOT NULL,  -- ARP - 6h (floor)
  sleep_onset_3cycle      TIME NOT NULL,  -- ARP - 4.5h (emergency)

  -- Pre-sleep windows
  pre_sleep_window_open   TIME NOT NULL,  -- C11
  pre_sleep_window_ideal  TIME NOT NULL,  -- C12 (5-cycle onset)
  pre_sleep_window_floor  TIME NOT NULL,  -- C13 (4-cycle onset)

  -- Deep sleep window (approximate)
  deep_sleep_window_open  TIME NOT NULL,
  deep_sleep_window_close TIME NOT NULL,

  -- MRM schedule: one per waking cycle C2–C11
  mrm_times               TIME[] NOT NULL,

  generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE arp_configs IS 'Computed 16-cycle schedule. Derived from arp_time. Regenerated on ARP change.';
COMMENT ON COLUMN arp_configs.cycle_times IS 'All 16 cycle boundary times: Cn = ARP + (n-1) * 90min.';
COMMENT ON COLUMN arp_configs.mrm_times IS 'MRM notification times: C2 through C11.';

-- =============================================================================
-- TABLE 4: event_contexts  (moved before sleep_logs/daily_logs due to FK deps)
-- Contextual modifiers that change engine behaviour for bounded periods.
-- =============================================================================

CREATE TABLE event_contexts (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  event_type                event_type NOT NULL,
  severity                  event_severity NOT NULL DEFAULT 'moderate',

  start_date                DATE NOT NULL,
  end_date                  DATE,  -- NULL = ongoing

  -- Travel-specific
  destination_timezone      TEXT,
  timezone_offset_hours     INTEGER,   -- COMPUTED: signed hour difference
  direction                 travel_direction,  -- COMPUTED: eastward/westward/none

  -- Engine modifiers
  expected_recovery_days    INTEGER,
  cycle_floor_override      INTEGER    -- override minimum acceptable cycles
    CHECK (cycle_floor_override IS NULL OR cycle_floor_override BETWEEN 2 AND 6),
  arp_locked                BOOLEAN NOT NULL DEFAULT TRUE,

  active                    BOOLEAN NOT NULL DEFAULT TRUE,
  notes                     TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE event_contexts IS 'Disruption events that modify engine behaviour for a bounded period.';

-- =============================================================================
-- TABLE 5: sleep_logs  (was Table 4 in data model)
-- One record per night. Captures nocturnal sleep period outcomes.
-- =============================================================================

CREATE TABLE sleep_logs (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                      DATE NOT NULL,  -- calendar date of the MORNING wake (not night of sleep)

  -- Core cycle data
  intended_sleep_onset      TIME,           -- calculated target from ARPConfig
  actual_sleep_onset        TIME,           -- self-reported bedtime/attempt time
  sleep_felt_onset          TIME,           -- V2: estimated actual sleep time
  wake_time                 TIME,           -- actual wake time (should match ARP)

  -- Computed: ARP adherence
  arp_maintained            BOOLEAN,        -- COMPUTED: wake_time within 15min of arp_time

  -- Cycle count
  cycles_completed          INTEGER         -- self-reported or calculated. Range 0–6. NULL = unknown
    CHECK (cycles_completed IS NULL OR cycles_completed BETWEEN 0 AND 6),

  -- Onset latency
  onset_latency_minutes     INTEGER         -- 0–120+. NULL = unknown
    CHECK (onset_latency_minutes IS NULL OR onset_latency_minutes >= 0),
  onset_latency_flag        BOOLEAN,        -- COMPUTED: onset_latency > 15min

  -- Night wakings
  night_wakings             INTEGER DEFAULT 0
    CHECK (night_wakings >= 0),
  night_waking_2_to_4am     BOOLEAN DEFAULT FALSE,
  waking_cause              waking_cause_type,  -- V2

  -- Routine adherence
  pre_sleep_routine_done    BOOLEAN,
  post_sleep_routine_done   BOOLEAN,

  -- Subjective
  subjective_energy_on_waking INTEGER   -- 1 (exhausted) to 5 (excellent)
    CHECK (subjective_energy_on_waking IS NULL OR subjective_energy_on_waking BETWEEN 1 AND 5),

  -- Disruption link
  disruption_event_id       UUID REFERENCES event_contexts(id) ON DELETE SET NULL,

  -- Free text
  notes                     TEXT,           -- V2

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One log per user per date
  UNIQUE(user_id, date)
);

COMMENT ON TABLE sleep_logs IS 'One record per night. Primary data input for weekly balance.';
COMMENT ON COLUMN sleep_logs.date IS 'Date of morning wake, not the night of sleep.';
COMMENT ON COLUMN sleep_logs.cycles_completed IS 'Self-reported or computed: floor((wake-onset)/90). NULL = unknown, not 0.';

-- =============================================================================
-- TABLE 5: daily_logs
-- One record per calendar day. Captures daytime recovery activity.
-- =============================================================================

CREATE TABLE daily_logs (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                      DATE NOT NULL,

  -- CRP data
  crp_taken                 BOOLEAN DEFAULT FALSE,
  crp_count                 INTEGER DEFAULT 0          -- usually 0–1; up to 2 in recovery mode
    CHECK (crp_count BETWEEN 0 AND 3),
  crp_duration_minutes      INTEGER                    -- 20, 30, or 90
    CHECK (crp_duration_minutes IS NULL OR crp_duration_minutes >= 0),
  crp_start_time            TIME,
  crp_type                  crp_type,                  -- V2
  crp_in_window             BOOLEAN,                   -- COMPUTED: start within CRP window
  crp_cycle_credited        BOOLEAN DEFAULT FALSE,     -- COMPUTED: duration >= 20min

  -- MRM data
  mrm_count                 INTEGER DEFAULT 0          -- target: 7; range 0–12
    CHECK (mrm_count BETWEEN 0 AND 12),
  mrm_target                INTEGER DEFAULT 7,         -- always 7
  mrm_with_daylight         INTEGER DEFAULT 0,         -- V2

  -- Light protocol
  morning_light_achieved    BOOLEAN,
  morning_light_method      morning_light_method_type, -- V2
  evening_light_managed     BOOLEAN,

  -- Subjective energy
  subjective_energy_midday  INTEGER
    CHECK (subjective_energy_midday IS NULL OR subjective_energy_midday BETWEEN 1 AND 5),
  subjective_energy_evening INTEGER
    CHECK (subjective_energy_evening IS NULL OR subjective_energy_evening BETWEEN 1 AND 5),

  -- Caffeine
  caffeine_doses            INTEGER DEFAULT 0
    CHECK (caffeine_doses >= 0),
  caffeine_last_time        TIME,
  caffeine_after_cutoff     BOOLEAN,                   -- COMPUTED: last_time > cutoff

  -- Exercise (V2)
  exercise_completed        BOOLEAN,
  exercise_start_time       TIME,
  exercise_phase            TEXT,                       -- COMPUTED V2: phase_1/2/3
  late_exercise_flag        BOOLEAN,                   -- COMPUTED V2

  -- Disruption link
  disruption_event_id       UUID REFERENCES event_contexts(id) ON DELETE SET NULL,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One log per user per date
  UNIQUE(user_id, date)
);

COMMENT ON TABLE daily_logs IS 'One record per day. Daytime recovery: CRP, MRM, light, caffeine.';

-- =============================================================================
-- TABLE 6: weekly_cycle_balances
-- One record per 7-day rolling window. Primary accounting unit.
-- =============================================================================

CREATE TABLE weekly_cycle_balances (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Week boundaries
  week_start                DATE NOT NULL,  -- rolling from ARP commitment date
  week_end                  DATE NOT NULL,
  day_number                INTEGER NOT NULL DEFAULT 1
    CHECK (day_number BETWEEN 1 AND 7),
  status                    TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed')),

  -- Per-day arrays (7 slots, index 0 = day 1)
  nocturnal_cycles          INTEGER[7] NOT NULL DEFAULT '{0,0,0,0,0,0,0}',
  crp_cycles                INTEGER[7] NOT NULL DEFAULT '{0,0,0,0,0,0,0}',

  -- Totals (COMPUTED — updated on each log)
  total_nocturnal_cycles    INTEGER NOT NULL DEFAULT 0,
  total_crp_cycles          INTEGER NOT NULL DEFAULT 0,
  weekly_cycle_total        INTEGER NOT NULL DEFAULT 0,  -- nocturnal + crp

  -- Targets (constants for clarity)
  weekly_target             INTEGER NOT NULL DEFAULT 35,
  weekly_floor              INTEGER NOT NULL DEFAULT 28,

  -- Deficit tracking
  cycle_deficit             INTEGER NOT NULL DEFAULT 35,  -- target - total
  projected_weekly_total    INTEGER NOT NULL DEFAULT 0,
  on_track                  BOOLEAN NOT NULL DEFAULT TRUE,
  deficit_risk_flag         BOOLEAN NOT NULL DEFAULT FALSE,

  -- MRM accounting
  mrm_total                 INTEGER DEFAULT 0,
  mrm_target                INTEGER NOT NULL DEFAULT 42,

  -- CRP accounting
  crp_count_total           INTEGER DEFAULT 0,
  crp_target                INTEGER NOT NULL DEFAULT 5,

  -- ARP stability
  arp_variance_minutes      INTEGER DEFAULT 0,
  arp_stable                BOOLEAN DEFAULT TRUE,  -- variance <= 15min

  computed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active balance per user at a time
  UNIQUE(user_id, week_start)
);

COMMENT ON TABLE weekly_cycle_balances IS 'Rolling 7-day cycle accounting. Target 35, floor 28.';
COMMENT ON COLUMN weekly_cycle_balances.nocturnal_cycles IS 'Array of 7: cycles per night for each day of the week.';
COMMENT ON COLUMN weekly_cycle_balances.deficit_risk_flag IS 'TRUE if cycle_deficit > 7 AND day_number >= 5.';

-- =============================================================================
-- TABLE 7: user_states
-- Engine classification of user recovery situation. Multiple can be active.
-- =============================================================================

CREATE TABLE user_states (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  state_id                  user_state_id NOT NULL,
  active                    BOOLEAN NOT NULL DEFAULT TRUE,
  priority                  INTEGER NOT NULL
    CHECK (priority BETWEEN 1 AND 5),

  detected_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at               TIMESTAMPTZ,
  auto_resolved             BOOLEAN DEFAULT FALSE,

  trigger_signals           TEXT[] NOT NULL DEFAULT '{}',
  detection_source          detection_source_type NOT NULL,

  -- Track persistence for rules like RULE-SR-01 (needs 14+ days)
  active_days               INTEGER DEFAULT 0,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_states IS 'Active recovery situations. Multiple states per user. Priority 1 = critical.';
COMMENT ON COLUMN user_states.trigger_signals IS 'Human-readable signals that activated this state.';

-- Partial unique index: only one active instance per user per state
CREATE UNIQUE INDEX idx_user_states_active_unique
  ON user_states(user_id, state_id) WHERE active = TRUE;

-- =============================================================================
-- TABLE 8: recommendations
-- Actionable outputs from the engine. Typed, timed, and toned.
-- =============================================================================

CREATE TABLE recommendations (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  recommendation_type       recommendation_type NOT NULL,
  category                  recommendation_category NOT NULL,
  triggered_by_states       user_state_id[] NOT NULL DEFAULT '{}',

  priority                  INTEGER NOT NULL
    CHECK (priority BETWEEN 1 AND 5),
  priority_label            priority_level NOT NULL,

  status                    recommendation_status NOT NULL DEFAULT 'pending',
  delivery_channel          delivery_channel NOT NULL DEFAULT 'in_app_card',

  -- Timing
  generated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deliver_at                TIMESTAMPTZ NOT NULL,
  expires_at                TIMESTAMPTZ,

  -- Content
  coaching_message          TEXT NOT NULL,
  action_payload            JSONB,

  -- User interaction
  actioned_at               TIMESTAMPTZ,
  dismissed_at              TIMESTAMPTZ,

  -- Cooldown
  cooldown_hours            INTEGER NOT NULL DEFAULT 24,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE recommendations IS 'Engine-generated coaching recommendations. Max 5 active per session.';

-- =============================================================================
-- TABLE 9: recommendation_cooldowns
-- Per user, per recommendation type — last triggered timestamp.
-- Used by the engine to suppress recently-fired recommendations.
-- =============================================================================

CREATE TABLE recommendation_cooldowns (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rec_type                  recommendation_type NOT NULL,
  last_triggered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cooldown_hours            INTEGER NOT NULL DEFAULT 24,
  dismissed_count           INTEGER NOT NULL DEFAULT 0,  -- tracks for RULE-CRP-02 (stigma)

  UNIQUE(user_id, rec_type)
);

COMMENT ON TABLE recommendation_cooldowns IS 'Cooldown tracking. Prevents recommendation spam.';

-- =============================================================================
-- TABLE 10: environment_contexts
-- User bedroom environment profile. Collected during onboarding/audit.
-- =============================================================================

CREATE TABLE environment_contexts (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  bedroom_temperature       bedroom_temperature_type,
  blackout_provision        BOOLEAN,
  dws_device                BOOLEAN DEFAULT FALSE,
  blackout_without_dws      BOOLEAN,  -- COMPUTED: blackout=true AND dws=false

  morning_light_access      morning_light_access_type,
  evening_light_environment evening_light_type,

  tv_in_bedroom             BOOLEAN DEFAULT FALSE,
  work_items_in_bedroom     BOOLEAN DEFAULT FALSE,

  -- V2 fields
  noise_profile             noise_profile_type,
  individual_duvets         BOOLEAN,
  mattress_gap_test_passed  BOOLEAN,
  air_quality_managed       BOOLEAN,

  -- Computed friction score (0–5)
  environment_friction_score INTEGER DEFAULT 0
    CHECK (environment_friction_score BETWEEN 0 AND 5),

  last_audit_date           DATE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE environment_contexts IS 'Bedroom environment profile. Friction score drives US-11.';
COMMENT ON COLUMN environment_contexts.environment_friction_score IS '+1 each: hot/variable temp, bright_blue light, TV, work items, blackout w/o DWS.';

-- (event_contexts table moved to before sleep_logs due to FK dependencies)

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users
CREATE INDEX idx_users_auth ON users(auth_user_id);

-- User profiles: fast lookup by user
-- (covered by UNIQUE constraint on user_id)

-- Sleep logs: common queries
CREATE INDEX idx_sleep_logs_user_date ON sleep_logs(user_id, date DESC);
CREATE INDEX idx_sleep_logs_date_range ON sleep_logs(user_id, date)
  WHERE cycles_completed IS NOT NULL;

-- Daily logs: common queries
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, date DESC);

-- Weekly balance: active balance lookup
CREATE INDEX idx_weekly_balance_active ON weekly_cycle_balances(user_id, status)
  WHERE status = 'active';
CREATE INDEX idx_weekly_balance_user_week ON weekly_cycle_balances(user_id, week_start DESC);

-- User states: active states per user (most common query)
CREATE INDEX idx_user_states_active ON user_states(user_id, priority)
  WHERE active = TRUE;
CREATE INDEX idx_user_states_user_state ON user_states(user_id, state_id, active);

-- Recommendations: active/pending per user
CREATE INDEX idx_recommendations_active ON recommendations(user_id, priority, status)
  WHERE status IN ('pending', 'delivered');
CREATE INDEX idx_recommendations_type ON recommendations(user_id, recommendation_type, generated_at DESC);

-- Recommendation cooldowns: lookup by user
-- (covered by UNIQUE constraint)

-- Event contexts: active events per user
CREATE INDEX idx_events_active ON event_contexts(user_id, active)
  WHERE active = TRUE;
CREATE INDEX idx_events_date_range ON event_contexts(user_id, start_date, end_date);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Compute environment friction score
CREATE OR REPLACE FUNCTION compute_friction_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.environment_friction_score := 0;
  IF NEW.bedroom_temperature IN ('hot', 'variable') THEN
    NEW.environment_friction_score := NEW.environment_friction_score + 1;
  END IF;
  IF NEW.evening_light_environment = 'bright_blue' THEN
    NEW.environment_friction_score := NEW.environment_friction_score + 1;
  END IF;
  IF NEW.tv_in_bedroom = TRUE THEN
    NEW.environment_friction_score := NEW.environment_friction_score + 1;
  END IF;
  IF NEW.work_items_in_bedroom = TRUE THEN
    NEW.environment_friction_score := NEW.environment_friction_score + 1;
  END IF;
  -- blackout without DWS
  NEW.blackout_without_dws := (NEW.blackout_provision = TRUE AND NEW.dws_device = FALSE);
  IF NEW.blackout_without_dws = TRUE THEN
    NEW.environment_friction_score := NEW.environment_friction_score + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_environment_friction
  BEFORE INSERT OR UPDATE ON environment_contexts
  FOR EACH ROW EXECUTE FUNCTION compute_friction_score();

-- Compute onset latency flag on sleep log
CREATE OR REPLACE FUNCTION compute_sleep_log_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- onset_latency_flag
  IF NEW.onset_latency_minutes IS NOT NULL THEN
    NEW.onset_latency_flag := (NEW.onset_latency_minutes > 15);
  ELSE
    NEW.onset_latency_flag := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sleep_log_flags
  BEFORE INSERT OR UPDATE ON sleep_logs
  FOR EACH ROW EXECUTE FUNCTION compute_sleep_log_flags();

-- Compute CRP credit on daily log
CREATE OR REPLACE FUNCTION compute_daily_log_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- CRP cycle credit: duration >= 20min
  IF NEW.crp_taken = TRUE AND NEW.crp_duration_minutes IS NOT NULL THEN
    NEW.crp_cycle_credited := (NEW.crp_duration_minutes >= 20);
  ELSE
    NEW.crp_cycle_credited := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_log_flags
  BEFORE INSERT OR UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION compute_daily_log_flags();
