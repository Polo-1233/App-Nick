-- Migration 003: Chat message persistence
-- Run once in Supabase SQL editor.
--
-- Creates a chat_messages table to persist R-Lo conversations per user.
-- Messages are grouped into sessions (default: one session per day).

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT        NOT NULL,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient per-user history loads
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON chat_messages(user_id, created_at DESC);

-- Index for per-session loads
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session
  ON chat_messages(user_id, session_id, created_at ASC);

-- RLS: users can only read their own messages (if RLS is enabled)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "chat_messages_own"
  ON chat_messages
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );
