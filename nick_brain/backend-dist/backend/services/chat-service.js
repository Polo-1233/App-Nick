/**
 * chat-service.ts — LLM coaching layer for R90 Navigator
 *
 * Architecture principle:
 *   - The deterministic engine decides everything (states, recs, plan).
 *   - The LLM only reformulates engine outputs into natural coaching language.
 *   - The LLM cannot override R90 logic, change times, or invent methodology.
 *
 * Fixes applied (2026-03-15):
 *   1. Persona renamed "Airloop" → "R-Lo" throughout
 *   2. Retry logic: up to 2 retries with exponential backoff
 *   3. Conversation persistence via chat_messages table
 *   4. Structured context injection (sections instead of free text)
 *   5. Light input moderation/validation
 */
import { assembleEngineContext } from "../context/assembler.js";
import { runEngineSafe } from "../../engine/engine-runner.js";
import { buildHomeScreenPayload } from "../payloads/home-screen.js";
import { loadRecentMessages, saveExchange, dailySessionId, } from "../db/chat-messages.js";
import { fetchRecentLifeEvents, fetchUpcomingCalendarEvents, fetchWeeklySummaries, fetchLatestWeeklyReport, } from "../db/queries.js";
import { detectPatterns } from "./pattern-detector.js";
import { SLEEP_COACH_TOOLS } from "./tool-definitions.js";
import { executeTool } from "./tool-executor.js";
// ─── 5. Input moderation / validation ────────────────────────────────────────
const MAX_INPUT_LENGTH = 1000;
const MAX_HISTORY_TURNS = 12;
/**
 * Validate and sanitize a user message before sending to the LLM.
 * Returns { ok: true, message } or { ok: false, reason }.
 */
function validateInput(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { ok: false, reason: "empty_message" };
    }
    if (trimmed.length > MAX_INPUT_LENGTH) {
        return { ok: false, reason: "message_too_long" };
    }
    // Detect prompt injection attempts
    const injectionPatterns = [
        /ignore (previous|all) instructions/i,
        /you are now/i,
        /forget your (instructions|system prompt|persona)/i,
        /act as (a )?(different|new) (ai|assistant|model)/i,
        /system prompt:/i,
    ];
    for (const pattern of injectionPatterns) {
        if (pattern.test(trimmed)) {
            return { ok: false, reason: "injection_attempt" };
        }
    }
    // Strip null bytes and control characters (keep newlines for multi-line messages)
    const sanitized = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
    if (!sanitized) {
        return { ok: false, reason: "invalid_content" };
    }
    return { ok: true, message: sanitized };
}
async function buildStructuredContext(client, userId) {
    const [ctx, lifeEvents, calendarEvents, weeklySummaries] = await Promise.all([
        assembleEngineContext(client, userId),
        fetchRecentLifeEvents(client, userId),
        fetchUpcomingCalendarEvents(client, userId, 48),
        fetchWeeklySummaries(client, userId, 4),
    ]);
    const output = runEngineSafe(ctx);
    const home = buildHomeScreenPayload(output, ctx);
    const wb = home.weekly_balance;
    const recentLogs = ctx.sleep_logs.slice(0, 3).map(l => `${l.date}: ${l.cycles_completed ?? "?"} cycles`);
    const profile = ctx.profile;
    return {
        today: ctx.today,
        arp_time: ctx.profile.arp_time ?? null,
        chronotype: ctx.profile.chronotype,
        cycle_target: 5,
        onboarding_ok: ctx.profile.onboarding_completed,
        weekly_cycles: wb ? `${wb.total}/${wb.target}` : "unknown",
        on_track: wb?.on_track ?? false,
        deficit: wb?.deficit ?? 0,
        sleep_onset: home.tonight_sleep_onset ?? null,
        current_phase: home.current_phase ?? null,
        current_cycle: home.current_cycle ?? null,
        active_states: output.active_states.map(s => `${s.state_id} (${s.priority_label}, ${s.active_days}d)`),
        primary_rec: home.primary_recommendation?.message_key ?? null,
        recent_logs: recentLogs,
        gate_blocked: output.gate_blocked,
        gate_reason: output.gate_reason ?? null,
        // Phase 1 — lifestyle
        stress_level: profile.stress_level ?? null,
        sleep_environment: profile.sleep_environment ?? null,
        exercise_frequency: profile.exercise_frequency ?? null,
        alcohol_use: profile.alcohol_use ?? null,
        work_start_time: profile.work_start_time ?? null,
        // Phase 1 — life events
        life_events: lifeEvents.map(e => ({
            type: e.event_type,
            title: e.title,
            date: e.event_date,
            notes: e.notes,
        })),
        // Phase 3 — long-term patterns
        four_week_avg: weeklySummaries.length > 0
            ? Math.round(weeklySummaries.reduce((sum, s) => sum + (s.avg_cycles ?? 0), 0) / weeklySummaries.length * 10) / 10
            : null,
        on_track_rate: weeklySummaries.length > 0
            ? `${weeklySummaries.filter(s => s.on_track).length}/${weeklySummaries.length} weeks`
            : "unknown",
        long_term_patterns: detectPatterns(weeklySummaries),
        // Phase 2 — calendar events
        calendar_events: calendarEvents.map(e => {
            const eventDate = new Date(e.start_time).toISOString().slice(0, 10);
            const todayStr = new Date().toISOString().slice(0, 10);
            const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
            return {
                type: e.event_type_hint,
                title: e.title,
                start_time: e.start_time,
                is_today: eventDate === todayStr,
                is_tomorrow: eventDate === tomorrow,
            };
        }),
    };
}
/**
 * Format structured context into clearly delimited prompt sections.
 * Sections make the context easier for GPT-4o to parse consistently.
 */
