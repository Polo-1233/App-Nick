-- Migration 007: wearable_data
-- Stores synced data from Apple Health, Oura, Whoop, Garmin
-- Each row = one sync snapshot from one source

CREATE TABLE IF NOT EXISTS wearable_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,           -- 'apple_health' | 'oura' | 'whoop' | 'garmin'
  collected_at    TIMESTAMPTZ NOT NULL,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Sleep
  sleep_duration_min  INTEGER,             -- total asleep minutes
  sleep_efficiency    NUMERIC(4,3),        -- 0.0–1.0
  sleep_onset         TIMESTAMPTZ,         -- when fell asleep
  sleep_end           TIMESTAMPTZ,         -- when woke up
  rem_min             INTEGER,
  deep_min            INTEGER,
  light_min           INTEGER,
  awake_min           INTEGER,

  -- Cardiac
  hrv_ms              NUMERIC(6,2),        -- Heart Rate Variability (ms)
  resting_hr          INTEGER,             -- bpm

  -- Activity
  active_kcal         INTEGER,
  step_count          INTEGER,

  -- Source-specific scores (Oura, Whoop)
  readiness_score     INTEGER,             -- 0–100 (Oura readiness / Whoop recovery)
  strain_score        NUMERIC(4,2),        -- Whoop strain

  -- Raw payload (full JSON for future use)
  raw_data            JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wearable_data_user_source_idx
  ON wearable_data (user_id, source, collected_at DESC);

-- OAuth tokens for cloud wearables (Oura, Whoop, Garmin)
CREATE TABLE IF NOT EXISTS wearable_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source        TEXT NOT NULL,             -- 'oura' | 'whoop' | 'garmin'
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  scope         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source)
);
