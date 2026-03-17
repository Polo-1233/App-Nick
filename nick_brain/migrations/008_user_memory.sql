-- Migration 008: User memory for R-Lo coaching
-- Stores extracted long-term facts per user (lightweight memory system)

CREATE TABLE IF NOT EXISTS user_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,        -- e.g. "work_schedule", "sleep_issue"
  value       TEXT NOT NULL,        -- e.g. "night shifts on Thursdays"
  source      TEXT NOT NULL DEFAULT 'chat', -- 'chat' | 'onboarding' | 'wearable'
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, key)             -- one fact per key per user (upsert on conflict)
);

CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);

-- Allow app to read/write memory
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_memory_self" ON user_memory
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
