/**
 * Pattern detector for weekly summaries
 *
 * Analyzes 4 weeks of summaries (oldest first) to detect sleep patterns.
 * Returns max 5 patterns sorted by priority.
 */
import type { WeeklySummaryRow } from "../db/queries.js";
export declare function detectPatterns(summaries: WeeklySummaryRow[]): string[];
