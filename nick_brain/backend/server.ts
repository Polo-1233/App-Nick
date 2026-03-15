/**
 * R90 Backend - HTTP Server
 *
 * Plain Node.js http server. No framework - MVP clarity.
 *
 * Routes:
 *   GET  /health                       -> 200 OK
 *   POST /logs/sleep                   -> submit_sleep_log
 *   POST /logs/daily                   -> submit_daily_log
 *   POST /logs/checkin                 -> submit_check_in
 *   GET  /screen/home                  -> get_home_screen_payload
 *   GET  /screen/day-plan[?date=]      -> get_day_plan_payload
 *   GET  /screen/checkin               -> get_check_in_payload
 *   POST /profile                      -> update_user_profile
 *   POST /profile/environment          -> update_environment
 *   POST /actions/recommendation       -> recommendation_action
 *
 * All routes except /health require a valid Supabase JWT
 * in the Authorization: Bearer <token> header.
 */

import http from "node:http";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { runMigrations } from "./db/migrate.js";
import { authenticate, authenticateSignup } from "./middleware/auth.js";
import type { AuthContext, SignupAuthContext } from "./middleware/auth.js";
import {
  submitSleepLogHandler,
  submitDailyLogHandler,
  submitCheckInHandler,
} from "./handlers/log-handlers.js";
import {
  homeScreenHandler,
  dayPlanHandler,
  checkInPayloadHandler,
} from "./handlers/payload-handlers.js";
import {
  createUserHandler,
  updateProfileHandler,
  updateEnvironmentHandler,
  recommendationActionHandler,
} from "./handlers/profile-handlers.js";
import { chatHandler, chatHistoryHandler } from "./handlers/chat-handler.js";
import { deleteAccountHandler } from "./handlers/account-handlers.js";
import {
  updateLifestyleHandler,
  getLifeEventsHandler,
  createLifeEventHandler,
  deleteLifeEventHandler,
} from "./handlers/lifestyle-handlers.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext,
  query: URLSearchParams
) => Promise<void>;

type SignupHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  auth: SignupAuthContext,
  query: URLSearchParams
) => Promise<void>;

interface Route {
  method: string;
  path: string;
  handler: Handler;
  signup?: false;
}

interface SignupRoute {
  method: string;
  path: string;
  handler: SignupHandler;
  signup: true;
}

type AnyRoute = Route | SignupRoute;

// ─── Route table ──────────────────────────────────────────────────────────────

const routes: AnyRoute[] = [
  // Signup - uses authenticateSignup (no existing users row required)
  { method: "POST", path: "/users", handler: createUserHandler, signup: true },
  // Standard authenticated routes
  { method: "POST", path: "/logs/sleep", handler: submitSleepLogHandler },
  { method: "POST", path: "/logs/daily", handler: submitDailyLogHandler },
  { method: "POST", path: "/logs/checkin", handler: submitCheckInHandler },
  { method: "GET", path: "/screen/home", handler: homeScreenHandler },
  { method: "GET", path: "/screen/day-plan", handler: dayPlanHandler },
  { method: "GET", path: "/screen/checkin", handler: checkInPayloadHandler },
  { method: "POST", path: "/profile", handler: updateProfileHandler },
  { method: "POST", path: "/profile/environment", handler: updateEnvironmentHandler },
  { method: "POST", path: "/actions/recommendation", handler: recommendationActionHandler },
  { method: "POST", path: "/chat",         handler: chatHandler },
  { method: "GET",  path: "/chat/history", handler: chatHistoryHandler },
  { method: "DELETE", path: "/account",          handler: deleteAccountHandler },
  { method: "PUT",    path: "/profile/lifestyle", handler: updateLifestyleHandler },
  { method: "GET",    path: "/events/life",        handler: getLifeEventsHandler },
  { method: "POST",   path: "/events/life",        handler: createLifeEventHandler },
  { method: "DELETE", path: "/events/life",        handler: deleteLifeEventHandler },
];

// ─── Request helpers ──────────────────────────────────────────────────────────

/** Read and JSON-parse the request body. Returns null on empty or invalid JSON. */
export async function readBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise(resolve => {
    let raw = "";
    req.setEncoding("utf-8");
    req.on("data", (chunk: string) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw) as T);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

/** Write a JSON response. */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
  });
  res.end(payload);
}

/** Write a standardised error response. */
export function sendError(
  res: ServerResponse,
  status: number,
  message: string,
  code?: string
): void {
  sendJson(res, status, { error: message, ...(code ? { code } : {}) });
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method?.toUpperCase() ?? "";
  const rawUrl = req.url ?? "/";
  const urlObj = new URL(rawUrl, "http://localhost");
  const path = urlObj.pathname;
  const query = urlObj.searchParams;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    });
    res.end();
    return;
  }

  // Public health check
  if (method === "GET" && path === "/health") {
    sendJson(res, 200, { ok: true, service: "r90-backend", ts: new Date().toISOString() });
    return;
  }

  const route = routes.find(r => r.method === method && r.path === path);
  if (!route) {
    sendError(res, 404, `No route for ${method} ${path}`);
    return;
  }

  try {
    if (route.signup) {
      // POST /users - validate JWT but don't require an existing users row
      const authResult = await authenticateSignup(req);
      if (!authResult.ok) {
        console.warn(`[auth] ${method} ${path} rejected: ${authResult.reason}`);
        sendError(res, 401, "Unauthorized", "AUTH_FAILED");
        return;
      }
      await route.handler(req, res, authResult.ctx, query);
    } else {
      // Standard routes - require existing users row
      const authResult = await authenticate(req);
      if (!authResult.ok) {
        console.warn(`[auth] ${method} ${path} rejected: ${authResult.reason}`);
        sendError(res, 401, "Unauthorized", "AUTH_FAILED");
        return;
      }
      await route.handler(req, res, authResult.ctx, query);
    }
  } catch (err) {
    console.error(`[server] unhandled error in ${method} ${path}:`, err);
    if (!res.headersSent) {
      sendError(res, 500, "Internal server error", "SERVER_ERROR");
    }
  }
}

// ─── .env loader (no external dep) ───────────────────────────────────────────

function loadDotEnv(): void {
  try {
    const content = fs.readFileSync(".env", "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env not present - environment variables must be set externally
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

loadDotEnv();

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
const HOST = "0.0.0.0";

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error("[server] fatal handler error:", err);
    if (!res.headersSent) sendError(res, 500, "Internal server error", "FATAL");
  });
});

// Run migrations before accepting traffic
runMigrations().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`\nR90 backend listening on http://${HOST}:${PORT}`);
    console.log("Routes:");
    for (const r of routes) {
      console.log(`  ${r.method.padEnd(4)} ${r.path}`);
    }
    console.log();
  });
}).catch(err => {
  console.error("[server] Migration runner failed:", err);
  // Start anyway — migrations are non-blocking
  server.listen(PORT, HOST, () => {
    console.log(`\nR90 backend listening on http://${HOST}:${PORT} (migrations skipped)`);
  });
});