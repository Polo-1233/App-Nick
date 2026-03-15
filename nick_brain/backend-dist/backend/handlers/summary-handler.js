/**
 * Weekly summary handlers
 *
 * POST /summaries/calculate — trigger calculation for a specific week
 * GET  /summaries/recent    — fetch recent summaries
 */
import { readBody, sendJson, sendError } from "../server.js";
import { calculateWeeklySummary, getWeekStart } from "../services/weekly-summary-service.js";
import { fetchWeeklySummaries } from "../db/queries.js";
export async function calculateSummaryHandler(req, res, auth) {
    const body = await readBody(req);
    const weekStart = body?.week_start ?? getWeekStart(new Date());
    try {
        await calculateWeeklySummary(auth.client, auth.userId, weekStart);
        sendJson(res, 200, { ok: true, week_start: weekStart });
    }
    catch (err) {
        console.error("[summary] Calculate failed:", err instanceof Error ? err.message : err);
        sendError(res, 500, "Failed to calculate summary", "CALC_FAILED");
    }
}
export async function recentSummariesHandler(_req, res, auth, query) {
    const limit = Math.min(Math.max(parseInt(query.get("limit") ?? "4", 10) || 4, 1), 12);
    const summaries = await fetchWeeklySummaries(auth.client, auth.userId, limit);
    sendJson(res, 200, { summaries });
}
//# sourceMappingURL=summary-handler.js.map