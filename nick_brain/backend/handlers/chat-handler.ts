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

import type { IncomingMessage, ServerResponse } from "node:http";
import type { URLSearchParams } from "node:url";
import type { AuthContext } from "../middleware/auth.js";
import type { ChatInput } from "../services/chat-service.js";
import { streamChatResponse } from "../services/chat-service.js";
import { readBody, sendError } from "../server.js";

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
    message: body.message.trim(),
    history: Array.isArray(body.history) ? body.history : [],
  };

  await streamChatResponse(auth.client, auth.userId, input, res);
}
