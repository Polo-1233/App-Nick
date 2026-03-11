/**
 * R90 Engine — State Detector
 *
 * Pure function. No I/O.
 *
 * Evaluation order (7-pass, per R90_RULE_ENGINE_SPEC.md §3):
 *   Pass 1 — Gate states:          US-12, US-04
 *   Pass 2 — Anxiety states:       US-07, US-09
 *   Pass 3 — Structural deficit:   US-03, US-02
 *   Pass 4 — Behavioural/env:      US-08, US-10, US-11, US-05
 *   Pass 5 — Event/context:        US-06, US-15, US-16, US-17 (V2)
 *   Pass 6 — Maintenance:          US-01
 *   Pass 7 — V2 only:              US-13, US-14
 */

import type {
  EngineContext,
  DetectedState,
  UserStateId,
  PriorityLevel,
} from "./types.js";
import {
  consecutiveNightsBelow,
  countHighLatencyNights,
  countCaffeineAfterCutoff,
  meanMRMCount,
  countCRPTaken,
} from "./weekly-accounting.js";
import { wakeVarianceMinutes, timeToMinutes } from "./arp-config.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priorityLabel(priority: number): PriorityLevel {
  if (priority === 1) return "CRITICAL";
  if (priority === 2) return "HIGH";
  if (priority === 3) return "MEDIUM";
  return "LOW";
}

function makeState(
  id: UserStateId,
  priority: number,
  activeDays = 0,
  confidence: DetectedState["confidence"] = "HIGH"
): DetectedState {
  return {
    state_id: id,
    priority,
    priority_label: priorityLabel(priority),
    active_days: activeDays,
    confidence,
  };
}

/** Find how many consecutive days a state has been in user_states (from DB context).
 *  The context does not carry active_days directly, so we default to 0 here;
 *  callers should pass the persisted value when available. */
function activeDaysFor(_stateId: UserStateId, _ctx: EngineContext): number {
  // In a real integration, query user_states.activated_at from DB context.
  // Engine context does not currently carry this; returning 0 as safe default.
  return 0;
}

// ─── Pass 1: Gate States ─────────────────────────────────────────────────────

/** US-12 — Framework Gap */
function detectUS12(ctx: EngineContext): DetectedState | null {
  const { profile, sleep_logs, daily_logs } = ctx;

  // Primary gate: ARP not committed
  if (!profile.arp_committed) {
    return makeState("US-12", 2, activeDaysFor("US-12", ctx));
  }

  // Secondary: MRM and CRP not established AND onboarding incomplete
  if (!profile.onboarding_completed) {
    const avgMRM = meanMRMCount(daily_logs, 7);
    const crpCount = countCRPTaken(daily_logs, 7);
    if (avgMRM < 2 && crpCount < 2) {
      return makeState("US-12", 2, activeDaysFor("US-12", ctx));
    }
  }

  return null;
}

/** US-04 — ARP Instability */
function detectUS04(ctx: EngineContext): DetectedState | null {
  const { sleep_logs, profile } = ctx;
  if (!profile.arp_committed) return null; // US-12 already handles no-ARP case

  const wakeTimes = sleep_logs.slice(0, 7).map(l => l.wake_time);
  const validWakeTimes = wakeTimes.filter((t): t is string => t != null);

  if (validWakeTimes.length < 3) return null; // insufficient data

  const variance = wakeVarianceMinutes(wakeTimes);
  if (variance !== null && variance > 30) {
    return makeState("US-04", 2, activeDaysFor("US-04", ctx));
  }
  return null;
}

// ─── Pass 2: Anxiety States ───────────────────────────────────────────────────

/** US-07 — Sleep Anxiety Loop */
function detectUS07(ctx: EngineContext): DetectedState | null {
  const { profile, sleep_logs } = ctx;

  // Direct user report
  if (profile.user_reported_anxiety) {
    return makeState("US-07", 1, activeDaysFor("US-07", ctx));
  }

  // 3+ of the last 5 nights with onset_latency > 30 min (non-null only)
  const highLatency = countHighLatencyNights(sleep_logs, 30, 5);
  if (highLatency >= 3) {
    return makeState("US-07", 1, activeDaysFor("US-07", ctx));
  }

  return null;
}

/** US-09 — Ortho-Insomnia */
function detectUS09(ctx: EngineContext): DetectedState | null {
  const { profile } = ctx;
  if (profile.tracker_in_use && profile.user_reported_tracker_anxiety) {
    return makeState("US-09", 2, activeDaysFor("US-09", ctx));
  }
  return null;
}

// ─── Pass 3: Structural Deficit States ───────────────────────────────────────

