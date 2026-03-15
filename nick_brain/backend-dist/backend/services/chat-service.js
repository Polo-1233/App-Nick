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
    const ctx = await assembleEngineContext(client, userId);
    const output = runEngineSafe(ctx);
    const home = buildHomeScreenPayload(output, ctx);
    const wb = home.weekly_balance;
    const recentLogs = ctx.sleep_logs.slice(0, 3).map(l => `${l.date}: ${l.cycles_completed ?? "?"} cycles`);
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
    return lines.join("\n");
}
// ─── 1. System prompt (R-Lo, not Airloop) ────────────────────────────────────
function buildSystemPrompt(contextSections) {
    return `You are R-Lo, the intelligent sleep coach inside R90 Navigator — a sleep performance app built on Nick Littlehales' R90 methodology.

## Your role
You help users understand and apply the R90 system to improve their sleep and performance. You speak like a knowledgeable, calm, and supportive performance coach — never clinical, never generic.

## What you can do
- Explain R90 concepts (anchor points, cycles, CRP, MRM, phases, readiness)
- Help users interpret their current sleep data and readiness state
- Offer practical advice grounded in the user's actual plan and state
- Motivate and guide without being preachy

## What you must NEVER do
- Invent or override sleep times, cycle targets, or ARP — these come from the engine
- Contradict the R90 methodology
- Make medical claims or diagnoses
- Discuss topics unrelated to sleep, recovery, and performance

## Current user context (from the R90 engine — treat as ground truth)
${contextSections}

## Response style
- Concise: 2–4 sentences for simple questions, up to 8 for complex ones
- Direct: lead with the answer, explain after
- Warm but precise: like a coach, not a therapist
- Use the user's actual data when relevant (e.g. "your 4.2 average this week")
- Never start with "Great question!" or similar filler`;
}
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
// ─── Main streaming entry point ───────────────────────────────────────────────
/**
 * Stream a response to the HTTP response object via SSE.
 *
 * Strategy:
 *   1. Validate input
 *   2. Load persisted history from DB (supplement client-side history)
 *   3. Build structured context from engine
 *   4. Call OpenAI with retry (non-streaming for reliability; fake-stream the result)
 *   5. Persist the exchange to DB
 *   6. Send SSE chunks + [DONE]
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
    // ── 4. Build structured context from engine ────────────────────────────
    let contextSections = "[CURRENT_STATE]\nContext unavailable — respond based on general R90 principles.";
    try {
        const ctx = await buildStructuredContext(client, userId);
        contextSections = formatContextSections(ctx);
    }
    catch (err) {
        console.warn("[chat-service] context build failed:", err instanceof Error ? err.message : err);
    }
    const systemPrompt = buildSystemPrompt(contextSections);
    // Build messages array: system + history + new user message
    const messages = [
        { role: "system", content: systemPrompt },
        ...historyMessages.slice(-MAX_HISTORY_TURNS).map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: cleanMessage },
    ];
    // ── 2. Call OpenAI with retry ──────────────────────────────────────────
    const { content: assistantReply, failed } = await callOpenAIWithRetry(apiKey, messages);
    // ── 3b. Persist exchange (best-effort, non-blocking) ──────────────────
    const sessionId = input.session_id ?? dailySessionId();
    if (!failed) {
        saveExchange(client, userId, sessionId, cleanMessage, assistantReply).catch(err => {
            console.warn("[chat-service] persist failed:", err instanceof Error ? err.message : err);
        });
    }
    // ── Stream the response as SSE (fake-stream character-by-character) ────
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    });
    // Send in word-sized chunks to simulate streaming feel
    const words = assistantReply.split(/(\s+)/);
    for (const chunk of words) {
        if (chunk) {
            res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
            // Small delay between chunks for a natural feel
            await new Promise(r => setTimeout(r, 18));
        }
    }
    res.write("data: [DONE]\n\n");
    res.end();
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
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