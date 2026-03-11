/**
 * R90 Backend — Log Submission Handlers
 *
 * POST /logs/sleep   → submit_sleep_log
 * POST /logs/daily   → submit_daily_log
 * POST /logs/checkin → submit_check_in
 */
import { submitSleepLog } from "../services/sleep-log-service.js";
import { submitDailyLog } from "../services/daily-log-service.js";
import { submitCheckIn } from "../services/check-in-service.js";
import { readBody, sendJson, sendError } from "../server.js";
// ─── POST /logs/sleep ─────────────────────────────────────────────────────────
export async function submitSleepLogHandler(req, res, auth) {
    const body = await readBody(req);
    if (!body) {
        sendError(res, 400, "Request body must be valid JSON", "INVALID_BODY");
        return;
    }
    const result = await submitSleepLog(auth.client, auth.userId, body);
    if (!result.ok) {
        sendJson(res, 422, { error: result.error, code: result.code });
        return;
    }
    sendJson(res, 200, result.data);
}
// ─── POST /logs/daily ─────────────────────────────────────────────────────────
export async function submitDailyLogHandler(req, res, auth) {
    const body = await readBody(req);
    if (!body) {
        sendError(res, 400, "Request body must be valid JSON", "INVALID_BODY");
        return;
    }
    const result = await submitDailyLog(auth.client, auth.userId, body);
    if (!result.ok) {
        sendJson(res, 422, { error: result.error, code: result.code });
        return;
    }
    sendJson(res, 200, result.data);
}
// ─── POST /logs/checkin ───────────────────────────────────────────────────────
export async function submitCheckInHandler(req, res, auth) {
    const body = await readBody(req);
    if (!body) {
        sendError(res, 400, "Request body must be valid JSON", "INVALID_BODY");
        return;
    }
    const result = await submitCheckIn(auth.client, auth.userId, body);
    if (!result.ok) {
        sendJson(res, 422, { error: result.error, code: result.code });
        return;
    }
    sendJson(res, 200, result.data);
}
//# sourceMappingURL=log-handlers.js.map