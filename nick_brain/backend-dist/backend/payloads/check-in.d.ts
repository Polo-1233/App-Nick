/**
 * R90 Backend — Check-In Payload Generator
 *
 * Produces the CheckInPayload: a set of max 3 questions tailored to the
 * user's current active states, plus any values already logged today.
 *
 * Question selection rules:
 * - MRM count is always asked (highest signal for framework adherence)
 * - Morning light always asked (supports US-08 detection)
 * - CRP question shown only if RULE-CRP-01 fired (short night trigger)
 * - Evening light asked only when US-08 is active
 * - Max 3 questions per session
 */
import type { CheckInPayload } from "../types.js";
import type { AppClient } from "../db/client.js";
export declare function getCheckInPayload(client: AppClient, userId: string): Promise<CheckInPayload>;
