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

import type { ServerResponse } from "node:http";
import type { AppClient } from "../db/client.js";
import { assembleEngineContext } from "../context/assembler.js";
import { runEngineSafe } from "../../engine/engine-runner.js";
import { buildHomeScreenPayload } from "../payloads/home-screen.js";
import {
  loadRecentMessages,
  saveExchange,
  dailySessionId,
  type ChatMessageRow,
} from "../db/chat-messages.js";
import {
  fetchRecentLifeEvents,
  fetchUpcomingCalendarEvents,
  fetchWeeklySummaries,
  fetchLatestWeeklyReport,
  fetchUserProfile,
} from "../db/queries.js";
import { detectPatterns } from "./pattern-detector.js";
import { fetchUserMemory, formatMemorySection, extractAndSaveMemory } from "./memory-service.js";
import { SLEEP_COACH_TOOLS } from "./tool-definitions.js";
import { executeTool } from "./tool-executor.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

export interface ChatInput {
  message:    string;
  history?:   ChatMessage[];  // client-side history (overridden by persisted if available)
  session_id?: string;        // optional explicit session ID from client
}

// ─── 5. Input moderation / validation ────────────────────────────────────────

const MAX_INPUT_LENGTH   = 1000;
const MAX_HISTORY_TURNS  = 6;  // Fewer turns = less old-style bleed-through
const MAX_MSG_CHARS      = 300; // Truncate long historical messages

/**
 * Validate and sanitize a user message before sending to the LLM.
 * Returns { ok: true, message } or { ok: false, reason }.
 */
