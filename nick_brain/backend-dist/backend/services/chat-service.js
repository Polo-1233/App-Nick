/**
 * chat-service.ts — LLM coaching layer for R90 Navigator
 *
 * Architecture principle:
 *   - The deterministic engine decides everything (states, recs, plan).
 *   - The LLM only reformulates engine outputs into natural coaching language.
 *   - The LLM cannot override R90 logic, change times, or invent methodology.
 *
 * Streaming:
 *   - Uses OpenAI GPT-4o with streaming enabled.
 *   - Yields SSE chunks to the HTTP response as they arrive.
 *   - The app accumulates chunks and renders progressively.
 */
import { assembleEngineContext } from "../context/assembler.js";
import { runEngineSafe } from "../../engine/engine-runner.js";
import { buildHomeScreenPayload } from "../payloads/home-screen.js";
// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(contextSummary) {
    return `You are Airloop, the intelligent coaching layer of R90 Navigator — a sleep performance app built on Nick Littlehales' R90 methodology.

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
${contextSummary}

## Response style
- Concise: 2–4 sentences for simple questions, up to 8 for complex ones
- Direct: lead with the answer, explain after
- Warm but precise: like a coach, not a therapist
- Use the user's actual data when relevant (e.g. "your 4.2 average this week")
- Never start with "Great question!" or similar filler`;
}
// ─── Context assembler ────────────────────────────────────────────────────────
async function buildContextSummary(client, userId) {
    try {
        const ctx = await assembleEngineContext(client, userId);
        const output = runEngineSafe(ctx);
        const home = buildHomeScreenPayload(output, ctx);
        const lines = [
            `Today: ${ctx.today}`,
            `ARP (anchor wake time): ${ctx.profile.arp_time ?? "not set"}`,
            `Chronotype: ${ctx.profile.chronotype}`,
            `Cycle target per night: ${ctx.profile.chronotype === "AMer" ? 5 : 5}`,
            `Onboarding complete: ${ctx.profile.onboarding_completed}`,
        ];
        if (home.weekly_balance) {
            const wb = home.weekly_balance;
            lines.push(`Weekly cycles: ${wb.total}/${wb.target} (day ${wb.day_number}/7)`);
            lines.push(`On track: ${wb.on_track ? "yes" : "no"}, deficit: ${wb.deficit}`);
        }
        if (home.gate_blocked) {
            lines.push(`Engine gate: BLOCKED (reason: ${home.gate_reason ?? "unknown"})`);
        }
        else {
            lines.push(`Tonight sleep onset (5 cycles): ${home.tonight_sleep_onset ?? "unknown"}`);
            lines.push(`Current phase: ${home.current_phase ?? "?"}, cycle: ${home.current_cycle ?? "?"}`);
        }
        if (output.active_states.length > 0) {
            const stateList = output.active_states
                .map(s => `${s.state_id} (${s.priority_label}, ${s.active_days}d active)`)
                .join(", ");
            lines.push(`Active user states: ${stateList}`);
        }
        else {
            lines.push("Active user states: none detected");
        }
        if (home.primary_recommendation) {
            lines.push(`Primary recommendation: ${home.primary_recommendation.message_key}`);
        }
        const recent = ctx.sleep_logs.slice(0, 3);
        if (recent.length > 0) {
            const cyclesStr = recent
                .map(l => `${l.date}: ${l.cycles_completed ?? "?"} cycles`)
                .join(", ");
            lines.push(`Recent sleep logs: ${cyclesStr}`);
        }
        return lines.join("\n");
    }
    catch {
        return "User context unavailable — respond based on general R90 principles.";
    }
}
// ─── OpenAI streaming call ────────────────────────────────────────────────────
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
/**
 * Stream a GPT-4o response via SSE to the HTTP response object.
 *
 * SSE format:
 *   data: {"delta":"chunk"}\n\n
 *   data: [DONE]\n\n
 */
export async function streamChatResponse(client, userId, input, res) {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
        sendSseError(res, "OpenAI API key not configured");
        return;
    }
    const contextSummary = await buildContextSummary(client, userId);
    // Build message array: system + history + new user message
    const history = (input.history ?? []).slice(-10); // keep last 10 turns
    const messages = [
        { role: "system", content: buildSystemPrompt(contextSummary) },
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: input.message },
    ];
    // Set SSE headers
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    });
    try {
        const openaiRes = await fetch(OPENAI_CHAT_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages,
                stream: true,
                max_tokens: 512,
                temperature: 0.65,
            }),
        });
        if (!openaiRes.ok || !openaiRes.body) {
            sendSseError(res, `OpenAI error ${openaiRes.status}`);
            return;
        }
        // Stream chunks from OpenAI → client
        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:"))
                    continue;
                const data = trimmed.slice(5).trim();
                if (data === "[DONE]") {
                    res.write("data: [DONE]\n\n");
                    res.end();
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
                    }
                }
                catch {
                    // Malformed chunk — skip
                }
            }
        }
        res.write("data: [DONE]\n\n");
        res.end();
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Streaming failed";
        sendSseError(res, msg);
    }
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
//# sourceMappingURL=chat-service.js.map