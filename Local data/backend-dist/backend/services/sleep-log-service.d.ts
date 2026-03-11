/**
 * R90 Backend — Sleep Log Service
 *
 * submit_sleep_log: validate → compute derived fields → write → run engine
 */
import type { AppClient } from "../db/client.js";
import type { SleepLogInput, ServiceResult } from "../types.js";
import type { EngineOutput } from "../../engine/types.js";
export interface SleepLogResult {
    sleep_log_id: string;
    engine_output: EngineOutput;
}
/**
 * Submit a sleep log for a user.
 *
 * Cycle resolution:
 *   1. If cycles_completed is explicitly provided → use as-is (including null)
 *   2. Else if actual_sleep_onset AND wake_time are both provided → compute via formula
 *   3. Else → null (missing data — never defaults to 0 or triggers CRP)
 *
 * Computed fields set by this service:
 *   - arp_maintained: abs(wake_time - arp_time) ≤ 15 min
 */
export declare function submitSleepLog(client: AppClient, userId: string, input: SleepLogInput): Promise<ServiceResult<SleepLogResult>>;
