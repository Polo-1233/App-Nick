/**
 * memory-service.ts
 *
 * Lightweight R-Lo memory system.
 *
 * After each assistant reply, extract a small number of useful coaching facts
 * and store them in user_memory (upsert by key).
 *
 * Injected into the prompt as [MEMORY] section.
 *
 * Threshold: max 6 items per user (keeps prompt light).
 * Staleness: facts older than 30 days are ignored at injection time.
 */

import type { AppClient } from "../db/client.js";

const OPENAI_URL       = "https://api.openai.com/v1/chat/completions";
const MAX_MEMORY_ITEMS = 6;
const STALE_DAYS       = 30;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryItem {
  key:        string;
  value:      string;
  updated_at: string;
}

interface ExtractedFact {
  key:   string;
  value: string;
}

// ─── Fetch memory for a user ──────────────────────────────────────────────────

export async function fetchUserMemory(
  client:  AppClient,
  userId:  string,
): Promise<MemoryItem[]> {
  const since = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();

  const { data } = await client
    .from("user_memory")
    .select("key, value, updated_at")
    .eq("user_id", userId)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(MAX_MEMORY_ITEMS);

  return (data ?? []) as MemoryItem[];
}

// ─── Format memory for prompt injection ──────────────────────────────────────

export function formatMemorySection(items: MemoryItem[]): string {
  if (items.length === 0) return "";
  const lines = ["[MEMORY]"];
  for (const item of items) {
    lines.push(`${item.key}: ${item.value}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ─── Extract facts from conversation ─────────────────────────────────────────

export async function extractAndSaveMemory(
  client:      AppClient,
  userId:      string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return;

  try {
    const res = await fetch(OPENAI_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model:       "gpt-4o-mini",       // cheap model for extraction
        max_tokens:  200,
        temperature: 0,
        messages: [
          {
            role:    "system",
            content: `You are a memory extractor for a sleep coaching app.
Given a user message and coach reply, extract 0-3 durable, useful coaching facts about the user.
Only extract facts that would genuinely help a coach remember this person over time.

Output ONLY a JSON array. Each item must have:
  { "key": "snake_case_key", "value": "short fact string" }

Rules:
- Only extract stable, long-term facts (work schedule, sleep issues, preferences, upcoming events)
- Do NOT extract: current day data, one-off mood, things already tracked by the app (cycles, ARP)
- Do NOT extract medical claims or sensitive info
- If nothing useful to extract, return []
- Max 3 items

Good examples:
  { "key": "work_schedule", "value": "works night shifts on Thursdays" }
  { "key": "sleep_issue", "value": "struggles to fall asleep, mind racing" }
  { "key": "travel_upcoming", "value": "travelling to London next week" }
  { "key": "nap_preference", "value": "prefers 20-min naps over longer ones" }

Bad examples (do NOT extract):
  { "key": "last_night_cycles", "value": "slept 4 cycles" }
  { "key": "feeling_tired", "value": "tired today" }`,
          },
          {
            role:    "user",
            content: `User: ${userMessage}\nCoach: ${assistantReply}`,
          },
        ],
      }),
    });

    if (!res.ok) return;

    const data    = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "[]";

    let facts: ExtractedFact[] = [];
    try {
      facts = JSON.parse(content) as ExtractedFact[];
      if (!Array.isArray(facts)) facts = [];
    } catch {
      return;
    }

    // Upsert each fact (max 3, validated)
    for (const fact of facts.slice(0, 3)) {
      if (typeof fact.key !== "string" || typeof fact.value !== "string") continue;
      if (!fact.key.match(/^[a-z_]{2,50}$/) || fact.value.length > 200) continue;

      await client.from("user_memory").upsert(
        {
          user_id:    userId,
          key:        fact.key,
          value:      fact.value,
          source:     "chat",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" },
      );
    }
  } catch {
    // Non-critical — never block the main flow
  }
}
