-- =============================================================================
-- R90 ENGINE — ROW LEVEL SECURITY POLICIES
-- Migration: 002_r90_rls_policies
-- Date: 2026-03-11
-- Purpose: Lock down all tables so users can only access their own data.
-- Assumption: auth.uid() returns the Supabase auth user ID.
--             We join through users.auth_user_id to get the app user_id.
-- =============================================================================

-- Helper function: get app user_id from auth.uid()
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE arp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_cycle_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_contexts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- USERS
-- Users can read/update their own row. Insert handled by backend on signup.
-- =============================================================================

CREATE POLICY users_select ON users
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY users_update ON users
  FOR UPDATE USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Insert: only service_role should create user records (via signup trigger)
-- No INSERT policy for authenticated users — handled server-side.

-- =============================================================================
-- USER_PROFILES
-- =============================================================================

CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT USING (user_id = public.current_app_user_id());

CREATE POLICY user_profiles_insert ON user_profiles
  FOR INSERT WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- =============================================================================
-- ARP_CONFIGS
-- Read-only for the client. Engine (service_role) writes.
-- =============================================================================

CREATE POLICY arp_configs_select ON arp_configs
  FOR SELECT USING (user_id = public.current_app_user_id());

-- No INSERT/UPDATE for authenticated — engine computes this server-side.

-- =============================================================================
-- SLEEP_LOGS
-- =============================================================================

CREATE POLICY sleep_logs_select ON sleep_logs
  FOR SELECT USING (user_id = public.current_app_user_id());

CREATE POLICY sleep_logs_insert ON sleep_logs
  FOR INSERT WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY sleep_logs_update ON sleep_logs
  FOR UPDATE USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- =============================================================================
-- DAILY_LOGS
-- =============================================================================

CREATE POLICY daily_logs_select ON daily_logs
  FOR SELECT USING (user_id = public.current_app_user_id());

CREATE POLICY daily_logs_insert ON daily_logs
  FOR INSERT WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY daily_logs_update ON daily_logs
  FOR UPDATE USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- =============================================================================
-- WEEKLY_CYCLE_BALANCES
-- Read-only for client. Engine computes.
-- =============================================================================

CREATE POLICY weekly_balances_select ON weekly_cycle_balances
  FOR SELECT USING (user_id = public.current_app_user_id());

-- =============================================================================
-- USER_STATES
-- Read-only for client. Engine writes.
-- =============================================================================

CREATE POLICY user_states_select ON user_states
  FOR SELECT USING (user_id = public.current_app_user_id());

-- =============================================================================
-- RECOMMENDATIONS
-- Client can read, and update status (actioned/dismissed). Engine inserts.
-- =============================================================================

CREATE POLICY recommendations_select ON recommendations
  FOR SELECT USING (user_id = public.current_app_user_id());

CREATE POLICY recommendations_update ON recommendations
  FOR UPDATE USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- =============================================================================
-- RECOMMENDATION_COOLDOWNS
-- Read-only for client. Engine manages.
-- =============================================================================

CREATE POLICY rec_cooldowns_select ON recommendation_cooldowns
  FOR SELECT USING (user_id = public.current_app_user_id());

-- =============================================================================
-- ENVIRONMENT_CONTEXTS
-- =============================================================================

CREATE POLICY env_contexts_select ON environment_contexts
  FOR SELECT USING (user_id = public.current_app_user_id());

CREATE POLICY env_contexts_insert ON environment_contexts
  FOR INSERT WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY env_contexts_update ON environment_contexts
  FOR UPDATE USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- =============================================================================
-- EVENT_CONTEXTS
-- =============================================================================

CREATE POLICY event_contexts_select ON event_contexts
  FOR SELECT USING (user_id = public.current_app_user_id());

CREATE POLICY event_contexts_insert ON event_contexts
  FOR INSERT WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY event_contexts_update ON event_contexts
  FOR UPDATE USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- =============================================================================
-- NOTES
-- =============================================================================
--
-- RLS Design Principles:
-- 1. All tables filtered by user_id ownership.
-- 2. Engine-computed tables (arp_configs, weekly_cycle_balances, user_states,
--    recommendation_cooldowns) are READ-ONLY for authenticated users.
--    Only service_role (backend) can write to these.
-- 3. User-input tables (sleep_logs, daily_logs, environment_contexts,
--    event_contexts, user_profiles) allow INSERT + UPDATE by the owning user.
-- 4. No DELETE policies — data is soft-archived, never deleted by client.
-- 5. The users table INSERT is handled by a Supabase auth trigger (server-side).
--
-- For admin/support access, create a separate admin role with broader policies.
-- =============================================================================
