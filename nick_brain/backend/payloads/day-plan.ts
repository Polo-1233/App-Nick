/**
 * R90 Backend — Day Plan Payload Generator
 *
 * Produces the DayPlanPayload: full 16-cycle timeline with MRM slots,
 * CRP window, phase boundaries, sleep onset options, and notification schedule.
 */

import type { ARPConfig } from "../../engine/types.js";
import type {
  DayPlanPayload,
  CycleTimelineEntry,
  NotificationScheduleEntry,
} from "../types.js";
import type { AppClient } from "../db/client.js";
import { fetchARPConfig } from "../db/queries.js";

// ─── Phase labels ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<number, string> = {
  1: "Phase 1 — Morning",
  2: "Phase 2 — Afternoon",
  3: "Phase 3 — Evening",
  4: "Phase 4 — Nocturnal",
};

function getPhase(cycleNumber: number): number {
  if (cycleNumber <= 4) return 1;
  if (cycleNumber <= 8) return 2;
  if (cycleNumber <= 12) return 3;
  return 4;
}

// ─── Cycle timeline builder ────────────────────────────────────────────────────

/**
 * Build the full 16-cycle timeline from an ARPConfig.
 * Annotates each cycle with type, phase, and window membership.
 */
function buildCycleTimeline(arpConfig: ARPConfig): CycleTimelineEntry[] {
  const crpOpen = arpConfig.crp_window_open;
  const crpClose = arpConfig.crp_window_close;
  const onset5 = arpConfig.sleep_onset_5cycle;
  const onset4 = arpConfig.sleep_onset_4cycle;
  const onset3 = arpConfig.sleep_onset_3cycle;

  const sleepOnsets = new Set([onset5, onset4, onset3]);

  return arpConfig.cycle_times.map((time, i) => {
    const cycleNum = i + 1;
    const phase = getPhase(cycleNum);
    const isInCRPWindow = isBetween(time, crpOpen, crpClose);
    const isSleepOnset = sleepOnsets.has(time);

    let type: CycleTimelineEntry["type"];
    if (cycleNum === 1) {
      type = "arp";
    } else if (time === crpOpen) {
      type = "crp_window_open";
    } else if (time === crpClose) {
      type = "crp_window_close";
    } else if (isSleepOnset) {
      type = "sleep_onset";
    } else if (phase !== getPhase(cycleNum - 1) || cycleNum === 1) {
      type = "phase_boundary";
    } else {
      type = "mrm";
    }

    let label = `C${cycleNum}`;
    if (cycleNum === 1) label = "Wake (ARP)";
    if (time === onset5) label = "Sleep onset — 5 cycles";
    if (time === onset4) label = "Sleep onset — 4 cycles";
    if (time === onset3) label = "Sleep onset — 3 cycles (floor)";
    if (time === crpOpen) label = "CRP window opens";
    if (time === crpClose) label = "CRP window closes / Phase 3";

    return {
      cycle: cycleNum,
      time,
      phase,
      label,
      type,
      is_crp_window: isInCRPWindow,
      is_sleep_onset: isSleepOnset,
    };
  });
}

// ─── Notification schedule ─────────────────────────────────────────────────────

/**
 * Build the notification schedule from an ARPConfig.
 * Covers: ARP wake, MRM reminders, CRP window open/close, Phase 3, sleep onset.
 */
