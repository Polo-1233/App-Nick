/**
 * use-chat.ts — Streaming chat hook for Airloop
 *
 * Manages:
 *   - Message history (persisted in memory during session)
 *   - Streaming SSE from POST /chat
 *   - Loading / streaming / error states
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { getAccessToken } from "./supabase";
import { BASE_URL } from "./api";

export interface ChatMessage {
  id:      string;
  role:    "user" | "assistant";
  content: string;
  status:  "done" | "streaming" | "error";
}

export interface UseChatResult {
  messages:   ChatMessage[];
  isStreaming: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-progress stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const isCurrentlyStreaming = messages.at(-1)?.status === "streaming";
    if (!text.trim() || isCurrentlyStreaming) return;

    // Abort any in-progress stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Add user message
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text, status: "done" };
    const assistantId = uid();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", status: "streaming" };

    // Build history from current messages before appending new ones
    const history = messages
      .filter(m => m.status === "done")
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    try {
      const token = await getAccessToken();

      const res = await fetch(`${BASE_URL}/chat`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body:   JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // Read SSE stream
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();

          if (data === "[DONE]") {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, status: "done" as const } : m
            ));
            return;
          }

          try {
            const parsed = JSON.parse(data) as { delta?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.delta) {
              accumulated += parsed.delta;
              const snapshot = accumulated;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: snapshot } : m
              ));
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      // Stream ended without [DONE]
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, status: "done" as const } : m
      ));
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      const errMsg = e instanceof Error ? e.message : "Something went wrong";
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: errMsg, status: "error" as const }
          : m
      ));
    }
  }, [messages]);

  const clearHistory = useCallback(() => setMessages([]), []);

  // Derive streaming state from messages instead of tracking separately
  const isStreaming = messages.at(-1)?.status === "streaming";

  return { messages, isStreaming, sendMessage, clearHistory };
}
