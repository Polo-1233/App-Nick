/**
 * Airloop Chat Handler
 *
 * Maps pre-built prompt IDs to engine calls + template responses.
 * This is the ONLY routing layer for chat in V1.
 *
 * Hard constraints (from product-architecture-roadmap.md):
 * - Finite switch statement — no intent routing, no LLM, no free-text
 * - Every response is derived from engine outputs (DayPlan, CycleWindow, etc.)
 * - Airloop interprets; the engine computes. Never the reverse.
 *
 * Adding a new prompt = add to CHAT_PROMPTS array + add case to handleChatPrompt().
 */

import type { DayPlan, UserProfile } from "@r90/types";
import { recalculateFromMissedBedtime, formatTime, addMinutes } from "@r90/core";

/** All valid prompt IDs — exhaustive union enforced by the switch default */
export type PromptId =
  | "how_is_my_week"
  | "explain_plan"
  | "what_if_late"
  | "recalculate";

export interface ChatPrompt {
  id: PromptId;
  label: string; // shown on the button
}

/** The 4 pre-built prompts available to the user. Order matters (visual layout). */
export const CHAT_PROMPTS: ChatPrompt[] = [
  { id: "how_is_my_week", label: "How's my week?" },
  { id: "explain_plan",   label: "Explain my plan" },
  { id: "what_if_late",   label: "What if I sleep late?" },
  { id: "recalculate",    label: "Recalculate" },
];

export interface HandleResult {
  /** The Airloop response text to display */
  text: string;
  /**
   * When true, the caller should invoke refreshPlan() after displaying
   * the response message. Used by "Recalculate".
   */
  shouldRefresh: boolean;
}

/** Get current minute of day (0-1439) */
function now(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Handle a prompt tap.
 *
 * @param promptId  - one of the CHAT_PROMPTS ids
 * @param dayPlan   - current day plan from context
 * @param profile   - user profile (may be null if still loading)
 */
export function handleChatPrompt(
  promptId: PromptId,
  dayPlan: DayPlan,
  profile: UserProfile | null
): HandleResult {
  switch (promptId) {
    // ----------------------------------------------------------------
    case "how_is_my_week": {
      const { zone, weeklyTotal, weeklyTarget } = dayPlan.readiness;
      const remaining = weeklyTarget - weeklyTotal;

      if (zone === "green") {
        return {
          text: `At ${weeklyTotal}/${weeklyTarget} cycles this week. Reserves solid.`,
          shouldRefresh: false,
        };
      }
      if (zone === "yellow") {
        return {
          text: `At ${weeklyTotal}/${weeklyTarget} cycles. ${remaining} to target. CRP recommended today.`,
          shouldRefresh: false,
        };
      }
      // orange
      return {
        text: `At ${weeklyTotal}/${weeklyTarget} cycles. Body asking for recovery. CRP is the priority — protect tonight.`,
        shouldRefresh: false,
      };
    }

    // ----------------------------------------------------------------
    case "explain_plan": {
      const { bedtime, wakeTime, cycleCount, preSleepStart } = dayPlan.cycleWindow;
      const action = dayPlan.nextAction;
      return {
        text: `Tonight: pre-sleep at ${formatTime(preSleepStart)}, bed at ${formatTime(bedtime)}, ${cycleCount} cycles, up at ${formatTime(wakeTime)}. Up next: ${action.title.toLowerCase()}.`,
        shouldRefresh: false,
      };
    }

    // ----------------------------------------------------------------
    case "what_if_late": {
      if (!profile) {
        return {
          text: "Profile not ready. Try again in a moment.",
          shouldRefresh: false,
        };
      }
      // Simulate: what's the next window if you miss tonight's planned bedtime?
      const missedAt = addMinutes(dayPlan.cycleWindow.bedtime, 1);
      const adjusted = recalculateFromMissedBedtime(profile, missedAt);

      if (!adjusted) {
        return {
          text: `No full window available after ${formatTime(dayPlan.cycleWindow.bedtime)}. Keep the anchor — ${formatTime(profile.anchorTime)} — and make tomorrow count.`,
          shouldRefresh: false,
        };
      }
      return {
        text: `Miss ${formatTime(dayPlan.cycleWindow.bedtime)}? Next option is ${formatTime(adjusted.bedtime)} for ${adjusted.cycleCount} cycles, up at ${formatTime(adjusted.wakeTime)}. Anchor stays at ${formatTime(profile.anchorTime)}.`,
        shouldRefresh: false,
      };
    }

    // ----------------------------------------------------------------
    case "recalculate": {
      const currentTime = now();
      return {
        text: `Rebuilding plan for ${formatTime(currentTime)}. Timeline and next action will update.`,
        shouldRefresh: true,
      };
    }

    // ----------------------------------------------------------------
    default: {
      // TypeScript exhaustiveness check — if this errors, a PromptId was not handled
      const _exhaustive: never = promptId;
      return { text: "Unknown prompt.", shouldRefresh: false };
    }
  }
}
