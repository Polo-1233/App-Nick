/**
 * Airloop message generator.
 *
 * Deterministic message selection based on context.
 * Rule references: R060-R065
 *
 * Tone guide (see docs/AIRLOOP_STYLE_GUIDE.md):
 * - Calm expert: no mascot language, no exclamation marks, no emojis in text.
 * - Cycle-first: speak in cycles, not hours.
 * - Week-aware: reference X/35 progress, not nightly perfection.
 * - Adult-to-adult: treat users as capable. No hand-holding.
 *
 * GUARDRAILS:
 * - Never use: "score," "grade," "rating," "poor," "bad," "fail"
 * - Never show raw metrics (HRV, recovery %, sleep stages)
 * - No exclamation marks. No emojis in message text.
 */

import type { AirloopMessage, RuleContext, AirloopMoment } from "@r90/types";
import { formatTime } from "./time-utils";

/**
 * Generate the primary Airloop message for the current moment.
 */
export function generateAirloopMessage(ctx: RuleContext): AirloopMessage {
  const moment = determineMoment(ctx.now, ctx.profile.anchorTime);

  switch (moment) {
    case "morning":
      return morningMessage(ctx);
    case "midday":
      return middayMessage(ctx);
    case "evening":
      return eveningMessage(ctx);
    default:
      return generalMessage(ctx);
  }
}

/**
 * Determine the time-of-day moment relative to anchor time.
 * Morning = anchor to anchor+6h, Midday = anchor+6h to anchor+11h, Evening = anchor+11h onward.
 */
function determineMoment(now: number, anchorTime: number): AirloopMoment {
  // Calculate time since anchor (handles wraparound)
  const minutesSinceAnchor = (now - anchorTime + 1440) % 1440;

  if (minutesSinceAnchor < 360) return "morning"; // 0-6h after anchor
  if (minutesSinceAnchor < 660) return "midday"; // 6-11h after anchor
  if (minutesSinceAnchor < 960) return "evening"; // 11-16h after anchor
  return "general"; // 16h+ after anchor (close to next anchor)
}

function morningMessage(ctx: RuleContext): AirloopMessage {
  const lastNight = ctx.weekHistory[ctx.weekHistory.length - 1];
  const cycles = lastNight?.cyclesCompleted ?? ctx.todayPlan.cycleCount;
  const { zone } = ctx.readiness;
  const { weeklyTotal, weeklyTarget } = ctx.readiness;

  if (zone === "green") {
    return {
      moment: "morning",
      text: `${cycles} cycles last night. Reserves solid. Push if you want today.`,
      ruleId: "R060",
      tone: "encouraging",
    };
  }

  if (zone === "yellow") {
    return {
      moment: "morning",
      text: `${cycles} cycles last night. Steady state. CRP window flagged for this afternoon.`,
      ruleId: "R060",
      tone: "calm",
    };
  }

  // Orange
  const daysLeftGuess = 7 - ctx.weekHistory.length;
  const message =
    daysLeftGuess > 1
      ? `${cycles} cycles last night. At ${weeklyTotal}/${weeklyTarget} this week. ${daysLeftGuess} nights to go — manageable. CRP is priority today.`
      : `${cycles} cycles. Your body is asking for rest. Tonight matters.`;

  return {
    moment: "morning",
    text: message,
    ruleId: "R060",
    tone: "pragmatic",
  };
}

function middayMessage(ctx: RuleContext): AirloopMessage {
  const { zone } = ctx.readiness;

  if (zone === "green") {
    return {
      moment: "midday",
      text: "Reserves looking solid. No CRP needed unless you want one.",
      ruleId: "R061",
      tone: "calm",
    };
  }

  // CRP window: 13:00-15:00 (book-confirmed)
  return {
    moment: "midday",
    text: "CRP window is open. Even 30 minutes would help. Can you fit it in?",
    ruleId: "R061",
    tone: "encouraging",
  };
}

function eveningMessage(ctx: RuleContext): AirloopMessage {
  const bedtime = ctx.todayPlan.bedtime;
  const preSleep = ctx.todayPlan.preSleepStart;
  const minutesUntilPreSleep = ((preSleep - ctx.now) + 1440) % 1440;

  if (minutesUntilPreSleep <= 120) {
    return {
      moment: "evening",
      text: `Pre-sleep routine in ${minutesUntilPreSleep} minutes. Start stepping away from screens.`,
      ruleId: "R062",
      tone: "calm",
    };
  }

  return {
    moment: "evening",
    text: `Evening is clear. Pre-sleep at ${formatTime(preSleep)}, first cycle at ${formatTime(bedtime)}.`,
    ruleId: "R062",
    tone: "calm",
  };
}

function generalMessage(ctx: RuleContext): AirloopMessage {
  return {
    moment: "general",
    text: `At ${ctx.readiness.weeklyTotal}/${ctx.readiness.weeklyTarget} cycles this week.`,
    ruleId: "R043",
    tone: "calm",
  };
}

/**
 * Generate a post-late-event message.
 * Rule R063: Down-period protocol guidance.
 */
export function generatePostEventMessage(
  eventEndTime: number,
  firstCycleTime: number,
  cycleCount: number
): AirloopMessage {
  return {
    moment: "post_event",
    text: `Event done. Adrenaline takes 90 minutes to clear. Next cycle at ${formatTime(firstCycleTime)}. ${cycleCount} cycles tonight — fine for one night. Wind down, no screens.`,
    ruleId: "R063",
    tone: "pragmatic",
  };
}
