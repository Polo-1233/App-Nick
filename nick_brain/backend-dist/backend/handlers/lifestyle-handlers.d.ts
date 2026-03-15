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
export declare function updateLifestyleHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext, _query: URLSearchParams): Promise<void>;
export declare function getLifeEventsHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext, _query: URLSearchParams): Promise<void>;
export declare function createLifeEventHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext, _query: URLSearchParams): Promise<void>;
export declare function deleteLifeEventHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext, query: URLSearchParams): Promise<void>;
