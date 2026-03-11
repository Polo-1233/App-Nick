/**
 * R90 Backend — Daily Log Service
 *
 * submit_daily_log: validate → compute derived fields → write → run engine
 */
import type { AppClient } from "../db/client.js";
import type { DailyLogInput, ServiceResult } from "../types.js";
import type { EngineOutput } from "../../engine/types.js";
export interface DailyLogResult {
    daily_log_id: string;
    crp_credited: boolean;
    crp_in_window: boolean | null;
    caffeine_after_cutoff: boolean | null;
    engine_output: EngineOutput;
}
/**
 * Submit a daily log for a user.
 *
 * Computed fields set by this service:
 *   - crp_in_window: crp_start_time falls within arp_config.crp_window
 *   - caffeine_after_cutoff: caffeine_last_time > profile.caffeine_cutoff_time (14:00)
 *
 * Note: crp_cycle_credited is computed by a DB trigger (duration >= 20 min).
 */
export declare function submitDailyLog(client: AppClient, userId: string, input: DailyLogInput): Promise<ServiceResult<DailyLogResult>>;
