/**
 * Notification handlers
 *
 * GET  /notifications/proactive — check and return proactive triggers
 * POST /notifications/dismiss   — dismiss a trigger for 24h
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
export declare function proactiveNotificationHandler(_req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
export declare function dismissNotificationHandler(req: IncomingMessage, res: ServerResponse, auth: AuthContext): Promise<void>;