function formatContextSections(ctx) {
    const lines = [];
    lines.push("[USER_PROFILE]");
    lines.push(`today: ${ctx.today}`);
    lines.push(`anchor_wake_time: ${ctx.arp_time ?? "not set"}`);
    lines.push(`chronotype: ${ctx.chronotype}`);
    lines.push(`cycle_target_per_night: ${ctx.cycle_target}`);
    lines.push(`onboarding_complete: ${ctx.onboarding_ok}`);
    lines.push("");
    if (ctx.gate_blocked) {
        lines.push("[SLEEP_PLAN]");
        lines.push(`status: blocked`);
        lines.push(`reason: ${ctx.gate_reason ?? "unknown"}`);
        lines.push("");
    }
    else {
        lines.push("[SLEEP_PLAN]");
        lines.push(`tonight_sleep_onset: ${ctx.sleep_onset ?? "unknown"}`);
        lines.push(`current_phase: ${ctx.current_phase ?? "unknown"}`);
        lines.push(`current_cycle: ${ctx.current_cycle ?? "unknown"}`);
        lines.push("");
        lines.push("[WEEKLY_RECOVERY]");
        lines.push(`cycles_this_week: ${ctx.weekly_cycles} (on_track: ${ctx.on_track})`);
        lines.push(`deficit: ${ctx.deficit} cycles`);
        lines.push("");
    }
    if (ctx.recent_logs.length > 0) {
        lines.push("[RECENT_SLEEP_HISTORY]");
        for (const log of ctx.recent_logs) {
            lines.push(log);
        }
        lines.push("");
    }
    lines.push("[CURRENT_STATE]");
    if (ctx.active_states.length > 0) {
        lines.push(`active_states: ${ctx.active_states.join(", ")}`);
    }
    else {
        lines.push("active_states: none");
    }
    if (ctx.primary_rec) {
        lines.push(`primary_recommendation: ${ctx.primary_rec}`);
    }
    lines.push("");
    // Phase 1 — Lifestyle context
    if (ctx.stress_level || ctx.sleep_environment || ctx.exercise_frequency || ctx.alcohol_use || ctx.work_start_time) {
        lines.push("[LIFESTYLE]");
        if (ctx.stress_level)
            lines.push(`baseline_stress: ${ctx.stress_level}`);
        if (ctx.sleep_environment)
            lines.push(`sleep_environment: ${ctx.sleep_environment}`);
        if (ctx.exercise_frequency)
            lines.push(`exercise_frequency: ${ctx.exercise_frequency}`);
        if (ctx.alcohol_use)
            lines.push(`alcohol_use: ${ctx.alcohol_use}`);
        if (ctx.work_start_time)
            lines.push(`work_start_time: ${ctx.work_start_time}`);
        lines.push("");
    }
    // Phase 1 — Life events
    if (ctx.life_events.length > 0) {
        lines.push("[LIFE_EVENTS]");
        const today = new Date().toISOString().slice(0, 10);
        for (const ev of ctx.life_events) {
            const rel = ev.date >= today ? `upcoming (${ev.date})` : `recent (${ev.date})`;
            lines.push(`${ev.type}: "${ev.title}" — ${rel}${ev.notes ? ` — ${ev.notes}` : ""}`);
        }
        lines.push("");
    }
    // Phase 3 — Long-term patterns
    if (ctx.four_week_avg !== null || ctx.long_term_patterns.length > 0) {
        lines.push("[LONG_TERM_PATTERNS]");
        if (ctx.four_week_avg !== null)
            lines.push(`4-week avg: ${ctx.four_week_avg} cycles/night`);
        lines.push(`on_track_rate: ${ctx.on_track_rate}`);
        if (ctx.long_term_patterns.length > 0) {
            lines.push("patterns:");
            for (const p of ctx.long_term_patterns) {
                lines.push(`- ${p}`);
            }
        }
        lines.push("");
    }
    // Phase 2 — Calendar events
    if (ctx.calendar_events.length > 0) {
        lines.push("[CALENDAR_EVENTS]");
        for (const ev of ctx.calendar_events) {
            const time = new Date(ev.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
            const when = ev.is_today ? `today ${time}` : ev.is_tomorrow ? `tomorrow ${time}` : new Date(ev.start_time).toISOString().slice(0, 10) + ` ${time}`;
            let flag = "";
            const hour = new Date(ev.start_time).getHours();
            if (ev.is_tomorrow && hour < 8)
                flag = " ⚠️ EARLY WAKE";
            if (ev.is_today && (ev.type === "important" || ev.type === "travel"))
                flag = " ⚠️ HIGH STAKES TODAY";
            lines.push(`${ev.type}: "${ev.title}" — ${when}${flag}`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
// ─── 1. System prompt ────────────────────────────────────────────────────────
function buildSystemPrompt(contextSections) {
    return `You are R-Lo, the intelligent sleep coach inside R90 Navigator — an app built on Nick Littlehales' R90 sleep methodology.

## Your ONLY purpose
You are a focused sleep and recovery coach. You ONLY discuss:
- Sleep (quality, duration, cycles, schedules, disruptions)
- Recovery and energy management
- The R90 methodology (anchor points, CRP, MRM, phases, readiness, chronotype)
- The user's personal sleep data and plan from this app
- Lifestyle factors that directly impact sleep (stress, exercise, alcohol, light, screen use, caffeine)
- Jet lag, travel, shift work — as they relate to sleep
- Mental recovery and wind-down routines

## Topics you REFUSE — always, without exception
You do NOT discuss: general knowledge, news, politics, sport, recipes, cooking, finance, relationships (unless sleep-related), travel (unless jet lag), coding, movies, TV, music, shopping, weather, history, science (unless sleep science), or any topic not listed above.

## How to refuse off-topic requests
When asked about anything outside your scope, respond EXACTLY with this format — no exceptions, no apologies, no elaboration:

"I'm R-Lo, your sleep coach — that's outside my area. Ask me anything about your sleep, recovery, or your R90 plan. 🌙"

Do not say "I can't help with that" or "As an AI...". Use only the exact refusal above.

## What you must NEVER do
- Invent or override sleep times, cycle targets, or ARP — these come from the engine
- Contradict the R90 methodology
- Make medical diagnoses or recommend medication
- Discuss anything unrelated to sleep and recovery

## Current user context (from the R90 engine — treat as ground truth)
${contextSections}

## Response style
- Concise: 2–4 sentences for simple questions, up to 8 for complex ones
- Direct: lead with the answer, explain after
- Warm but precise: like a coach, not a therapist
- Use the user's actual data when relevant (e.g. "your 4.2 average this week")
- Never start with "Great question!" or similar filler
- Reply in the same language the user writes in (French or English)`;
}
// ─── Off-topic pre-filter (saves API cost + faster refusal) ──────────────────
const OFF_TOPIC_PATTERNS = [
    // General knowledge / trivia
    /\b(capital of|who (is|was|invented|created|discovered)|what is the (population|distance|speed|formula)|how (tall|old|far|fast|much does|many people))\b/i,
    // News / politics
    /\b(election|president|minister|government|politics|war|conflict|economy|inflation|stock|bitcoin|crypto|news|current events)\b/i,
    // Entertainment
    /\b(movie|film|series|netflix|spotify|song|music|artist|album|tv show|episode|actor|actress|football|soccer|basketball|tennis|sport|game score|match)\b/i,
    // Food
    /\b(recipe|ingredient|cook|bake|dish|restaurant|meal|food|cuisine)\b/i,
    // Tech / coding
    /\b(code|programming|javascript|python|html|css|database|algorithm|bug|function|syntax|framework)\b/i,
    // General chat
    /\b(tell me a joke|write (me |a )?(poem|story|essay|email)|translate|summarize this article|what do you think about)\b/i,
];
export function isOffTopic(message) {
    // Allow if message clearly relates to sleep/recovery/R90
    const SLEEP_SIGNALS = /\b(sleep|sommeil|nuit|cycle|fatigue|tired|tired|réveil|coucher|recovery|recover|energie|energy|r90|crp|mrm|arp|chronotype|jet lag|nap|sieste|melatonin|mélatonin|insomnia|insomnie|wake|bedtime|stress|rest|recovery)\b/i;
    if (SLEEP_SIGNALS.test(message))
        return false;
    return OFF_TOPIC_PATTERNS.some(p => p.test(message));
}
export const OFF_TOPIC_REPLY = "I'm R-Lo, your sleep coach — that's outside my area. Ask me anything about your sleep, recovery, or your R90 plan. 🌙";
// ─── 2. OpenAI call with retry + graceful fallback ────────────────────────────
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MAX_RETRIES = 2;
const FALLBACK_MESSAGE = "R-Lo is having trouble responding right now. Please try again in a moment.";
/**
 * Attempt a single non-streaming OpenAI request to get a complete response.
 * Returns the content string or throws on failure.
 */
async function callOpenAI(apiKey, messages, attempt) {
    const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages,
            stream: false,
            max_tokens: 512,
            temperature: 0.65,
        }),
        signal: AbortSignal.timeout(20_000), // 20s timeout per attempt
    });
    if (!response.ok) {
        throw new Error(`OpenAI HTTP ${response.status} (attempt ${attempt})`);
    }
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error(`Empty OpenAI response (attempt ${attempt})`);
    }
    return content;
}
/**
 * Try to get a response with exponential backoff retries.
 * On all failures, returns the safe fallback string.
 */
