"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Notificacao } from "@/types";

type NotificationCounts = {
  total: number;
  avisos: number;
  escalas: number;
  eventos: number;
  ministerios: Record<string, number>;
};

type NotificationsCtx = {
  notificacoes: Notificacao[];
  counts: NotificationCounts;
  marcarUma: (id: string) => void;
  marcarTodas: () => void;
  marcarTipo: (tipo: "aviso" | "escala" | "evento") => void;
  marcarMinisterio: (ministerio: string) => void;
  remover: (id: string) => void;
  limparTodas: () => void;
};

const EMPTY_COUNTS: NotificationCounts = {
  total: 0,
  avisos: 0,
  escalas: 0,
  eventos: 0,
  ministerios: {},
};

const NotificationsContext = createContext<NotificationsCtx>({
  notificacoes: [],
  counts: EMPTY_COUNTS,
  marcarUma: () => {},
  marcarTodas: () => {},
  marcarTipo: () => {},
  marcarMinisterio: () => {},
  remover: () => {},
  limparTodas: () => {},
});

function rowToNotif(n: any): Notificacao {
  return {
    id: n.id,
    titulo: n.titulo,
    corpo: n.corpo,
    tipo: n.tipo,
    lida: n.lida,
    criadaEm: n.criada_em,
    link: n.link,
    ministerio: n.ministerio,
  };
}

function demoNotificacoes(): Notificacao[] {
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60000).toISOString();
  return [
    {
      id: "demo-aviso",
      titulo: "Novo aviso",
      corpo: "Reuniao geral de alinhamento hoje as 20:00.",
      tipo: "aviso",
      lida: false,
      criadaEm: at(4),
      link: "/dashboard/mural",
    },
    {
      id: "demo-escala",
      titulo: "Voce foi escalado em Louvor",
      corpo: "Culto de Domingo - dom., 07 jun as 18:30",
      tipo: "escala",
      lida: false,
      criadaEm: at(12),
      link: "/dashboard/escalas",
      ministerio: "Louvor",
    },
    {
      id: "demo-evento",
      titulo: "Novo evento - Jovens",
      corpo: "Culto de Jovens em Igreja Ramo da Vida",
      tipo: "evento",
      lida: false,
      criadaEm: at(24),
      link: "/dashboard/eventos",
      ministerio: "Jovens",
    },
    {
      id: "demo-jovens",
      titulo: "Jovens",
      corpo: "Matheus: Alinhamento da escala do proximo culto.",
      tipo: "ministerio",
      lida: false,
      criadaEm: at(39),
      link: "/dashboard/ministerio/Jovens",
      ministerio: "Jovens",
    },
    {
      id: "demo-midias",
      titulo: "Midias",
      corpo: "Larissa: Transmissao e projecao confirmadas.",
      tipo: "ministerio",
      lida: false,
      criadaEm: at(58),
      link: "/dashboard/ministerio/M%C3%ADdias",
      ministerio: "Mídias",
    },
  ];
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

async function persistirNotificacoes(method: "PATCH" | "DELETE", body: { ids?: string[]; all?: boolean }) {
  let token = await getFreshToken();
  if (!token) throw new Error("Sessao invalida");

  let res = await fetch("/api/notificacoes", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    token = await getFreshToken(true);
    res = await fetch("/api/notificacoes", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Falha ao atualizar notificacoes");
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const demoMode = process.env.NODE_ENV !== "production" && searchParams.get("demoNotificacoes") === "1";
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  useEffect(() => {
    if (demoMode) {
      setNotificacoes(demoNotificacoes());
      return;
    }

    if (!user?.id) {
      setNotificacoes([]);
      return;
    }

    let cancelled = false;

    supabase
      .from("notificacoes")
      .select()
      .eq("usuario_id", user.id)
      .order("criada_em", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled && data) setNotificacoes(data.map(rowToNotif));
      });

    const ch = supabase
      .channel(`notifs_${user.id}`)
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "notificacoes",
        filter: `usuario_id=eq.${user.id}`,
      }, (payload: any) => {
        setNotificacoes((prev) => [rowToNotif(payload.new), ...prev.filter((n) => n.id !== payload.new.id)].slice(0, 50));
      })
      .on("postgres_changes" as any, {
        event: "UPDATE",
        schema: "public",
        table: "notificacoes",
        filter: `usuario_id=eq.${user.id}`,
      }, (payload: any) => {
        setNotificacoes((prev) => prev.map((n) => n.id === payload.new.id ? rowToNotif(payload.new) : n));
      })
      .on("postgres_changes" as any, {
        event: "DELETE",
        schema: "public",
        table: "notificacoes",
        filter: `usuario_id=eq.${user.id}`,
      }, (payload: any) => {
        setNotificacoes((prev) => prev.filter((n) => n.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [demoMode, user?.id]);

  const counts = useMemo(() => {
    const acc: NotificationCounts = { total: 0, avisos: 0, escalas: 0, eventos: 0, ministerios: {} };
    for (const n of notificacoes) {
      if (n.lida) continue;
      acc.total += 1;
      if (n.tipo === "aviso") acc.avisos += 1;
      if (n.tipo === "escala") acc.escalas += 1;
      if (n.tipo === "evento") acc.eventos += 1;
      if (n.tipo === "ministerio" && n.ministerio) {
        acc.ministerios[n.ministerio] = (acc.ministerios[n.ministerio] ?? 0) + 1;
      }
    }
    return acc;
  }, [notificacoes]);

  function marcarTodas() {
    const ids = notificacoes.filter((n) => !n.lida).map((n) => n.id);
    if (!demoMode && ids.length) persistirNotificacoes("PATCH", { ids }).catch(console.error);
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  function marcarUma(id: string) {
    if (!demoMode) persistirNotificacoes("PATCH", { ids: [id] }).catch(console.error);
    setNotificacoes((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n));
  }

  function marcarTipo(tipo: "aviso" | "escala" | "evento") {
    const ids = notificacoes.filter((n) => !n.lida && n.tipo === tipo).map((n) => n.id);
    if (!demoMode && ids.length) persistirNotificacoes("PATCH", { ids }).catch(console.error);
    setNotificacoes((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, lida: true } : n));
  }

  function marcarMinisterio(ministerio: string) {
    const ids = notificacoes
      .filter((n) => !n.lida && n.tipo === "ministerio" && n.ministerio === ministerio)
      .map((n) => n.id);
    if (!demoMode && ids.length) persistirNotificacoes("PATCH", { ids }).catch(console.error);
    setNotificacoes((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, lida: true } : n));
  }

  function remover(id: string) {
    if (!demoMode) persistirNotificacoes("DELETE", { ids: [id] }).catch(console.error);
    setNotificacoes((prev) => prev.filter((n) => n.id !== id));
  }

  function limparTodas() {
    if (!demoMode && notificacoes.length) persistirNotificacoes("DELETE", { all: true }).catch(console.error);
    setNotificacoes([]);
  }

  return (
    <NotificationsContext.Provider value={{ notificacoes, counts, marcarUma, marcarTodas, marcarTipo, marcarMinisterio, remover, limparTodas }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
