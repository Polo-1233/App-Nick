/**
 * R90 Engine — Conflict Resolution
 *
 * Pure function. No I/O.
 *
 * Applies suppression rules and tone overrides when multiple states co-occur.
 *
 * Sources: R90_RULE_ENGINE_SPEC.md §6 (CONFLICT RESOLUTION)
 */

import type {
  DetectedState,
  RecommendationOutput,
  ToneOverride,
  UserStateId,
} from "./types.js";
import { isActive } from "./state-detector.js";

// ─── Tone Override ────────────────────────────────────────────────────────────

/**
 * Compute the active tone override based on detected states.
 * US-07 is the only state that triggers a global tone override.
 */
export function computeToneOverride(states: DetectedState[]): ToneOverride {
  if (isActive(states, "US-07")) {
    return {
      active: true,
      reason: "US-07",
      suppress_outcome_metrics: true,
      suppress_cycle_count_comparison: true,
    };
  }
  return {
    active: false,
    reason: null,
    suppress_outcome_metrics: false,
    suppress_cycle_count_comparison: false,
  };
}

// ─── Suppression Rules ────────────────────────────────────────────────────────

interface SuppressionResult {
  recommendations: RecommendationOutput[];
  suppressed: Array<{ rec_type: string; reason: string }>;
}

/**
 * Apply all conflict-resolution suppression rules to the candidate list.
 * Returns filtered recommendations and a log of what was suppressed and why.
 */
export function applySuppressionRules(
  candidates: RecommendationOutput[],
  states: DetectedState[]
): SuppressionResult {
  const suppressed: Array<{ rec_type: string; reason: string }> = [];
  const us07 = isActive(states, "US-07");
  const us09 = isActive(states, "US-09");
  const us12 = isActive(states, "US-12");
  const us16 = isActive(states, "US-16");

  const keep: RecommendationOutput[] = [];

  for (const rec of candidates) {
    const reason = shouldSuppress(rec, states, us07, us09, us12, us16);
    if (reason) {
      suppressed.push({ rec_type: rec.rec_type, reason });
    } else {
      keep.push(rec);
    }
  }

  return { recommendations: keep, suppressed };
}

function shouldSuppress(
  rec: RecommendationOutput,
  states: DetectedState[],
  us07: boolean,
  us09: boolean,
  us12: boolean,
  us16: boolean
): string | null {

  // ── US-07: Sleep Anxiety Loop → Hard suppressions ────────────────────────
  if (us07) {
    // HARD: never show sleep restriction when anxiety is active
    if (rec.rec_type === "REC-19") return "US-07_active";

    // Suppress tracker recommendations
    if (rec.rec_type === "REC-18") return "US-07_suppress_tracker_rec";

    // Suppress Phase 3 protocol (don't pile on new tasks for anxious user)
    // REC-08 is already suppressed in the generator, but belt-and-suspenders:
    if (rec.rec_type === "REC-08") return "US-07_active";

    // Suppress weekly balance review (outcome metric)
    if (rec.rec_type === "REC-14") return "US-07_suppress_outcome_metrics";
  }

  // ── US-09: Ortho-Insomnia → suppress environment audit ────────────────────
  // Do not add more tasks/audits to an anxious tracker user
  if (us09) {
    if (rec.rec_type === "REC-11") return "US-09_active_defer_audit";
  }

  // ── US-12: Framework Gap → suppress product recs until framework in place ─
  if (us12) {
    if (rec.rec_type === "REC-10") return "US-12_framework_not_established";
    if (rec.rec_type === "REC-11") return "US-12_framework_not_established";
    if (rec.rec_type === "REC-26") return "US-12_framework_not_established";
  }

  // ── US-16: Illness → suspend deficit warnings ─────────────────────────────
  if (us16) {
    if (rec.rec_type === "REC-14") return "US-16_deficit_suspended_during_illness";
    if (rec.rec_type === "REC-19") return "US-16_no_sleep_restriction_during_illness";
  }

  // ── US-06 + US-03: Disruption recovery framing superseded by structural ──
  if (isActive(states, "US-03") && rec.rec_type === "REC-22") {
    return "US-03_takes_priority_over_US-06_framing";
  }

  return null;
}

// ─── Conflict Tone Adjustments ────────────────────────────────────────────────

/**
 * For the US-07 + US-03 conflict:
 * REC-03 (CRP) survives but gets a process-focus flag so coaching copy
 * frames it as routine, not compensation.
 *
 * Mutates the action_payload to add context flags (does not remove the rec).
 */
export function applyConflictToneAdjustments(
  recommendations: RecommendationOutput[],
  states: DetectedState[]
): RecommendationOutput[] {
  const us07 = isActive(states, "US-07");
  const us03 = isActive(states, "US-03");

  return recommendations.map(rec => {
    // US-07 + US-03: CRP framed as routine process, not deficit compensation
    if (us07 && us03 && rec.rec_type === "REC-03") {
      return {
        ...rec,
        action_payload: {
          ...rec.action_payload,
          tone: "process_routine",
          suppress_deficit_framing: true,
        },
      };
    }

    // US-15 + US-03: CRP framed as pre-event prep, not deficit correction
    if (isActive(states, "US-15") && us03 && rec.rec_type === "REC-03") {
      return {
        ...rec,
        action_payload: {
          ...rec.action_payload,
          tone: "pre_event_prep",
          suppress_deficit_framing: true,
        },
      };
    }

    // US-05 + US-02: batch social jet lag coaching with CRP
    if (isActive(states, "US-05") && isActive(states, "US-02") && rec.rec_type === "REC-03") {
      return {
        ...rec,
        action_payload: {
          ...rec.action_payload,
          coaching_context: "social_jet_lag_driver",
        },
      };
    }

    return rec;
  });
}

// ─── Show/Hide UI Signals ─────────────────────────────────────────────────────

/**
 * Determine whether the cycle count should be shown on the home screen.
 * Hidden when US-07 is active (suppress outcome metrics).
 */
export function shouldShowCycleCount(states: DetectedState[]): boolean {
  return !isActive(states, "US-07");
}

/**
 * Determine whether the deficit warning banner should be shown.
 * Hidden when US-07 is active, or when US-16 (illness) is active.
 */
export function shouldShowDeficitWarning(states: DetectedState[]): boolean {
  if (isActive(states, "US-07")) return false;
  if (isActive(states, "US-16")) return false;
  return isActive(states, "US-02") || isActive(states, "US-03");
}
