/**
 * chat-service.ts — LLM coaching layer for R90 Navigator
 *
 * Architecture principle:
 *   - The deterministic engine decides everything (states, recs, plan).
 *   - The LLM only reformulates engine outputs into natural coaching language.
 *   - The LLM cannot override R90 logic, change times, or invent methodology.
 *
 * Fixes applied (2026-03-15):
 *   1. Persona renamed "Airloop" → "R-Lo" throughout
 *   2. Retry logic: up to 2 retries with exponential backoff
 *   3. Conversation persistence via chat_messages table
 *   4. Structured context injection (sections instead of free text)
 *   5. Light input moderation/validation
 */
import type { ServerResponse } from "node:http";
import type { AppClient } from "../db/client.js";
export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}
export interface ChatInput {
    message: string;
    history?: ChatMessage[];
    session_id?: string;
}
/**
 * Stream a response to the HTTP response object via SSE.
 *
 * Strategy:
 *   1. Validate input
 *   2. Load persisted history from DB (supplement client-side history)
 *   3. Build structured context from engine
 *   4. Call OpenAI with tools (dynamic data via tool calls)
 *   5. Fallback: static context if tool calling fails
 *   6. Persist the exchange to DB
 *   7. Fake-stream the response
 */
export declare function streamChatResponse(client: AppClient, userId: string, input: ChatInput, res: ServerResponse): Promise<void>;
/**
 * Load recent conversation history for the chat screen on app startup.
 * Called by the chat init API to pre-populate conversation.
 */
export declare function loadChatHistory(client: AppClient, userId: string, limit?: number): Promise<ChatMessage[]>;
