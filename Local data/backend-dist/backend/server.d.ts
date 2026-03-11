/**
 * R90 Backend — HTTP Server
 *
 * Plain Node.js http server. No framework — MVP clarity.
 *
 * Routes:
 *   GET  /health                       → 200 OK
 *   POST /logs/sleep                   → submit_sleep_log
 *   POST /logs/daily                   → submit_daily_log
 *   POST /logs/checkin                 → submit_check_in
 *   GET  /screen/home                  → get_home_screen_payload
 *   GET  /screen/day-plan[?date=]      → get_day_plan_payload
 *   GET  /screen/checkin               → get_check_in_payload
 *   POST /profile                      → update_user_profile
 *   POST /profile/environment          → update_environment
 *   POST /actions/recommendation       → recommendation_action
 *
 * All routes except /health require a valid Supabase JWT
 * in the Authorization: Bearer <token> header.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
/** Read and JSON-parse the request body. Returns null on empty or invalid JSON. */
export declare function readBody<T>(req: IncomingMessage): Promise<T | null>;
/** Write a JSON response. */
export declare function sendJson(res: ServerResponse, status: number, body: unknown): void;
/** Write a standardised error response. */
export declare function sendError(res: ServerResponse, status: number, message: string, code?: string): void;
