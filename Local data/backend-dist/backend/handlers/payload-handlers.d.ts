/**
 * R90 Backend — Screen Payload Handlers
 *
 * GET /screen/home             → get_home_screen_payload
 * GET /screen/day-plan[?date=] → get_day_plan_payload
 * GET /screen/checkin          → get_check_in_payload
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
export declare function homeScreenHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
export declare function dayPlanHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext, query: URLSearchParams): Promise<void>;
export declare function checkInPayloadHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
