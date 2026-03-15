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
import type { AppClient } from "./client.js";
export interface ChatMessageRow {
    id: string;
    user_id: string;
    session_id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}
/**
 * Load the most recent N messages for a user, newest-first, then reversed
 * so they are returned oldest-first (ready to inject into messages[]).
 */
export declare function loadRecentMessages(client: AppClient, userId: string, limit?: number): Promise<ChatMessageRow[]>;
/**
 * Load messages for a specific session.
 */
export declare function loadSessionMessages(client: AppClient, userId: string, sessionId: string, limit?: number): Promise<ChatMessageRow[]>;
/**
 * Persist a single message. Silently ignores errors (chat persistence
 * is best-effort — never block a response due to a DB write failure).
 */
export declare function saveMessage(client: AppClient, userId: string, sessionId: string, role: "user" | "assistant", content: string): Promise<void>;
/**
 * Save a user + assistant pair atomically (best-effort).
 * If either fails, the other is still attempted.
 */
export declare function saveExchange(client: AppClient, userId: string, sessionId: string, userContent: string, asstContent: string): Promise<void>;
/**
 * Generate a session ID from the current date (YYYY-MM-DD).
 * This groups all messages on the same day into one session.
 * For multi-session support, callers can pass a UUID instead.
 */
export declare function dailySessionId(): string;
