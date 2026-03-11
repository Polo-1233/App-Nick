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
import type { EngineContext, DetectedState, UserStateId } from "./types.js";
export interface StateDetectionResult {
    states: DetectedState[];
    gate_all_states: boolean;
}
/**
 * Detect all active user states for the given engine context.
 * Returns states sorted by priority ascending (1 = most urgent first).
 */
export declare function detectStates(ctx: EngineContext): StateDetectionResult;
/** Helper: check if a specific state is in the active list */
export declare function isActive(states: DetectedState[], id: UserStateId): boolean;
/** Find a state by ID */
export declare function findState(states: DetectedState[], id: UserStateId): DetectedState | undefined;
