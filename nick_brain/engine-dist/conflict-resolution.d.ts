/**
 * R90 Engine — Conflict Resolution
 *
 * Pure function. No I/O.
 *
 * Applies suppression rules and tone overrides when multiple states co-occur.
 *
 * Sources: R90_RULE_ENGINE_SPEC.md §6 (CONFLICT RESOLUTION)
 */
import type { DetectedState, RecommendationOutput, ToneOverride } from "./types.js";
/**
 * Compute the active tone override based on detected states.
 * US-07 is the only state that triggers a global tone override.
 */
export declare function computeToneOverride(states: DetectedState[]): ToneOverride;
interface SuppressionResult {
    recommendations: RecommendationOutput[];
    suppressed: Array<{
        rec_type: string;
        reason: string;
    }>;
}
/**
 * Apply all conflict-resolution suppression rules to the candidate list.
 * Returns filtered recommendations and a log of what was suppressed and why.
 */
export declare function applySuppressionRules(candidates: RecommendationOutput[], states: DetectedState[]): SuppressionResult;
/**
 * For the US-07 + US-03 conflict:
 * REC-03 (CRP) survives but gets a process-focus flag so coaching copy
 * frames it as routine, not compensation.
 *
 * Mutates the action_payload to add context flags (does not remove the rec).
 */
export declare function applyConflictToneAdjustments(recommendations: RecommendationOutput[], states: DetectedState[]): RecommendationOutput[];
/**
 * Determine whether the cycle count should be shown on the home screen.
 * Hidden when US-07 is active (suppress outcome metrics).
 */
export declare function shouldShowCycleCount(states: DetectedState[]): boolean;
/**
 * Determine whether the deficit warning banner should be shown.
 * Hidden when US-07 is active, or when US-16 (illness) is active.
 */
export declare function shouldShowDeficitWarning(states: DetectedState[]): boolean;
export {};
//# sourceMappingURL=conflict-resolution.d.ts.map