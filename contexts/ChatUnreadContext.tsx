"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type ChatUnreadCtx = {
  totalUnread: number;
  setTotalUnread: (n: number) => void;
};

const ChatUnreadContext = createContext<ChatUnreadCtx>({
  totalUnread: 0,
  setTotalUnread: () => {},
});

// ── helpers localStorage ────────────────────────────────────────────
function persistedCount(uid: string): number {
  try { return parseInt(localStorage.getItem(`chat_unread_${uid}`) ?? "0", 10) || 0; } catch { return 0; }
}
function saveCount(uid: string, n: number) {
  try { localStorage.setItem(`chat_unread_${uid}`, String(n)); } catch {}
}
function conversaIdsFromCache(uid: string): string[] {
  try {
    const raw = localStorage.getItem(`chat_v1_${uid}`);
    if (!raw) return [];
    const c = JSON.parse(raw);
    return [
      ...(c.dms ?? []).map((d: { id: string }) => d.id),
      ...(c.grupos ?? []).map((g: { id: string }) => g.id),
    ];
  } catch { return []; }
}

export function ChatUnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [totalUnread, setTotalUnreadState] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelsRef = useRef<Map<string, any>>(new Map());
  const pathnameRef = useRef(pathname);
  const userIdRef = useRef<string | undefined>(undefined);

  // Mantém pathnameRef sempre atualizado dentro dos closures
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // Wrapper que persiste no localStorage
  function setTotalUnread(n: number) {
    setTotalUnreadState(n);
    if (userIdRef.current) saveCount(userIdRef.current, n);
  }

  // Inicializa do localStorage quando usuário carrega
  useEffect(() => {
    if (!user?.id) return;
    userIdRef.current = user.id;
    setTotalUnreadState(persistedCount(user.id));
  }, [user?.id]);

  // Zera ao entrar na página de chat (o chat page cuida dos counts internos)
  useEffect(() => {
    if (pathname === "/dashboard/chat" && user?.id) {
      setTotalUnreadState(0);
      saveCount(user.id, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Inscreve nos canais Broadcast de todas as conversas conhecidas.
  // Roda em cada navegação para pegar novas conversas adicionadas ao cache.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const map = channelsRef.current;
    const ids = conversaIdsFromCache(uid);

    for (const cid of ids) {
      if (map.has(cid)) continue; // já inscrito, não duplicar
      const ch = supabase
        .channel(`room:${cid}`) // mesmo nome usado pelo chat page
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("broadcast", { event: "msg" }, ({ payload }: { payload: any }) => {
          // Ignora mensagens próprias
          if (payload?.autorId === uid) return;
          // Ignora se o usuário está na página de chat (chat page cuida do count)
          if (pathnameRef.current === "/dashboard/chat") return;
          setTotalUnreadState(prev => {
            const next = prev + 1;
            saveCount(uid, next);
            return next;
          });
        })
        .subscribe();
      map.set(cid, ch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user?.id]); // re-roda a cada navegação para capturar novas conversas

  // Limpeza só no unmount
  useEffect(() => {
    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current.clear();
    };
  }, []);

  return (
    <ChatUnreadContext.Provider value={{ totalUnread, setTotalUnread }}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}
