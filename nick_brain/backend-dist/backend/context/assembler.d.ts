/**
 * R90 Backend — EngineContext Assembler
 *
 * Reads all required Supabase records for a user and assembles a valid
 * EngineContext ready to be passed to runEngineSafe().
 *
 * This is the bridge between the Supabase data layer and the pure engine.
 */
import type { EngineContext } from "../../engine/types.js";
import type { AppClient } from "../db/client.js";
/**
 * Assemble a complete EngineContext for a user from the Supabase database.
 *
 * @param client   Service-role Supabase client
 * @param userId   App-level users.id (not auth_user_id)
 * @param now      ISO timestamp for the evaluation point (default: new Date())
 */
export declare function assembleEngineContext(client: AppClient, userId: string, now?: string): Promise<EngineContext>;