async function callOpenAIWithRetry(apiKey, messages) {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
            const content = await callOpenAI(apiKey, messages, attempt);
            return { content, failed: false };
        }
        catch (err) {
            lastError = err;
            console.warn(`[chat-service] OpenAI attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
            if (attempt <= MAX_RETRIES) {
                // Exponential backoff: 800ms → 1600ms
                const delay = 800 * Math.pow(2, attempt - 1);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    console.error("[chat-service] All OpenAI attempts failed:", lastError instanceof Error ? lastError.message : lastError);
    return { content: FALLBACK_MESSAGE, failed: true };
}
/**
 * Call OpenAI with tool-calling support. Executes up to 3 iterations of the loop.
 * Sends "thinking" status events via SSE for progress indication.
 * Falls back to static context on failure.
 */
async function callOpenAIWithTools(apiKey, messages, userId, client, res) {
    const MAX_ITERATIONS = 3;
    try {
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const response = await fetch(OPENAI_CHAT_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages,
                    tools: SLEEP_COACH_TOOLS,
                    tool_choice: "auto",
                    stream: false,
                    max_tokens: 512,
                    temperature: 0.65,
                }),
                signal: AbortSignal.timeout(20_000),
            });
            if (!response.ok) {
                throw new Error(`OpenAI HTTP ${response.status}`);
            }
            const json = await response.json();
            const choice = json.choices?.[0];
            const message = choice?.message;
            if (!message) {
                throw new Error("Empty OpenAI response");
            }
            // If the model wants to call tools
            if (message.tool_calls && message.tool_calls.length > 0) {
                // Add the assistant message with tool_calls to the conversation
                messages.push({
                    role: "assistant",
                    content: message.content,
                    ...{ tool_calls: message.tool_calls },
                });
                // Send thinking status (not SSE headers yet — just queue them)
                if (!res.headersSent) {
                    res.writeHead(200, {
                        "Content-Type": "text/event-stream",
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "Access-Control-Allow-Origin": "*",
                    });
                }
                // Execute each tool call
                for (const tc of message.tool_calls) {
                    // Send thinking indicator
                    res.write(`data: ${JSON.stringify({ status: "thinking", tool: tc.function.name })}\n\n`);
                    let parsedArgs = {};
                    try {
                        parsedArgs = JSON.parse(tc.function.arguments);
                    }
                    catch {
                        // Empty args
                    }
                    const result = await executeTool(tc.function.name, parsedArgs, userId, client);
                    // Add tool result to conversation
                    messages.push({
                        role: "tool",
                        content: result,
                        tool_call_id: tc.id,
                        name: tc.function.name,
                    });
                }
                // Continue loop — next iteration will send tool results back to OpenAI
                continue;
            }
            // No tool calls — we have the final response
            const content = message.content;
            if (!content) {
                throw new Error("Empty content in final response");
            }
            return { content, failed: false };
        }
        // Max iterations reached
        throw new Error("Tool-calling loop exceeded max iterations");
    }
    catch (err) {
        console.warn("[chat-service] Tool-calling failed:", err instanceof Error ? err.message : err);
        return { content: "", failed: true };
    }
}
// ─── Main streaming entry point ───────────────────────────────────────────────
/**
 * Stream a response to the HTTP response object via SSE.
 *
 * Strategy:
 *   1. Validate input
 *   2. Load persisted history from DB (supplement client-side history)
 *   3. Build structured context from engine
 *   4. Call OpenAI with tools (dynamic data via tool calls)
 *   5. Fallback: static context if tool calling fails
 *   6. Persist the exchange to DB
 *   7. Fake-stream the response
 */
export async function streamChatResponse(client, userId, input, res) {
    // ── 5. Validate input ──────────────────────────────────────────────────
    const validation = validateInput(input.message);
    if (!validation.ok) {
        if (validation.reason === "message_too_long") {
            sendSseError(res, "Your message is too long. Please keep it under 1000 characters.");
        }
        else if (validation.reason === "injection_attempt") {
            sendSseError(res, "I can only help with sleep and recovery topics.");
        }
        else {
            sendSseError(res, "Please send a valid message.");
        }
        return;
    }
    const cleanMessage = validation.message;
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
        sendSseError(res, FALLBACK_MESSAGE);
        return;
    }
    // ── 3. Load persisted history ──────────────────────────────────────────
    let persistedHistory = [];
    try {
        persistedHistory = await loadRecentMessages(client, userId, MAX_HISTORY_TURNS * 2);
    }
    catch {
        // Non-fatal: fall back to client history
    }
    // Prefer persisted history if available; fall back to client-sent history
    const historyMessages = persistedHistory.length > 0
        ? persistedHistory.map(m => ({ role: m.role, content: m.content }))
        : (input.history ?? []).slice(-MAX_HISTORY_TURNS);
    // ── Report rerouting: check if user is asking for their weekly report ──
    const reportKeywords = /\b(bilan|rapport|weekly report|semaine|cette semaine|my week|week report)\b/i;
    if (reportKeywords.test(cleanMessage)) {
        try {
            const report = await fetchLatestWeeklyReport(client, userId);
            if (report) {
                const reportAge = Date.now() - new Date(report.generated_at).getTime();
                if (reportAge < 7 * 86_400_000) {
                    // Stream the report directly without calling OpenAI
                    const fullReply = `Here's your weekly report:\n\n${report.content}`;
                    const sessionId = input.session_id ?? dailySessionId();
                    saveExchange(client, userId, sessionId, cleanMessage, fullReply).catch(() => { });
                    await fakeStreamResponse(res, fullReply);
                    return;
                }
            }
        }
        catch {
            // Fall through to normal chat flow
        }
    }
    // ── 4. Build minimal context for tool-calling mode ────────────────────
    let minimalContext = "";
    try {
        const ctx = await buildStructuredContext(client, userId);
        // Only [USER_PROFILE] + [CURRENT_STATE] for the tool-calling system prompt
        const lines = [];
        lines.push("[USER_PROFILE]");
        lines.push(`today: ${ctx.today}`);
        lines.push(`anchor_wake_time: ${ctx.arp_time ?? "not set"}`);
        lines.push(`chronotype: ${ctx.chronotype}`);
        lines.push(`cycle_target_per_night: ${ctx.cycle_target}`);
        lines.push("");
        lines.push("[CURRENT_STATE]");
        if (ctx.active_states.length > 0) {
            lines.push(`active_states: ${ctx.active_states.join(", ")}`);
        }
        else {
            lines.push("active_states: none");
        }
        if (ctx.primary_rec)
            lines.push(`primary_recommendation: ${ctx.primary_rec}`);
        lines.push("");
        minimalContext = lines.join("\n");
    }
    catch (err) {
        console.warn("[chat-service] context build failed:", err instanceof Error ? err.message : err);
        minimalContext = "[CURRENT_STATE]\nContext unavailable — respond based on general R90 principles.";
    }
    const toolSystemPrompt = buildSystemPrompt(minimalContext);
    // Build messages for tool-calling flow
    const toolMessages = [
        { role: "system", content: toolSystemPrompt },
        ...historyMessages.slice(-MAX_HISTORY_TURNS).map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: cleanMessage },
    ];
    // ── Try tool-calling flow first ──────────────────────────────────────
    let assistantReply;
    let failed;
    const toolResult = await callOpenAIWithTools(apiKey, toolMessages, userId, client, res);
    if (!toolResult.failed && toolResult.content) {
        assistantReply = toolResult.content;
        failed = false;
    }
    else {
        // ── Fallback: full static context (original behavior) ────────────
        let contextSections = "[CURRENT_STATE]\nContext unavailable — respond based on general R90 principles.";
        try {
            const ctx = await buildStructuredContext(client, userId);
            contextSections = formatContextSections(ctx);
        }
        catch {
            // Use default fallback
        }
        const fallbackMessages = [
            { role: "system", content: buildSystemPrompt(contextSections) },
            ...historyMessages.slice(-MAX_HISTORY_TURNS).map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: cleanMessage },
        ];
        const fallbackResult = await callOpenAIWithRetry(apiKey, fallbackMessages);
        assistantReply = fallbackResult.content;
        failed = fallbackResult.failed;
    }
    // ── Persist exchange (best-effort, non-blocking) ──────────────────
    const sessionId = input.session_id ?? dailySessionId();
    if (!failed) {
        saveExchange(client, userId, sessionId, cleanMessage, assistantReply).catch(err => {
            console.warn("[chat-service] persist failed:", err instanceof Error ? err.message : err);
        });
    }
    // ── Stream the response as SSE ───────────────────────────────────────
    if (res.headersSent) {
        // Headers already sent by tool-calling flow — just stream the final response
        const words = assistantReply.split(/(\s+)/);
        for (const chunk of words) {
            if (chunk) {
                res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
                await new Promise(r => setTimeout(r, 18));
            }
        }
        res.write("data: [DONE]\n\n");
        res.end();
    }
    else {
        await fakeStreamResponse(res, assistantReply);
    }
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Fake-stream a response over SSE (word-by-word with 18ms delay).
 */
async function fakeStreamResponse(res, text) {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    });
    const words = text.split(/(\s+)/);
    for (const chunk of words) {
        if (chunk) {
            res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
            await new Promise(r => setTimeout(r, 18));
        }
    }
    res.write("data: [DONE]\n\n");
    res.end();
}
function sendSseError(res, message) {
    if (!res.headersSent) {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Access-Control-Allow-Origin": "*",
        });
    }
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
}
// ─── History loader for chat init ─────────────────────────────────────────────
/**
 * Load recent conversation history for the chat screen on app startup.
 * Called by the chat init API to pre-populate conversation.
 */
export async function loadChatHistory(client, userId, limit = 20) {
    try {
        const rows = await loadRecentMessages(client, userId, limit);
        return rows.map(r => ({ role: r.role, content: r.content }));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=chat-service.js.map