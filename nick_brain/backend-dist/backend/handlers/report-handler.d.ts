/**
 * Weekly report handlers
 *
 * POST /reports/generate       — generate a weekly report via OpenAI
 * GET  /reports/weekly/latest  — fetch the latest report
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
export declare function generateReportHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
export declare function latestReportHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
