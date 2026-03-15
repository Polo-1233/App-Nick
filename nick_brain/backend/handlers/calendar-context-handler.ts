/**
 * Calendar context handlers
 *
 * POST /calendar/sync    — receive & classify calendar events
 * GET  /calendar/upcoming — fetch upcoming events within time window
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
import { readBody, sendJson, sendError } from "../server.js";
import { classifyCalendarEvent } from "../services/calendar-classifier.js";
import { upsertCalendarEvents } from "../db/mutations.js";
import { fetchUpcomingCalendarEvents } from "../db/queries.js";

// ─── POST /calendar/sync ─────────────────────────────────────────────────────

interface SyncBody {
  events: Array<{
    external_id: string;
    title:       string;
    start_time:  string;
    end_time:    string;
    all_day?:    boolean;
    source:      string;
  }>;
}

export async function calendarSyncHandler(
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext,
): Promise<void> {
  const body = await readBody<SyncBody>(req);
  if (!body?.events || !Array.isArray(body.events)) {
    sendError(res, 400, "Body must contain an events array", "INVALID_BODY");
    return;
  }

  if (body.events.length > 200) {
    sendError(res, 400, "Maximum 200 events per sync", "TOO_MANY_EVENTS");
    return;
  }

  // Classify each event
  const classified = body.events.map(e => ({
    ...e,
    event_type_hint: classifyCalendarEvent(e.title),
  }));

  const ok = await upsertCalendarEvents(auth.client, auth.userId, classified);
  if (!ok) {
    sendError(res, 500, "Failed to sync calendar events", "SYNC_FAILED");
    return;
  }

  sendJson(res, 200, { ok: true, synced: classified.length });
}

// ─── GET /calendar/upcoming ──────────────────────────────────────────────────

export async function calendarUpcomingHandler(
  _req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext,
  query: URLSearchParams,
): Promise<void> {
  const hours = Math.min(Math.max(parseInt(query.get("hours") ?? "48", 10) || 48, 1), 168);
  const events = await fetchUpcomingCalendarEvents(auth.client, auth.userId, hours);
  sendJson(res, 200, { events });
}
