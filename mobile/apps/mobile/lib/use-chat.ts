/**
 * use-chat.ts — Streaming chat hook for Airloop (React Native compatible)
 *
 * Uses XMLHttpRequest + onprogress for SSE streaming.
 * React Native's fetch doesn't support ReadableStream, but XHR does.
 *
 * SSE format from server:
 *   data: {"delta":"chunk"}\n\n
 *   data: [DONE]\n\n
 *   data: {"error":"message"}\n\n
 */

import { useState, useCallback, useRef } from "react";
import { getAccessToken } from "./supabase";

const PROD_URL = "https://app-nick-production.up.railway.app";
const BASE_URL = (process.env.EXPO_PUBLIC_NICK_BRAIN_API_URL?.trim())
  || (__DEV__ ? "http://localhost:3000" : PROD_URL);

export interface ChatMessage {
  id:      string;
  role:    "user" | "assistant";
  content: string;
  status:  "done" | "streaming" | "error";
}

export interface UseChatResult {
  messages:        ChatMessage[];
  isStreaming:     boolean;
  sendMessage:     (text: string) => Promise<void>;
  clearHistory:    () => void;
  injectMessage:   (content: string) => void; // local R-Lo message, no API call
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function parseSSEChunks(raw: string, alreadyParsed: number): { deltas: string[]; done: boolean; error?: string; consumed: number } {
  const slice   = raw.slice(alreadyParsed);
  const lines   = slice.split("\n");
  const deltas: string[] = [];
  let done      = false;
  let error: string | undefined;
  let consumed  = alreadyParsed;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { consumed += line.length + 1; continue; }
    if (!trimmed.startsWith("data:")) { consumed += line.length + 1; continue; }

    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") { done = true; consumed += line.length + 1; break; }

    try {
      const parsed = JSON.parse(data) as { delta?: string; error?: string };
      if (parsed.error) { error = parsed.error; consumed += line.length + 1; break; }
      if (parsed.delta) { deltas.push(parsed.delta); }
    } catch { /* skip */ }
    consumed += line.length + 1;
  }

  return { deltas, done, error, consumed };
}

export function useChat(): UseChatResult {
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const xhrRef     = useRef<XMLHttpRequest | null>(null);
  const parsedRef  = useRef(0); // bytes already processed in XHR response

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Abort any previous request
    xhrRef.current?.abort();
    parsedRef.current = 0;

    const userMsg: ChatMessage       = { id: uid(), role: "user",      content: text, status: "done" };
    const assistantId                = uid();
    const assistantMsg: ChatMessage  = { id: assistantId, role: "assistant", content: "", status: "streaming" };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    let accumulated = "";

    try {
      const token = await getAccessToken();
      const history = messages
        .filter(m => m.status === "done")
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.open("POST", `${BASE_URL}/chat`, true);
        xhr.setRequestHeader("Content-Type",  "application/json");
        xhr.setRequestHeader("Authorization", token ? `Bearer ${token}` : "");
        xhr.setRequestHeader("Accept",        "text/event-stream");

        xhr.onprogress = () => {
          const raw    = xhr.responseText;
          const result = parseSSEChunks(raw, parsedRef.current);
          parsedRef.current = result.consumed;

          if (result.deltas.length > 0) {
            accumulated += result.deltas.join("");
            const snapshot = accumulated;
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: snapshot } : m
            ));
          }

          if (result.error) {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: result.error!, status: "error" as const } : m
            ));
            reject(new Error(result.error));
          }

          if (result.done) {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, status: "done" as const } : m
            ));
            resolve();
          }
        };

        xhr.onload = () => {
          // Catch case where [DONE] was in the last chunk but onprogress already fired
          if (xhr.status !== 200) {
            let errMsg = `HTTP ${xhr.status}`;
            try {
              const body = JSON.parse(xhr.responseText) as { error?: string };
              if (body.error) errMsg = body.error;
            } catch { /* ignore */ }
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: errMsg, status: "error" as const } : m
            ));
            reject(new Error(errMsg));
            return;
          }
          // Ensure final state is "done"
          setMessages(prev => prev.map(m =>
            m.id === assistantId && m.status === "streaming"
              ? { ...m, status: "done" as const }
              : m
          ));
          resolve();
        };

        xhr.onerror = () => {
          const errMsg = "Network error — backend unreachable";
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: errMsg, status: "error" as const } : m
          ));
          reject(new Error(errMsg));
        };

        xhr.onabort = () => resolve();

        xhr.send(JSON.stringify({ message: text, history }));
      });
    } catch (e) {
      if (e instanceof Error && e.message !== "abort") {
        // Error already set in messages above
      }
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming]);

  const clearHistory = useCallback(() => {
    xhrRef.current?.abort();
    setMessages([]);
  }, []);

  // Inject a local R-Lo message (no API call — used for proactive greetings)
  const injectMessage = useCallback((content: string) => {
    const msg: ChatMessage = { id: uid(), role: 'assistant', content, status: 'done' };
    setMessages(prev => (prev.length === 0 ? [msg] : prev));
  }, []);

  return { messages, isStreaming, sendMessage, clearHistory, injectMessage };
}
