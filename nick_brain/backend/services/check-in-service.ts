/**
 * R90 Backend — Check-In Service
 *
 * submit_check_in: lightweight daily input → write to daily_logs → run engine
 *
 * The check-in is a subset of the daily log. It collects the highest-signal
 * fields without asking for everything. Max 3 questions surfaced to the user.
 */

import type { AppClient } from "../db/client.js";
import type { CheckInInput, ServiceResult } from "../types.js";
import type { EngineOutput } from "../../engine/types.js";
import { submitDailyLog } from "./daily-log-service.js";

export interface CheckInResult {
  daily_log_id: string;
  engine_output: EngineOutput;
}

/**
 * Submit a daily check-in.
 * Delegates to submitDailyLog (same write path, subset of fields).
 */
export async function submitCheckIn(
  client: AppClient,
  userId: string,
  input: CheckInInput
): Promise<ServiceResult<CheckInResult>> {
  const result = await submitDailyLog(client, userId, {
    date: input.date,
    mrm_count: input.mrm_count,
    morning_light_achieved: input.morning_light_achieved,
    evening_light_managed: input.evening_light_managed,
    subjective_energy_midday: input.subjective_energy_midday,
    crp_taken: input.crp_taken,
    crp_duration_minutes: input.crp_duration_minutes,
    crp_start_time: input.crp_start_time,
  });

  if (!result.ok || !result.data) {
    return { ok: result.ok, error: result.error, code: result.code };
  }

  return {
    ok: true,
    data: {
      daily_log_id: result.data.daily_log_id,
      engine_output: result.data.engine_output,
    },
  };
}
