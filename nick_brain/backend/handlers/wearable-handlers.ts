/**
 * wearable-handlers.ts
 *
 * POST /wearables/sync           — receive Apple Health data from app
 * POST /wearables/apple/register — mark Apple Health as connected (permission granted)
 * GET  /wearables/status         — connected sources for current user
 * GET  /wearables/latest         — latest snapshot per source (for LLM context)
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
import { readBody, sendJson, sendError } from "../server.js";
import { createServerClient } from "../db/client.js";

// ─── POST /wearables/sync ─────────────────────────────────────────────────────

export async function wearableSyncHandler(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: AuthContext,
): Promise<void> {
  const body = await readBody(req) as {
    source: string;
    data:   Record<string, unknown>;
  };

  if (!body?.source || !body?.data) {
    sendError(res, 400, "Missing source or data");
    return;
  }

  const { source, data } = body;
  const userId = ctx.userId;

  if (source === "apple_health") {
    const d = data as {
      sleepDurationMin:  number | null;
      sleepEfficiency:   number | null;
      sleepSamples:      Array<{ startDate: string; endDate: string; value: string }>;
      hrv:               number | null;
      restingHR:         number | null;
      activeEnergyKcal:  number | null;
      stepCount:         number | null;
      collectedAt:       string;
    };

    const asleepSamples = (d.sleepSamples ?? [])
      .filter(s => ["ASLEEP", "DEEP", "CORE", "REM"].includes(s.value));

    const sleepOnset = asleepSamples.length
      ? asleepSamples.reduce((earliest, s) =>
          new Date(s.startDate) < new Date(earliest) ? s.startDate : earliest,
          asleepSamples[0].startDate)
      : null;

    const sleepEnd = asleepSamples.length
      ? asleepSamples.reduce((latest, s) =>
          new Date(s.endDate) > new Date(latest) ? s.endDate : latest,
          asleepSamples[0].endDate)
      : null;

    const stageDuration = (stage: string): number | null => {
      const ms = (d.sleepSamples ?? [])
        .filter(s => s.value === stage)
        .reduce((sum, s) =>
          sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()), 0);
      return ms > 0 ? Math.round(ms / 60000) : null;
    };

    const { error } = await createServerClient().from("wearable_data").insert({
      user_id:            userId,
      source:             "apple_health",
      collected_at:       d.collectedAt,
      sleep_duration_min: d.sleepDurationMin,
      sleep_efficiency:   d.sleepEfficiency,
      sleep_onset:        sleepOnset,
      sleep_end:          sleepEnd,
      rem_min:            stageDuration("REM"),
      deep_min:           stageDuration("DEEP"),
      light_min:          stageDuration("CORE"),
      awake_min:          stageDuration("AWAKE"),
      hrv_ms:             d.hrv,
      resting_hr:         d.restingHR,
      active_kcal:        d.activeEnergyKcal,
      step_count:         d.stepCount,
      raw_data:           d,
    });

    if (error) {
      console.error("[wearables/sync] DB error:", error.message);
      sendError(res, 500, "Failed to store wearable data");
      return;
    }

    sendJson(res, 200, { ok: true, source: "apple_health" });
    return;
  }

  sendError(res, 400, `Unsupported source: ${source}`);
}

// ─── POST /wearables/apple/register ──────────────────────────────────────────

export async function appleHealthRegisterHandler(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: AuthContext,
): Promise<void> {
  const { error } = await createServerClient()
    .from("wearable_tokens")
    .upsert(
      { user_id: ctx.userId, source: "apple_health", access_token: "granted", updated_at: new Date().toISOString() },
      { onConflict: "user_id,source" }
    );
  if (error) { sendError(res, 500, error.message); return; }
  sendJson(res, 200, { ok: true });
}

// ─── GET /wearables/status ────────────────────────────────────────────────────

export async function wearableStatusHandler(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: AuthContext,
): Promise<void> {
  const userId = ctx.userId;

  const [{ data: tokens }, { data: latest }] = await Promise.all([
    createServerClient().from("wearable_tokens").select("source, updated_at").eq("user_id", userId),
    createServerClient().from("wearable_data")
      .select("source, collected_at")
      .eq("user_id", userId)
      .order("collected_at", { ascending: false })
      .limit(10),
  ]);

  const sourceMap: Record<string, { connected: boolean; lastSync: string | null }> = {
    apple_health: { connected: false, lastSync: null },
    oura:         { connected: false, lastSync: null },
    whoop:        { connected: false, lastSync: null },
  };

  (tokens ?? []).forEach((t: any) => {
    if (sourceMap[t.source]) sourceMap[t.source].connected = true;
  });

  // lastSync comes from wearable_data, but connected stays token-driven only
  // (apple_health has no token — it's permission-based, tracked separately)
  (latest ?? []).forEach((row: any) => {
    if (sourceMap[row.source] && !sourceMap[row.source].lastSync) {
      sourceMap[row.source].lastSync = row.collected_at;
      // Do NOT set connected=true from data alone — only token presence counts
    }
  });

  sendJson(res, 200, { ok: true, sources: sourceMap });
}

// ─── GET /wearables/latest ────────────────────────────────────────────────────

// ─── GET /wearables/history ───────────────────────────────────────────────────

export async function wearableHistoryHandler(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: AuthContext,
): Promise<void> {
  const { data, error } = await createServerClient()
    .from("wearable_data")
    .select("source, collected_at, sleep_duration_min, sleep_efficiency, hrv_ms, resting_hr, readiness_score, rem_min, deep_min")
    .eq("user_id", ctx.userId)
    .order("collected_at", { ascending: false })
    .limit(30);

  if (error) { sendError(res, 500, error.message); return; }
  sendJson(res, 200, { ok: true, data: data ?? [] });
}

// ─── GET /wearables/latest ────────────────────────────────────────────────────

export async function wearableLatestHandler(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: AuthContext,
): Promise<void> {
  const { data, error } = await createServerClient()
    .from("wearable_data")
    .select("source, collected_at, sleep_duration_min, sleep_efficiency, hrv_ms, resting_hr, readiness_score, strain_score, rem_min, deep_min")
    .eq("user_id", ctx.userId)
    .order("collected_at", { ascending: false })
    .limit(5);

  if (error) { sendError(res, 500, error.message); return; }

  const bySource: Record<string, unknown> = {};
  (data ?? []).forEach((row: any) => {
    if (!bySource[row.source]) bySource[row.source] = row;
  });

  sendJson(res, 200, { ok: true, data: bySource });
}
