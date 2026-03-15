/**
 * Calendar context handlers
 *
 * POST /calendar/sync    — receive & classify calendar events
 * GET  /calendar/upcoming — fetch upcoming events within time window
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
export declare function calendarSyncHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
export declare function calendarUpcomingHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext, query: URLSearchParams): Promise<void>;
