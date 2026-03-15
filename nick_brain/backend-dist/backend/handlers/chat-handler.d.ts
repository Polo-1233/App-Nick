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
export declare function chatHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext, _query: URLSearchParams): Promise<void>;
export declare function chatHistoryHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext, query: URLSearchParams): Promise<void>;
