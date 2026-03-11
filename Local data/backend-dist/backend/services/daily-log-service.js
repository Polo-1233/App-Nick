/**
 * R90 Backend — Daily Log Service
 *
 * submit_daily_log: validate → compute derived fields → write → run engine
 */
import { isInCRPWindow, timeToMinutes } from "../../engine/arp-config.js";
import { fetchUserProfile, fetchARPConfig } from "../db/queries.js";
import { upsertDailyLog } from "../db/mutations.js";
import { runAndPersistEngine } from "./engine-service.js";
/**
 * Submit a daily log for a user.
 *
 * Computed fields set by this service:
 *   - crp_in_window: crp_start_time falls within arp_config.crp_window
 *   - caffeine_after_cutoff: caffeine_last_time > profile.caffeine_cutoff_time (14:00)
 *
 * Note: crp_cycle_credited is computed by a DB trigger (duration >= 20 min).
 */
export async function submitDailyLog(client, userId, input) {
    // ── Validate ────────────────────────────────────────────────────────────
    const validation = validateDailyLogInput(input);
    if (!validation.ok)
        return validation;
    // ── Compute derived fields ────────────────────────────────────────────────
    const [profile, arpConfig] = await Promise.all([
        fetchUserProfile(client, userId),
        fetchARPConfig(client, userId),
    ]);
    let crpInWindow;
    if (input.crp_taken && input.crp_start_time && arpConfig) {
        crpInWindow = isInCRPWindow(input.crp_start_time, {
            crp_window_open: arpConfig.crp_window_open,
            crp_window_close: arpConfig.crp_window_close,
            // Minimal shape needed by isInCRPWindow — other fields not required
        });
    }
    let caffeineAfterCutoff = input.caffeine_after_cutoff;
    if (input.caffeine_last_time) {
        const cutoff = profile?.caffeine_cutoff_time ?? "14:00";
        caffeineAfterCutoff = timeToMinutes(input.caffeine_last_time) > timeToMinutes(cutoff);
    }
    // ── Write to DB ───────────────────────────────────────────────────────────
    const written = await upsertDailyLog(client, userId, {
        ...input,
        crp_in_window: crpInWindow,
        caffeine_after_cutoff: caffeineAfterCutoff,
    });
    if (!written) {
        return { ok: false, error: "Failed to write daily log", code: "DB_WRITE_FAILED" };
    }
    // ── Run engine ────────────────────────────────────────────────────────────
    const engineOutput = await runAndPersistEngine(client, userId);
    // Determine crp_credited from engine output's weekly accounting
    const crpCredited = !!(input.crp_taken && (input.crp_duration_minutes ?? 0) >= 20);
    return {
        ok: true,
        data: {
            daily_log_id: written.id,
            crp_credited: crpCredited,
            crp_in_window: crpInWindow ?? null,
            caffeine_after_cutoff: caffeineAfterCutoff ?? null,
            engine_output: engineOutput,
        },
    };
}
// ─── Validation ───────────────────────────────────────────────────────────────
function validateDailyLogInput(input) {
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        return { ok: false, error: "Invalid date format. Expected YYYY-MM-DD", code: "INVALID_DATE" };
    }
    if (new Date(input.date) > new Date()) {
        return { ok: false, error: "Cannot log a future date", code: "FUTURE_DATE" };
    }
    if (input.mrm_count !== undefined &&
        (input.mrm_count < 0 || input.mrm_count > 12)) {
        return { ok: false, error: "mrm_count must be 0–12", code: "INVALID_MRM" };
    }
    if (input.crp_duration_minutes !== undefined && input.crp_duration_minutes < 0) {
        return { ok: false, error: "crp_duration_minutes must be ≥ 0", code: "INVALID_CRP_DURATION" };
    }
    if (input.caffeine_doses !== undefined && input.caffeine_doses < 0) {
        return { ok: false, error: "caffeine_doses must be ≥ 0", code: "INVALID_CAFFEINE" };
    }
    if (input.crp_start_time && !/^\d{2}:\d{2}$/.test(input.crp_start_time)) {
        return { ok: false, error: "crp_start_time must be HH:MM", code: "INVALID_TIME" };
    }
    return { ok: true, data: null };
}
//# sourceMappingURL=daily-log-service.js.map