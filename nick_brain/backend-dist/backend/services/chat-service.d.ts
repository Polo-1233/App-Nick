/**
 * chat-service.ts — LLM coaching layer for R90 Navigator
 *
 * Architecture principle:
 *   - The deterministic engine decides everything (states, recs, plan).
 *   - The LLM only reformulates engine outputs into natural coaching language.
 *   - The LLM cannot override R90 logic, change times, or invent methodology.
 *
 * Streaming:
 *   - Uses OpenAI GPT-4o with streaming enabled.
 *   - Yields SSE chunks to the HTTP response as they arrive.
 *   - The app accumulates chunks and renders progressively.
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
}
/**
 * Stream a GPT-4o response via SSE to the HTTP response object.
 *
 * SSE format:
 *   data: {"delta":"chunk"}\n\n
 *   data: [DONE]\n\n
 */
export declare function streamChatResponse(client: AppClient, userId: string, input: ChatInput, res: ServerResponse): Promise<void>;
