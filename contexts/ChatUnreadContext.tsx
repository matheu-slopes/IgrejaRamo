"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type ChatUnreadCtx = {
  totalUnread: number;
  setTotalUnread: (n: number) => void;
  setActiveChatId: (id: string | null) => void;
  contextConversaIds: string[];
};

const ChatUnreadContext = createContext<ChatUnreadCtx>({
  totalUnread: 0,
  setTotalUnread: () => {},
  setActiveChatId: () => {},
  contextConversaIds: [],
});

// ── helpers localStorage ────────────────────────────────────────────
function persistedCount(uid: string): number {
  try { return parseInt(localStorage.getItem(`chat_unread_${uid}`) ?? "0", 10) || 0; } catch { return 0; }
}
function saveCount(uid: string, n: number) {
  try { localStorage.setItem(`chat_unread_${uid}`, String(n)); } catch {}
}
async function getFreshToken(forceRefresh = false): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "";
  const expiresAt = session.expires_at ?? 0;
  if (forceRefresh || Date.now() / 1000 > expiresAt - 60) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? "";
  }
  return session.access_token;
}

async function fetchUnreadWithAuth(): Promise<Response | null> {
  let token = await getFreshToken();
  if (!token) return null;
  let res = await fetch("/api/chat/unread", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    token = await getFreshToken(true);
    if (!token) return res;
    res = await fetch("/api/chat/unread", {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return res;
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
function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}
function isMissingColumn(error: unknown, column: string) {
  const err = error as { code?: string; message?: string } | null;
  const msg = String(err?.message ?? "").toLowerCase();
  return err?.code === "42703" && msg.includes(column.toLowerCase());
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
  const [conversaIds, setConversaIds] = useState<string[]>([]);
  const [channelRevision, setChannelRevision] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelsRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatesChannelRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageInsertChannelRef = useRef<any>(null);
  const pathnameRef = useRef(pathname);
  const userIdRef = useRef<string | undefined>(undefined);
  const activeChatIdRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const conversaIdsRef = useRef<string[]>([]);

  function setActiveChatId(id: string | null) {
    activeChatIdRef.current = id;
  }

  function handleIncomingChatMessage(uid: string, cid: string, msg: {
    id?: string;
    autorId?: string;
    autorNome?: string;
    conteudo?: string;
    tipo?: string;
    mediaUrl?: string;
    criadoEm?: string;
  }) {
    if (!msg.id || msg.autorId === uid) return;
    if (pathnameRef.current === "/dashboard/chat") return;
    if (seenMessageIdsRef.current.has(msg.id)) return;

    seenMessageIdsRef.current.add(msg.id);
    if (seenMessageIdsRef.current.size > 300) {
      seenMessageIdsRef.current = new Set([...seenMessageIdsRef.current].slice(-150));
    }

    saveToLocalInbox(uid, cid, {
      id: msg.id,
      autorId: msg.autorId,
      autorNome: msg.autorNome ?? "",
      conteudo: msg.conteudo ?? "",
      tipo: msg.tipo ?? "texto",
      mediaUrl: msg.mediaUrl,
      criadoEm: msg.criadoEm ?? new Date().toISOString(),
      lida: false,
    });

    setTotalUnreadState(prev => {
      const next = prev + 1;
      saveCount(uid, next);
      return next;
    });
  }

  // Mantém pathnameRef sempre atualizado dentro dos closures
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => { conversaIdsRef.current = conversaIds; }, [conversaIds]);

  // Wrapper que persiste no localStorage
  function setTotalUnread(n: number) {
    setTotalUnreadState(n);
    if (userIdRef.current) saveCount(userIdRef.current, n);
  }


  // Sempre força atualização do contador do servidor ao logar ou abrir o app
  useEffect(() => {
    if (!user?.id) return;
    userIdRef.current = user.id;
    // Primeiro mostra o valor local para feedback rápido
    setTotalUnreadState(persistedCount(user.id));
    // Em seguida, força atualização do servidor
    refreshUnreadFromServer(user.id);
  }, [user?.id]);

  async function refreshUnreadFromServer(uid: string) {
    try {
      const res = await fetchUnreadWithAuth();
      if (!res) return;
      const json = await res.json().catch(() => ({}));
      if (!res.ok || typeof json.total !== "number") return;
      setTotalUnreadState(json.total);
      saveCount(uid, json.total);
    } catch {
      // Mantém o contador local se estiver offline.
    }
  }

  // Recalcula pelo banco ao entrar/relogar e ao voltar para o app.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    refreshUnreadFromServer(uid);

    const onFocus = () => refreshUnreadFromServer(uid);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshUnreadFromServer(uid);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Reconciliacao leve enquanto o dashboard esta aberto. Push pode chegar mesmo
  // quando o JS estava pausado; esse polling mantem o badge de Conversas correto
  // sem depender de entrar na tela de chat.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      refreshUnreadFromServer(uid);
    };

    sync();
    const interval = window.setInterval(sync, pathname === "/dashboard/chat" ? 30000 : 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user?.id]);

  // Carrega as conversas do usuário no layout, sem depender da página de chat.
  // Antes, o badge do rodapé só passava a escutar mensagens depois que /dashboard/chat
  // criava o cache local com os IDs das conversas.
  useEffect(() => {
    if (!user?.id) {
      setConversaIds([]);
      return;
    }

    let cancelled = false;
    const uid = user.id;

    const cachedIds = conversaIdsFromCache(uid);
    if (cachedIds.length) setConversaIds(uniqueIds(cachedIds));

    async function carregarIds() {
      const result = await supabase
        .from("chat_participantes")
        .select("conversa_id, historico_desde")
        .eq("user_id", uid);
      let data = result.data as { conversa_id: string; historico_desde?: string | null }[] | null;
      let error = result.error;

      if (error && isMissingColumn(error, "historico_desde")) {
        const fallback = await supabase
          .from("chat_participantes")
          .select("conversa_id")
          .eq("user_id", uid);
        data = fallback.data as { conversa_id: string }[] | null;
        error = fallback.error;
      }

      if (cancelled || error) return;
      const dbIds = ((data ?? []) as { conversa_id: string }[]).map((p) => p.conversa_id);
      setConversaIds((prev) => uniqueIds([...prev, ...cachedIds, ...dbIds]));
    }

    carregarIds();

    return () => { cancelled = true; };
  }, [user?.id]);

  // Detecta novas conversas/grupos adicionados enquanto o usuário está fora do chat.
  useEffect(() => {
    if (!user?.id) return;
    if (updatesChannelRef.current) supabase.removeChannel(updatesChannelRef.current);

    const uid = user.id;
    const channel = supabase
      .channel(`chat_unread_memberships_${uid}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "chat_participantes",
        filter: `user_id=eq.${uid}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const cid = payload.new?.conversa_id as string | undefined;
        if (!cid) return;
        setConversaIds((prev) => uniqueIds([...prev, cid]));
      })
      .subscribe();

    updatesChannelRef.current = channel;

    return () => {
      if (updatesChannelRef.current) supabase.removeChannel(updatesChannelRef.current);
      updatesChannelRef.current = null;
    };
  }, [user?.id]);

  // Escuta novas mensagens com um unico canal. O polling abaixo continua sendo a
  // fonte de reconciliacao, mas esta escuta deixa o badge subir quase em tempo real.
  useEffect(() => {
    if (!user?.id) return;
    if (messageInsertChannelRef.current) supabase.removeChannel(messageInsertChannelRef.current);

    const uid = user.id;
    const channel = supabase
      .channel(`chat_unread_messages_${uid}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "chat_mensagens",
      }, (payload: any) => {
        const row = payload.new;
        const cid = row?.conversa_id as string | undefined;
        if (!cid || !conversaIdsRef.current.includes(cid)) return;
        handleIncomingChatMessage(uid, cid, {
          id: row?.id,
          autorId: row?.autor_id,
          conteudo: row?.conteudo,
          tipo: row?.tipo,
          mediaUrl: row?.media_url,
          criadoEm: row?.criado_em,
        });
      })
      .subscribe();

    messageInsertChannelRef.current = channel;

    return () => {
      if (messageInsertChannelRef.current) supabase.removeChannel(messageInsertChannelRef.current);
      messageInsertChannelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Gerencia canais de broadcast ─────────────────────────────────
  // ESTRATÉGIA: canais ficam ativos durante toda a sessão autenticada.
  // Quando o usuário está no chat page, os broadcasts são recebidos mas
  // NÃO incrementam o badge nem salvam no inbox (o chat page cuida disso).
  // Isso elimina o gap onde mensagens eram perdidas ao entrar/sair do chat.
  useEffect(() => {
    const map = channelsRef.current;

    if (!user?.id) {
      // Logout: limpa todos os canais
      map.forEach(ch => supabase.removeChannel(ch));
      map.clear();
      return;
    }

    const uid = user.id;

    // Troca de conta: limpa canais do usuário anterior
    if (userIdRef.current !== uid) {
      map.forEach(ch => supabase.removeChannel(ch));
      map.clear();
    }

    // Adiciona apenas conversas novas (incremental, sem destruir canais ativos)
    const toAdd = conversaIds.filter(id => !map.has(id));
    for (const cid of toAdd) {
      const ch = supabase
        .channel(`room:${cid}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("broadcast", { event: "msg" }, ({ payload }: { payload: any }) => {
          handleIncomingChatMessage(uid, cid, {
            id: payload?.id,
            autorId: payload?.autorId,
            autorNome: payload?.autorNome,
            conteudo: payload?.conteudo,
            tipo: payload?.tipo,
            mediaUrl: payload?.mediaUrl,
            criadoEm: payload?.criadoEm,
          });
        })
        .subscribe((status: string) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (map.get(cid) === ch) {
              supabase.removeChannel(ch);
              map.delete(cid);
              setTimeout(() => setChannelRevision(r => r + 1), 2000);
            }
          } else if (status === "CLOSED") {
            setTimeout(() => {
              if (map.get(cid) === ch) {
                supabase.removeChannel(ch);
                map.delete(cid);
                setChannelRevision(r => r + 1);
              }
            }, 8000);
          }
        });
      map.set(cid, ch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, conversaIds.join(","), channelRevision]);

  // Cleanup global ao desmontar o Provider
  useEffect(() => {
    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current.clear();
      if (messageInsertChannelRef.current) {
        supabase.removeChannel(messageInsertChannelRef.current);
        messageInsertChannelRef.current = null;
      }
    };
  }, []);

  return (
    <ChatUnreadContext.Provider value={{ totalUnread, setTotalUnread, setActiveChatId, contextConversaIds: conversaIds }}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}
