"use client";

import { useState } from "react";
import { Bell, X, CheckCheck, CalendarDays, MessageSquare, AlertCircle, Users } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { TipoNotificacao } from "@/types";
import { useNotifications } from "@/contexts/NotificationsContext";

const tipoIcon: Record<TipoNotificacao, React.ReactNode> = {
  escala: <CalendarDays className="w-4 h-4 text-gray-400" />,
  evento: <CalendarDays className="w-4 h-4 text-gold-500" />,
  aviso: <AlertCircle className="w-4 h-4 text-amber-500" />,
  ministerio: <MessageSquare className="w-4 h-4 text-grape-400" />,
  sistema: <Users className="w-4 h-4 text-gray-400" />,
};

function formatarTempo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diff / 60000));
  if (min < 60) return `${min}m atras`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atras`;
  return `${Math.floor(h / 24)}d atras`;
}

export default function NotificationBell() {
  const { notificacoes, counts, marcarUma, marcarTodas, remover, limparTodas } = useNotifications();
  const [open, setOpen] = useState(false);
  const naoLidas = counts.total;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition"
        aria-label="Notificacoes"
      >
        <Bell className="w-5 h-5 text-gray-500" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed sm:absolute right-4 sm:right-0 left-4 sm:left-auto top-16 sm:top-11 z-50 w-auto sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-4 h-4 text-gray-900 shrink-0" />
                <h3 className="text-sm font-semibold text-gray-800">Notificacoes</h3>
                {naoLidas > 0 && (
                  <span className="bg-gray-100 text-gray-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {naoLidas > 99 ? "99+" : naoLidas}
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

            <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
              {notificacoes.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Nenhuma notificacao</p>
                </div>
              ) : (
                notificacoes.map((n) => (
                  <div
                    key={n.id}
                    className={clsx(
                      "flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition group",
                      !n.lida && "bg-gray-50"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">{tipoIcon[n.tipo]}</div>
                    <div className="flex-1 min-w-0">
                      {n.link ? (
                        <Link href={n.link} className="block" onClick={() => { marcarUma(n.id); setOpen(false); }}>
                          <p className={clsx("text-[13px] leading-snug", !n.lida ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                            {n.titulo}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{n.corpo}</p>
                        </Link>
                      ) : (
                        <>
                          <p className={clsx("text-[13px] leading-snug", !n.lida ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                            {n.titulo}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{n.corpo}</p>
                        </>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{formatarTempo(n.criadaEm)}</p>
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

            {notificacoes.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-2.5 text-center">
                <button onClick={limparTodas} className="text-[11px] text-gray-400 hover:text-red-400 transition">
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
