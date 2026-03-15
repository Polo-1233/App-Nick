-- Migration 004: Rich user profile — Phase 1 personalization
-- Run once in Supabase SQL editor.
--
-- 1. New lifestyle columns on user_profiles
-- 2. New life_events table
-- 3. New mood/stress columns on daily_logs

-- ─── 1. user_profiles — lifestyle fields ─────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stress_level         TEXT DEFAULT 'medium'
    CHECK (stress_level IN ('low', 'medium', 'high', 'variable')),
  ADD COLUMN IF NOT EXISTS sleep_environment    TEXT DEFAULT 'moderate'
    CHECK (sleep_environment IN ('quiet', 'moderate', 'noisy', 'very_noisy')),
  ADD COLUMN IF NOT EXISTS exercise_frequency   TEXT DEFAULT 'light'
    CHECK (exercise_frequency IN ('none', 'light', 'moderate', 'heavy')),
  ADD COLUMN IF NOT EXISTS alcohol_use          TEXT DEFAULT 'none'
    CHECK (alcohol_use IN ('none', 'occasional', 'regular')),
  ADD COLUMN IF NOT EXISTS work_start_time      TIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lifestyle_updated_at TIMESTAMPTZ DEFAULT NULL;

-- ─── 2. life_events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS life_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL
    CHECK (event_type IN (
      'travel', 'illness', 'high_stress', 'late_night',
      'important_day', 'celebration', 'other'
    )),
  title       TEXT        NOT NULL,
  event_date  DATE        NOT NULL,
  end_date    DATE        DEFAULT NULL,    -- for multi-day events (travel)
  notes       TEXT        DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_life_events_user_date
  ON life_events(user_id, event_date DESC);

ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "life_events_own"
  ON life_events FOR ALL
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ─── 3. daily_logs — subjective tracking ─────────────────────────────────────

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS mood_score    SMALLINT DEFAULT NULL
    CHECK (mood_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS stress_score  SMALLINT DEFAULT NULL
    CHECK (stress_score BETWEEN 1 AND 5);

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON COLUMN user_profiles.stress_level IS
  'Self-reported baseline stress level: low / medium / high / variable';
COMMENT ON COLUMN user_profiles.sleep_environment IS
  'Typical sleep environment noise level: quiet / moderate / noisy / very_noisy';
COMMENT ON COLUMN user_profiles.exercise_frequency IS
  'Typical exercise frequency: none / light / moderate / heavy';
COMMENT ON COLUMN user_profiles.alcohol_use IS
  'Typical alcohol consumption: none / occasional / regular';
COMMENT ON COLUMN user_profiles.work_start_time IS
  'Typical work start time (impacts scheduling recommendations)';

COMMENT ON TABLE life_events IS
  'User-reported life events that affect sleep quality and recovery';
COMMENT ON COLUMN daily_logs.mood_score IS
  '1 (very low) to 5 (excellent) — reported at check-in';
COMMENT ON COLUMN daily_logs.stress_score IS
  '1 (very calm) to 5 (very stressed) — reported at check-in';
