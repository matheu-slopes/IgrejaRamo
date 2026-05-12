"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, ChevronDown, ExternalLink, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Evento, Ministerio } from "@/types";
import { supabase } from "@/lib/supabase";
import { downloadICS, linkGoogleCalendar, formatarData, diaSemana } from "@/lib/calendarUtils";

export function EventosTab({
  ministerio,
  isLider,
  podeEditar,
}: {
  ministerio: Ministerio;
  isLider: boolean;
  podeEditar: boolean;
}) {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Evento, "id" | "criadoPor">>({
    titulo: "", descricao: "", data: "", horario: "", local: "", publico: false, ministerio,
  });
  const [calendarMenu, setCalendarMenu] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState("");

  useEffect(() => {
    supabase.from("eventos").select().eq("ministerio", ministerio).order("data").then(({ data }) => {
      if (data) setEventos(data.map((e: Record<string, unknown>) => ({
        id: e.id as string,
        titulo: e.titulo as string,
        descricao: (e.descricao as string) ?? undefined,
        data: e.data as string,
        horario: e.horario as string,
        local: e.local as string,
        publico: e.publico as boolean,
        ministerio: e.ministerio as Ministerio,
        criadoPor: (e.criado_por as string) ?? "",
      })));
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministerio]);

  async function criarEvento() {
    if (!form.titulo || !form.data || !form.horario || !form.local) {
      setErroCriar("Preencha todos os campos obrigatórios.");
      return;
    }
    setCriando(true);
    setErroCriar("");
    const { error } = await supabase.from("eventos").insert({
      titulo: form.titulo, descricao: form.descricao || null,
      data: form.data, horario: form.horario, local: form.local,
      publico: form.publico, ministerio,
      criado_por: user?.id,
    });
    setCriando(false);
    if (error) {
      setErroCriar(error.message);
      return;
    }
    // Recarrega a lista após insert (evita depender do SELECT com RLS)
    const { data: lista } = await supabase.from("eventos").select().eq("ministerio", ministerio).order("data");
    if (lista) setEventos(lista.map((e: Record<string, unknown>) => ({
      id: e.id as string, titulo: e.titulo as string,
      descricao: (e.descricao as string) ?? "",
      data: e.data as string, horario: e.horario as string,
      local: e.local as string, publico: e.publico as boolean,
      ministerio: e.ministerio as Ministerio, criadoPor: (e.criado_por as string) ?? "",
    })));
    setForm({ titulo: "", descricao: "", data: "", horario: "", local: "", publico: false, ministerio });
    setShowForm(false);
  }

  async function removerEvento(id: string) {
    await supabase.from("eventos").delete().eq("id", id);
    setEventos((prev) => prev.filter((e) => e.id !== id));
  }

  const hoje = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {eventos.length} evento{eventos.length !== 1 ? "s" : ""}
        </p>
        {isLider && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-gold-500 text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gold-400 transition"
          >
            <Plus className="w-4 h-4" /> Novo evento
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-gold-50 border border-gold-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Novo evento</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Título do evento *"
              className="col-span-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400"
            />
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 bg-white"
            />
            <input
              type="time"
              value={form.horario}
              onChange={(e) => setForm({ ...form, horario: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 bg-white"
            />
            <input
              value={form.local}
              onChange={(e) => setForm({ ...form, local: e.target.value })}
              placeholder="Local *"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400"
            />
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descrição"
              rows={2}
              className="col-span-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 resize-none"
            />
            <label className="col-span-full flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.publico}
                onChange={(e) => setForm({ ...form, publico: e.target.checked })}
                className="accent-black w-4 h-4 rounded"
              />
              Visível na página pública
            </label>
          </div>
          {erroCriar && <p className="text-xs text-red-500 font-medium">{erroCriar}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setErroCriar(""); }}
              className="text-sm text-gray-500 px-4 py-1.5 rounded-xl hover:bg-gray-100 transition"
            >
              Cancelar
            </button>
            <button
              onClick={criarEvento}
              disabled={criando}
              className="text-sm bg-gold-500 text-black font-semibold px-4 py-1.5 rounded-xl hover:bg-gold-400 transition disabled:opacity-50"
            >
              {criando ? "Salvando..." : "Criar evento"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de eventos */}
      <div className="space-y-3">
        {eventos.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm bg-gray-50 rounded-2xl">
            Nenhum evento para este ministério.
          </div>
        )}
        {eventos.map((e) => {
          const passado = e.data < hoje;
          return (
            <div
              key={e.id}
              className={clsx(
                "bg-white rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition",
                passado ? "border-gray-100 opacity-60" : "border-gray-200 hover:border-gold-300 hover:shadow-sm"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 text-center">
                  <p className="text-xs text-gray-400 uppercase">{diaSemana(e.data).slice(0, 3)}</p>
                  <p className="text-2xl font-sans font-bold text-gray-900 leading-none">{e.data.split("-")[2]}</p>
                  <p className="text-xs text-gray-400">{formatarData(e.data).split(" ").slice(1).join(" ")}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{e.titulo}</h3>
                  {e.descricao && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{e.descricao}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-400">
                    <span>🕐 {e.horario}</span>
                    <span>📍 {e.local}</span>
                    {e.publico && <span className="text-green-600 font-medium">• Público</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <button
                    onClick={() => setCalendarMenu(calendarMenu === e.id ? null : e.id)}
                    className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 text-gray-900 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Calendário
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {calendarMenu === e.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setCalendarMenu(null)} />
                      <div className="absolute right-0 top-9 z-20 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden w-52">
                        <button
                          onClick={() => { downloadICS(e); setCalendarMenu(null); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                        >
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="font-medium">Baixar .ics</p>
                            <p className="text-xs text-gray-400">Apple / Outlook / qualquer app</p>
                          </div>
                        </button>
                        <a
                          href={linkGoogleCalendar(e)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setCalendarMenu(null)}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-50"
                        >
                          <ExternalLink className="w-4 h-4 text-blue-500" />
                          <div>
                            <p className="font-medium">Google Calendar</p>
                            <p className="text-xs text-gray-400">Abre no Google Calendar</p>
                          </div>
                        </a>
                      </div>
                    </>
                  )}
                </div>

                {podeEditar && (
                  <button
                    onClick={() => removerEvento(e.id)}
                    className="text-gray-300 hover:text-red-400 transition p-1.5 rounded-lg hover:bg-red-50"
                    title="Remover evento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