/** US-03 — Significant Cycle Deficit */
function detectUS03(ctx: EngineContext): DetectedState | null {
  const { weekly_balance, sleep_logs } = ctx;

  if (weekly_balance) {
    // Condition 1: deficit > 7 by day 5+
    if (weekly_balance.cycle_deficit > 7 && weekly_balance.day_number >= 5) {
      return makeState("US-03", 2, activeDaysFor("US-03", ctx), "MEDIUM");
    }
    // Condition 2: floor breached by end of week
    if (weekly_balance.day_number === 7 && weekly_balance.weekly_cycle_total < 28) {
      return makeState("US-03", 2, activeDaysFor("US-03", ctx), "MEDIUM");
    }
  }

  // Condition 3: 3+ consecutive nights below 4 cycles (non-null logs only)
  const consec = consecutiveNightsBelow(sleep_logs, 4);
  if (consec >= 3) {
    return makeState("US-03", 2, activeDaysFor("US-03", ctx), "MEDIUM");
  }

  return null;
}

/** US-02 — Mild Cycle Deficit (skipped if US-03 active) */
function detectUS02(
  ctx: EngineContext,
  us03Active: boolean
): DetectedState | null {
  if (us03Active) return null; // US-03 supersedes

  const { weekly_balance } = ctx;
  if (!weekly_balance) return null;

  const { weekly_cycle_total, day_number } = weekly_balance;
  if (weekly_cycle_total >= 28 && weekly_cycle_total <= 34 && day_number <= 5) {
    return makeState("US-02", 3, activeDaysFor("US-02", ctx));
  }
  return null;
}

// ─── Pass 4: Behavioural / Environmental States ───────────────────────────────

/** US-08 — Electronic Insomnia */
function detectUS08(ctx: EngineContext): DetectedState | null {
  const { sleep_logs, arp_config, profile } = ctx;

  // Direct user report
  if (profile.user_reported_screen_use_in_phase_3) {
    return makeState("US-08", 2, activeDaysFor("US-08", ctx));
  }

  if (!arp_config) return null;

  const targetOnsetMin = timeToMinutes(arp_config.sleep_onset_5cycle);
  const lateOnsetThreshold = targetOnsetMin + 45;

  // Count nights in last 5 where actual_sleep_onset > target + 45 min
  let chronicLateOnset = 0;
  for (const log of sleep_logs.slice(0, 5)) {
    if (log.actual_sleep_onset == null) continue;
    let onsetMin = timeToMinutes(log.actual_sleep_onset);
    // Handle overnight: if onset is after midnight and target is before midnight
    if (onsetMin < targetOnsetMin - 360) onsetMin += 1440;
    if (onsetMin > lateOnsetThreshold) chronicLateOnset++;
  }

  if (chronicLateOnset >= 3) {
    return makeState("US-08", 2, activeDaysFor("US-08", ctx));
  }

  // Strengthen signal from environment data
  if (ctx.environment?.evening_light_environment === "bright_blue" && chronicLateOnset >= 2) {
    return makeState("US-08", 2, activeDaysFor("US-08", ctx));
  }

  return null;
}

/** US-10 — Stimulant Compensation */
function detectUS10(ctx: EngineContext): DetectedState | null {
  const { daily_logs, profile } = ctx;

  // From log data: caffeine after cutoff 3+ of last 7 days
  const caffeineCount = countCaffeineAfterCutoff(daily_logs, 7);
  if (caffeineCount >= 3) {
    return makeState("US-10", 3, activeDaysFor("US-10", ctx));
  }

  // From profile: high caffeine use (low confidence signal)
  if (profile.caffeine_use === "high") {
    return makeState("US-10", 3, activeDaysFor("US-10", ctx), "LOW");
  }

  return null;
}

/** US-11 — Environmental Friction */
function detectUS11(ctx: EngineContext): DetectedState | null {
  const { environment } = ctx;
  if (!environment) return null;

  // Use DB-computed friction score if available
  if (environment.environment_friction_score != null) {
    if (environment.environment_friction_score >= 2) {
      return makeState("US-11", 3, activeDaysFor("US-11", ctx));
    }
    return null;
  }

  // Engine fallback: compute score
  let score = 0;
  if (environment.bedroom_temperature === "hot" || environment.bedroom_temperature === "variable") score++;
  if (environment.evening_light_environment === "bright_blue") score++;
  if (environment.tv_in_bedroom) score++;
  if (environment.work_items_in_bedroom) score++;
  if (environment.blackout_provision && !environment.dws_device) score++;

  if (score >= 2) {
    return makeState("US-11", 3, activeDaysFor("US-11", ctx));
  }
  return null;
}

/** US-05 — Chronotype Conflict (Social Jet Lag) */
function detectUS05(ctx: EngineContext): DetectedState | null {
  const { profile } = ctx;
  if (!profile.arp_time) return null;

  if (
    profile.chronotype === "PMer" &&
    timeToMinutes(profile.arp_time) < timeToMinutes("07:00")
  ) {
    return makeState("US-05", 3, activeDaysFor("US-05", ctx));
  }
  return null;
}

// ─── Pass 5: Event / Context States ──────────────────────────────────────────

