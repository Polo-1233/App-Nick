/**
 * chat-handler.ts — POST /chat
 *
 * Receives a user message + conversation history.
 * Assembles R90 engine context, then streams a GPT-4o response via SSE.
 *
 * Request body:
 *   { message: string, history?: Array<{role, content}> }
 *
 * Response: text/event-stream (SSE)
 *   data: {"delta":"chunk"}\n\n
 *   data: [DONE]\n\n
 *   data: {"error":"message"}\n\n  (on error)
 */
import { streamChatResponse } from "../services/chat-service.js";
import { sendError } from "../server.js";
export async function chatHandler(req, res, auth) {
    // Parse body manually (readBody from server.ts is not SSE-compatible)
    const body = await readBody(req);
    if (!body || typeof body.message !== "string" || !body.message.trim()) {
        sendError(res, 400, "message is required", "MISSING_MESSAGE");
        return;
    }
    const input = {
        message: body.message.trim(),
        history: Array.isArray(body.history) ? body.history : [],
    };
    await streamChatResponse(auth.client, auth.userId, input, res);
}
async function readBody(req) {
    return new Promise(resolve => {
        let raw = "";
        req.setEncoding("utf-8");
        req.on("data", (chunk) => { raw += chunk; });
        req.on("end", () => {
            try {
                resolve(JSON.parse(raw));
            }
            catch {
                resolve(null);
            }
        });
        req.on("error", () => resolve(null));
    });
}
//# sourceMappingURL=chat-handler.js.map