/**
 * R90 Engine — Weekly Accounting
 *
 * Pure functions. No I/O.
 *
 * Sources:
 *   R90_RULE_ENGINE_SPEC.md §7 (WEEKLY ACCOUNTING LOGIC)
 *   R90_BACKEND_API_CONTRACT.md §3 (weekly balance)
 */
import type { SleepLog, DailyLog, WeeklyAccountingOutput } from "./types.js";
declare const WEEKLY_TARGET = 35;
declare const WEEKLY_FLOOR = 28;
declare const MRM_TARGET = 42;
/**
 * Compute the day number within the rolling 7-day week.
 * day_number = number of completed days since week_start (1–7).
 *
 * @param today       "YYYY-MM-DD"
 * @param weekStart   "YYYY-MM-DD" — the ARP commitment date (rolling week anchor)
 */
export declare function computeDayNumber(today: string, weekStart: string): number;
/**
 * Compute the full weekly accounting output.
 *
 * @param sleepLogs   All sleep logs for the current week (up to 7), oldest first
 * @param dailyLogs   All daily logs for the current week (up to 7), oldest first
 * @param dayNumber   Day number in the rolling week (1–7)
 */
export declare function computeWeeklyAccounting(sleepLogs: SleepLog[], dailyLogs: DailyLog[], dayNumber: number): WeeklyAccountingOutput;
/**
 * Count consecutive nights below a threshold (from most recent backwards).
 * Only counts logs where cycles_completed is NOT null.
 * null logs are skipped (missing data ≠ short night).
 */
export declare function consecutiveNightsBelow(sleepLogs: SleepLog[], // sorted descending (most recent first)
threshold: number): number;
/**
 * Count logs in the last N days where onset_latency_minutes > threshold.
 * Only counts logs where onset_latency_minutes is NOT null.
 */
export declare function countHighLatencyNights(sleepLogs: SleepLog[], // sorted descending
threshold: number, lastN: number): number;
/**
 * Count daily logs in the last N days where caffeine_after_cutoff = true.
 */
export declare function countCaffeineAfterCutoff(dailyLogs: DailyLog[], // sorted descending
lastN: number): number;
/**
 * Compute mean MRM count over the last N daily logs.
 * Logs with null mrm_count are treated as 0.
 */
export declare function meanMRMCount(dailyLogs: DailyLog[], lastN: number): number;
/**
 * Count CRP taken in the last N daily logs.
 */
export declare function countCRPTaken(dailyLogs: DailyLog[], lastN: number): number;
export { WEEKLY_TARGET, WEEKLY_FLOOR, MRM_TARGET };
