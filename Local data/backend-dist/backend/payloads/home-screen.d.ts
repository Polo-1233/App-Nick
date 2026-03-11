/**
 * R90 Backend — Home Screen Payload Generator
 *
 * Produces the HomeScreenPayload from an EngineOutput and EngineContext.
 * Called after runAndPersistEngine() for every home screen request.
 */
import type { EngineOutput, EngineContext } from "../../engine/types.js";
import type { HomeScreenPayload } from "../types.js";
/**
 * Build the HomeScreenPayload from engine output and context.
 *
 * @param output   Result of runEngineSafe()
 * @param ctx      The EngineContext used for the engine run
 */
export declare function buildHomeScreenPayload(output: EngineOutput, ctx: EngineContext): HomeScreenPayload;
import type { AppClient } from "../db/client.js";
/**
 * Full flow: assemble context → run engine → build payload.
 * Does NOT persist engine output (reads-only use this path).
 * For post-write use, call buildHomeScreenPayload(output, ctx) directly.
 */
export declare function getHomeScreenPayload(client: AppClient, userId: string): Promise<HomeScreenPayload>;
