/**
 * Tool executor for OpenAI function calling
 *
 * Dispatches tool calls to the appropriate data fetchers.
 * Returns JSON string results. Never throws.
 */
import type { AppClient } from "../db/client.js";
/**
 * Execute a tool call and return a JSON string result.
 * Never throws — returns error JSON on failure.
 */
export declare function executeTool(name: string, args: Record<string, unknown>, userId: string, client: AppClient): Promise<string>;
