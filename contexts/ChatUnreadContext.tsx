"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type ChatUnreadCtx = {
  totalUnread: number;
  setTotalUnread: (n: number) => void;
  setActiveChatId: (id: string | null) => void;
};

const ChatUnreadContext = createContext<ChatUnreadCtx>({
  totalUnread: 0,
  setTotalUnread: () => {},
  setActiveChatId: () => {},
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveToLocalInbox(uid: string, cid: string, msg: any) {
  try {
    const key = `chat_inbox_${uid}`;
    const raw = localStorage.getItem(key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inbox: Record<string, any[]> = raw ? JSON.parse(raw) : {};
    // Garante que é sempre um array (compatível com formato antigo de objeto único)
    if (!Array.isArray(inbox[cid])) {
      inbox[cid] = inbox[cid] ? [inbox[cid]] : [];
    }
    // Deduplica por id para não adicionar a mesma mensagem duas vezes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!inbox[cid].some((m: any) => m.id === msg.id)) {
      inbox[cid].push(msg);
    }
    localStorage.setItem(key, JSON.stringify(inbox));
  } catch {}
}

export function ChatUnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [totalUnread, setTotalUnreadState] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelsRef = useRef<Map<string, any>>(new Map());
  const pathnameRef = useRef(pathname);
  const userIdRef = useRef<string | undefined>(undefined);
  const activeChatIdRef = useRef<string | null>(null);

  function setActiveChatId(id: string | null) {
    activeChatIdRef.current = id;
  }

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

  // ── Gerencia canais de broadcast ─────────────────────────────────
  // ESTRATÉGIA:
  // - Quando no chat page → remove todos os canais do contexto.
  //   O chat page cuida dos próprios canais e chama setTotalUnread diretamente.
  // - Quando fora do chat page → recria canais frescos.
  //   Isso garante que um LEAVE enviado pelo chat page ao desmontar não
  //   deixe os canais do contexto "mortos" no servidor.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const map = channelsRef.current;

    // Sempre limpa antes (garante canais frescos, evita canais zumbis)
    map.forEach(ch => supabase.removeChannel(ch));
    map.clear();

    // No chat page: sem canais no contexto (chat page gerencia tudo)
    if (pathname === "/dashboard/chat") return;

    const ids = conversaIdsFromCache(uid);
    for (const cid of ids) {
      const ch = supabase
        .channel(`room:${cid}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("broadcast", { event: "msg" }, ({ payload }: { payload: any }) => {
          if (payload?.autorId === uid) return; // mensagem própria

          // Salva no inbox do localStorage (persiste mesmo com gaps de reconexão)
          saveToLocalInbox(uid, cid, {
            id:        payload.id,
            autorId:   payload.autorId,
            autorNome: payload.autorNome,
            conteudo:  payload.conteudo ?? "",
            tipo:      payload.tipo ?? "texto",
            mediaUrl:  payload.mediaUrl,
            criadoEm:  payload.criadoEm ?? new Date().toISOString(),
            lida:      false,
          });

          // Incrementa badge
          setTotalUnreadState(prev => {
            const next = prev + 1;
            saveCount(uid, next);
            return next;
          });
        })
        .subscribe();
      map.set(cid, ch);
    }

    return () => {
      map.forEach(ch => supabase.removeChannel(ch));
      map.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user?.id]);

  return (
    <ChatUnreadContext.Provider value={{ totalUnread, setTotalUnread, setActiveChatId }}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}
