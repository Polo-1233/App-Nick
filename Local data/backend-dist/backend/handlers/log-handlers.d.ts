/**
 * R90 Backend — Log Submission Handlers
 *
 * POST /logs/sleep   → submit_sleep_log
 * POST /logs/daily   → submit_daily_log
 * POST /logs/checkin → submit_check_in
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
export declare function submitSleepLogHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
export declare function submitDailyLogHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
export declare function submitCheckInHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
