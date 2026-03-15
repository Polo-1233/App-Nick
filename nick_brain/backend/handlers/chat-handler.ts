/**
 * chat-handler.ts — Chat routes
 *
 * POST /chat
 *   Receives a user message, streams R-Lo response via SSE.
 *   Body: { message: string, history?: [{role, content}], session_id?: string }
 *   Response: text/event-stream
 *     data: {"delta":"chunk"}\n\n
 *     data: [DONE]\n\n
 *     data: {"error":"message"}\n\n
 *
 * GET /chat/history
 *   Returns recent conversation history for chat screen initialisation.
 *   Response: { messages: [{role, content}] }
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { URLSearchParams } from "node:url";
import type { AuthContext } from "../middleware/auth.js";
import type { ChatInput } from "../services/chat-service.js";
import { streamChatResponse, loadChatHistory } from "../services/chat-service.js";
import { readBody, sendError, sendJson } from "../server.js";

export async function chatHandler(
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext,
  _query: URLSearchParams,
): Promise<void> {
  const body = await readBody<ChatInput>(req);
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    sendError(res, 400, "message is required", "MISSING_MESSAGE");
    return;
  }

  const input: ChatInput = {
    message:    body.message.trim(),
    history:    Array.isArray(body.history) ? body.history : [],
    session_id: typeof body.session_id === "string" ? body.session_id : undefined,
  };

  await streamChatResponse(auth.client, auth.userId, input, res);
}

export async function chatHistoryHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  auth: AuthContext,
  query: URLSearchParams,
): Promise<void> {
  const limit = Math.min(parseInt(query.get("limit") ?? "20", 10), 50);
  const messages = await loadChatHistory(auth.client, auth.userId, limit);
  sendJson(res, 200, { messages });
}
