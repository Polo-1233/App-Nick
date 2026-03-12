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
import type { AuthContext } from "../middleware/auth.js";
export declare function chatHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
