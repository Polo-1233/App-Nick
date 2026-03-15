/**
 * Weekly summary handlers
 *
 * POST /summaries/calculate — trigger calculation for a specific week
 * GET  /summaries/recent    — fetch recent summaries
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
export declare function calculateSummaryHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
export declare function recentSummariesHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext, query: URLSearchParams): Promise<void>;
