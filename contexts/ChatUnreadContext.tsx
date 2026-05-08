"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type ChatUnreadCtx = {
  totalUnread: number;
  setTotalUnread: (n: number) => void;
};

const ChatUnreadContext = createContext<ChatUnreadCtx>({
  totalUnread: 0,
  setTotalUnread: () => {},
});

export function ChatUnreadProvider({ children }: { children: ReactNode }) {
  const [totalUnread, setTotalUnread] = useState(0);
  return (
    <ChatUnreadContext.Provider value={{ totalUnread, setTotalUnread }}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}
