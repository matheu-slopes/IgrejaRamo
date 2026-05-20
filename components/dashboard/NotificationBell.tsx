"use client";

import { useState, useEffect } from "react";
import { Bell, X, CheckCheck, CalendarDays, MessageSquare, AlertCircle, Users } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Notificacao, TipoNotificacao } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const tipoIcon: Record<TipoNotificacao, React.ReactNode> = {
  escala:     <CalendarDays className="w-4 h-4 text-gray-400"  />,
  evento:     <CalendarDays className="w-4 h-4 text-gold-500"  />,
  aviso:      <AlertCircle  className="w-4 h-4 text-amber-500" />,
  ministerio: <MessageSquare className="w-4 h-4 text-grape-400"/>,
  sistema:    <Users         className="w-4 h-4 text-gray-400" />,
};

function formatarTempo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60)   return `${min}m atrás`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

async function getFreshToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "";
  const expiresAt = session.expires_at ?? 0;
  if (Date.now() / 1000 > expiresAt - 60) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? "";
  }
  return session.access_token;
}

async function persistirNotificacoes(method: "PATCH" | "DELETE", body: { ids?: string[]; all?: boolean }) {
  const token = await getFreshToken();
  if (!token) throw new Error("Sessão inválida");
  const res = await fetch("/api/notificacoes", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Falha ao atualizar notificações");
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);

  function rowToNotif(n: any): Notificacao {
    return {
      id: n.id, titulo: n.titulo, corpo: n.corpo,
      tipo: n.tipo, lida: n.lida, criadaEm: n.criada_em,
      link: n.link, ministerio: n.ministerio,
    };
  }

  useEffect(() => {
    if (!user) return;

    // Carga inicial
    supabase
      .from("notificacoes")
      .select()
      .eq("usuario_id", user.id)
      .order("criada_em", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setNotifs(data.map(rowToNotif));
      });

    // Realtime: novas notificações chegam sem precisar recarregar
    const ch = supabase
      .channel(`notifs_${user.id}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "notificacoes",
        filter: `usuario_id=eq.${user.id}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        setNotifs((prev) => [rowToNotif(payload.new), ...prev].slice(0, 50));
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "UPDATE",
        schema: "public",
        table: "notificacoes",
        filter: `usuario_id=eq.${user.id}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        setNotifs((prev) => prev.map((n) => n.id === payload.new.id ? rowToNotif(payload.new) : n));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const naoLidas = notifs.filter((n) => !n.lida).length;

  function marcarTodas() {
    const ids = notifs.filter((n) => !n.lida).map((n) => n.id);
    if (ids.length > 0) persistirNotificacoes("PATCH", { ids }).catch(console.error);
    setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  function marcarUma(id: string) {
    persistirNotificacoes("PATCH", { ids: [id] }).catch(console.error);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n));
  }

  function remover(id: string) {
    persistirNotificacoes("DELETE", { ids: [id] }).catch(console.error);
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="relative">
      {/* Sino */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5 text-gray-500" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {naoLidas}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Overlay para fechar */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed sm:absolute right-4 sm:right-0 left-4 sm:left-auto top-16 sm:top-11 z-50 w-auto sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-900" />
                <h3 className="text-sm font-semibold text-gray-800">Notificações</h3>
                {naoLidas > 0 && (
                  <span className="bg-gray-100 text-gray-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {naoLidas} nova{naoLidas > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {naoLidas > 0 && (
                <button
                  onClick={marcarTodas}
                  className="text-[11px] text-gray-800 hover:text-gray-900 flex items-center gap-1 font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                </button>
              )}
            </div>

            {/* Lista */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
              {notifs.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Nenhuma notificação</p>
                </div>
              ) : (
                notifs.map((n) => (
                  <div
                    key={n.id}
                    className={clsx(
                      "flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition group",
                      !n.lida && "bg-gray-50"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {tipoIcon[n.tipo]}
                    </div>
                    <div className="flex-1 min-w-0">
                      {n.link ? (
                        <Link
                          href={n.link}
                          className="block"
                          onClick={() => { marcarUma(n.id); setOpen(false); }}
                        >
                          <p className={clsx("text-[13px] leading-snug", !n.lida ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                            {n.titulo}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                            {n.corpo}
                          </p>
                        </Link>
                      ) : (
                        <>
                          <p className={clsx("text-[13px] leading-snug", !n.lida ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                            {n.titulo}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                            {n.corpo}
                          </p>
                        </>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatarTempo(n.criadaEm)}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      {!n.lida && (
                        <button
                          onClick={() => marcarUma(n.id)}
                          className="w-2 h-2 rounded-full bg-gray-500 hover:bg-gray-900 transition"
                          title="Marcar como lida"
                        />
                      )}
                      <button
                        onClick={() => remover(n.id)}
                        className="opacity-0 group-hover:opacity-100 transition p-0.5 hover:text-red-400 text-gray-300"
                        title="Remover"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifs.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-2.5 text-center">
                <button
                  onClick={() => {
                    const ids = notifs.map((n) => n.id);
                    if (ids.length > 0) persistirNotificacoes("DELETE", { all: true }).catch(console.error);
                    setNotifs([]);
                  }}
                  className="text-[11px] text-gray-400 hover:text-red-400 transition"
                >
                  Limpar todas
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
