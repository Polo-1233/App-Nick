/**
 * Notification handlers
 *
 * GET  /notifications/proactive        — check and return proactive triggers
 * POST /notifications/dismiss          — dismiss a trigger for 24h
 * GET  /notifications/morning-briefing — personalized morning message
 * GET  /notifications/evening-prep     — personalized evening wind-down message
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthContext } from "../middleware/auth.js";
import { readBody, sendJson, sendError } from "../server.js";
import { checkProactiveTriggers } from "../services/trigger-engine.js";
import { buildStructuredContext, formatContextSections } from "../services/chat-service.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const res = await fetch(OPENAI_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model:       "gpt-4o",
      max_tokens:  100,
      temperature: 0.60,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

export async function proactiveNotificationHandler(
  _req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext,
): Promise<void> {
  const triggers = await checkProactiveTriggers(auth.client, auth.userId);

  if (triggers.length === 0) {
    sendJson(res, 200, { trigger: null });
    return;
  }

  // Filter out triggers already sent (check notification_log)
  for (const trigger of triggers) {
    const { data: existing } = await auth.client
      .from("notification_log")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("trigger_type", trigger.type)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (existing && existing.length > 0) continue;

    // This trigger hasn't been sent yet — log it and return
    await auth.client.from("notification_log").insert({
      user_id:      auth.userId,
      trigger_type: trigger.type,
      expires_at:   trigger.expires_at,
    });

    sendJson(res, 200, { trigger });
    return;
  }

  // All triggers already sent
  sendJson(res, 200, { trigger: null });
}

// ─── Morning briefing ─────────────────────────────────────────────────────────

export async function morningBriefingHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  auth: AuthContext,
): Promise<void> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    sendJson(res, 200, { message: "Good morning. Check your sleep plan for today." });
    return;
  }

  try {
    const ctx     = await buildStructuredContext(auth.client, auth.userId);
    const context = formatContextSections(ctx);
    const message = await callOpenAI(
      apiKey,
      `You are R-Lo, a sleep coach. Write a SHORT morning push notification (1-2 sentences, under 100 chars total). Mention: last night's cycles, readiness zone if available, tonight's target bedtime. Be direct and warm. No emoji. No "Good morning" opener. Example: "4 cycles last night — solid. Tonight's target: 23:00."`,
      `User context:\n${context}\n\nWrite the morning briefing notification now.`,
    );
    sendJson(res, 200, { message: message ?? "Check your sleep plan for today." });
  } catch {
    sendJson(res, 200, { message: "Check your sleep plan for today." });
  }
}

// ─── Evening prep ─────────────────────────────────────────────────────────────

export async function eveningPrepHandler(
  _req: IncomingMessage,
  res:  ServerResponse,
  auth: AuthContext,
): Promise<void> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    sendJson(res, 200, { message: "Wind-down time. Prepare for tonight." });
    return;
  }

  try {
    const ctx     = await buildStructuredContext(auth.client, auth.userId);
    const context = formatContextSections(ctx);
    const message = await callOpenAI(
      apiKey,
      `You are R-Lo, a sleep coach. Write a SHORT evening push notification (1-2 sentences, under 100 chars total). Include wind-down start time and ideal bedtime. Add one brief tip if relevant (screens, room temp). Be calm and directive. No emoji. Example: "Wind-down at 21:30. Bedtime 23:00. Dim your lights now."`,
      `User context:\n${context}\n\nWrite the evening prep notification now.`,
    );
    sendJson(res, 200, { message: message ?? "Time to wind down. Check your bedtime in the app." });
  } catch {
    sendJson(res, 200, { message: "Time to wind down. Check your bedtime in the app." });
  }
}

export async function dismissNotificationHandler(
  req: IncomingMessage,
  res: ServerResponse,
  auth: AuthContext,
): Promise<void> {
  const body = await readBody<{ trigger_type: string }>(req);
  if (!body?.trigger_type) {
    sendError(res, 400, "trigger_type is required", "INVALID_BODY");
    return;
  }

  // Insert a notification_log entry that expires in 24h
  await auth.client.from("notification_log").insert({
    user_id:      auth.userId,
    trigger_type: body.trigger_type,
    expires_at:   new Date(Date.now() + 24 * 3_600_000).toISOString(),
  });

  sendJson(res, 200, { ok: true });
}
