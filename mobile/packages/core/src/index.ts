/**
 * @r90/core — R90 Digital Navigator Logic Engine
 *
 * Pure TypeScript, zero dependencies, fully deterministic.
 */

export { calculateCycleWindow, recalculateFromMissedBedtime, calculatePostEventWindow, CYCLE_DURATION, DOWN_PERIOD_DURATION, PRE_SLEEP_DURATION } from "./cycles";
export { buildDayPlan, buildDayPlanFromWindow } from "./planner";
export { detectConflicts, generateConflictOptions } from "./conflicts";
export { selectNextAction } from "./actions";
export { generateAirloopMessage, generatePostEventMessage } from "./airloop-messages";
export { computeReadiness } from "./readiness";
export { RULES_REGISTRY, getTodoNickRules, getRule, getRulesByCategory } from "./rules";
export { parseTime, formatTime, subtractMinutes, addMinutes, isTimeBetween, duration } from "./time-utils";
export { evaluatePremiumTrigger, defaultUsage, type UsageRecord, type PremiumFeature, type PremiumTriggerResult } from "./premium-gates";
