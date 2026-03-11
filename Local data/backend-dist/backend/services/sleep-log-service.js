/**
 * R90 Backend — Sleep Log Service
 *
 * submit_sleep_log: validate → compute derived fields → write → run engine
 */
import { cyclesFromFormula, timeToMinutes } from "../../engine/arp-config.js";
import { fetchUserProfile } from "../db/queries.js";
import { upsertSleepLog } from "../db/mutations.js";
import { runAndPersistEngine } from "./engine-service.js";
/**
 * Submit a sleep log for a user.
 *
 * Cycle resolution:
 *   1. If cycles_completed is explicitly provided → use as-is (including null)
 *   2. Else if actual_sleep_onset AND wake_time are both provided → compute via formula
 *   3. Else → null (missing data — never defaults to 0 or triggers CRP)
 *
 * Computed fields set by this service:
 *   - arp_maintained: abs(wake_time - arp_time) ≤ 15 min
 */
export async function submitSleepLog(client, userId, input) {
    // ── Validate ────────────────────────────────────────────────────────────
    const validation = validateSleepLogInput(input);
    if (!validation.ok)
        return validation;
    // ── Resolve cycles_completed ─────────────────────────────────────────────
    let computedCycles;
    if ("cycles_completed" in input) {
        // Explicitly provided (including null) — use as-is
        computedCycles = undefined; // signal: use input.cycles_completed
    }
    else if (input.actual_sleep_onset && input.wake_time) {
        computedCycles = cyclesFromFormula(input.actual_sleep_onset, input.wake_time);
    }
    else {
        computedCycles = null; // no data = null, not 0
    }
    // ── Compute arp_maintained ────────────────────────────────────────────────
    let arpMaintained;
    if (input.wake_time) {
        const profile = await fetchUserProfile(client, userId);
        if (profile?.arp_time) {
            const wakeMin = timeToMinutes(input.wake_time);
            const arpMin = timeToMinutes(profile.arp_time);
            arpMaintained = Math.abs(wakeMin - arpMin) <= 15;
        }
    }
    // ── Write to DB ───────────────────────────────────────────────────────────
    const written = await upsertSleepLog(client, userId, {
        ...input,
        arp_maintained: arpMaintained,
        computed_cycles: computedCycles,
    });
    if (!written) {
        return { ok: false, error: "Failed to write sleep log", code: "DB_WRITE_FAILED" };
    }
    // ── Run engine ────────────────────────────────────────────────────────────
    const engineOutput = await runAndPersistEngine(client, userId);
    return {
        ok: true,
        data: {
            sleep_log_id: written.id,
            engine_output: engineOutput,
        },
    };
}
// ─── Validation ───────────────────────────────────────────────────────────────
function validateSleepLogInput(input) {
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        return { ok: false, error: "Invalid date format. Expected YYYY-MM-DD", code: "INVALID_DATE" };
    }
    if (new Date(input.date) > new Date()) {
        return { ok: false, error: "Cannot log a future date", code: "FUTURE_DATE" };
    }
    if (input.cycles_completed !== undefined &&
        input.cycles_completed !== null &&
        (input.cycles_completed < 0 || input.cycles_completed > 6)) {
        return { ok: false, error: "cycles_completed must be 0–6", code: "INVALID_CYCLES" };
    }
    if (input.onset_latency_minutes !== undefined && input.onset_latency_minutes < 0) {
        return { ok: false, error: "onset_latency_minutes must be ≥ 0", code: "INVALID_LATENCY" };
    }
    if (input.wake_time && !/^\d{2}:\d{2}$/.test(input.wake_time)) {
        return { ok: false, error: "wake_time must be HH:MM", code: "INVALID_TIME" };
    }
    if (input.actual_sleep_onset && !/^\d{2}:\d{2}$/.test(input.actual_sleep_onset)) {
        return { ok: false, error: "actual_sleep_onset must be HH:MM", code: "INVALID_TIME" };
    }
    if (input.subjective_energy_on_waking !== undefined &&
        (input.subjective_energy_on_waking < 1 || input.subjective_energy_on_waking > 5)) {
        return { ok: false, error: "subjective_energy_on_waking must be 1–5", code: "INVALID_ENERGY" };
    }
    return { ok: true, data: null };
}
//# sourceMappingURL=sleep-log-service.js.map