/**
 * R90 Backend — Coaching Copy
 *
 * Static message templates keyed by recommendation type.
 * In production this would be served from a CMS or localised strings file.
 * The engine outputs message_key values; this map resolves them to displayable text.
 *
 * Tone rules (from R90_RULE_ENGINE_SPEC.md):
 * - Never use fear-based statistics
 * - Never use outcome comparisons when US-07 is active
 * - Frame CRP as recovery tool, not "nap"
 * - Cycles, not hours
 */
export interface CoachingMessage {
    title: string;
    body: string;
    cta?: string;
}
export declare const COACHING_COPY: Record<string, CoachingMessage>;
/**
 * Get coaching message for a recommendation type, with optional variable interpolation.
 */
export declare function getCoachingMessage(recType: string, variables?: Record<string, string>, tone?: string): CoachingMessage;
