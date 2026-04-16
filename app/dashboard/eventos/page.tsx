"use client";

import { useState } from "react";
import { CalendarDays, Calendar, ExternalLink, ChevronDown, Filter, Plus } from "lucide-react";
import clsx from "clsx";
import { Evento, Ministerio } from "@/types";
import { mockEventos } from "@/lib/mockData";
import { downloadICS, linkGoogleCalendar, formatarData, diaSemana } from "@/lib/calendarUtils";
import { useAuth } from "@/contexts/AuthContext";

const TODOS = "Todos" as const;
type Filtro = "Todos" | Ministerio;

export default function EventosDashboardPage() {
  const { user, temPermissao } = useAuth();
  const isLider = temPermissao("criar_evento");

  const [eventos, setEventos] = useState<Evento[]>(mockEventos);
  const [filtro, setFiltro] = useState<Filtro>(TODOS);
  const [calMenu, setCalMenu] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Evento, "id">>({
    titulo: "", descricao: "", data: "", horario: "", local: "", publico: false, ministerio: user?.ministerios[0],
  });

  const ministeriosFiltro = [TODOS, ...Array.from(new Set(eventos.map((e) => e.ministerio).filter(Boolean)))] as Filtro[];

  const visíveis = filtro === TODOS
    ? eventos
    : eventos.filter((e) => e.ministerio === filtro);

  const hoje = new Date().toISOString().split("T")[0];
  const proximos = visíveis.filter((e) => e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  const passados  = visíveis.filter((e) => e.data < hoje).sort((a, b) => b.data.localeCompare(a.data));

  function criar() {
    if (!form.titulo || !form.data || !form.horario || !form.local) return;
    setEventos((prev) => [{ ...form, id: `ev-${Date.now()}`, criadoPor: user?.id }, ...prev]);
    setForm({ titulo: "", descricao: "", data: "", horario: "", local: "", publico: false, ministerio: user?.ministerios[0] });
    setShowForm(false);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-vine-950">Eventos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Agenda do ministério · integração com calendário</p>
        </div>
        {isLider && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-gold-500 text-vine-950 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-gold-400 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo evento
          </button>
        )}
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <div className="bg-gold-50 border border-gold-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-vine-800">Novo evento</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Título *"
              className="col-span-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400"
            />
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 bg-white" />
            <input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 bg-white" />
            <input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })}
              placeholder="Local *"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400" />
            <select value={form.ministerio ?? ""} onChange={(e) => setForm({ ...form, ministerio: e.target.value as Ministerio || undefined })}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 bg-white">
              <option value="">Nenhum ministério</option>
              {(["Louvor","Mídias","Ensino","Infantil","Ação Social","Jovens","Cantina"] as Ministerio[]).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descrição"
              rows={2}
              className="col-span-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gold-400 resize-none" />
            <label className="col-span-full flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.checked })}
                className="accent-vine-700 w-4 h-4" />
              Visível na página pública
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-1.5 rounded-xl hover:bg-gray-100 transition">Cancelar</button>
            <button onClick={criar} className="text-sm bg-gold-500 text-vine-950 font-semibold px-4 py-1.5 rounded-xl hover:bg-gold-400 transition">
              Criar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        {ministeriosFiltro.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={clsx(
              "text-xs font-medium px-3 py-1.5 rounded-full border transition",
              filtro === f
                ? "bg-vine-800 text-white border-vine-800"
                : "border-gray-200 text-gray-600 hover:border-vine-300"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Próximos */}
      {proximos.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-gray-400 mb-3 font-semibold">Próximos</h2>
          <div className="space-y-3">
            {proximos.map((e) => <EventoCard key={e.id} evento={e} calMenu={calMenu} setCalMenu={setCalMenu} />)}
          </div>
        </section>
      )}

      {/* Passados */}
      {passados.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-gray-400 mb-3 font-semibold">Realizados</h2>
          <div className="space-y-3 opacity-60">
            {passados.map((e) => <EventoCard key={e.id} evento={e} calMenu={calMenu} setCalMenu={setCalMenu} />)}
          </div>
        </section>
      )}

      {visíveis.length === 0 && (
        <div className="py-16 text-center text-gray-400 bg-gray-50 rounded-2xl text-sm">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          Nenhum evento encontrado.
        </div>
      )}
    </div>
  );
}

function EventoCard({
  evento: e, calMenu, setCalMenu,
}: {
  evento: Evento;
  calMenu: string | null;
  setCalMenu: (id: string | null) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gold-200 hover:shadow-sm transition">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 text-center bg-vine-50 rounded-xl py-2">
          <p className="text-[10px] text-vine-400 uppercase font-semibold">{diaSemana(e.data).slice(0, 3)}</p>
          <p className="text-xl font-serif font-bold text-vine-800 leading-tight">{e.data.split("-")[2]}</p>
          <p className="text-[10px] text-gray-400">{formatarData(e.data).split(" ").slice(1, 2).join(" ")}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-800">{e.titulo}</h3>
            {e.ministerio && (
              <span className="text-[10px] bg-grape-50 text-grape-700 font-semibold px-2 py-0.5 rounded-full border border-grape-100">
                {e.ministerio}
              </span>
            )}
            {e.publico && (
              <span className="text-[10px] bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full border border-green-100">
                Público
              </span>
            )}
          </div>
          {e.descricao && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{e.descricao}</p>}
          <p className="text-xs text-gray-400 mt-1">🕐 {e.horario} · 📍 {e.local}</p>
        </div>
      </div>

      {/* Botão calendário */}
      <div className="relative shrink-0">
        <button
          onClick={() => setCalMenu(calMenu === e.id ? null : e.id)}
          className="flex items-center gap-1.5 text-xs font-medium bg-vine-50 text-vine-700 border border-vine-200 px-3 py-1.5 rounded-xl hover:bg-vine-100 transition"
        >
          <Calendar className="w-3.5 h-3.5" /> Adicionar ao calendário
          <ChevronDown className="w-3 h-3" />
        </button>
        {calMenu === e.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setCalMenu(null)} />
            <div className="absolute right-0 top-9 z-20 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden w-56">
              <button
                onClick={() => { downloadICS(e); setCalMenu(null); }}
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
                onClick={() => setCalMenu(null)}
                className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-50"
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
    </div>
  );
}
