/**
 * R90 Engine — Recommendation Engine
 *
 * Pure function. No I/O.
 *
 * Generates a ranked, deduplicated, cooldown-filtered, and capped set of
 * recommendations from the active states and engine context.
 *
 * Sources: R90_RULE_ENGINE_SPEC.md §4 and §5
 */
import { randomUUID } from "crypto";
import { isActive } from "./state-detector.js";
import { countCRPTaken, meanMRMCount, } from "./weekly-accounting.js";
import { timeToMinutes } from "./arp-config.js";
// ─── Cooldown table (hours) ──────────────────────────────────────────────────
const COOLDOWN_HOURS = {
    "REC-01": 0, // no cooldown — shown every session until resolved
    "REC-02": 12,
    "REC-03": 24,
    "REC-04": 0, // no cooldown during onboarding; 72h thereafter (handled in condition)
    "REC-05": 1.5, // 90 min (one per cycle boundary)
    "REC-06": 24,
    "REC-07": 24,
    "REC-08": 24,
    "REC-09": 48,
    "REC-10": 72,
    "REC-11": 168, // 7 days
    "REC-12": 168,
    "REC-13": 72,
    "REC-14": 72,
    "REC-15": 48,
    "REC-16": 48,
    "REC-17": 48,
    "REC-18": 168, // 7 days
    "REC-19": 336, // 14 days
    "REC-20": 0, // no cooldown
    "REC-21": 336, // 14 days
    "REC-22": 48,
    "REC-23": 0, // per-event
    "REC-24": 0, // per-event
    "REC-25": 72,
    "REC-26": 0, // per-event
};
// Recommendations exempt from the 5-rec cap
const CAP_EXEMPT = new Set(["REC-01", "REC-20"]);
// Priority mapping: CRITICAL=1, HIGH=2, MEDIUM=3, LOW=4
const REC_PRIORITY = {
    "REC-01": { priority: 1, label: "CRITICAL" },
    "REC-02": { priority: 2, label: "HIGH" },
    "REC-03": { priority: 2, label: "HIGH" },
    "REC-04": { priority: 2, label: "HIGH" },
    "REC-05": { priority: 3, label: "MEDIUM" },
    "REC-06": { priority: 2, label: "HIGH" },
    "REC-07": { priority: 2, label: "HIGH" },
    "REC-08": { priority: 2, label: "HIGH" },
    "REC-09": { priority: 2, label: "HIGH" },
    "REC-10": { priority: 3, label: "MEDIUM" },
    "REC-11": { priority: 3, label: "MEDIUM" },
    "REC-12": { priority: 3, label: "MEDIUM" },
    "REC-13": { priority: 3, label: "MEDIUM" },
    "REC-14": { priority: 3, label: "MEDIUM" },
    "REC-15": { priority: 2, label: "HIGH" },
    "REC-16": { priority: 2, label: "HIGH" },
    "REC-17": { priority: 3, label: "MEDIUM" },
    "REC-18": { priority: 2, label: "HIGH" },
    "REC-19": { priority: 4, label: "LOW" },
    "REC-20": { priority: 1, label: "CRITICAL" },
    "REC-21": { priority: 3, label: "MEDIUM" },
    "REC-22": { priority: 3, label: "MEDIUM" },
    "REC-23": { priority: 3, label: "MEDIUM" },
    "REC-24": { priority: 2, label: "HIGH" },
    "REC-25": { priority: 3, label: "MEDIUM" },
    "REC-26": { priority: 4, label: "LOW" },
};
// ─── Helpers ─────────────────────────────────────────────────────────────────
function isOnCooldown(recType, ctx) {
    const cooldownHours = COOLDOWN_HOURS[recType];
    if (!cooldownHours)
        return false;
    const cd = ctx.cooldowns.find(c => c.rec_type === recType);
    if (!cd?.last_delivered_at)
        return false;
    const lastMs = Date.parse(cd.last_delivered_at);
    const nowMs = Date.parse(ctx.now);
    const elapsedHours = (nowMs - lastMs) / 3_600_000;
    return elapsedHours < cooldownHours;
}
function dismissedCount(recType, ctx) {
    return ctx.cooldowns.find(c => c.rec_type === recType)?.dismissed_count ?? 0;
}
function buildRec(recType, triggeredBy, actionPayload = {}, suppressionReason = null) {
    const { priority, label } = REC_PRIORITY[recType];
    return {
        id: randomUUID(),
        rec_type: recType,
        priority,
        priority_label: label,
        triggered_by: triggeredBy,
        suppression_reason: suppressionReason,
        action_payload: actionPayload,
        message_key: recType.toLowerCase().replace("-", "_"),
    };
}
/** Check if MRM and CRP are established (required before product recs) */
function isFrameworkEstablished(ctx) {
    const mrmOk = ctx.profile.onboarding_completed && meanMRMCount(ctx.daily_logs, 7) >= 3;
    const crpOk = countCRPTaken(ctx.daily_logs, 7) >= 2;
    return mrmOk && crpOk;
}
/** Earliest available CRP slot: MAX(now, crp_window_open) */
function earliestCRPSlot(ctx) {
    if (!ctx.arp_config)
        return "14:00"; // safe default
    const nowMin = timeToMinutes(ctx.now.slice(11, 16)); // extract HH:MM from ISO
    const openMin = timeToMinutes(ctx.arp_config.crp_window_open);
    const effectiveMin = Math.max(nowMin, openMin);
    const h = Math.floor(effectiveMin / 60) % 24;
    const m = effectiveMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
// ─── Candidate Builders (one per rec type) ───────────────────────────────────
function tryREC01(states, ctx) {
    const { profile } = ctx;
    const trigger = !profile.arp_committed ||
        (isActive(states, "US-04") &&
            (ctx.weekly_balance?.arp_stable === false));
    if (!trigger)
        return null;
    return buildRec("REC-01", isActive(states, "US-04") ? "US-04" : "US-12", {
        action: "open_arp_setup",
        reason: !profile.arp_committed ? "no_arp" : "arp_instability",
    });
}
function tryREC02(states, ctx) {
    if (!ctx.profile.arp_committed || !ctx.arp_config)
        return null;
    if (isOnCooldown("REC-02", ctx))
        return null;
    // Suppress outcome framing when US-07 active
    const us07Active = isActive(states, "US-07");
    return buildRec("REC-02", null, {
        sleep_onset_5cycle: ctx.arp_config.sleep_onset_5cycle,
        sleep_onset_4cycle: ctx.arp_config.sleep_onset_4cycle,
        suppress_cycle_count: us07Active,
    });
}
function tryREC03(states, ctx) {
    if (isOnCooldown("REC-03", ctx))
        return null;
    const { sleep_logs, weekly_balance, daily_logs } = ctx;
    const yesterday = sleep_logs[0]; // sorted descending
    const crpAlreadyTaken = daily_logs[0]?.crp_taken === true;
    if (crpAlreadyTaken)
        return null;
    // Trigger: cycles last night < 4 (ONLY if not null — missing data = skip)
    const cyclesTonight = yesterday?.cycles_completed;
    const shortNight = cyclesTonight !== null && cyclesTonight !== undefined && cyclesTonight < 4;
    // OR: weekly deficit >= 3 by day 3+
    const deficitTrigger = (weekly_balance?.cycle_deficit ?? 0) >= 3 &&
        (weekly_balance?.day_number ?? 0) <= 5;
    // OR: US-06 active
    const disruption = isActive(states, "US-06");
    if (!shortNight && !deficitTrigger && !disruption)
        return null;
    const crpSlot = earliestCRPSlot(ctx);
    return buildRec("REC-03", shortNight ? null : "US-06", {
        crp_start: crpSlot,
        crp_duration: 30,
        crp_window: ctx.arp_config
            ? [ctx.arp_config.crp_window_open, ctx.arp_config.crp_window_close]
            : null,
        cycle_credit: 1,
    });
}
function tryREC04(states, ctx) {
    if (!isActive(states, "US-12"))
        return null;
    const duringOnboarding = ctx.profile.onboarding_step <= 3;
    if (!duringOnboarding && isOnCooldown("REC-04", ctx))
        return null;
    return buildRec("REC-04", "US-12", { action: "introduce_mrm" });
}
function tryREC13(states, ctx) {
    if (isOnCooldown("REC-13", ctx))
        return null;
    const trigger = isActive(states, "US-07") ||
        isActive(states, "US-12") ||
        dismissedCount("REC-03", ctx) >= 2;
    if (!trigger)
        return null;
    return buildRec("REC-13", isActive(states, "US-07") ? "US-07" : null, {});
}
function tryREC14(states, ctx) {
    if (isOnCooldown("REC-14", ctx))
        return null;
    if (isActive(states, "US-07"))
        return null; // suppress metric display under anxiety
    const trigger = isActive(states, "US-02") || isActive(states, "US-03");
    if (!trigger)
        return null;
    return buildRec("REC-14", isActive(states, "US-03") ? "US-03" : "US-02", {
        weekly_total: ctx.weekly_balance?.weekly_cycle_total,
        target: 35,
    });
}
function tryREC15(states, ctx) {
    // Never suppress while US-07 active
    if (!isActive(states, "US-07") && isOnCooldown("REC-15", ctx))
        return null;
    const { sleep_logs } = ctx;
    const lastNight = sleep_logs[0];
    const latencyTrigger = lastNight?.onset_latency_minutes != null &&
        lastNight.onset_latency_minutes > 15;
    if (!isActive(states, "US-07") && !latencyTrigger)
        return null;
    return buildRec("REC-15", isActive(states, "US-07") ? "US-07" : null, {});
}
function tryREC16(states, ctx) {
    if (isOnCooldown("REC-16", ctx))
        return null;
    const lastNight = ctx.sleep_logs[0];
    if (!lastNight?.night_waking_2_to_4am)
        return null;
    return buildRec("REC-16", null, {});
}
function tryREC17(states, ctx) {
    if (isOnCooldown("REC-17", ctx))
        return null;
    if (!isActive(states, "US-10"))
        return null;
    return buildRec("REC-17", "US-10", {
        cutoff_time: "14:00",
    });
}
function tryREC18(states, ctx) {
    if (!isActive(states, "US-09"))
        return null;
    if (isOnCooldown("REC-18", ctx))
        return null;
    return buildRec("REC-18", "US-09", {});
}
function tryREC19(states, ctx) {
    // HARD SUPPRESSION: never fire when US-07 active
    if (isActive(states, "US-07")) {
        return null; // suppressed — callers must not include this
    }
    // HARD SUPPRESSION: app usage < 14 days
    if (ctx.app_usage_days < 14)
        return null;
    if (isOnCooldown("REC-19", ctx))
        return null;
    // Trigger: US-03 persistent >= 14 days with no improvement from CRP/MRM
    const us03 = ctx.profile; // active_days for US-03 from DB context
    const us03State = states.find(s => s.state_id === "US-03");
    if (!us03State || us03State.active_days < 14)
        return null;
    return buildRec("REC-19", "US-03", {
        delay_onset_by_minutes: 90,
        arp_held: true,
        duration_days: 7,
    });
}
function tryREC20(states, ctx) {
    if (!isActive(states, "US-12") && ctx.profile.arp_committed)
        return null;
    return buildRec("REC-20", "US-12", { action: "open_onboarding" });
}
function tryREC21(states, ctx) {
    if (!isActive(states, "US-05"))
        return null;
    if (isOnCooldown("REC-21", ctx))
        return null;
    const canShiftARP = ctx.profile.occupation_schedule === "flexible" ||
        ctx.profile.occupation_schedule === "freelance" ||
        ctx.profile.occupation_schedule == null;
    return buildRec("REC-21", "US-05", {
        arp_negotiable: canShiftARP,
    });
}
function tryREC22(states, ctx) {
    if (!isActive(states, "US-06"))
        return null;
    if (isActive(states, "US-03"))
        return null; // US-03 structural takes priority
    if (isOnCooldown("REC-22", ctx))
        return null;
    return buildRec("REC-22", "US-06", {
        crp_start: earliestCRPSlot(ctx),
    });
}
function tryREC23(states, ctx) {
    if (!isActive(states, "US-15"))
        return null;
    return buildRec("REC-23", "US-15", {
        crp_recommended: true,
        floor_cycles: 3,
    });
}
function tryREC24(states, ctx) {
    if (!isActive(states, "US-16"))
        return null;
    return buildRec("REC-24", "US-16", {
        crp_any_phase: true,
        cycle_target_tonight: 6,
    });
}
function tryREC25(states, ctx) {
    if (!isActive(states, "US-02") && !isActive(states, "US-03"))
        return null;
    if (isOnCooldown("REC-25", ctx))
        return null;
    const dayNumber = ctx.weekly_balance?.day_number ?? 0;
    if (dayNumber < 3)
        return null;
    return buildRec("REC-25", isActive(states, "US-03") ? "US-03" : "US-02", { recovery_day: true });
}
function tryREC08(states, ctx) {
    if (isActive(states, "US-07"))
        return null; // suppress — reduces anxiety
    if (!ctx.arp_config)
        return null;
    if (isOnCooldown("REC-08", ctx))
        return null;
    if (isActive(states, "US-08")) {
        return buildRec("REC-08", "US-08", {
            phase_3_start: ctx.arp_config.phase_3_start,
        });
    }
    return null;
}
function tryREC09(states, ctx) {
    if (!isFrameworkEstablished(ctx))
        return null;
    if (isOnCooldown("REC-09", ctx))
        return null;
    if (!isActive(states, "US-08") && !isActive(states, "US-11"))
        return null;
    if (ctx.environment?.evening_light_environment !== "bright_blue")
        return null;
    if (ctx.daily_logs[0]?.evening_light_managed)
        return null;
    return buildRec("REC-09", isActive(states, "US-08") ? "US-08" : "US-11", {});
}
function tryREC10(states, ctx) {
    if (!isFrameworkEstablished(ctx))
        return null;
    if (!isActive(states, "US-11"))
        return null;
    if (isOnCooldown("REC-10", ctx))
        return null;
    const temp = ctx.environment?.bedroom_temperature;
    if (temp !== "hot" && temp !== "variable")
        return null;
    return buildRec("REC-10", "US-11", { bedroom_temperature: temp });
}
function tryREC11(states, ctx) {
    if (!isFrameworkEstablished(ctx))
        return null;
    if (!isActive(states, "US-11"))
        return null;
    if (isOnCooldown("REC-11", ctx))
        return null;
    return buildRec("REC-11", "US-11", { friction_score: ctx.environment?.environment_friction_score });
}
function tryREC12(states, ctx) {
    if (!isActive(states, "US-05"))
        return null;
    if (isOnCooldown("REC-12", ctx))
        return null;
    const canShift = ctx.profile.occupation_schedule === "flexible" ||
        ctx.profile.occupation_schedule === "freelance";
    if (!canShift)
        return null; // suppress if fixed schedule
    return buildRec("REC-12", "US-05", {});
}
// ─── Main Generator ───────────────────────────────────────────────────────────
/**
 * Generate the full candidate recommendation set from active states.
 * Does NOT apply suppression rules (handled in conflict-resolution.ts).
 * Returns all candidates before capping.
 */
export function generateCandidateRecommendations(states, ctx) {
    const candidates = [];
    const push = (r) => {
        if (r)
            candidates.push(r);
    };
    // Always-on (gate level)
    push(tryREC01(states, ctx));
    push(tryREC20(states, ctx));
    // Core schedule (daily)
    push(tryREC02(states, ctx));
    // CRP
    push(tryREC03(states, ctx));
    // MRM
    push(tryREC04(states, ctx));
    // Reframe / Education
    push(tryREC13(states, ctx));
    push(tryREC14(states, ctx));
    // Anxiety
    push(tryREC15(states, ctx));
    // Night waking
    push(tryREC16(states, ctx));
    // Stimulant
    push(tryREC17(states, ctx));
    // Tracker
    push(tryREC18(states, ctx));
    // Sleep restriction (conservative, may be suppressed)
    push(tryREC19(states, ctx));
    // Social jet lag
    push(tryREC21(states, ctx));
    push(tryREC12(states, ctx));
    // Disruption / illness
    push(tryREC22(states, ctx));
    push(tryREC23(states, ctx));
    push(tryREC24(states, ctx));
    push(tryREC25(states, ctx));
    // Environment
    push(tryREC08(states, ctx));
    push(tryREC09(states, ctx));
    push(tryREC10(states, ctx));
    push(tryREC11(states, ctx));
    // Deduplicate by rec_type (keep highest priority instance)
    const seen = new Map();
    for (const r of candidates) {
        const existing = seen.get(r.rec_type);
        if (!existing || r.priority < existing.priority) {
            seen.set(r.rec_type, r);
        }
    }
    return Array.from(seen.values()).sort((a, b) => a.priority - b.priority);
}
/**
 * Apply the 5-recommendation cap.
 * REC-01 and REC-20 are exempt from the cap.
 */
export function applyRecommendationCap(recs) {
    const exempt = recs.filter(r => CAP_EXEMPT.has(r.rec_type));
    const capped = recs
        .filter(r => !CAP_EXEMPT.has(r.rec_type))
        .slice(0, 5);
    return [...exempt, ...capped].sort((a, b) => a.priority - b.priority);
}
export { CAP_EXEMPT };
//# sourceMappingURL=recommendation-engine.js.map