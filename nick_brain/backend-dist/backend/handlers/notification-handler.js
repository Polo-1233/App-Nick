/**
 * Notification handlers
 *
 * GET  /notifications/proactive — check and return proactive triggers
 * POST /notifications/dismiss   — dismiss a trigger for 24h
 */
import { readBody, sendJson, sendError } from "../server.js";
import { checkProactiveTriggers } from "../services/trigger-engine.js";
export async function proactiveNotificationHandler(_req, res, auth) {
    const triggers = await checkProactiveTriggers(auth.client, auth.userId);
    if (triggers.length === 0) {
        sendJson(res, 200, { trigger: null });
        return;
    }
    // Filter out triggers already sent (check notification_log)
    for (const trigger of triggers) {
        const { data: existing } = await auth.client
            .from("notification_log")
            .select("id")
            .eq("user_id", auth.userId)
            .eq("trigger_type", trigger.type)
            .gt("expires_at", new Date().toISOString())
            .limit(1);
        if (existing && existing.length > 0)
            continue;
        // This trigger hasn't been sent yet — log it and return
        await auth.client.from("notification_log").insert({
            user_id: auth.userId,
            trigger_type: trigger.type,
            expires_at: trigger.expires_at,
        });
        sendJson(res, 200, { trigger });
        return;
    }
    // All triggers already sent
    sendJson(res, 200, { trigger: null });
}
export async function dismissNotificationHandler(req, res, auth) {
    const body = await readBody(req);
    if (!body?.trigger_type) {
        sendError(res, 400, "trigger_type is required", "INVALID_BODY");
        return;
    }
    // Insert a notification_log entry that expires in 24h
    await auth.client.from("notification_log").insert({
        user_id: auth.userId,
        trigger_type: body.trigger_type,
        expires_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
    });
    sendJson(res, 200, { ok: true });
}
//# sourceMappingURL=notification-handler.js.map