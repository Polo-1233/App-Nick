/**
 * R90 Backend — Engine Service
 *
 * Orchestrates: assemble context → run engine → persist results.
 *
 * This is the single point of engine execution for all write flows.
 * All log submission services call runAndPersistEngine() after writing.
 */

import type { AppClient } from "../db/client.js";
import type { EngineOutput } from "../../engine/types.js";
import { runEngineSafe } from "../../engine/engine-runner.js";
import { generateARPConfig } from "../../engine/arp-config.js";
import { computeDayNumber } from "../../engine/weekly-accounting.js";
import { assembleEngineContext } from "../context/assembler.js";
import {
  syncUserStates,
  persistRecommendations,
  updateCooldown,
  upsertARPConfig,
  upsertWeeklyBalance,
} from "../db/mutations.js";

/**
 * Full engine execution cycle for a user:
 * 1. Assemble EngineContext from Supabase
 * 2. Run the deterministic engine
 * 3. Persist states, recommendations, and weekly balance back to DB
 *
 * Returns the EngineOutput for use by the calling service (payload generation, etc.)
 */
export async function runAndPersistEngine(
  client: AppClient,
  userId: string,
  now?: string
): Promise<EngineOutput> {
  const evaluationTime = now ?? new Date().toISOString();

  // Step 1: Assemble context from DB
  const ctx = await assembleEngineContext(client, userId, evaluationTime);

  // Step 2: Run engine (safe — never throws)
  const output = runEngineSafe(ctx);

  // Step 3: Persist results asynchronously (fire and forget errors are logged)
  await persistEngineOutput(client, userId, ctx, output);

  return output;
}

/**
 * Persist engine output to the database:
 * - Sync detected user states
 * - Persist recommendations
 * - Update recommendation cooldowns for delivered recs
 * - Update/create weekly balance record
 * - Upsert ARP config if it was regenerated
 */
async function persistEngineOutput(
  client: AppClient,
  userId: string,
  ctx: ReturnType<typeof assembleEngineContext> extends Promise<infer T> ? T : never,
  output: EngineOutput
): Promise<void> {
  const now = output.evaluated_at;

  // Persist states
  await syncUserStates(client, userId, output.active_states);

  // Persist recommendations
  await persistRecommendations(client, userId, output.recommendations);

  // Update cooldowns for all recommendations that were just generated
  for (const rec of output.recommendations) {
    await updateCooldown(client, userId, rec.rec_type);
  }

  // Persist updated ARP config if engine regenerated it
  if (output.arp_config && (
    !ctx.arp_config ||
    output.arp_config.arp_time !== ctx.arp_config.arp_time
  )) {
    await upsertARPConfig(client, userId, output.arp_config);
  }

  // Persist weekly accounting if computed
  if (output.weekly_accounting) {
    const acct = output.weekly_accounting;
    const weekStart = ctx.profile.arp_committed_at?.slice(0, 10) ?? ctx.today;
    const resolvedWeekStart = computeWeekStart(
      ctx.profile.arp_committed_at?.slice(0, 10) ?? ctx.today,
      ctx.today
    );
    const weekEnd = addDays(resolvedWeekStart, 6);

    // Build per-day arrays from the week's logs
    const weekSleepLogs = [...ctx.sleep_logs].slice(0, 7).reverse();
    const weekDailyLogs = [...ctx.daily_logs].slice(0, 7).reverse();

    const nocturnalPerDay = weekSleepLogs.map(l => l.cycles_completed);
    const crpPerDay = weekDailyLogs.map(l => (l.crp_cycle_credited ? 1 : 0));

    await upsertWeeklyBalance(
      client,
      userId,
      resolvedWeekStart,
      weekEnd,
      acct,
      nocturnalPerDay,
      crpPerDay
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the rolling week start date from ARP commitment date and today.
 */
export function computeWeekStart(arpCommittedAt: string, today: string): string {
  const msPerDay = 86_400_000;
  const commitMs = Date.parse(arpCommittedAt.slice(0, 10));
  const todayMs = Date.parse(today);
  const daysSinceCommit = Math.floor((todayMs - commitMs) / msPerDay);
  const daysIntoWeek = daysSinceCommit % 7;
  const weekStartMs = todayMs - daysIntoWeek * msPerDay;
  return new Date(weekStartMs).toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  return new Date(Date.parse(dateStr) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Generate and persist ARP config from an ARP time string.
 * Called when a user commits to an ARP during onboarding or updates it.
 */
export async function generateAndPersistARPConfig(
  client: AppClient,
  userId: string,
  arpTime: string
): Promise<void> {
  const config = generateARPConfig(arpTime);
  await upsertARPConfig(client, userId, config);
}
