/**
 * Weekly summary calculator
 *
 * Aggregates sleep logs, daily logs, and profile data for a given week.
 * Upserts the result into weekly_summaries.
 */
import type { AppClient } from "../db/client.js";
/**
 * Calculate and persist a weekly summary for the given week.
 * @param weekStart YYYY-MM-DD (Monday of the week)
 */
export declare function calculateWeeklySummary(client: AppClient, userId: string, weekStart: string): Promise<void>;
/**
 * Get the Monday of the week containing a given date.
 */
export declare function getWeekStart(date: Date): string;
