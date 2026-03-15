/**
 * Proactive trigger engine
 *
 * Checks user data for conditions that warrant proactive notifications.
 * Returns sorted triggers (highest priority first).
 */
import type { AppClient } from "../db/client.js";
export interface ProactiveTrigger {
    type: 'recovery_alert' | 'pre_event_coaching' | 'improvement_milestone' | 'weekly_deficit';
    priority: number;
    title: string;
    body: string;
    chat_context: string;
    expires_at: string;
}
export declare function checkProactiveTriggers(client: AppClient, userId: string): Promise<ProactiveTrigger[]>;
