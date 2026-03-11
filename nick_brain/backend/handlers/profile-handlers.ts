/**
 * R90 Backend — Profile, Environment, and Recommendation Action Handlers
 *
 * POST /users                  → register user after Supabase auth signup (idempotent)
 * POST /profile                → update_user_profile (+ ARP config if arp_time changed)
 * POST /profile/environment    → update_environment
 * POST /actions/recommendation → actioned / dismissed
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext, SignupAuthContext } from "../middleware/auth.js";
import type { ProfileUpdateInput, EnvironmentInput, RecommendationActionInput } from "../types.js";
import {
  createUser,
  createUserProfile,
  updateUserProfile,
  upsertEnvironment,
  updateRecommendationStatus,
} from "../db/mutations.js";
import { resolveUserId } from "../db/client.js";
import { generateAndPersistARPConfig, runAndPersistEngine } from "../services/engine-service.js";
import { readBody, sendJson, sendError } from "../server.js";

// ─── POST /users ──────────────────────────────────────────────────────────────

/**
 * Register the app-level user record after Supabase auth signup.
 *
 * Must be called once after the user signs up via Supabase Auth.
 * Uses authenticateSignup() — the users row may not exist yet.
 * Idempotent: if the user already exists, returns their existing user_id.
 *
 * Body (optional): { timezone?: string }  — defaults to "Europe/London"
 */
export async function createUserHandler(
  req: IncomingMessage,
  res: ServerResponse,
  auth: SignupAuthContext
): Promise<void> {
  const body = await readBody<{ timezone?: string }>(req);
  const timezone = body?.timezone ?? "Europe/London";

  // Idempotency check: return existing user_id if already registered
  const existingUserId = await resolveUserId(auth.client, auth.authUid);
  if (existingUserId) {
    sendJson(res, 200, { user_id: existingUserId, is_new: false });
    return;
  }

  // Create app-level users record
  const created = await createUser(auth.client, auth.authUid, timezone);
  if (!created) {
    sendError(res, 500, "Failed to create user record", "DB_WRITE_FAILED");
    return;
  }

  // Create blank user_profiles row — onboarding fills in the rest
  await createUserProfile(auth.client, created.id, {});

  sendJson(res, 201, { user_id: created.id, is_new: true });
}

// ─── POST /profile ────────────────────────────────────────────────────────────

export async function updateProfileHandler(
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext
): Promise<void> {
  const body = await readBody<ProfileUpdateInput>(req);
  if (!body) {
    sendError(res, 400, "Request body must be valid JSON", "INVALID_BODY");
    return;
  }

  // Validate ARP time if provided
  if (body.arp_time && !/^\d{2}:[03]0$/.test(body.arp_time)) {
    sendError(res, 422, "arp_time must be HH:00 or HH:30 (e.g. 06:30)", "INVALID_ARP_TIME");
    return;
  }

  const ok = await updateUserProfile(auth.client, auth.userId, body);
  if (!ok) {
    sendError(res, 500, "Failed to update profile", "DB_WRITE_FAILED");
    return;
  }

  // Regenerate ARP config if arp_time was committed
  if (body.arp_time && body.arp_committed) {
    await generateAndPersistARPConfig(auth.client, auth.userId, body.arp_time);
  }

  // Re-run engine so states/recs reflect the profile change
  const engineOutput = await runAndPersistEngine(auth.client, auth.userId);

  sendJson(res, 200, { ok: true, engine_output: engineOutput });
}

// ─── POST /profile/environment ────────────────────────────────────────────────

export async function updateEnvironmentHandler(
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext
): Promise<void> {
  const body = await readBody<EnvironmentInput>(req);
  if (!body) {
    sendError(res, 400, "Request body must be valid JSON", "INVALID_BODY");
    return;
  }

  const ok = await upsertEnvironment(auth.client, auth.userId, body);
  if (!ok) {
    sendError(res, 500, "Failed to update environment", "DB_WRITE_FAILED");
    return;
  }

  // Re-run engine — environment affects US-08, US-10, US-11 etc.
  const engineOutput = await runAndPersistEngine(auth.client, auth.userId);

  sendJson(res, 200, { ok: true, engine_output: engineOutput });
}

// ─── POST /actions/recommendation ─────────────────────────────────────────────

export async function recommendationActionHandler(
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext
): Promise<void> {
  const body = await readBody<RecommendationActionInput>(req);
  if (!body) {
    sendError(res, 400, "Request body must be valid JSON", "INVALID_BODY");
    return;
  }

  if (!body.recommendation_id) {
    sendError(res, 422, "recommendation_id is required", "MISSING_REC_ID");
    return;
  }

  if (body.action !== "actioned" && body.action !== "dismissed") {
    sendError(res, 422, "action must be 'actioned' or 'dismissed'", "INVALID_ACTION");
    return;
  }

  const ok = await updateRecommendationStatus(
    auth.client,
    auth.userId,
    body.recommendation_id,
    body.action
  );

  if (!ok) {
    sendError(res, 404, "Recommendation not found or already resolved", "NOT_FOUND");
    return;
  }

  sendJson(res, 200, { ok: true });
}
