"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Ministerio, Evento } from "@/types";
import { EventosTab } from "@/components/dashboard/EventosTab";
import { supabase } from "@/lib/supabase";
import { store, STORE_KEYS } from "@/lib/dataStore";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { userMinisterios } from "@/lib/userMinistries";
import { Plus, ChevronRight, MapPin } from "lucide-react";
import clsx from "clsx";

const TODOS: Ministerio[] = ["Louvor", "Mídias", "Recepcionamento", "Infantil", "Ação Social", "Jovens", "Ensino"];
const EMOJI: Record<string, string> = {
  Louvor: "🎸", "Mídias": "📹", Recepcionamento: "🤝",
  Infantil: "🧒", "Ação Social": "🤝", Jovens: "⚡", Ensino: "📖",
};

function EventoMiniCard({ ev }: { ev: Evento }) {
  const d = ev.data ? new Date(ev.data + "T00:00:00") : null;
  const isPast = ev.data && ev.data < new Date().toISOString().split("T")[0];
  return (
    <div className={clsx(
      "flex-shrink-0 w-52 rounded-2xl border border-gray-100 border-t-4 border-t-gold-400 bg-white shadow-sm p-4 space-y-2.5 transition hover:shadow-md",
      isPast && "opacity-50"
    )}>
      {d && (
        <div className="flex items-center gap-3">
          <div className="text-center w-10 shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">
              {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
            </p>
            <p className="text-3xl font-bold text-gray-800 leading-tight">{d.getDate()}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">
              {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
            </p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 leading-tight line-clamp-2">{ev.titulo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{ev.horario}</p>
            {ev.publico
              ? <span className="inline-block text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full mt-1">Público</span>
              : <span className="inline-block text-[10px] bg-gray-100 text-gray-400 font-bold px-2 py-0.5 rounded-full mt-1">Interno</span>
            }
          </div>
        </div>
      )}
      {ev.local && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{ev.local}</span>
        </div>
      )}
    </div>
  );
}

// ── Linha de ministério usando dados do store central ─────────────────────────

function MinistryEventRow({
  ministerio, isLider, podeEditar, onOpen, allEventos,
}: {
  ministerio: Ministerio; isLider: boolean; podeEditar: boolean;
  onOpen: (m: Ministerio) => void;
  allEventos: Evento[];
}) {
  const hojeStr = new Date().toISOString().split("T")[0];
  const eventos = allEventos.filter((e) => e.ministerio === ministerio);
  const proximos = eventos.filter((e) => e.data && e.data >= hojeStr);
  const passados = eventos.filter((e) => e.data && e.data < hojeStr).reverse();

  return (
    <>
      {/* ── Mobile: card vertical ── */}
      <div className="md:hidden flex border-b border-gray-100 last:border-0">
        <div className="w-full">
          <button
            onClick={() => onOpen(ministerio)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition"
          >
            <span className="text-2xl leading-none">{EMOJI[ministerio] ?? "📋"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">{ministerio}</p>
              <p className="text-xs text-gray-400">{eventos.length} evento{eventos.length !== 1 ? "s" : ""}</p>
            </div>
            {isLider && (
              <span className="text-xs bg-gray-50 text-gray-800 font-semibold px-2.5 py-1 rounded-full border border-gray-200">
                + Novo
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </button>
          {proximos.length > 0 && (
            <div className="px-4 pb-3 space-y-2">
              {proximos.slice(0, 2).map((ev) => {
                const d = ev.data ? new Date(ev.data + "T00:00:00") : null;
                return (
                  <div key={ev.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    {d && (
                      <div className="text-center w-9 shrink-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</p>
                        <p className="text-lg font-bold text-gray-800 leading-tight">{d.getDate()}</p>
                        <p className="text-[10px] text-gray-400 uppercase leading-none">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</p>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{ev.titulo}</p>
                      <p className="text-xs text-gray-400">{ev.horario}{ev.local && ` · ${ev.local}`}</p>
                    </div>
                    {ev.publico
                      ? <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full shrink-0">Público</span>
                      : <span className="text-[10px] bg-gray-100 text-gray-400 font-bold px-1.5 py-0.5 rounded-full shrink-0">Interno</span>
                    }
                  </div>
                );
              })}
              {proximos.length > 2 && (
                <button onClick={() => onOpen(ministerio)} className="w-full text-center text-xs text-gray-800 font-semibold py-1">
                  Ver mais {proximos.length - 2} eventos →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop: scroll horizontal ── */}
      <div className="hidden md:flex border-b border-gray-100 last:border-0">
        <button
          onClick={() => onOpen(ministerio)}
          className="w-48 shrink-0 flex items-center gap-3 px-5 py-5 text-left hover:bg-gray-50 transition group"
        >
          <span className="text-2xl leading-none">{EMOJI[ministerio] ?? "📋"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate group-hover:text-gray-900 transition">{ministerio}</p>
            <p className="text-xs text-gray-400 mt-0.5">{eventos.length} evento{eventos.length !== 1 ? "s" : ""}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 shrink-0 transition" />
        </button>
        <div className="w-px bg-gray-100 my-4 shrink-0" />
        <div className="flex-1 min-w-0 px-5 py-4 flex items-center">
          {eventos.length === 0 ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-300 italic">Sem eventos criados.</p>
              {isLider && (
                <button onClick={() => onOpen(ministerio)} className="flex items-center gap-1.5 text-sm text-gray-800 hover:text-gray-900 font-semibold border border-gray-200 hover:border-gray-400 px-3 py-2 rounded-xl transition">
                  <Plus className="w-4 h-4" /> Criar
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-200 w-full">
              {proximos.map((ev) => <EventoMiniCard key={ev.id} ev={ev} />)}
              {proximos.length > 0 && passados.length > 0 && (
                <div className="flex items-center px-2 shrink-0"><div className="h-20 w-px bg-gray-200" /></div>
              )}
              {passados.map((ev) => <EventoMiniCard key={ev.id} ev={ev} />)}
              {isLider && (
                <button onClick={() => onOpen(ministerio)} className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 w-20 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-800 transition min-h-[6rem]">
                  <Plus className="w-5 h-5" />
                  <span className="text-xs font-semibold">Novo</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function EventosDashboardPage() {
  const { user, temPermissao } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "pastor";
  const meus = userMinisterios(user);
  const lista = isAdmin ? TODOS : meus;
  const [editing, setEditing] = useState<Ministerio | null>(null);

  // Hidrata do cache instantaneamente — sem tela em branco
  const [allEventos, setAllEventos] = useState<Evento[]>(
    store.get<Evento[]>(STORE_KEYS.EVENTOS_TODOS) ?? []
  );

  function parseEvento(e: Record<string, unknown>): Evento {
    return {
      id: e.id as string,
      titulo: e.titulo as string,
      descricao: (e.descricao as string) ?? undefined,
      data: e.data as string,
      horario: e.horario as string,
      local: e.local as string,
      publico: e.publico as boolean,
      ministerio: e.ministerio as Ministerio,
      criadoPor: (e.criado_por as string) ?? "",
    };
  }

  async function carregarTodos() {
    const { data } = await supabase
      .from("eventos")
      .select()
      .order("data", { ascending: true });
    if (data) {
      const parsed = data.map(parseEvento);
      setAllEventos(parsed);
      store.set(STORE_KEYS.EVENTOS_TODOS, parsed);
    }
  }

  useAppRefresh(() => { void carregarTodos(); }, [], { minIntervalMs: 2000 });

  // ── Realtime: 1 canal para todos os eventos ────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("eventos-page-realtime")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "eventos" }, (payload: any) => {
        if (payload.eventType === "INSERT") {
          setAllEventos((prev) => {
            const novo = parseEvento(payload.new);
            const next = [...prev, novo].sort((a, b) => a.data.localeCompare(b.data));
            store.set(STORE_KEYS.EVENTOS_TODOS, next);
            return next;
          });
        } else if (payload.eventType === "UPDATE") {
          setAllEventos((prev) => {
            const next = prev.map((e) => e.id === payload.new.id ? parseEvento(payload.new) : e);
            store.set(STORE_KEYS.EVENTOS_TODOS, next);
            return next;
          });
        } else if (payload.eventType === "DELETE") {
          setAllEventos((prev) => {
            const next = prev.filter((e) => e.id !== payload.old?.id);
            store.set(STORE_KEYS.EVENTOS_TODOS, next);
            return next;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lista.length === 0)
    return (
      <div className="py-24 text-center text-sm text-gray-400">
        Você não pertence a nenhum ministério.
      </div>
    );

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setEditing(null); void carregarTodos(); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-semibold transition"
          >
            ← Voltar
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-base font-bold text-black">
            {EMOJI[editing]} {editing}
          </h1>
        </div>
        <EventosTab
          ministerio={editing}
          isLider={temPermissao("criar_evento")}
          podeEditar={temPermissao("editar_evento")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl md:text-2xl font-sans font-semibold text-black">Eventos</h1>
        <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">Clique num ministério para gerenciar os eventos.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {lista.map((m) => (
          <MinistryEventRow
            key={m}
            ministerio={m}
            isLider={temPermissao("criar_evento")}
            podeEditar={temPermissao("editar_evento")}
            onOpen={setEditing}
            allEventos={allEventos}
          />
        ))}
      </div>
    </div>
  );
}
