-- Migration 005: calendar_events + notification_log tables

-- ─── calendar_events ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  source TEXT NOT NULL CHECK (source IN ('apple', 'google', 'manual')),
  event_type_hint TEXT DEFAULT 'other' CHECK (event_type_hint IN ('travel', 'meeting', 'important', 'social', 'health', 'other')),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, external_id, source)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start
  ON calendar_events(user_id, start_time);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'calendar_events_own' AND tablename = 'calendar_events'
  ) THEN
    CREATE POLICY calendar_events_own ON calendar_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── notification_log ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_trigger
  ON notification_log(user_id, trigger_type, sent_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'notification_log_own' AND tablename = 'notification_log'
  ) THEN
    CREATE POLICY notification_log_own ON notification_log
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
