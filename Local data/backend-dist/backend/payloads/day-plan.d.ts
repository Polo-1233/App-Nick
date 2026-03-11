/**
 * R90 Backend — Day Plan Payload Generator
 *
 * Produces the DayPlanPayload: full 16-cycle timeline with MRM slots,
 * CRP window, phase boundaries, sleep onset options, and notification schedule.
 */
import type { ARPConfig } from "../../engine/types.js";
import type { DayPlanPayload } from "../types.js";
import type { AppClient } from "../db/client.js";
export declare function buildDayPlanPayload(arpConfig: ARPConfig, date: string): DayPlanPayload;
export declare function getDayPlanPayload(client: AppClient, userId: string, date?: string): Promise<DayPlanPayload | null>;
