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

import type { EngineOutput, EngineContext } from "../../engine/types.js";
import type { CheckInPayload, CheckInQuestion, CheckInInput } from "../types.js";
import type { AppClient } from "../db/client.js";
import { assembleEngineContext } from "../context/assembler.js";
import { runEngineSafe } from "../../engine/engine-runner.js";
import { fetchRecentDailyLogs } from "../db/queries.js";

// ─── Question definitions ─────────────────────────────────────────────────────

const Q_MRM: CheckInQuestion = {
  id: "mrm_count",
  type: "number",
  label_key: "checkin_mrm_count",
  min: 0,
  max: 7,
};

const Q_MORNING_LIGHT: CheckInQuestion = {
  id: "morning_light_achieved",
  type: "boolean",
  label_key: "checkin_morning_light",
};

const Q_EVENING_LIGHT: CheckInQuestion = {
  id: "evening_light_managed",
  type: "boolean",
  label_key: "checkin_evening_light",
};

const Q_CRP: CheckInQuestion = {
  id: "crp_taken",
  type: "boolean",
  label_key: "checkin_crp_taken",
};

const Q_ENERGY: CheckInQuestion = {
  id: "subjective_energy_midday",
  type: "scale",
  label_key: "checkin_energy_midday",
  min: 1,
  max: 5,
};

// ─── Question selector ────────────────────────────────────────────────────────

function selectQuestions(
  output: EngineOutput,
  todayLog: Partial<CheckInInput> | null
): { questions: CheckInQuestion[]; showCRPQuestion: boolean } {
  const questions: CheckInQuestion[] = [];
  const activeStateIds = new Set(output.active_states.map(s => s.state_id));
  const crpRecommended = output.recommendations.some(r => r.rec_type === "REC-03");

  // Always: MRM count
  if (todayLog?.mrm_count === undefined) {
    questions.push(Q_MRM);
  }

  // Always: morning light (unless already logged)
  if (todayLog?.morning_light_achieved === undefined) {
    questions.push(Q_MORNING_LIGHT);
  }

  // Conditional: CRP question if engine recommended one today
  const showCRPQuestion = crpRecommended && !todayLog?.crp_taken;
  if (showCRPQuestion && questions.length < 3) {
    questions.push(Q_CRP);
  }

  // Conditional: evening light if US-08 active AND not asked enough questions yet
  if (
    (activeStateIds.has("US-08") || activeStateIds.has("US-11")) &&
    todayLog?.evening_light_managed === undefined &&
    questions.length < 3
  ) {
    questions.push(Q_EVENING_LIGHT);
  }

  // Conditional: energy scale if needed and space
  if (
    !activeStateIds.has("US-07") && // never add outcome metrics under anxiety state
    questions.length < 3
  ) {
    questions.push(Q_ENERGY);
  }

  return { questions: questions.slice(0, 3), showCRPQuestion };
}

// ─── Prefilled values ─────────────────────────────────────────────────────────

import type { DailyLogRow } from "../db/queries.js";

function buildPrefilled(todayLogRow: DailyLogRow | null): Partial<CheckInInput> {
  if (!todayLogRow) return {};
  return {
    mrm_count: todayLogRow.mrm_count ?? undefined,
    morning_light_achieved: todayLogRow.morning_light_achieved ?? undefined,
    evening_light_managed: todayLogRow.evening_light_managed ?? undefined,
    crp_taken: todayLogRow.crp_taken ?? undefined,
    crp_duration_minutes: todayLogRow.crp_duration_minutes ?? undefined,
    crp_start_time: todayLogRow.crp_start_time ?? undefined,
    subjective_energy_midday: todayLogRow.subjective_energy_midday ?? undefined,
  };
}

// ─── Service function ──────────────────────────────────────────────────────────

export async function getCheckInPayload(
  client: AppClient,
  userId: string
): Promise<CheckInPayload> {
  const today = new Date().toISOString().slice(0, 10);

  // Assemble context and run engine (read-only)
  const ctx = await assembleEngineContext(client, userId);
  const output = runEngineSafe(ctx);

  // Get today's daily log if one exists
  const recentDailyLogs = await fetchRecentDailyLogs(client, userId, 1);
  const todayLog = recentDailyLogs.find(l => l.date === today) ?? null;
  const prefilled = todayLog ? buildPrefilled(todayLog) : {};

  const { questions, showCRPQuestion } = selectQuestions(output, prefilled);

  return {
    daily_log_date: today,
    questions,
    prefilled,
    active_states: output.active_states,
    show_crp_question: showCRPQuestion,
  };
}
