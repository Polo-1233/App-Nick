-- Migration 006: weekly_summaries + weekly_reports + tool_call_logs tables

-- ─── weekly_summaries ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  avg_cycles DECIMAL(4,2),
  total_cycles INT,
  target_cycles INT,
  on_track BOOLEAN,
  deficit INT,
  mood_avg DECIMAL(3,2),
  stress_avg DECIMAL(3,2),
  notable_events JSONB DEFAULT '[]'::jsonb,
  patterns_detected JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user
  ON weekly_summaries(user_id, week_start DESC);

ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'weekly_summaries_own' AND tablename = 'weekly_summaries'
  ) THEN
    CREATE POLICY weekly_summaries_own ON weekly_summaries
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── weekly_reports ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_user
  ON weekly_reports(user_id, week_start DESC);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'weekly_reports_own' AND tablename = 'weekly_reports'
  ) THEN
    CREATE POLICY weekly_reports_own ON weekly_reports
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── tool_call_logs (Phase 5) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tool_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  duration_ms INT,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_call_logs_user
  ON tool_call_logs(user_id, created_at DESC);

-- No RLS on tool_call_logs (internal logs only)
