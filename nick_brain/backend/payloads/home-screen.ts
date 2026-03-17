/**
 * R90 Backend — Home Screen Payload Generator
 *
 * Produces the HomeScreenPayload from an EngineOutput and EngineContext.
 * Called after runAndPersistEngine() for every home screen request.
 */

import type { EngineOutput, EngineContext, ARPConfig } from "../../engine/types.js";
import type {
  HomeScreenPayload,
  WeeklyBalanceSummary,
} from "../types.js";
import { timeToMinutes } from "../../engine/arp-config.js";

// ─── Phase and cycle from current time ───────────────────────────────────────

/**
 * Determine the current phase (1–4) and cycle (1–16) from the ARP config
 * and the current time.
 */
function computeCurrentPhaseCycle(
  arpConfig: ARPConfig,
  nowIso: string
): { phase: number; cycle: number } {
  const nowHHMM = nowIso.slice(11, 16); // "HH:MM" from ISO
  const nowMin = timeToMinutes(nowHHMM);
  const arpMin = timeToMinutes(arpConfig.arp_time);

  // Find current cycle: the last cycle boundary ≤ now
  let currentCycle = 1;
  for (let i = 0; i < arpConfig.cycle_times.length; i++) {
    const cycleMin = timeToMinutes(arpConfig.cycle_times[i]!);
    // Handle overnight wrap: if cycle time appears before ARP in the day, add 24h
    const adjustedCycleMin = cycleMin < arpMin ? cycleMin + 1440 : cycleMin;
    const adjustedNow = nowMin < arpMin ? nowMin + 1440 : nowMin;

    if (adjustedNow >= adjustedCycleMin) {
      currentCycle = i + 1;
    }
  }

  // Phase from cycle
  const phase =
    currentCycle <= 4 ? 1 :
    currentCycle <= 8 ? 2 :
    currentCycle <= 12 ? 3 : 4;

  return { phase, cycle: currentCycle };
}

// ─── Main payload builder ─────────────────────────────────────────────────────

/**
 * Build the HomeScreenPayload from engine output and context.
 *
 * @param output   Result of runEngineSafe()
 * @param ctx      The EngineContext used for the engine run
 */
export function buildHomeScreenPayload(
  output: EngineOutput,
  ctx: EngineContext,
  cycleTarget?: number,
): HomeScreenPayload {
  const arpConfig  = output.arp_config;
  const profile    = ctx.profile;
  const nightTarget = cycleTarget ?? 5;
  const weekTarget  = nightTarget * 7;

  // Tonight's sleep onset
  const tonightOnset = arpConfig?.sleep_onset_5cycle ?? null;
  const fallbackOnset = arpConfig ? computeFallback(arpConfig.sleep_onset_5cycle) : null;
  const floorOnset = arpConfig?.sleep_onset_4cycle ?? null;

  // Current phase and cycle (only meaningful if ARP committed)
  let currentPhase: number | null = null;
  let currentCycle: number | null = null;
  if (arpConfig) {
    const { phase, cycle } = computeCurrentPhaseCycle(arpConfig, ctx.now);
    currentPhase = phase;
    currentCycle = cycle;
  }

  // Weekly balance summary
  let weeklyBalance: WeeklyBalanceSummary | null = null;
  if (output.weekly_accounting && output.show_cycle_count) {
    const acct = output.weekly_accounting;
    weeklyBalance = {
      total: acct.weekly_cycle_total,
      target: weekTarget,
      floor: (nightTarget - 1) * 7,
      deficit: acct.cycle_deficit,
      pace_deficit: acct.pace_deficit,
      deficit_risk: acct.deficit_risk_flag,
      day_number: acct.day_number,
      on_track: acct.on_track,
    };
  }

  // Split recommendations: primary (first) + additional
  const [primary = null, ...additional] = output.recommendations;

  return {
    user_id: profile.user_id,
    today: ctx.today,
    arp_time: profile.arp_time,
    tonight_sleep_onset: output.tone_override.active ? tonightOnset : tonightOnset,
    fallback_onset: fallbackOnset,
    floor_onset: floorOnset,
    current_phase: currentPhase,
    current_cycle: currentCycle,
    weekly_balance: weeklyBalance,
    gate_blocked: output.gate_blocked,
    gate_reason: output.gate_reason,
    active_states: output.active_states,
    primary_recommendation: primary,
    additional_recommendations: additional,
    tone_override_active: output.tone_override.active,
    show_cycle_count: output.show_cycle_count,
    show_deficit_warning: output.show_deficit_warning,
    arp_config: arpConfig,
  };
}

/** Add 90 minutes to a "HH:MM" time → fallback onset */
function computeFallback(onset5cycle: string): string {
  const min = timeToMinutes(onset5cycle);
  const fallbackMin = (min + 90) % 1440;
  const h = Math.floor(fallbackMin / 60);
  const m = fallbackMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Service function ─────────────────────────────────────────────────────────

import type { AppClient } from "../db/client.js";
import { assembleEngineContext } from "../context/assembler.js";
import { fetchUserProfile } from "../db/queries.js";
import { runEngineSafe } from "../../engine/engine-runner.js";

/**
 * Full flow: assemble context → run engine → build payload.
 * Does NOT persist engine output (reads-only use this path).
 * For post-write use, call buildHomeScreenPayload(output, ctx) directly.
 */
export async function getHomeScreenPayload(
  client: AppClient,
  userId: string
): Promise<HomeScreenPayload> {
  const [ctx, profileRow] = await Promise.all([
    assembleEngineContext(client, userId),
    fetchUserProfile(client, userId),
  ]);
  const output = runEngineSafe(ctx);
  return buildHomeScreenPayload(output, ctx, profileRow?.cycle_target ?? 5);
}
