/**
 * oura-handlers.ts
 *
 * Oura Ring OAuth2 + data sync
 *
 * GET  /wearables/oura/connect   → redirect to Oura OAuth consent
 * GET  /wearables/oura/callback  → exchange code → store token
 * POST /wearables/oura/sync      → pull latest data from Oura API
 * DELETE /wearables/oura/disconnect → revoke + delete token
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
import { sendJson, sendError } from "../server.js";
import { createServerClient } from "../db/client.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const OURA_CLIENT_ID     = process.env.OURA_CLIENT_ID     ?? '';
const OURA_CLIENT_SECRET = process.env.OURA_CLIENT_SECRET ?? '';
const OURA_REDIRECT_URI  = process.env.OURA_REDIRECT_URI  ??
  'https://app-nick-production.up.railway.app/wearables/oura/callback';
const OURA_API_BASE      = 'https://api.ouraring.com/v2';
const OURA_AUTH_URL      = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL     = 'https://api.ouraring.com/oauth/token';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoRange(daysBack: number): { start: string; end: string } {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  };
}

async function ouraFetch(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`${OURA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Oura API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function refreshOuraToken(refreshToken: string): Promise<{
  access_token: string; refresh_token: string; expires_in: number;
}> {
  const res = await fetch(OURA_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     OURA_CLIENT_ID,
      client_secret: OURA_CLIENT_SECRET,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

async function getValidToken(userId: string): Promise<string | null> {
  const db = createServerClient();
  const { data } = await db
    .from('wearable_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('source', 'oura')
    .single();

  if (!data) return null;

  // Refresh if expired (with 5-min buffer)
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt && Date.now() > expiresAt - 5 * 60 * 1000) {
    try {
      const tokens = await refreshOuraToken(data.refresh_token);
      const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      await db.from('wearable_tokens').update({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at:    newExpiry,
        updated_at:    new Date().toISOString(),
      }).eq('user_id', userId).eq('source', 'oura');
      return tokens.access_token;
    } catch {
      return null;
    }
  }

  return data.access_token;
}

// ─── GET /wearables/oura/connect ─────────────────────────────────────────────
// Returns the OAuth URL — app opens it in a WebBrowser

export async function ouraConnectHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  ctx:  AuthContext,
): Promise<void> {
  if (!OURA_CLIENT_ID) { sendError(res, 503, 'Oura not configured'); return; }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     OURA_CLIENT_ID,
    redirect_uri:  OURA_REDIRECT_URI,
    scope:         'daily heartrate personal session spo2 workout',
    // Pass userId in state so callback knows which user to store token for
    state:         ctx.userId,
  });

  sendJson(res, 200, { ok: true, url: `${OURA_AUTH_URL}?${params.toString()}` });
}

// ─── GET /wearables/oura/callback ────────────────────────────────────────────
// Called by Oura after user grants permission

export async function ouraCallbackHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  _ctx: AuthContext,
  query: Record<string, string>,
): Promise<void> {
  const { code, state: userId, error } = query;

  if (error || !code || !userId) {
    res.writeHead(302, { Location: 'r90://wearables/oura?status=error' });
    res.end();
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(OURA_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: OURA_REDIRECT_URI,
        client_id:    OURA_CLIENT_ID,
        client_secret: OURA_CLIENT_SECRET,
      }).toString(),
    });

    if (!tokenRes.ok) throw new Error(await tokenRes.text());

    const tokens = await tokenRes.json() as {
      access_token:  string;
      refresh_token: string;
      expires_in:    number;
      token_type:    string;
    };

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await createServerClient().from('wearable_tokens').upsert({
      user_id:       userId,
      source:        'oura',
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    expiresAt,
      scope:         'daily heartrate personal session spo2 workout',
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id,source' });

    // Trigger immediate data sync
    void pullOuraData(userId, tokens.access_token);

    // Redirect back to app
    res.writeHead(302, { Location: 'r90://wearables/oura?status=connected' });
    res.end();
  } catch (e: any) {
    console.error('[oura/callback]', e.message);
    res.writeHead(302, { Location: 'r90://wearables/oura?status=error' });
    res.end();
  }
}

// ─── POST /wearables/oura/sync ────────────────────────────────────────────────

export async function ouraSyncHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  ctx:  AuthContext,
): Promise<void> {
  const token = await getValidToken(ctx.userId);
  if (!token) { sendError(res, 401, 'Oura not connected'); return; }

  try {
    await pullOuraData(ctx.userId, token);
    sendJson(res, 200, { ok: true });
  } catch (e: any) {
    sendError(res, 500, e.message);
  }
}

// ─── DELETE /wearables/oura/disconnect ───────────────────────────────────────

export async function ouraDisconnectHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  ctx:  AuthContext,
): Promise<void> {
  await createServerClient()
    .from('wearable_tokens')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('source', 'oura');

  sendJson(res, 200, { ok: true });
}

// ─── Core: pull Oura data + store ────────────────────────────────────────────

async function pullOuraData(userId: string, accessToken: string): Promise<void> {
  const { start, end } = isoRange(7); // Last 7 days
  const db = createServerClient();

  // Fetch in parallel
  const [sleepRes, readinessRes, hrvRes] = await Promise.allSettled([
    ouraFetch(`/usercollection/daily_sleep?start_date=${start}&end_date=${end}`, accessToken),
    ouraFetch(`/usercollection/daily_readiness?start_date=${start}&end_date=${end}`, accessToken),
    ouraFetch(`/usercollection/daily_cardiovascular_age?start_date=${start}&end_date=${end}`, accessToken),
  ]);

  const sleepData     = sleepRes.status     === 'fulfilled' ? sleepRes.value?.data     ?? [] : [];
  const readinessData = readinessRes.status === 'fulfilled' ? readinessRes.value?.data ?? [] : [];

  // Build combined daily rows
  const byDate: Record<string, any> = {};

  sleepData.forEach((s: any) => {
    byDate[s.day] = {
      ...byDate[s.day],
      sleep_duration_min: s.contributors?.total_sleep ? Math.round(s.contributors.total_sleep / 60) : null,
      sleep_efficiency:   s.contributors?.efficiency  ? s.contributors.efficiency / 100 : null,
      rem_min:            s.contributors?.rem_sleep   ? Math.round(s.contributors.rem_sleep / 60) : null,
      deep_min:           s.contributors?.deep_sleep  ? Math.round(s.contributors.deep_sleep / 60) : null,
      hrv_ms:             s.average_hrv ?? null,
      resting_hr:         s.lowest_heart_rate ?? null,
      raw_sleep:          s,
    };
  });

  readinessData.forEach((r: any) => {
    byDate[r.day] = {
      ...byDate[r.day],
      readiness_score: r.score ?? null,
      raw_readiness:   r,
    };
  });

  // Upsert rows
  const rows = Object.entries(byDate).map(([day, d]) => ({
    user_id:            userId,
    source:             'oura',
    collected_at:       new Date(`${day}T12:00:00Z`).toISOString(),
    sleep_duration_min: d.sleep_duration_min ?? null,
    sleep_efficiency:   d.sleep_efficiency   ?? null,
    rem_min:            d.rem_min            ?? null,
    deep_min:           d.deep_min           ?? null,
    hrv_ms:             d.hrv_ms             ?? null,
    resting_hr:         d.resting_hr         ?? null,
    readiness_score:    d.readiness_score    ?? null,
    raw_data:           { sleep: d.raw_sleep, readiness: d.raw_readiness },
  }));

  if (rows.length) {
    await db.from('wearable_data').upsert(rows, {
      onConflict: 'user_id,source,collected_at',
      ignoreDuplicates: false,
    });
  }
}
