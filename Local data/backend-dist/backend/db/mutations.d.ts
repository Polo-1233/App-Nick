/**
 * R90 Backend — Database Write Operations
 *
 * All functions take an AppClient (service role) and a userId.
 * Callers must verify ownership before calling these functions.
 */
import type { AppClient } from "./client.js";
import type { SleepLogInput, DailyLogInput, EventInput, ProfileUpdateInput, EnvironmentInput, RecommendationAction } from "../types.js";
import type { DetectedState, RecommendationOutput, WeeklyAccountingOutput } from "../../engine/types.js";
export declare function createUser(client: AppClient, authUid: string, timezone?: string): Promise<{
    id: string;
} | null>;
export declare function createUserProfile(client: AppClient, userId: string, input: ProfileUpdateInput): Promise<boolean>;
export declare function updateUserProfile(client: AppClient, userId: string, input: ProfileUpdateInput): Promise<boolean>;
/**
 * Upsert the computed ARP config into the DB.
 * Called by the engine service after generateARPConfig().
 */
export declare function upsertARPConfig(client: AppClient, userId: string, config: {
    arp_time: string;
    cycle_times: string[];
    phase_1_start: string;
    phase_2_start: string;
    phase_3_start: string;
    phase_4_start: string;
    crp_window_open: string;
    crp_window_close: string;
    sleep_onset_6cycle: string;
    sleep_onset_5cycle: string;
    sleep_onset_4cycle: string;
    sleep_onset_3cycle: string;
    mrm_times: string[];
}): Promise<boolean>;
export declare function upsertSleepLog(client: AppClient, userId: string, input: SleepLogInput & {
    arp_maintained?: boolean;
    computed_cycles?: number | null;
}): Promise<{
    id: string;
} | null>;
export declare function upsertDailyLog(client: AppClient, userId: string, input: DailyLogInput & {
    crp_in_window?: boolean;
    caffeine_after_cutoff?: boolean;
}): Promise<{
    id: string;
} | null>;
/**
 * Upsert the weekly cycle balance with freshly computed accounting values.
 * Creates a new record if none exists for the week_start date.
 */
export declare function upsertWeeklyBalance(client: AppClient, userId: string, weekStart: string, weekEnd: string, accounting: WeeklyAccountingOutput, nocturnalPerDay: (number | null)[], crpPerDay: (number | null)[]): Promise<boolean>;
/**
 * Sync detected states to the DB:
 * - Activate new states (upsert with active=true)
 * - Deactivate states that are no longer detected
 */
export declare function syncUserStates(client: AppClient, userId: string, detectedStates: DetectedState[]): Promise<void>;
/**
 * Replace all pending/delivered recommendations for a user with the new engine output.
 * Previous recommendations that are 'actioned' or 'dismissed' are preserved.
 */
export declare function persistRecommendations(client: AppClient, userId: string, recommendations: RecommendationOutput[]): Promise<void>;
/**
 * Update recommendation cooldowns after delivery.
 */
export declare function updateCooldown(client: AppClient, userId: string, recType: string): Promise<void>;
/**
 * Handle user action on a recommendation (actioned / dismissed).
 */
export declare function updateRecommendationStatus(client: AppClient, userId: string, recommendationId: string, action: RecommendationAction): Promise<boolean>;
export declare function createEvent(client: AppClient, userId: string, input: EventInput): Promise<{
    id: string;
} | null>;
export declare function resolveEvent(client: AppClient, userId: string, eventId: string): Promise<boolean>;
export declare function upsertEnvironment(client: AppClient, userId: string, input: EnvironmentInput): Promise<boolean>;
