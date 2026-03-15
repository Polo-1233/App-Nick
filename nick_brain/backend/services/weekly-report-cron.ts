/**
 * Weekly report cron
 *
 * Checks every hour. On Monday between 07:00–09:00 UTC, generates
 * weekly reports for all active users who don't already have one.
 */

import type { AppClient } from "../db/client.js";
import { createServerClient } from "../db/client.js";
import { calculateWeeklySummary, getWeekStart } from "./weekly-summary-service.js";
import { detectPatterns } from "./pattern-detector.js";
import { fetchWeeklySummaries, fetchLatestWeeklyReport } from "../db/queries.js";

const ONE_HOUR = 3_600_000;

export function scheduleWeeklyReport(): void {
  setInterval(() => {
    void runWeeklyReportJob();
  }, ONE_HOUR);

  // Also run once at startup to catch missed windows
  setTimeout(() => void runWeeklyReportJob(), 10_000);
}

async function runWeeklyReportJob(): Promise<void> {
  const now     = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon
  const hour      = now.getUTCHours();

  // Only run on Monday between 07:00-09:00 UTC
  if (dayOfWeek !== 1 || hour < 7 || hour >= 9) return;

  let client: AppClient;
  try {
    client = createServerClient();
  } catch {
    return;
  }

  try {
    // Find active users (users with a sleep log in the last 7 days)
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: activeUsers } = await client
      .from("sleep_logs")
      .select("user_id")
      .gte("date", since);

    if (!activeUsers || activeUsers.length === 0) return;

    // Deduplicate user IDs
    const userIds = [...new Set(activeUsers.map((r: { user_id: string }) => r.user_id))];

    const weekStart = getWeekStart(now);
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) return;

    for (const userId of userIds) {
      try {
        // Check if report already exists
        const existing = await fetchLatestWeeklyReport(client, userId);
        if (existing && existing.week_start === weekStart) continue;

        // Calculate this week's summary first
        await calculateWeeklySummary(client, userId, weekStart);

        // Fetch summaries and detect patterns
        const summaries = await fetchWeeklySummaries(client, userId, 4);
        if (summaries.length === 0) continue;

        const patterns = detectPatterns(summaries);

        const summaryText = summaries.map(s =>
          `Week ${s.week_start}: avg ${s.avg_cycles ?? "?"} cycles, total ${s.total_cycles ?? 0}/${s.target_cycles ?? 35}, ` +
          `on_track: ${s.on_track ?? "?"}, deficit: ${s.deficit ?? 0}`
        ).join("\n");

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "You are R-Lo, the sleep performance coach. Generate a concise weekly report (~400 tokens). 3 sections: Weekly Overview, Strengths, Recommendations (2 concrete tips). Be warm, direct, data-driven."
              },
              {
                role: "user",
                content: `Sleep data:\n${summaryText}\n\nPatterns:\n${patterns.join("\n") || "None detected."}\n\nGenerate the weekly report.`
              },
            ],
            max_tokens: 512,
            temperature: 0.6,
          }),
          signal: AbortSignal.timeout(25_000),
        });

        if (!response.ok) continue;

        const json = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = json.choices?.[0]?.message?.content;
        if (!content) continue;

        await client
          .from("weekly_reports")
          .upsert({
            user_id: userId,
            week_start: weekStart,
            content,
            generated_at: new Date().toISOString(),
          }, { onConflict: "user_id,week_start" });
      } catch (err) {
        console.error(`[weekly-report-cron] Failed for user ${userId}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error("[weekly-report-cron] Job failed:", err instanceof Error ? err.message : err);
  }
}
