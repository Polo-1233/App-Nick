/**
 * R90 Backend — Engine Service
 *
 * Orchestrates: assemble context → run engine → persist results.
 *
 * This is the single point of engine execution for all write flows.
 * All log submission services call runAndPersistEngine() after writing.
 */
import type { AppClient } from "../db/client.js";
import type { EngineOutput } from "../../engine/types.js";
/**
 * Full engine execution cycle for a user:
 * 1. Assemble EngineContext from Supabase
 * 2. Run the deterministic engine
 * 3. Persist states, recommendations, and weekly balance back to DB
 *
 * Returns the EngineOutput for use by the calling service (payload generation, etc.)
 */
export declare function runAndPersistEngine(client: AppClient, userId: string, now?: string): Promise<EngineOutput>;
/**
 * Compute the rolling week start date from ARP commitment date and today.
 */
export declare function computeWeekStart(arpCommittedAt: string, today: string): string;
/**
 * Generate and persist ARP config from an ARP time string.
 * Called when a user commits to an ARP during onboarding or updates it.
 */
export declare function generateAndPersistARPConfig(client: AppClient, userId: string, arpTime: string): Promise<void>;
