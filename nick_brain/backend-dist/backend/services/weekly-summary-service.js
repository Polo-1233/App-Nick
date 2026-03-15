/**
 * Weekly summary calculator
 *
 * Aggregates sleep logs, daily logs, and profile data for a given week.
 * Upserts the result into weekly_summaries.
 */
import { fetchUserProfile } from "../db/queries.js";
/**
 * Calculate and persist a weekly summary for the given week.
 * @param weekStart YYYY-MM-DD (Monday of the week)
 */
export async function calculateWeeklySummary(client, userId, weekStart) {
    // Compute week_end = weekStart + 6 days
    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const weekEnd = endDate.toISOString().slice(0, 10);
    // Fetch sleep logs for the week
    const { data: sleepLogs, error: sleepErr } = await client
        .from("sleep_logs")
        .select("cycles_completed")
        .eq("user_id", userId)
        .gte("date", weekStart)
        .lte("date", weekEnd);
    if (sleepErr) {
        console.error("[weekly-summary] Failed to fetch sleep logs:", sleepErr.message);
        return;
    }
    // Fetch daily logs for mood/stress
    const { data: dailyLogs, error: dailyErr } = await client
        .from("daily_logs")
        .select("mood_score, stress_score")
        .eq("user_id", userId)
        .gte("date", weekStart)
        .lte("date", weekEnd);
    if (dailyErr) {
        console.error("[weekly-summary] Failed to fetch daily logs:", dailyErr.message);
    }
    // Fetch user profile for cycle_target
    const profile = await fetchUserProfile(client, userId);
    const cycleTarget = profile?.cycle_target ?? 5;
    // Aggregate sleep data
    const validCycles = (sleepLogs ?? [])
        .map((l) => l.cycles_completed)
        .filter((c) => c !== null && c !== undefined);
    const totalCycles = validCycles.reduce((a, b) => a + b, 0);
    const avgCycles = validCycles.length > 0 ? totalCycles / validCycles.length : null;
    const targetCycles = cycleTarget * 7;
    const onTrack = avgCycles !== null ? avgCycles >= cycleTarget * 0.8 : null;
    const deficit = Math.max(0, targetCycles - totalCycles);
    // Aggregate mood/stress
    const moods = (dailyLogs ?? [])
        .map((l) => l.mood_score)
        .filter((v) => v !== null && v !== undefined);
    const stresses = (dailyLogs ?? [])
        .map((l) => l.stress_score)
        .filter((v) => v !== null && v !== undefined);
    const moodAvg = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
    const stressAvg = stresses.length > 0 ? stresses.reduce((a, b) => a + b, 0) / stresses.length : null;
    // Fetch life events for the week
    const { data: lifeEvents } = await client
        .from("life_events")
        .select("event_type, title, event_date")
        .eq("user_id", userId)
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd);
    const notableEvents = (lifeEvents ?? []).map((e) => ({
        type: e.event_type,
        title: e.title,
        date: e.event_date,
    }));
    // Upsert
    const { error: upsertErr } = await client
        .from("weekly_summaries")
        .upsert({
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd,
        avg_cycles: avgCycles !== null ? Math.round(avgCycles * 100) / 100 : null,
        total_cycles: totalCycles,
        target_cycles: targetCycles,
        on_track: onTrack,
        deficit,
        mood_avg: moodAvg !== null ? Math.round(moodAvg * 100) / 100 : null,
        stress_avg: stressAvg !== null ? Math.round(stressAvg * 100) / 100 : null,
        notable_events: notableEvents,
        patterns_detected: [],
        updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,week_start" });
    if (upsertErr) {
        console.error("[weekly-summary] Upsert failed:", upsertErr.message);
    }
}
/**
 * Get the Monday of the week containing a given date.
 */
export function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    // Sunday = 0, Monday = 1, ..., Saturday = 6
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
}
//# sourceMappingURL=weekly-summary-service.js.map