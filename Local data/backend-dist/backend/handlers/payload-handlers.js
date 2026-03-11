/**
 * R90 Backend — Screen Payload Handlers
 *
 * GET /screen/home             → get_home_screen_payload
 * GET /screen/day-plan[?date=] → get_day_plan_payload
 * GET /screen/checkin          → get_check_in_payload
 */
import { getHomeScreenPayload } from "../payloads/home-screen.js";
import { getDayPlanPayload } from "../payloads/day-plan.js";
import { getCheckInPayload } from "../payloads/check-in.js";
import { sendJson, sendError } from "../server.js";
// ─── GET /screen/home ─────────────────────────────────────────────────────────
export async function homeScreenHandler(_req, res, auth) {
    const payload = await getHomeScreenPayload(auth.client, auth.userId);
    sendJson(res, 200, payload);
}
// ─── GET /screen/day-plan ─────────────────────────────────────────────────────
export async function dayPlanHandler(_req, res, auth, query) {
    const date = query.get("date") ?? undefined;
    // Validate date param if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        sendError(res, 400, "date param must be YYYY-MM-DD", "INVALID_DATE");
        return;
    }
    const payload = await getDayPlanPayload(auth.client, auth.userId, date);
    if (!payload) {
        sendError(res, 404, "ARP config not found. Complete onboarding first.", "NO_ARP_CONFIG");
        return;
    }
    sendJson(res, 200, payload);
}
// ─── GET /screen/checkin ──────────────────────────────────────────────────────
export async function checkInPayloadHandler(_req, res, auth) {
    const payload = await getCheckInPayload(auth.client, auth.userId);
    sendJson(res, 200, payload);
}
//# sourceMappingURL=payload-handlers.js.map