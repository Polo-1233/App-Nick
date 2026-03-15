/**
 * Weekly report handlers
 *
 * POST /reports/generate       — generate a weekly report via OpenAI
 * GET  /reports/weekly/latest  — fetch the latest report
 */
import { sendJson, sendError } from "../server.js";
import { fetchWeeklySummaries, fetchLatestWeeklyReport } from "../db/queries.js";
import { detectPatterns } from "../services/pattern-detector.js";
import { getWeekStart } from "../services/weekly-summary-service.js";
export async function generateReportHandler(_req, res, auth) {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
        sendError(res, 500, "OpenAI not configured", "NO_API_KEY");
        return;
    }
    // Fetch last 4 weeks of summaries
    const summaries = await fetchWeeklySummaries(auth.client, auth.userId, 4);
    if (summaries.length === 0) {
        sendError(res, 400, "No weekly data available for report", "NO_DATA");
        return;
    }
    const patterns = detectPatterns(summaries);
    const weekStart = getWeekStart(new Date());
    // Check if report already exists for this week
    const existing = await fetchLatestWeeklyReport(auth.client, auth.userId);
    if (existing && existing.week_start === weekStart) {
        sendJson(res, 200, { report: existing });
        return;
    }
    // Build prompt
    const summaryText = summaries.map(s => `Week ${s.week_start}: avg ${s.avg_cycles ?? "?"} cycles, total ${s.total_cycles ?? 0}/${s.target_cycles ?? 35}, ` +
        `on_track: ${s.on_track ?? "?"}, deficit: ${s.deficit ?? 0}` +
        (s.mood_avg !== null ? `, mood: ${s.mood_avg}` : "") +
        (s.stress_avg !== null ? `, stress: ${s.stress_avg}` : "")).join("\n");
    const patternsText = patterns.length > 0 ? patterns.join("\n") : "No patterns detected yet.";
    const systemPrompt = `You are R-Lo, the sleep performance coach from R90 Navigator. Generate a concise weekly sleep report (~400 tokens max) based on the user's data. Use 3 sections:
1. **Weekly Overview** — summarize the week's sleep performance
2. **Strengths** — what went well
3. **Recommendations** — 2 concrete, actionable tips for next week

Be warm, direct, and data-driven. Never invent data. Use the R90 methodology.`;
    const userPrompt = `Here is the user's sleep data:

${summaryText}

Detected patterns:
${patternsText}

Generate the weekly report now.`;
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                max_tokens: 512,
                temperature: 0.6,
            }),
            signal: AbortSignal.timeout(25_000),
        });
        if (!response.ok) {
            sendError(res, 500, "Failed to generate report", "OPENAI_ERROR");
            return;
        }
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
            sendError(res, 500, "Empty response from AI", "EMPTY_RESPONSE");
            return;
        }
        // Persist the report
        const { error } = await auth.client
            .from("weekly_reports")
            .upsert({
            user_id: auth.userId,
            week_start: weekStart,
            content,
            generated_at: new Date().toISOString(),
        }, { onConflict: "user_id,week_start" });
        if (error) {
            console.error("[report] Failed to persist report:", error.message);
        }
        sendJson(res, 200, {
            report: {
                user_id: auth.userId,
                week_start: weekStart,
                content,
                generated_at: new Date().toISOString(),
            },
        });
    }
    catch (err) {
        console.error("[report] Generation failed:", err instanceof Error ? err.message : err);
        sendError(res, 500, "Report generation failed", "GENERATION_FAILED");
    }
}
export async function latestReportHandler(_req, res, auth) {
    const report = await fetchLatestWeeklyReport(auth.client, auth.userId);
    sendJson(res, 200, { report });
}
//# sourceMappingURL=report-handler.js.map