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
import type { AuthContext } from "../middleware/auth.js";
export declare function deleteAccountHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