function buildNotificationSchedule(arpConfig: ARPConfig): NotificationScheduleEntry[] {
  const schedule: NotificationScheduleEntry[] = [];

  // ARP wake notification
  schedule.push({
    time: arpConfig.arp_time,
    type: "arp_wake",
    message_key: "rec_06",
    payload: { action: "open_wake_routine" },
  });

  // MRM reminders (C2 through C8, waking hours)
  for (const mrmTime of arpConfig.mrm_times.slice(1, 8)) { // skip C1 (ARP), stop before Phase 3
    schedule.push({
      time: mrmTime,
      type: "mrm",
      message_key: "rec_05",
      payload: { duration: "3-5 min" },
    });
  }

  // CRP window open
  schedule.push({
    time: arpConfig.crp_window_open,
    type: "crp_window_open",
    message_key: "rec_03",
    payload: {
      crp_window_open: arpConfig.crp_window_open,
      crp_window_close: arpConfig.crp_window_close,
    },
  });

  // Phase 3 boundary
  schedule.push({
    time: arpConfig.phase_3_start,
    type: "phase_3_start",
    message_key: "rec_08",
    payload: { phase: 3 },
  });

  // Sleep onset (5-cycle target)
  schedule.push({
    time: arpConfig.sleep_onset_5cycle,
    type: "sleep_onset",
    message_key: "rec_02",
    payload: {
      target_cycles: 5,
      fallback_onset: addNinetyMinutes(arpConfig.sleep_onset_5cycle),
    },
  });

  // Sort by time
  schedule.sort((a, b) => compareHHMM(a.time, b.time));

  return schedule;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMin(hhmm: string): number {
  const parts = hhmm.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

/** Check if time is within [open, close] inclusive, handling midnight wrap. */
function isBetween(t: string, open: string, close: string): boolean {
  const tm = timeToMin(t);
  const om = timeToMin(open);
  const cm = timeToMin(close);
  if (om <= cm) return tm >= om && tm <= cm;
  return tm >= om || tm <= cm;
}

function addNinetyMinutes(hhmm: string): string {
  const m = (timeToMin(hhmm) + 90) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function compareHHMM(a: string, b: string): number {
  return timeToMin(a) - timeToMin(b);
}

// ─── Main payload builder ─────────────────────────────────────────────────────

export function buildDayPlanPayload(
  arpConfig: ARPConfig,
  date: string
): DayPlanPayload {
  return {
    date,
    arp_time: arpConfig.arp_time,
    cycle_timeline: buildCycleTimeline(arpConfig),
    crp_window: {
      open: arpConfig.crp_window_open,
      close: arpConfig.crp_window_close,
    },
    sleep_onset: {
      "6cycle": arpConfig.sleep_onset_6cycle,
      "5cycle": arpConfig.sleep_onset_5cycle,
      "4cycle": arpConfig.sleep_onset_4cycle,
      "3cycle": arpConfig.sleep_onset_3cycle,
    },
    phase_boundaries: {
      "1": arpConfig.phase_1_start,
      "2": arpConfig.phase_2_start,
      "3": arpConfig.phase_3_start,
      "4": arpConfig.phase_4_start,
    },
    notification_schedule: buildNotificationSchedule(arpConfig),
  };
}

// ─── Service function ──────────────────────────────────────────────────────────

export async function getDayPlanPayload(
  client: AppClient,
  userId: string,
  date?: string
): Promise<DayPlanPayload | null> {
  const arpConfigRow = await fetchARPConfig(client, userId);
  if (!arpConfigRow) return null;

  const arpConfig: ARPConfig = {
    arp_time: arpConfigRow.arp_time,
    cycle_times: arpConfigRow.cycle_times,
    crp_window_open: arpConfigRow.crp_window_open,
    crp_window_close: arpConfigRow.crp_window_close,
    sleep_onset_6cycle: arpConfigRow.sleep_onset_6cycle,
    sleep_onset_5cycle: arpConfigRow.sleep_onset_5cycle,
    sleep_onset_4cycle: arpConfigRow.sleep_onset_4cycle,
    sleep_onset_3cycle: arpConfigRow.sleep_onset_3cycle,
    mrm_times: arpConfigRow.mrm_times,
    phase_1_start: arpConfigRow.phase_1_start,
    phase_2_start: arpConfigRow.phase_2_start,
    phase_3_start: arpConfigRow.phase_3_start,
    phase_4_start: arpConfigRow.phase_4_start,
    generated_at: arpConfigRow.generated_at,
  };

  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  return buildDayPlanPayload(arpConfig, targetDate);
}
