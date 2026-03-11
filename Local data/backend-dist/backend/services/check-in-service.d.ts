/**
 * R90 Backend — Check-In Service
 *
 * submit_check_in: lightweight daily input → write to daily_logs → run engine
 *
 * The check-in is a subset of the daily log. It collects the highest-signal
 * fields without asking for everything. Max 3 questions surfaced to the user.
 */
import type { AppClient } from "../db/client.js";
import type { CheckInInput, ServiceResult } from "../types.js";
import type { EngineOutput } from "../../engine/types.js";
export interface CheckInResult {
    daily_log_id: string;
    engine_output: EngineOutput;
}
/**
 * Submit a daily check-in.
 * Delegates to submitDailyLog (same write path, subset of fields).
 */
export declare function submitCheckIn(client: AppClient, userId: string, input: CheckInInput): Promise<ServiceResult<CheckInResult>>;