function validateInput(raw: string): { ok: true; message: string } | { ok: false; reason: string } {
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

// ─── 4. Structured context injection ─────────────────────────────────────────

interface StructuredContext {
  today:          string;
  arp_time:       string | null;
  chronotype:     string;
  cycle_target:   number;
  memory_section:  string;   // pre-formatted [MEMORY] block, empty string if none
  user_anxiety:    boolean;  // user_reported_anxiety from profile
  onboarding_ok:  boolean;
  weekly_cycles:  string;
  on_track:       boolean;
  deficit:        number;
  sleep_onset:    string | null;
  current_phase:  number | string | null;
  current_cycle:  number | string | null;
  active_states:  string[];
  primary_rec:    string | null;
  recent_logs:    string[];
  gate_blocked:   boolean;
  gate_reason:    string | null;
  // Phase 1 — lifestyle
  stress_level:        string | null;
  sleep_environment:   string | null;
  exercise_frequency:  string | null;
  alcohol_use:         string | null;
  work_start_time:     string | null;
  // Phase 1 — life events
  life_events:         Array<{ type: string; title: string; date: string; notes: string | null }>;
  // Phase 2 — calendar events
  calendar_events:     Array<{ type: string; title: string; start_time: string; is_today: boolean; is_tomorrow: boolean }>;
  // Phase 3 — long-term patterns
  four_week_avg:       number | null;
  on_track_rate:       string;
  long_term_patterns:  string[];
  // Phase C — wearable data
  wearable:            WearableSnapshot | null;
}

interface WearableSnapshot {
  source:             string;
  collected_at:       string;
  sleep_duration_min: number | null;
  sleep_efficiency:   number | null;
  hrv_ms:             number | null;
  resting_hr:         number | null;
  readiness_score:    number | null;
  strain_score:       number | null;
  rem_min:            number | null;
  deep_min:           number | null;
}

export async function buildStructuredContext(
  client: AppClient,
  userId: string,
): Promise<StructuredContext> {
  const [ctx, profileRow, lifeEvents, calendarEvents, weeklySummaries, wearableData, memoryItems] = await Promise.all([
    assembleEngineContext(client, userId),
    fetchUserProfile(client, userId),
    fetchRecentLifeEvents(client, userId),
    fetchUpcomingCalendarEvents(client, userId, 48),
    fetchWeeklySummaries(client, userId, 4),
    client.from('wearable_data')
      .select('source, collected_at, sleep_duration_min, sleep_efficiency, hrv_ms, resting_hr, readiness_score, strain_score, rem_min, deep_min')
      .eq('user_id', userId)
      .order('collected_at', { ascending: false })
      .limit(3)
      .then(r => r.data ?? []),
    fetchUserMemory(client, userId),
  ]);
  const cycleTarget = profileRow?.cycle_target ?? 5;
  const output = runEngineSafe(ctx);
  const home   = buildHomeScreenPayload(output, ctx, cycleTarget);

  const wb = home.weekly_balance;
  const recentLogs = ctx.sleep_logs.slice(0, 3).map(l =>
    `${l.date}: ${l.cycles_completed ?? "?"} cycles`
  );

  const profile = ctx.profile as typeof ctx.profile & {
    stress_level?: string | null;
    sleep_environment?: string | null;
    exercise_frequency?: string | null;
    alcohol_use?: string | null;
    work_start_time?: string | null;
  };

  return {
    today:          ctx.today,
    arp_time:       ctx.profile.arp_time ?? null,
    chronotype:     ctx.profile.chronotype,
    cycle_target:   cycleTarget,
    memory_section:  formatMemorySection(memoryItems),
    user_anxiety:    ctx.profile.user_reported_anxiety,
    onboarding_ok:   ctx.profile.onboarding_completed,
    weekly_cycles: wb ? `${wb.total}/${wb.target}` : "unknown",
    on_track:      wb?.on_track ?? false,
    deficit:       wb?.deficit ?? 0,
    sleep_onset:   home.tonight_sleep_onset ?? null,
    current_phase: home.current_phase ?? null,
    current_cycle: home.current_cycle ?? null,
    active_states: output.active_states.map(s =>
      `${s.state_id} (${s.priority_label}, ${s.active_days}d)`
    ),
    primary_rec:   home.primary_recommendation?.message_key ?? null,
    recent_logs:   recentLogs,
    gate_blocked:  output.gate_blocked,
    gate_reason:   output.gate_reason ?? null,
    // Phase 1 — lifestyle
    stress_level:       profile.stress_level ?? null,
    sleep_environment:  profile.sleep_environment ?? null,
    exercise_frequency: profile.exercise_frequency ?? null,
    alcohol_use:        profile.alcohol_use ?? null,
    work_start_time:    profile.work_start_time ?? null,
    // Phase 1 — life events
    life_events: lifeEvents.map(e => ({
      type:  e.event_type,
      title: e.title,
      date:  e.event_date,
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
    // Phase C — wearable data (most recent across all sources)
    wearable: (() => {
      if (!wearableData.length) return null;
      // Prefer Oura readiness > Apple Health > others
      const priority = ['oura', 'whoop', 'apple_health'];
      const sorted = [...wearableData].sort((a, b) => {
        const pa = priority.indexOf((a as any).source);
        const pb = priority.indexOf((b as any).source);
        if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
        return new Date((b as any).collected_at).getTime() - new Date((a as any).collected_at).getTime();
      });
      return sorted[0] as WearableSnapshot;
    })(),
    // Phase 2 — calendar events
    calendar_events: calendarEvents.map(e => {
      const eventDate = new Date(e.start_time).toISOString().slice(0, 10);
      const todayStr  = new Date().toISOString().slice(0, 10);
      const tomorrow  = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      return {
        type:       e.event_type_hint,
        title:      e.title,
        start_time: e.start_time,
        is_today:   eventDate === todayStr,
        is_tomorrow: eventDate === tomorrow,
      };
    }),
  };
}

/**
 * Format structured context into clearly delimited prompt sections.
 * Sections make the context easier for GPT-4o to parse consistently.
 */
export function formatContextSections(ctx: StructuredContext): string {
  const lines: string[] = [];

  // Memory first — helps R-Lo reference it naturally throughout
  if (ctx.memory_section) {
    lines.push(ctx.memory_section);
  }

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
  } else {
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
  } else {
    lines.push("active_states: none");
  }
  if (ctx.primary_rec) {
    lines.push(`primary_recommendation: ${ctx.primary_rec}`);
  }
  // State-specific coaching rules
  if (ctx.user_anxiety) {
    lines.push("COACHING_MODE: anxiety_sensitive");
    lines.push("RULES: suppress deficit framing; suppress cycle count emphasis; avoid pressure language; be calm and supportive; focus on what IS working; never say 'you need to' or 'you should'");
  }
  lines.push("");

  // Phase 1 — Lifestyle context
  if (ctx.stress_level || ctx.sleep_environment || ctx.exercise_frequency || ctx.alcohol_use || ctx.work_start_time) {
    lines.push("[LIFESTYLE]");
    if (ctx.stress_level)       lines.push(`baseline_stress: ${ctx.stress_level}`);
    if (ctx.sleep_environment)  lines.push(`sleep_environment: ${ctx.sleep_environment}`);
    if (ctx.exercise_frequency) lines.push(`exercise_frequency: ${ctx.exercise_frequency}`);
    if (ctx.alcohol_use)        lines.push(`alcohol_use: ${ctx.alcohol_use}`);
    if (ctx.work_start_time)    lines.push(`work_start_time: ${ctx.work_start_time}`);
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
    if (ctx.four_week_avg !== null) lines.push(`4-week avg: ${ctx.four_week_avg} cycles/night`);
    lines.push(`on_track_rate: ${ctx.on_track_rate}`);
    if (ctx.long_term_patterns.length > 0) {
      lines.push("patterns:");
      for (const p of ctx.long_term_patterns) {
        lines.push(`- ${p}`);
      }
    }
    lines.push("");
  }

  // Phase C — Wearable data
  if (ctx.wearable) {
    const w = ctx.wearable;
    const ageHours = (Date.now() - new Date(w.collected_at).getTime()) / 3_600_000;
    const STALE_THRESHOLD_H = 36; // data older than 36h is considered stale
    const isStale = ageHours > STALE_THRESHOLD_H;

    if (isStale) {
      // Include with explicit stale warning — R-Lo must not act on it as if fresh
      const staleLabel = `${Math.floor(ageHours / 24)}d ago — STALE, do not reference as recent data`;
      lines.push("[WEARABLE_DATA]");
      lines.push(`source: ${w.source} (${staleLabel})`);
      lines.push("WARNING: This wearable data is outdated. Do not make coaching recommendations based on it. Ask the user to sync their device if relevant.");
    } else {
      const ageLabel = ageHours < 24 ? `${Math.round(ageHours)}h ago` : `${Math.floor(ageHours / 24)}d ago`;
      lines.push("[WEARABLE_DATA]");
      lines.push(`source: ${w.source} (${ageLabel})`);
      if (w.readiness_score !== null)    lines.push(`readiness_score: ${w.readiness_score}/100`);
      if (w.hrv_ms !== null)             lines.push(`hrv: ${Math.round(w.hrv_ms)}ms`);
      if (w.resting_hr !== null)         lines.push(`resting_hr: ${w.resting_hr}bpm`);
      if (w.sleep_duration_min !== null) lines.push(`sleep_duration: ${Math.floor(w.sleep_duration_min / 60)}h${w.sleep_duration_min % 60 > 0 ? `${w.sleep_duration_min % 60}m` : ''}`);
      if (w.sleep_efficiency !== null)   lines.push(`sleep_efficiency: ${Math.round(w.sleep_efficiency * 100)}%`);
      if (w.rem_min !== null)            lines.push(`rem: ${w.rem_min}min`);
      if (w.deep_min !== null)           lines.push(`deep: ${w.deep_min}min`);
      if (w.strain_score !== null)       lines.push(`strain: ${w.strain_score}`);
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
      if (ev.is_tomorrow && hour < 8) flag = " ⚠️ EARLY WAKE";
      if (ev.is_today && (ev.type === "important" || ev.type === "travel")) flag = " ⚠️ HIGH STAKES TODAY";
      lines.push(`${ev.type}: "${ev.title}" — ${when}${flag}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── 1. System prompt ────────────────────────────────────────────────────────

function buildSystemPrompt(contextSections: string): string {
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

## Message length — CRITICAL
Keep every message SHORT. 2-3 sentences maximum. If you need to explain more, break it into multiple short messages or wait for the user to ask.
Never write paragraphs. Never write lists. Think SMS, not email.

## What you must NEVER do
- Invent or override sleep times, cycle targets, or ARP — these come from the engine
- Contradict the R90 methodology
- Make medical diagnoses or recommend medication
- Discuss anything unrelated to sleep and recovery
- Use markdown formatting of any kind: no **bold**, no *italic*, no # headers, no bullet points with -, no numbered lists. Plain text only.
- Write long messages. Max 2-3 sentences per reply.

## Current user context (from the R90 engine — treat as ground truth)
${contextSections}

## How to use [WEARABLE_DATA] when present
- **readiness_score** (Oura): < 60 = low recovery day → recommend light activity, protect sleep window; 60–79 = moderate; ≥ 80 = well recovered
- **hrv**: low HRV vs user's baseline → nervous system stressed → suggest wind-down adjustments; high HRV → good readiness
- **resting_hr**: elevated resting HR (+5-10bpm above normal) → signs of fatigue or illness → reduce training advice
- **sleep_efficiency**: < 85% → fragmented sleep, suggest wind-down routine improvements
- **rem_min / deep_min**: low REM (<90min) → cognitive recovery lacking; low deep (<60min) → physical recovery lacking
- Cross-reference wearable data with R90 cycle count to give a complete picture
- Never invent wearable data if the section is absent

## R90 core calculations (use these to explain plans)
- **Bedtime** = Anchor wake time − (cycle_target × 90 minutes)
- **Pre-sleep window** = 90 minutes before bedtime (starts wind-down)
- **CRP windows**: 13:00–15:00 (30 or 90 min), 17:00–19:00 (30 min only)
- **Weekly target** = cycle_target × 7 (e.g. 4 cycles/night → 28/week, 5 → 35, 6 → 42)
- **Readiness zones**: Green ≥ weekly_target, Yellow ≥ weekly_target - 7, Orange < weekly_target - 7
- Example: anchor 06:30, target 5 cycles → bedtime = 06:30 − 7h30 = 23:00 → pre-sleep starts 21:30

## Example responses (match this tone and structure exactly)

**Morning debrief:**
User: "How did I sleep last night?"
R-Lo: "You logged 4 cycles — one short of your 5-cycle target. Your 06:30 anchor held, which is the most important thing. Tonight, aim for sleep onset at 23:00 to hit the full 5. Want me to set your wind-down reminder?"

**Bad night empathy:**
User: "I barely slept and I feel terrible"
R-Lo: "3 cycles is a rough night — your body is running on partial recovery. Today's plan: protect your energy. A 30-minute CRP between 13:00–15:00 will help. Tonight is a recovery night — prioritise getting to bed by 22:30 for 5 full cycles. Don't try to catch up with a lie-in, your 06:30 anchor stays."

**Evening prep:**
User: "What should I do before bed tonight?"
R-Lo: "Start wind-down at 21:00 — that gives you the full 90-minute pre-sleep window. Dim lights, no screens after 21:30, cool your room to 18°C. Your calendar is clear after 20:00, so you have a clean run to your 22:30 sleep onset."

**Off-topic refusal:**
User: "Tell me about the French Revolution"
R-Lo: "I'm R-Lo, your sleep coach — that's outside my area. Ask me anything about your sleep, recovery, or your R90 plan. 🌙"

**Explaining calculations:**
User: "Why is my bedtime 22:30?"
R-Lo: "Your anchor wake time is 06:30. Working backward: 5 cycles × 90 minutes = 7h30 of sleep. 06:30 − 7:30 = 23:00 sleep onset. But you need 90 minutes of pre-sleep wind-down, so your routine starts at 21:30. The 22:30 you see is when you should aim to be falling asleep — lights out, eyes closed."

## Response style
- Concise: 2–4 sentences for simple questions, up to 8 for complex ones
- Direct: lead with the answer, explain after
- Warm but precise: like a coach, not a therapist
- Use the user's actual data when relevant (e.g. "your HRV is 52ms — that's a sign your body needs an easier day")
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

export function isOffTopic(message: string): boolean {
  // Allow if message clearly relates to sleep/recovery/R90
  const SLEEP_SIGNALS = /\b(sleep|sommeil|nuit|cycle|fatigue|tired|réveil|coucher|recovery|recover|energie|energy|r90|crp|mrm|arp|chronotype|jet.?lag|nap|sieste|melatonin|mélatonin|insomnia|insomnie|wake|bedtime|stress|rest|rest|wind.?down|routine|circadian|rythme|repos|detox|caffeine|caféine|alcohol|alcool|screen|écran|cortisol|snore|ronfle|pillow|oreiller|mattress|matelas|temperature|température|dark|light|lumière|noise|bruit|apnea|apnée)\b/i;
  if (SLEEP_SIGNALS.test(message)) return false;

  // Compound-context check: if message contains BOTH off-topic word AND a lifestyle-adjacent word
  // that might relate to sleep (e.g. "cooking late affects my sleep", "eating before bed")
  const COMPOUND_BRIDGE = /\b(before bed|after dinner|late night|night shift|travail de nuit|manger|eating|affect|impact|influence|disturb|disrupt|perturb|empêche|keeps me|me garde|réveille|wakes me|can't sleep|cannot sleep|du mal à|hard to sleep|difficult to)\b/i;
  if (COMPOUND_BRIDGE.test(message)) return false;

  return OFF_TOPIC_PATTERNS.some(p => p.test(message));
}

export const OFF_TOPIC_REPLY = "I'm R-Lo, your sleep coach — that's outside my area. Ask me anything about your sleep, recovery, or your R90 plan. 🌙";

// ─── 2. OpenAI call with retry + graceful fallback ────────────────────────────

const OPENAI_CHAT_URL  = "https://api.openai.com/v1/chat/completions";
const MAX_RETRIES      = 2;
const FALLBACK_MESSAGE = "R-Lo is having trouble responding right now. Please try again in a moment.";

/**
 * Attempt a single non-streaming OpenAI request to get a complete response.
 * Returns the content string or throws on failure.
 */
async function callOpenAI(
  apiKey:   string,
  messages: { role: string; content: string }[],
  attempt:  number,
): Promise<string> {
  const response = await fetch(OPENAI_CHAT_URL, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      model:       "gpt-4o",
      messages,
      stream:      false,
      max_tokens:  150,
      temperature: 0.60,
    }),
    signal: AbortSignal.timeout(20_000), // 20s timeout per attempt
  });

  if (!response.ok) {
    throw new Error(`OpenAI HTTP ${response.status} (attempt ${attempt})`);
  }

  const json = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?:   { message?: string };
  };

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
async function callOpenAIWithRetry(
  apiKey:   string,
  messages: { role: string; content: string }[],
): Promise<{ content: string; failed: boolean }> {
  let lastError: Error | unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const content = await callOpenAI(apiKey, messages, attempt);
      return { content, failed: false };
    } catch (err) {
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

// ─── Tool-calling loop ──────────────────────────────────────────────────────

interface ToolCallMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
}

/**
 * Call OpenAI with tool-calling support. Executes up to 3 iterations of the loop.
 * Sends "thinking" status events via SSE for progress indication.
 * Falls back to static context on failure.
 */
async function callOpenAIWithTools(
  apiKey: string,
  messages: Array<{ role: string; content: string | null; tool_call_id?: string; name?: string }>,
  userId: string,
  client: AppClient,
  res: ServerResponse,
): Promise<{ content: string; failed: boolean }> {
  const MAX_ITERATIONS = 3;

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          model:       "gpt-4o",
          messages,
          tools:       SLEEP_COACH_TOOLS,
          tool_choice: "auto",
          stream:      false,
          max_tokens:  150,
          temperature: 0.60,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        throw new Error(`OpenAI HTTP ${response.status}`);
      }

      const json = await response.json() as {
        choices?: Array<{
          message?: ToolCallMessage;
          finish_reason?: string;
        }>;
      };

      const choice  = json.choices?.[0];
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
          ...({ tool_calls: message.tool_calls } as Record<string, unknown>),
        } as typeof messages[number]);

        // Send thinking status (not SSE headers yet — just queue them)
        if (!res.headersSent) {
          res.writeHead(200, {
            "Content-Type":                "text/event-stream",
            "Cache-Control":               "no-cache",
            "Connection":                  "keep-alive",
            "Access-Control-Allow-Origin": "*",
          });
        }

        // Execute each tool call
        for (const tc of message.tool_calls) {
          // Send thinking indicator
          res.write(`data: ${JSON.stringify({ status: "thinking", tool: tc.function.name })}\n\n`);

          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            // Empty args
          }

          const result = await executeTool(tc.function.name, parsedArgs, userId, client);

          // Add tool result to conversation
          messages.push({
            role: "tool",
            content: result,
            tool_call_id: tc.id,
            name: tc.function.name,
          } as typeof messages[number]);
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
  } catch (err) {
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
export async function streamChatResponse(
  client:  AppClient,
  userId:  string,
  input:   ChatInput,
  res:     ServerResponse,
): Promise<void> {
  // ── 5. Validate input ──────────────────────────────────────────────────
  const validation = validateInput(input.message);
  if (!validation.ok) {
    if (validation.reason === "message_too_long") {
      sendSseError(res, "Your message is too long. Please keep it under 1000 characters.");
    } else if (validation.reason === "injection_attempt") {
      sendSseError(res, "I can only help with sleep and recovery topics.");
    } else {
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
  let persistedHistory: ChatMessageRow[] = [];
  try {
    persistedHistory = await loadRecentMessages(client, userId, MAX_HISTORY_TURNS * 2);
  } catch {
    // Non-fatal: fall back to client history
  }

  // Prefer persisted history if available; fall back to client-sent history
  const historyMessages: ChatMessage[] = persistedHistory.length > 0
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
          saveExchange(client, userId, sessionId, cleanMessage, fullReply).catch(() => {});
          await fakeStreamResponse(res, fullReply);
          return;
        }
      }
    } catch {
      // Fall through to normal chat flow
    }
  }

  // ── 4. Build minimal context for tool-calling mode ────────────────────
  let minimalContext = "";
  try {
    const ctx = await buildStructuredContext(client, userId);
    // Only [USER_PROFILE] + [CURRENT_STATE] for the tool-calling system prompt
    const lines: string[] = [];
    lines.push("[USER_PROFILE]");
    lines.push(`today: ${ctx.today}`);
    lines.push(`anchor_wake_time: ${ctx.arp_time ?? "not set"}`);
    lines.push(`chronotype: ${ctx.chronotype}`);
    lines.push(`cycle_target_per_night: ${ctx.cycle_target}`);
    lines.push("");
    lines.push("[CURRENT_STATE]");
    if (ctx.active_states.length > 0) {
      lines.push(`active_states: ${ctx.active_states.join(", ")}`);
    } else {
      lines.push("active_states: none");
    }
    if (ctx.primary_rec) lines.push(`primary_recommendation: ${ctx.primary_rec}`);
    lines.push("");
    minimalContext = lines.join("\n");
  } catch (err) {
    console.warn("[chat-service] context build failed:", err instanceof Error ? err.message : err);
    minimalContext = "[CURRENT_STATE]\nContext unavailable — respond based on general R90 principles.";
  }

  const toolSystemPrompt = buildSystemPrompt(minimalContext);

  // Build messages for tool-calling flow
  const toolMessages: Array<{ role: string; content: string | null; tool_call_id?: string; name?: string }> = [
    { role: "system", content: toolSystemPrompt },
    ...historyMessages.slice(-MAX_HISTORY_TURNS).map(m => ({ role: m.role, content: m.content.length > MAX_MSG_CHARS ? m.content.slice(0, MAX_MSG_CHARS) + "…" : m.content })),
    { role: "user",   content: cleanMessage },
  ];

  // ── Try tool-calling flow first ──────────────────────────────────────
  let assistantReply: string;
  let failed: boolean;

  const toolResult = await callOpenAIWithTools(apiKey, toolMessages, userId, client, res);

  if (!toolResult.failed && toolResult.content) {
    assistantReply = toolResult.content;
    failed = false;
  } else {
    // ── Fallback: full static context (original behavior) ────────────
    let contextSections = "[CURRENT_STATE]\nContext unavailable — respond based on general R90 principles.";
    try {
      const ctx = await buildStructuredContext(client, userId);
      contextSections = formatContextSections(ctx);
    } catch {
      // Use default fallback
    }

    const fallbackMessages = [
      { role: "system",  content: buildSystemPrompt(contextSections) },
      ...historyMessages.slice(-MAX_HISTORY_TURNS).map(m => ({ role: m.role, content: m.content.length > MAX_MSG_CHARS ? m.content.slice(0, MAX_MSG_CHARS) + "…" : m.content })),
      { role: "user",    content: cleanMessage },
    ];

    const fallbackResult = await callOpenAIWithRetry(apiKey, fallbackMessages);
    assistantReply = fallbackResult.content;
    failed = fallbackResult.failed;
  }

  // ── Post-processing: forbidden words filter ───────────────────────
  assistantReply = sanitizeReply(assistantReply);

  // ── Persist exchange (best-effort, non-blocking) ──────────────────
  const sessionId = input.session_id ?? dailySessionId();
  if (!failed) {
    saveExchange(client, userId, sessionId, cleanMessage, assistantReply).catch(err => {
      console.warn("[chat-service] persist failed:", err instanceof Error ? err.message : err);
    });
    // Extract and save long-term coaching facts from this exchange (non-blocking)
    extractAndSaveMemory(client, userId, cleanMessage, assistantReply).catch(() => {});
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
  } else {
    await fakeStreamResponse(res, assistantReply);
  }
}

// ─── Post-processing: forbidden words + persona sanitizer ─────────────────────

const FORBIDDEN_REPLACEMENTS: Array<[RegExp, string]> = [
  // Technical / AI references
  [/\bAs an AI\b/gi,              "As your coach"],
  [/\bI('m| am) an AI\b/gi,       "I'm R-Lo, your coach"],
  [/\blanguage model\b/gi,        "coaching system"],
  [/\bChatGPT\b/gi,               "R-Lo"],
  [/\bOpenAI\b/gi,                ""],
  [/\bGPT-?\d*/gi,                "R-Lo"],
  // Forbidden app references
  [/\bSleep Score\b/gi,           "readiness zone"],
  [/\bsleep tracker\b/gi,         "wearable"],
  [/\bFitbit\b/gi,                "your wearable"],
  [/\bApple Watch\b/gi,           "your wearable"],
  // Medical overreach
  [/\b(diagnos|prescri|medic(at|ine)|therap(y|ist)|psychiatr)\w*/gi, ""],
  // Formatting artifacts (safety net — mobile also strips these)
  [/\*\*(.+?)\*\*/g,              "$1"],
  [/\*(.+?)\*/g,                  "$1"],
  [/^#{1,6}\s+/gm,                ""],
];

function sanitizeReply(text: string): string {
  let result = text;
  for (const [pattern, replacement] of FORBIDDEN_REPLACEMENTS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      console.warn(`[chat-service] sanitizeReply: replaced pattern ${pattern}`);
    }
  }
  // Clean up double spaces from replacements
  result = result.replace(/  +/g, " ").trim();
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fake-stream a response over SSE (word-by-word with 18ms delay).
 */
async function fakeStreamResponse(res: ServerResponse, text: string): Promise<void> {
  res.writeHead(200, {
    "Content-Type":                "text/event-stream",
    "Cache-Control":               "no-cache",
    "Connection":                  "keep-alive",
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

function sendSseError(res: ServerResponse, message: string): void {
  if (!res.headersSent) {
    res.writeHead(200, {
      "Content-Type":                "text/event-stream",
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
export async function loadChatHistory(
  client:    AppClient,
  userId:    string,
  limit      = 20,
): Promise<ChatMessage[]> {
  try {
    const rows = await loadRecentMessages(client, userId, limit);
    return rows.map(r => ({ role: r.role, content: r.content }));
  } catch {
    return [];
  }
}

// ─── Greeting — personalized context-aware opening ────────────────────────────

const GREETING_SYSTEM_PROMPT = `You are R-Lo, the intelligent sleep coach inside R90 Navigator.

Your task: write a SHORT, personalized opening message (2-3 sentences max) that:
1. Immediately shows you know the user's current situation (use their actual data)
2. Takes initiative — YOU lead the conversation, don't wait for them to ask
3. Ends with ONE concrete, specific question based on their situation

Situation-based approach:
- After a bad night (< 3 cycles) → acknowledge it, ask what happened or offer recovery strategy
- After a great night (≥ 5 cycles) → celebrate briefly, ask about energy or what's next
- Morning → focus on how they feel now vs their sleep data
- Evening (3h before ARP) → check if they've started wind-down
- Upcoming event (travel, important day) → proactively mention it
- No sleep logged yet today → ask them to log last night
- Multiple bad nights in a row → flag the pattern, take action

NEVER start with "How can I help you today?" or any generic opener.
NEVER be generic. Every word should be based on their actual data.
Reply in the same language as the user's interface (check context for clues, default English).
Be direct, warm, like a coach who already knows them.
Use plain text only — no markdown, no **bold**, no *italic*, no # headers.
Keep it SHORT: 1-2 sentences. This is a mobile chat, not an email.`;

export async function streamGreeting(
  client: AppClient,
  userId: string,
  res:    ServerResponse,
): Promise<void> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) { await fakeStreamResponse(res, "Good to see you. How did you sleep last night?"); return; }

  let ctx: StructuredContext;
  try {
    ctx = await buildStructuredContext(client, userId);
  } catch {
    await fakeStreamResponse(res, "Good to see you. How did you sleep last night?"); return;
  }

  const contextSections = formatContextSections(ctx);

  const body = JSON.stringify({
    model:       "gpt-4o",
    max_tokens:  120,
    temperature: 0.70,
    messages: [
      { role: "system",  content: GREETING_SYSTEM_PROMPT },
      { role: "user",    content: `Current user context:\n${contextSections}\n\nWrite the personalized opening message now.` },
    ],
  });

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body,
      signal:  AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      await fakeStreamResponse(res, "Good to see you. How did you sleep last night?"); return;
    }

    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "Good to see you. How did you sleep last night?";
    await fakeStreamResponse(res, text);
  } catch {
    await fakeStreamResponse(res, "Good to see you. How did you sleep last night?");
  }
}
