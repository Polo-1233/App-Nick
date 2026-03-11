/**
 * ChatContext
 *
 * Exposes openChat() to any component inside the tab layout without
 * prop-drilling. The actual chat state and AirloopChat modal live in
 * _layout.tsx — this context is a thin wire.
 */

import { createContext, useContext, useMemo, useCallback } from "react";
import type { ReactNode } from "react";

interface ChatContextValue {
  openChat: () => void;
}

// Safe default so consumers outside the provider never crash
const ChatContext = createContext<ChatContextValue>({ openChat: () => {} });

interface ProviderProps {
  onOpenChat: () => void;
  children: ReactNode;
}

export function ChatProvider({ onOpenChat, children }: ProviderProps) {
  const openChat = useCallback(onOpenChat, []); // eslint-disable-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ openChat }), [openChat]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  return useContext(ChatContext);
}
