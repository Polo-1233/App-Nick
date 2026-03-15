/**
 * account-handlers.ts — Account management routes
 *
 * DELETE /account
 *   Permanently deletes the authenticated user's account:
 *   1. Deletes all app data (CASCADE from users table)
 *   2. Deletes the Supabase auth user (removes login credentials)
 *   3. Returns 200 { ok: true } — the app then signs out locally
 *
 * Apple App Store requires a functional in-app account deletion flow.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { URLSearchParams } from "node:url";
import type { AuthContext } from "../middleware/auth.js";
import { sendJson, sendError } from "../server.js";
import { createServerClient } from "../db/client.js";

export async function deleteAccountHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  auth: AuthContext,
): Promise<void> {
  const { client, userId } = auth;

  // ── Step 1: Get the auth UID before deleting the users row ────────────────
  const { data: userRow, error: userErr } = await client
    .from("users")
    .select("auth_user_id")
    .eq("id", userId)
    .single();

  if (userErr || !userRow) {
    sendError(res, 404, "User not found", "USER_NOT_FOUND");
    return;
  }

  const authUid = (userRow as { auth_user_id: string }).auth_user_id;

  // ── Step 2: Delete app data (CASCADE handles all child tables) ────────────
  // Tables with FK → users(id) ON DELETE CASCADE:
  //   user_profiles, sleep_logs, daily_logs, weekly_balances,
  //   user_states, arp_configs, events, environments,
  //   recommendation_cooldowns, chat_messages
  const { error: deleteDataErr } = await client
    .from("users")
    .delete()
    .eq("id", userId);

  if (deleteDataErr) {
    console.error("[deleteAccount] Failed to delete user data:", deleteDataErr.message);
    sendError(res, 500, "Failed to delete account data", "DELETE_DATA_FAILED");
    return;
  }

  // ── Step 3: Delete Supabase auth user (requires service role) ─────────────
  // This removes the ability to log in — must come AFTER data deletion.
  const adminClient = createServerClient(); // service role
  const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(authUid);

  if (authDeleteErr) {
    // Data is already deleted — log but don't fail the request.
    // The user's auth record will be orphaned but harmless (no app data).
    console.warn("[deleteAccount] Auth user deletion failed:", authDeleteErr.message);
  }

  sendJson(res, 200, { ok: true, message: "Account deleted successfully" });
}
