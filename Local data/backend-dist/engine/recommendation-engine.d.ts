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
import type { EngineContext, DetectedState, RecommendationOutput, RecommendationType } from "./types.js";
declare const CAP_EXEMPT: Set<RecommendationType>;
/**
 * Generate the full candidate recommendation set from active states.
 * Does NOT apply suppression rules (handled in conflict-resolution.ts).
 * Returns all candidates before capping.
 */
export declare function generateCandidateRecommendations(states: DetectedState[], ctx: EngineContext): RecommendationOutput[];
/**
 * Apply the 5-recommendation cap.
 * REC-01 and REC-20 are exempt from the cap.
 */
export declare function applyRecommendationCap(recs: RecommendationOutput[]): RecommendationOutput[];
export { CAP_EXEMPT };
