/**
 * R90 Engine — Runner
 *
 * Entry point. Assembles all engine modules into a single deterministic call.
 *
 * Usage:
 *   import { runEngine } from "./engine-runner.js";
 *   const output = runEngine(context);
 *
 * The runner is pure: it makes no DB calls. The caller is responsible for
 * assembling the EngineContext from the database before calling runEngine().
 */

import type { EngineContext, EngineOutput, GateReason, ARPConfig, WeeklyCycleBalance } from "./types.js";
import { generateARPConfig } from "./arp-config.js";
import { computeWeeklyAccounting, computeDayNumber } from "./weekly-accounting.js";
import { detectStates } from "./state-detector.js";
import {
  generateCandidateRecommendations,
  applyRecommendationCap,
} from "./recommendation-engine.js";
import {
  computeToneOverride,
  applySuppressionRules,
  applyConflictToneAdjustments,
  shouldShowCycleCount,
  shouldShowDeficitWarning,
} from "./conflict-resolution.js";

const ENGINE_VERSION = "1.0.0";

// ─── Validation Gates ─────────────────────────────────────────────────────────

function validateGates(ctx: EngineContext): GateReason | null {
  // VALIDATE-01: no ARP committed
  if (!ctx.profile.arp_committed || !ctx.profile.arp_time) {
    return "no_arp_committed";
  }

  // VALIDATE-02: stale ARP config
  // (arp_config older than profile.updated_at → regenerate, not gate)
  // This is handled below in the runner, not as a gate.

  // VALIDATE-03: no logs at all (brand-new user, no sleep logs)
  if (ctx.sleep_logs.length === 0) {
    return "no_logs";
  }

  return null;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Run the R90 engine against the provided context.
 *
 * @param ctx  Pre-assembled EngineContext. The caller must populate all fields
 *             from the database before calling this function.
 */
export function runEngine(ctx: EngineContext): EngineOutput {
  const evaluatedAt = ctx.now;

  // ── Step 1: Resolve ARP Config ──────────────────────────────────────────
  let arpConfig: ARPConfig | null = ctx.arp_config;

  if (ctx.profile.arp_committed && ctx.profile.arp_time) {
    // Regenerate if missing or stale (config older than profile.updated_at)
    const configStale =
      !arpConfig ||
      Date.parse(arpConfig.generated_at) < Date.parse(ctx.profile.updated_at);

    if (configStale) {
      arpConfig = generateARPConfig(ctx.profile.arp_time, ctx.now);
    }
  }

  // Inject resolved arp_config into context for downstream modules
  const resolvedCtx: EngineContext = { ...ctx, arp_config: arpConfig };

  // ── Step 2: Validation Gates ────────────────────────────────────────────
  const gateReason = validateGates(resolvedCtx);

  if (gateReason) {
    // Gate-blocked output — always 200, safe defaults
    const { states, gate_all_states } = detectStates(resolvedCtx);

    // Even in gate states, we still generate onboarding-appropriate recs
    const candidates = generateCandidateRecommendations(states, resolvedCtx);
    const { recommendations } = applySuppressionRules(candidates, states);
    const capped = applyRecommendationCap(recommendations);

    return {
      gate_blocked: true,
      gate_reason: gateReason,
      active_states: states,
      recommendations: capped,
      tone_override: computeToneOverride(states),
      show_cycle_count: shouldShowCycleCount(states),
      show_deficit_warning: false,
      weekly_accounting: null,
      arp_config: arpConfig,
      evaluated_at: evaluatedAt,
      engine_version: ENGINE_VERSION,
    };
  }

  // ── Step 3: Weekly Accounting ───────────────────────────────────────────
  const weekStart =
    ctx.profile.arp_committed_at?.slice(0, 10) ?? ctx.today;
  const dayNumber = computeDayNumber(ctx.today, weekStart);

  // Get logs for current rolling week (last 7 days, oldest first)
  const weekSleepLogs = ctx.sleep_logs.slice(0, 7).reverse();
  const weekDailyLogs = ctx.daily_logs.slice(0, 7).reverse();

  const weeklyAccounting = computeWeeklyAccounting(
    weekSleepLogs,
    weekDailyLogs,
    dayNumber
  );

  // ── Step 3b: Inject fresh balance into context ──────────────────────────
  // This ensures state detection always uses up-to-date values, not a
  // potentially stale DB snapshot (critical when a log was just submitted).
  const freshBalance: WeeklyCycleBalance = {
    id: ctx.weekly_balance?.id ?? "",
    user_id: ctx.profile.user_id,
    week_start: weekStart,
    nocturnal_cycles: weekSleepLogs.map(l => l.cycles_completed),
    crp_cycles: weekDailyLogs.map(l => (l.crp_cycle_credited ? 1 : 0)),
    weekly_cycle_total: weeklyAccounting.weekly_cycle_total,
    weekly_crp_total: weeklyAccounting.weekly_crp_total,
    cycle_deficit: weeklyAccounting.cycle_deficit,
    arp_stable: weeklyAccounting.arp_stable,
    deficit_risk_flag: weeklyAccounting.deficit_risk_flag,
    day_number: dayNumber,
  };
  const ctxForDetection: EngineContext = { ...resolvedCtx, weekly_balance: freshBalance };

  // ── Step 4: State Detection ─────────────────────────────────────────────
  const { states } = detectStates(ctxForDetection);

  // ── Step 5: Generate Candidate Recommendations ──────────────────────────
  const candidates = generateCandidateRecommendations(states, ctxForDetection);

  // ── Step 6: Apply Suppression Rules ────────────────────────────────────
  const { recommendations: filtered } = applySuppressionRules(candidates, states);


  // ── Step 7: Apply Conflict Tone Adjustments ─────────────────────────────
  const toneAdjusted = applyConflictToneAdjustments(filtered, states);

  // ── Step 8: Cap Recommendations ────────────────────────────────────────
  const capped = applyRecommendationCap(toneAdjusted);

  // ── Step 9: Compute UI Signal Flags ─────────────────────────────────────
  const toneOverride = computeToneOverride(states);
  const showCycleCount = shouldShowCycleCount(states);
  const showDeficitWarning = shouldShowDeficitWarning(states);

  return {
    gate_blocked: false,
    gate_reason: null,
    active_states: states,
    recommendations: capped,
    tone_override: toneOverride,
    show_cycle_count: showCycleCount,
    show_deficit_warning: showDeficitWarning,
    weekly_accounting: weeklyAccounting,
    arp_config: arpConfig,
    evaluated_at: evaluatedAt,
    engine_version: ENGINE_VERSION,
  };
}

// ─── Safe Wrapper ─────────────────────────────────────────────────────────────

/**
 * Safe version of runEngine that never throws.
 * Returns a safe fallback output if the engine fails.
 * Use this in API handlers.
 */
export function runEngineSafe(ctx: EngineContext): EngineOutput {
  try {
    return runEngine(ctx);
  } catch (err) {
    console.error("[R90 Engine] runEngine failed:", err);

    // Always return a 200-safe fallback — never surface engine error to the user
    return {
      gate_blocked: false,
      gate_reason: null,
      active_states: [],
      recommendations: [],
      tone_override: {
        active: false,
        reason: null,
        suppress_outcome_metrics: false,
        suppress_cycle_count_comparison: false,
      },
      show_cycle_count: true,
      show_deficit_warning: false,
      weekly_accounting: null,
      arp_config: ctx.arp_config,
      evaluated_at: ctx.now,
      engine_version: ENGINE_VERSION,
    };
  }
}
