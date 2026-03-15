/**
 * chat-messages.ts — Conversation persistence layer
 *
 * Schema (Supabase table: chat_messages):
 *   id          uuid        PK, default gen_random_uuid()
 *   user_id     uuid        FK → users.id
 *   session_id  text        Groups messages into a conversation session
 *   role        text        'user' | 'assistant'
 *   content     text        Message content
 *   created_at  timestamptz default now()
 *
 * Migration SQL (run once in Supabase SQL editor):
 * ─────────────────────────────────────────────────
 *   CREATE TABLE IF NOT EXISTS chat_messages (
 *     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *     session_id TEXT NOT NULL,
 *     role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
 *     content    TEXT NOT NULL,
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session
 *     ON chat_messages(user_id, session_id, created_at DESC);
 */
// ─── Read ─────────────────────────────────────────────────────────────────────
/**
 * Load the most recent N messages for a user, newest-first, then reversed
 * so they are returned oldest-first (ready to inject into messages[]).
 */
export async function loadRecentMessages(client, userId, limit = 20) {
    const { data, error } = await client
        .from("chat_messages")
        .select("id, user_id, session_id, role, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error || !data) {
        console.warn("[chat-messages] loadRecentMessages failed:", error?.message);
        return [];
    }
    // Reverse so oldest is first (chronological order for the LLM)
    return data.reverse();
}
/**
 * Load messages for a specific session.
 */
export async function loadSessionMessages(client, userId, sessionId, limit = 30) {
    const { data, error } = await client
        .from("chat_messages")
        .select("id, user_id, session_id, role, content, created_at")
        .eq("user_id", userId)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(limit);
    if (error || !data) {
        console.warn("[chat-messages] loadSessionMessages failed:", error?.message);
        return [];
    }
    return data;
}
// ─── Write ────────────────────────────────────────────────────────────────────
/**
 * Persist a single message. Silently ignores errors (chat persistence
 * is best-effort — never block a response due to a DB write failure).
 */
export async function saveMessage(client, userId, sessionId, role, content) {
    const { error } = await client
        .from("chat_messages")
        .insert({ user_id: userId, session_id: sessionId, role, content });
    if (error) {
        console.warn("[chat-messages] saveMessage failed:", error.message);
    }
}
/**
 * Save a user + assistant pair atomically (best-effort).
 * If either fails, the other is still attempted.
 */
export async function saveExchange(client, userId, sessionId, userContent, asstContent) {
    const rows = [
        { user_id: userId, session_id: sessionId, role: "user", content: userContent },
        { user_id: userId, session_id: sessionId, role: "assistant", content: asstContent },
    ];
    const { error } = await client
        .from("chat_messages")
        .insert(rows);
    if (error) {
        console.warn("[chat-messages] saveExchange failed:", error.message);
    }
}
// ─── Session ID generator ─────────────────────────────────────────────────────
/**
 * Generate a session ID from the current date (YYYY-MM-DD).
 * This groups all messages on the same day into one session.
 * For multi-session support, callers can pass a UUID instead.
 */
export function dailySessionId() {
    return new Date().toISOString().slice(0, 10);
}
//# sourceMappingURL=chat-messages.js.map