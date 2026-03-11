/**
 * R90 Backend — Recommendation Metadata
 *
 * Static lookup tables for recommendation category, cooldown, and delivery channel.
 * Mirrors the constants defined in the engine recommendation-engine.ts.
 */
import type { RecommendationType } from "../../engine/types.js";
export declare const REC_CATEGORY: Record<RecommendationType, string>;
export declare const REC_COOLDOWN_HOURS: Record<string, number>;
export declare const REC_DELIVERY_CHANNEL: Record<string, string>;
