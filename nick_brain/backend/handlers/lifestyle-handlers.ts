/**
 * lifestyle-handlers.ts — Phase 1 personalization routes
 *
 * PUT /profile/lifestyle    — Update lifestyle fields (stress, environment, exercise…)
 * GET /events/life          — List recent life events (±14 days)
 * POST /events/life         — Create a life event
 * DELETE /events/life/:id   — Delete a life event
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { URLSearchParams } from "node:url";
import type { AuthContext } from "../middleware/auth.js";
import { readBody, sendJson, sendError } from "../server.js";
import {
  updateLifestyleProfile,
  createLifeEvent,
  deleteLifeEvent,
  type LifestyleInput,
  type LifeEventInput,
} from "../db/mutations.js";
import { fetchRecentLifeEvents } from "../db/queries.js";

// ─── PUT /profile/lifestyle ───────────────────────────────────────────────────

const VALID_STRESS     = ["low", "medium", "high", "variable"] as const;
const VALID_ENV        = ["quiet", "moderate", "noisy", "very_noisy"] as const;
const VALID_EXERCISE   = ["none", "light", "moderate", "heavy"] as const;
const VALID_ALCOHOL    = ["none", "occasional", "regular"] as const;

export async function updateLifestyleHandler(
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext,
  _query: URLSearchParams,
): Promise<void> {
  const body = await readBody<LifestyleInput>(req);
  if (!body) { sendError(res, 400, "Body required", "MISSING_BODY"); return; }

  const input: LifestyleInput = {};

  if (body.stress_level !== undefined) {
    if (!VALID_STRESS.includes(body.stress_level as any)) {
      sendError(res, 400, "Invalid stress_level", "INVALID_FIELD"); return;
    }
    input.stress_level = body.stress_level;
  }
  if (body.sleep_environment !== undefined) {
    if (!VALID_ENV.includes(body.sleep_environment as any)) {
      sendError(res, 400, "Invalid sleep_environment", "INVALID_FIELD"); return;
    }
    input.sleep_environment = body.sleep_environment;
  }
  if (body.exercise_frequency !== undefined) {
    if (!VALID_EXERCISE.includes(body.exercise_frequency as any)) {
      sendError(res, 400, "Invalid exercise_frequency", "INVALID_FIELD"); return;
    }
    input.exercise_frequency = body.exercise_frequency;
  }
  if (body.alcohol_use !== undefined) {
    if (!VALID_ALCOHOL.includes(body.alcohol_use as any)) {
      sendError(res, 400, "Invalid alcohol_use", "INVALID_FIELD"); return;
    }
    input.alcohol_use = body.alcohol_use;
  }
  if (body.work_start_time !== undefined) {
    input.work_start_time = body.work_start_time;
  }

  const ok = await updateLifestyleProfile(auth.client, auth.userId, input);
  if (!ok) { sendError(res, 500, "Failed to update lifestyle profile", "UPDATE_FAILED"); return; }

  sendJson(res, 200, { ok: true });
}

// ─── GET /events/life ─────────────────────────────────────────────────────────

export async function getLifeEventsHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  auth: AuthContext,
  _query: URLSearchParams,
): Promise<void> {
  const events = await fetchRecentLifeEvents(auth.client, auth.userId);
  sendJson(res, 200, { events });
}

// ─── POST /events/life ────────────────────────────────────────────────────────

const VALID_EVENT_TYPES = [
  "travel", "illness", "high_stress", "late_night",
  "important_day", "celebration", "other",
] as const;

export async function createLifeEventHandler(
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext,
  _query: URLSearchParams,
): Promise<void> {
  const body = await readBody<LifeEventInput>(req);
  if (!body) { sendError(res, 400, "Body required", "MISSING_BODY"); return; }

  if (!body.event_type || !VALID_EVENT_TYPES.includes(body.event_type as any)) {
    sendError(res, 400, "Invalid event_type", "INVALID_FIELD"); return;
  }
  if (!body.title?.trim()) {
    sendError(res, 400, "title is required", "MISSING_TITLE"); return;
  }
  if (!body.event_date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
    sendError(res, 400, "event_date must be YYYY-MM-DD", "INVALID_DATE"); return;
  }

  const result = await createLifeEvent(auth.client, auth.userId, {
    event_type: body.event_type,
    title:      body.title.trim(),
    event_date: body.event_date,
    end_date:   body.end_date ?? null,
    notes:      body.notes?.trim() ?? null,
  });

  if (!result) { sendError(res, 500, "Failed to create event", "CREATE_FAILED"); return; }

  sendJson(res, 201, { ok: true, id: result.id });
}

// ─── DELETE /events/life/:id ──────────────────────────────────────────────────

export async function deleteLifeEventHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  auth: AuthContext,
  query: URLSearchParams,
): Promise<void> {
  const eventId = query.get("id");
  if (!eventId) { sendError(res, 400, "id is required", "MISSING_ID"); return; }

  const ok = await deleteLifeEvent(auth.client, auth.userId, eventId);
  if (!ok) { sendError(res, 500, "Failed to delete event", "DELETE_FAILED"); return; }

  sendJson(res, 200, { ok: true });
}
