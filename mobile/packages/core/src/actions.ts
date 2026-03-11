/**
 * Next Best Action selector.
 *
 * Determines the single most important action for the user right now.
 * Principle: ONE action. No overwhelm.
 */

import type { NextAction, RuleContext } from "@r90/types";
import { isTimeBetween, duration, addMinutes, subtractMinutes, formatTime } from "./time-utils";

/**
 * Select the next best action based on current time and context.
 */
export function selectNextAction(ctx: RuleContext): NextAction {
  const { now, todayPlan, readiness } = ctx;
  const { preSleepStart, bedtime, wakeTime } = todayPlan;

  // Morning: just woke up (within 2 hours of anchor)
  if (isTimeBetween(now, wakeTime, addMinutes(wakeTime, 120))) {
    return morningAction(ctx);
  }

  // Midday: CRP recommendation window (13:00-15:00, book-confirmed)
  if (isTimeBetween(now, 780, 900) && readiness.zone !== "green") {
    return crpAction(ctx);
  }

  // Pre-sleep approaching (within 2 hours)
  if (isTimeBetween(now, subtractMinutes(preSleepStart, 120), preSleepStart)) {
    const minutesUntil = duration(now, preSleepStart);
    return {
      type: "start_pre_sleep",
      title: "Pre-sleep routine soon",
      description: `Start your pre-sleep routine in ${minutesUntil} minutes.`,
      scheduledAt: preSleepStart,
      ruleId: "R010",
    };
  }

  // During pre-sleep window (90 minutes before bedtime)
  if (isTimeBetween(now, preSleepStart, bedtime)) {
    const minutesUntil = duration(now, bedtime);
    return {
      type: "start_pre_sleep",
      title: "Pre-sleep routine",
      description: `Time to wind down. Dim lights, no screens. ${minutesUntil} min until bedtime.`,
      scheduledAt: preSleepStart,
      ruleId: "R012",
    };
  }

  // Bedtime (within 15 minutes of bedtime)
  if (isTimeBetween(now, bedtime, addMinutes(bedtime, 15))) {
    return {
      type: "go_to_sleep",
      title: "Time for sleep",
      description: `Cycle 1 starts now. ${todayPlan.cycleCount} cycles until ${formatTime(wakeTime)}.`,
      scheduledAt: bedtime,
      ruleId: "R001",
    };
  }

  // Default: general guidance based on zone
  return generalAction(ctx);
}

function morningAction(ctx: RuleContext): NextAction {
  const { readiness, todayPlan } = ctx;
  const lastNight = ctx.weekHistory[0]; // history is newest-first (sorted desc by date)
  const cycles = lastNight?.cyclesCompleted ?? todayPlan.cycleCount;

  if (readiness.zone === "orange") {
    return {
      type: "take_crp",
      title: "CRP recommended today",
      description: "Recovery priority. Plan a 90-minute CRP this afternoon.",
      ruleId: "R022",
    };
  }

  return {
    type: "general_guidance",
    title: `${cycles} cycles last night`,
    description:
      readiness.zone === "green"
        ? "Full reserves. Push if you want today."
        : "Steady day ahead. A CRP this afternoon would help.",
    ruleId: "R060",
  };
}

function crpAction(ctx: RuleContext): NextAction {
  // CRP window: 13:00-15:00 (book-confirmed, R90_CANONICAL_METHOD_v2 ch. 5)
  return {
    type: "crp_reminder",
    title: "CRP window open",
    description: "Good time for a 30-minute recovery period if you can fit it in.",
    scheduledAt: 780, // 13:00
    ruleId: "R020",
  };
}

function generalAction(ctx: RuleContext): NextAction {
  const { readiness } = ctx;
  const minutesUntil = duration(ctx.now, ctx.todayPlan.preSleepStart);
  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;

  return {
    type: "general_guidance",
    title: "On track",
    description: `Pre-sleep routine in ${hours}h${mins}m. ${readiness.weeklyTotal}/${readiness.weeklyTarget} cycles this week.`,
    ruleId: "R043",
  };
}

