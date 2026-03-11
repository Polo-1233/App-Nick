/**
 * R90 Engine — Weekly Accounting
 *
 * Pure functions. No I/O.
 *
 * Sources:
 *   R90_RULE_ENGINE_SPEC.md §7 (WEEKLY ACCOUNTING LOGIC)
 *   R90_BACKEND_API_CONTRACT.md §3 (weekly balance)
 */
const WEEKLY_TARGET = 35;
const WEEKLY_FLOOR = 28;
const MRM_TARGET = 42;
/**
 * Compute the day number within the rolling 7-day week.
 * day_number = number of completed days since week_start (1–7).
 *
 * @param today       "YYYY-MM-DD"
 * @param weekStart   "YYYY-MM-DD" — the ARP commitment date (rolling week anchor)
 */
export function computeDayNumber(today, weekStart) {
    const msPerDay = 86_400_000;
    const diff = (Date.parse(today) - Date.parse(weekStart)) / msPerDay;
    return Math.min(Math.max(Math.floor(diff) + 1, 1), 7);
}
/**
 * Resolve cycles_completed for a sleep log.
 * null log OR null cycles AND no formula inputs → null (never coerced to 0 for rule evaluation).
 * For accounting summation only, use ?? 0.
 */
function resolvedCycles(log) {
    if (log.cycles_completed != null)
        return log.cycles_completed;
    // Try formula: floor((wake - onset) / 90)
    if (log.actual_sleep_onset && log.wake_time) {
        const onset = timeToMin(log.actual_sleep_onset);
        let wake = timeToMin(log.wake_time);
        if (wake < onset)
            wake += 1440;
        return Math.floor((wake - onset) / 90);
    }
    return null;
}
function timeToMin(hhmm) {
    const parts = hhmm.split(":").map(Number);
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}
/**
 * Resolve CRP cycle credit for a daily log.
 * Uses DB-computed crp_cycle_credited if available; otherwise derives from duration.
 * Returns 0 (not null) — no credit = 0 cycles.
 */
function resolvedCRPCredit(log) {
    if (!log.crp_taken)
        return 0;
    // DB trigger may have computed this
    if (log.crp_cycle_credited != null)
        return log.crp_cycle_credited ? 1 : 0;
    // Engine fallback
    if (log.crp_duration_minutes != null && log.crp_duration_minutes >= 20)
        return 1;
    return 0;
}
/**
 * Compute ARP stability across a set of sleep logs.
 * arp_stable = max wake variance ≤ 15 min across all logs with a wake_time.
 */
function computeARPStable(sleepLogs) {
    const wakeTimes = sleepLogs
        .map(l => l.wake_time)
        .filter((t) => t != null)
        .map(timeToMin);
    if (wakeTimes.length < 2)
        return true; // not enough data — assume stable
    const variance = Math.max(...wakeTimes) - Math.min(...wakeTimes);
    return variance <= 15;
}
/**
 * Compute the full weekly accounting output.
 *
 * @param sleepLogs   All sleep logs for the current week (up to 7), oldest first
 * @param dailyLogs   All daily logs for the current week (up to 7), oldest first
 * @param dayNumber   Day number in the rolling week (1–7)
 */
export function computeWeeklyAccounting(sleepLogs, dailyLogs, dayNumber) {
    // Nocturnal cycles (null → 0 for summation only)
    const nocturnalTotal = sleepLogs.reduce((sum, log) => {
        return sum + (resolvedCycles(log) ?? 0);
    }, 0);
    // CRP cycles
    const crpTotal = dailyLogs.reduce((sum, log) => {
        return sum + resolvedCRPCredit(log);
    }, 0);
    const weeklyTotal = nocturnalTotal + crpTotal;
    const cycleDeficit = WEEKLY_TARGET - weeklyTotal;
    // Pace: 5 cycles/day expected
    const expectedByToday = dayNumber * 5;
    const paceDeficit = expectedByToday - weeklyTotal;
    const remainingDays = 7 - dayNumber;
    const projectedEndTotal = weeklyTotal + remainingDays * 5;
    const onTrack = projectedEndTotal >= WEEKLY_FLOOR;
    // deficit_risk_flag: STRICT greater-than (deficit of exactly 7 does NOT flag)
    const deficitRiskFlag = cycleDeficit > 7 && dayNumber >= 5;
    const arpStable = computeARPStable(sleepLogs);
    const mrmWeeklyTotal = dailyLogs.reduce((sum, log) => {
        return sum + (log.mrm_count ?? 0);
    }, 0);
    return {
        weekly_cycle_total: weeklyTotal,
        weekly_crp_total: crpTotal,
        nocturnal_total: nocturnalTotal,
        cycle_deficit: cycleDeficit,
        pace_deficit: paceDeficit,
        projected_end_total: projectedEndTotal,
        on_track: onTrack,
        deficit_risk_flag: deficitRiskFlag,
        arp_stable: arpStable,
        mrm_weekly_total: mrmWeeklyTotal,
        day_number: dayNumber,
    };
}
/**
 * Count consecutive nights below a threshold (from most recent backwards).
 * Only counts logs where cycles_completed is NOT null.
 * null logs are skipped (missing data ≠ short night).
 */
export function consecutiveNightsBelow(sleepLogs, // sorted descending (most recent first)
threshold) {
    let count = 0;
    for (const log of sleepLogs) {
        const cycles = resolvedCycles(log);
        if (cycles === null)
            continue; // skip missing data
        if (cycles < threshold) {
            count++;
        }
        else {
            break;
        }
    }
    return count;
}
/**
 * Count logs in the last N days where onset_latency_minutes > threshold.
 * Only counts logs where onset_latency_minutes is NOT null.
 */
export function countHighLatencyNights(sleepLogs, // sorted descending
threshold, lastN) {
    return sleepLogs.slice(0, lastN).filter(l => l.onset_latency_minutes != null && l.onset_latency_minutes > threshold).length;
}
/**
 * Count daily logs in the last N days where caffeine_after_cutoff = true.
 */
export function countCaffeineAfterCutoff(dailyLogs, // sorted descending
lastN) {
    return dailyLogs.slice(0, lastN).filter(l => l.caffeine_after_cutoff === true).length;
}
/**
 * Compute mean MRM count over the last N daily logs.
 * Logs with null mrm_count are treated as 0.
 */
export function meanMRMCount(dailyLogs, lastN) {
    const slice = dailyLogs.slice(0, lastN);
    if (slice.length === 0)
        return 0;
    const total = slice.reduce((s, l) => s + (l.mrm_count ?? 0), 0);
    return total / slice.length;
}
/**
 * Count CRP taken in the last N daily logs.
 */
export function countCRPTaken(dailyLogs, lastN) {
    return dailyLogs.slice(0, lastN).filter(l => l.crp_taken === true).length;
}
export { WEEKLY_TARGET, WEEKLY_FLOOR, MRM_TARGET };
//# sourceMappingURL=weekly-accounting.js.map