/** US-06 — Post-Disruption Recovery */
function detectUS06(
  ctx: EngineContext,
  us03Active: boolean
): DetectedState | null {
  if (us03Active) return null; // US-03 takes priority

  const disruptionTypes = ["travel", "social_disruption", "shift_change"] as const;
  const activeEvents = ctx.events.filter(
    e =>
      e.active &&
      disruptionTypes.includes(e.event_type as (typeof disruptionTypes)[number])
  );

  if (activeEvents.length === 0) return null;

  const deficit = ctx.weekly_balance?.cycle_deficit ?? 0;
  if (deficit <= 14) {
    return makeState("US-06", 3, activeDaysFor("US-06", ctx));
  }
  return null;
}

/** US-15 — Pre-Event High Arousal */
function detectUS15(ctx: EngineContext): DetectedState | null {
  const todayMs = Date.parse(ctx.today);
  const twoDaysMs = 2 * 86_400_000;

  const preEvents = ctx.events.filter(e => {
    if (!e.active || e.event_type !== "pre_event") return false;
    const startMs = Date.parse(e.start_date);
    return startMs <= todayMs + twoDaysMs;
  });

  if (preEvents.length > 0) {
    return makeState("US-15", 3, activeDaysFor("US-15", ctx));
  }
  return null;
}

/** US-16 — Illness / Injury Recovery */
function detectUS16(ctx: EngineContext): DetectedState | null {
  const illnessEvents = ctx.events.filter(
    e => e.active && (e.event_type === "illness" || e.event_type === "injury")
  );
  if (illnessEvents.length > 0) {
    return makeState("US-16", 2, activeDaysFor("US-16", ctx));
  }
  return null;
}

// ─── Pass 6: Maintenance ──────────────────────────────────────────────────────

/** US-01 — Aligned */
function detectUS01(
  ctx: EngineContext,
  activeStates: DetectedState[]
): DetectedState | null {
  // Only active if no priority ≤ 3 state is active
  const hasHighPriorityState = activeStates.some(s => s.priority <= 3);
  if (hasHighPriorityState) return null;

  const { weekly_balance, daily_logs } = ctx;
  if (!weekly_balance) return null;

  if (
    weekly_balance.weekly_cycle_total >= 33 &&
    weekly_balance.arp_stable &&
    meanMRMCount(daily_logs, 7) >= 4
  ) {
    return makeState("US-01", 5, activeDaysFor("US-01", ctx));
  }
  return null;
}

// ─── Main Detector ────────────────────────────────────────────────────────────

export interface StateDetectionResult {
  states: DetectedState[];
  gate_all_states: boolean;  // true when arp_committed = false
}

/**
 * Detect all active user states for the given engine context.
 * Returns states sorted by priority ascending (1 = most urgent first).
 */
export function detectStates(ctx: EngineContext): StateDetectionResult {
  const states: DetectedState[] = [];

  // ── Pass 1: Gate States ──────────────────────────────────────────────────
  const us12 = detectUS12(ctx);
  if (us12) states.push(us12);

  // Hard gate: if ARP not committed, no other states evaluated
  if (!ctx.profile.arp_committed) {
    return { states, gate_all_states: true };
  }

  const us04 = detectUS04(ctx);
  if (us04) states.push(us04);

  // ── Pass 2: Anxiety States ───────────────────────────────────────────────
  const us07 = detectUS07(ctx);
  if (us07) states.push(us07);

  const us09 = detectUS09(ctx);
  if (us09) states.push(us09);

  // ── Pass 3: Structural Deficit ───────────────────────────────────────────
  const us03 = detectUS03(ctx);
  if (us03) states.push(us03);

  const us02 = detectUS02(ctx, us03 !== null);
  if (us02) states.push(us02);

  // ── Pass 4: Behavioural / Environmental ──────────────────────────────────
  const us08 = detectUS08(ctx);
  if (us08) states.push(us08);

  const us10 = detectUS10(ctx);
  if (us10) states.push(us10);

  const us11 = detectUS11(ctx);
  if (us11) states.push(us11);

  const us05 = detectUS05(ctx);
  if (us05) states.push(us05);

  // ── Pass 5: Event / Context States ──────────────────────────────────────
  const us06 = detectUS06(ctx, us03 !== null);
  if (us06) states.push(us06);

  const us15 = detectUS15(ctx);
  if (us15) states.push(us15);

  const us16 = detectUS16(ctx);
  if (us16) states.push(us16);

  // ── Pass 6: Maintenance ──────────────────────────────────────────────────
  const us01 = detectUS01(ctx, states);
  if (us01) states.push(us01);

  // Sort by priority ascending (1 first)
  states.sort((a, b) => a.priority - b.priority);

  return { states, gate_all_states: false };
}

/** Helper: check if a specific state is in the active list */
export function isActive(states: DetectedState[], id: UserStateId): boolean {
  return states.some(s => s.state_id === id);
}

/** Find a state by ID */
export function findState(
  states: DetectedState[],
  id: UserStateId
): DetectedState | undefined {
  return states.find(s => s.state_id === id);
}
