/**
 * Tool executor for OpenAI function calling
 *
 * Dispatches tool calls to the appropriate data fetchers.
 * Returns JSON string results. Never throws.
 */
import { fetchRecentSleepLogs, fetchUpcomingCalendarEvents, fetchRecentLifeEvents, fetchActiveWeeklyBalance, fetchUserProfile, } from "../db/queries.js";
import { assembleEngineContext } from "../context/assembler.js";
import { runEngineSafe } from "../../engine/engine-runner.js";
import { buildHomeScreenPayload } from "../payloads/home-screen.js";
const TIMEOUT_MS = 3000;
/**
 * Execute a tool call and return a JSON string result.
 * Never throws — returns error JSON on failure.
 */
export async function executeTool(name, args, userId, client) {
    const start = Date.now();
    let success = true;
    try {
        const result = await Promise.race([
            executeToolInner(name, args, userId, client),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
        ]);
        return result;
    }
    catch (err) {
        success = false;
        return JSON.stringify({ error: "data temporarily unavailable" });
    }
    finally {
        const duration = Date.now() - start;
        // Fire-and-forget: log the tool call
        logToolCall(client, userId, name, duration, success).catch(() => { });
    }
}
async function executeToolInner(name, args, userId, client) {
    switch (name) {
        case "query_sleep_history": {
            const days = Math.min(Math.max(Number(args.days) || 7, 1), 30);
            const logs = await fetchRecentSleepLogs(client, userId, days);
            return JSON.stringify(logs.map(l => ({
                date: l.date,
                cycles_completed: l.cycles_completed,
                wake_time: l.wake_time,
                sleep_onset: l.actual_sleep_onset,
                arp_maintained: l.arp_maintained,
                night_waking: l.night_waking_2_to_4am,
            })));
        }
        case "get_calendar_events": {
            const hours = Math.min(Math.max(Number(args.hours_ahead) || 48, 1), 168);
            const events = await fetchUpcomingCalendarEvents(client, userId, hours);
            return JSON.stringify(events.map(e => ({
                title: e.title,
                type: e.event_type_hint,
                start_time: e.start_time,
                end_time: e.end_time,
                source: e.source,
            })));
        }
        case "get_life_events": {
            const includePast = args.include_past !== false;
            const events = await fetchRecentLifeEvents(client, userId, includePast ? 14 : 0, 7);
            return JSON.stringify(events.map(e => ({
                type: e.event_type,
                title: e.title,
                date: e.event_date,
                notes: e.notes,
            })));
        }
        case "get_weekly_balance": {
            const balance = await fetchActiveWeeklyBalance(client, userId);
            if (!balance)
                return JSON.stringify({ status: "no_data" });
            return JSON.stringify({
                week_start: balance.week_start,
                day_number: balance.day_number,
                total_cycles: balance.weekly_cycle_total,
                deficit: balance.cycle_deficit,
                on_track: !balance.deficit_risk_flag,
                arp_stable: balance.arp_stable,
            });
        }
        case "get_readiness_score": {
            const ctx = await assembleEngineContext(client, userId);
            const output = runEngineSafe(ctx);
            const home = buildHomeScreenPayload(output, ctx);
            return JSON.stringify({
                current_phase: home.current_phase,
                current_cycle: home.current_cycle,
                gate_blocked: home.gate_blocked,
                active_states: output.active_states.map(s => s.state_id),
                primary_rec: home.primary_recommendation?.message_key ?? null,
                sleep_onset: home.tonight_sleep_onset,
            });
        }
        case "get_lifestyle_profile": {
            const profile = await fetchUserProfile(client, userId);
            if (!profile)
                return JSON.stringify({ status: "no_profile" });
            return JSON.stringify({
                stress_level: profile.stress_level,
                sleep_environment: profile.sleep_environment,
                exercise_frequency: profile.exercise_frequency,
                alcohol_use: profile.alcohol_use,
                work_start_time: profile.work_start_time,
            });
        }
        default:
            return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
}
async function logToolCall(client, userId, toolName, durationMs, success) {
    await client.from("tool_call_logs").insert({
        user_id: userId,
        tool_name: toolName,
        duration_ms: durationMs,
        success,
    });
}
//# sourceMappingURL=tool-executor.js.map