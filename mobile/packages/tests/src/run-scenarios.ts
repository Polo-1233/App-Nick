/**
 * R90 Scenario Test Harness
 *
 * Feeds scenario inputs into the core engine and asserts expected outputs.
 * Run with: npx tsx packages/tests/src/run-scenarios.ts
 */

import { SCENARIOS } from "./scenarios";
import {
  calculateCycleWindow,
  calculatePostEventWindow,
  buildDayPlan,
  computeReadiness,
  detectConflicts,
} from "@r90/core";
import type { Scenario } from "@r90/types";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(
  scenarioId: string,
  field: string,
  actual: unknown,
  expected: unknown
): boolean {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    return true;
  }
  const msg = `  FAIL [${scenarioId}] ${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  failures.push(msg);
  return false;
}

function runScenario(scenario: Scenario): boolean {
  const { input, expected } = scenario;
  const { profile, currentTime, weekHistory, calendarEvents, lateEventEndTime } = input;

  let allPassed = true;

  // ── Cycle window ──────────────────────────────────────────────────────────
  if (expected.cycleWindow) {
    const cycleWindow = lateEventEndTime != null
      ? calculatePostEventWindow(profile, lateEventEndTime)
      : calculateCycleWindow(profile);

    if (cycleWindow) {
      if (expected.cycleWindow.bedtime != null) {
        if (!assert(input.id, "cycleWindow.bedtime", cycleWindow.bedtime, expected.cycleWindow.bedtime))
          allPassed = false;
      }
      if (expected.cycleWindow.wakeTime != null) {
        if (!assert(input.id, "cycleWindow.wakeTime", cycleWindow.wakeTime, expected.cycleWindow.wakeTime))
          allPassed = false;
      }
      if (expected.cycleWindow.cycleCount != null) {
        if (!assert(input.id, "cycleWindow.cycleCount", cycleWindow.cycleCount, expected.cycleWindow.cycleCount))
          allPassed = false;
      }
      if (expected.cycleWindow.preSleepStart != null) {
        if (!assert(input.id, "cycleWindow.preSleepStart", cycleWindow.preSleepStart, expected.cycleWindow.preSleepStart))
          allPassed = false;
      }
    } else {
      failures.push(`  FAIL [${input.id}] cycleWindow: got null`);
      allPassed = false;
    }
  }

  // ── Readiness zone ────────────────────────────────────────────────────────
  if (expected.readinessZone != null) {
    const readiness = computeReadiness(weekHistory, profile.weeklyTarget);
    if (!assert(input.id, "readinessZone", readiness.zone, expected.readinessZone))
      allPassed = false;
  }

  // ── Weekly total ──────────────────────────────────────────────────────────
  if (expected.weeklyTotal != null) {
    const readiness = computeReadiness(weekHistory, profile.weeklyTarget);
    if (!assert(input.id, "weeklyTotal", readiness.weeklyTotal, expected.weeklyTotal))
      allPassed = false;
  }

  // ── Conflict count ────────────────────────────────────────────────────────
  if (expected.conflictCount != null) {
    const cycleWindow = calculateCycleWindow(profile);
    const conflicts = detectConflicts(cycleWindow, calendarEvents);
    if (!assert(input.id, "conflictCount", conflicts.length, expected.conflictCount))
      allPassed = false;
  }

  // ── Day-plan assertions (hasCRPBlock, nextActionType, title, rloMessage) ──
  const needsDayPlan =
    expected.hasCRPBlock != null ||
    expected.nextActionType != null ||
    expected.nextActionTitleContains != null ||
    expected.rloMessageContains != null;

  if (needsDayPlan) {
    const dayPlan = buildDayPlan(profile, input.id, currentTime, weekHistory, calendarEvents);

    if (expected.hasCRPBlock != null) {
      const hasCRP = dayPlan.blocks.some(block => block.type === "crp");
      if (!assert(input.id, "hasCRPBlock", hasCRP, expected.hasCRPBlock))
        allPassed = false;
    }

    if (expected.nextActionType != null) {
      if (!assert(input.id, "nextActionType", dayPlan.nextAction.type, expected.nextActionType))
        allPassed = false;
    }

    if (expected.nextActionTitleContains != null) {
      const includes = dayPlan.nextAction.title.includes(expected.nextActionTitleContains);
      if (!assert(input.id, "nextActionTitleContains", includes, true))
        allPassed = false;
    }

    if (expected.rloMessageContains != null) {
      const includesText = dayPlan.rloMessage.text.includes(expected.rloMessageContains);
      if (!assert(input.id, "rloMessageContains", includesText, true))
        allPassed = false;
    }
  }

  return allPassed;
}

// --- Main ---
console.log("R90 Digital Navigator — Scenario Test Suite");
console.log("============================================\n");

for (const scenario of SCENARIOS) {
  const { input } = scenario;
  process.stdout.write(`[${input.id}] ${input.name}... `);

  const success = runScenario(scenario);
  if (success) {
    console.log("PASS");
    passed++;
  } else {
    console.log("FAIL");
    failed++;
  }
}

console.log(`\n--------------------------------------------`);
console.log(`Results: ${passed} passed, ${failed} failed, ${SCENARIOS.length} total`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(f);
  }
  process.exit(1);
}

console.log("\nAll scenarios passed!");
process.exit(0);
