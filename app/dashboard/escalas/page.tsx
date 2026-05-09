"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Ministerio, Escala, FuncaoEscala } from "@/types";
import { EscalasTab } from "@/components/dashboard/EscalasTab";
import { EscalaModal } from "@/components/dashboard/EscalaModal";
import { supabase } from "@/lib/supabase";
import { Plus, ChevronRight } from "lucide-react";
import clsx from "clsx";

const TODOS: Ministerio[] = ["Louvor", "Mídias", "Cantina", "Infantil", "Ação Social", "Jovens", "Ensino"];
const EMOJI: Record<string, string> = {
  Louvor: "🎸", "Mídias": "📹", Cantina: "🧹",
  Infantil: "🧒", "Ação Social": "🤝", Jovens: "⚡", Ensino: "📖",
};
const COR_MIN: Record<string, string> = {
  Louvor: "bg-grape-400", "Mídias": "bg-blue-400", Cantina: "bg-orange-400",
  Infantil: "bg-yellow-400", "Ação Social": "bg-green-400", Jovens: "bg-vine-500", Ensino: "bg-teal-400",
};

function parseEscala(e: Record<string, unknown>): Escala {
  return {
    id: e.id as string,
    ministerio: e.ministerio as Ministerio,
    data: e.data as string,
    horario: e.horario as string,
    culto: e.culto as string,
    observacoes: (e.observacoes as string) ?? undefined,
    visivel: e.visivel as boolean,
    confirmacaoParticipantes: (e.confirmacao_participantes as boolean) ?? false,
    criadoPor: (e.criado_por as string) ?? "",
    itens: ((e.escala_itens as Record<string, unknown>[]) ?? []).map((i) => ({
      funcao: i.funcao as FuncaoEscala,
      voluntarioId: (i.voluntario_id as string) ?? undefined,
      voluntarioNome: i.voluntario_nome as string,
      observacao: (i.observacao as string) ?? undefined,
    })),
    musicas: ((e.escala_musicas as Record<string, unknown>[]) ?? [])
      .sort((a, b) => (a.ordem as number) - (b.ordem as number))
      .map((m) => ({
        musicaId: (m.musica_id as string) ?? "",
        titulo: m.titulo as string,
        artista: m.artista as string,
        tom: (m.tom as string) ?? "",
      })),
  };
}

function corCard(culto: string) {
  if (culto.includes("Quinta")) return "border-t-grape-400";
  if (culto.includes("Domingo")) return "border-t-gold-400";
  if (culto.includes("Especial")) return "border-t-blue-400";
  return "border-t-vine-500";
}


// ── Detalhe do dia selecionado ────────────────────────────────────────────────
function DiaSelecionado({ date, escalas, userId, onOpenMinisterio }: {
  date: string; escalas: Escala[]; userId: string;
  onOpenMinisterio: (m: Ministerio) => void;
}) {
  const d = new Date(date + "T00:00:00");
  const label = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-bold text-gray-400 uppercase mb-3 capitalize">{label}</p>
      <div className="flex flex-wrap gap-3">
        {escalas.map((e) => (
          <button key={e.id} onClick={() => onOpenMinisterio(e.ministerio)}
            className="flex items-center gap-3 text-left border border-gray-100 rounded-xl p-3 hover:shadow-md hover:border-vine-200 transition"
          >
            <span className="text-xl">{EMOJI[e.ministerio]}</span>
            <div>
              <p className="text-xs font-semibold text-gray-400">{e.ministerio}</p>
              <p className="text-sm font-bold text-gray-800">{e.culto}</p>
              <p className="text-xs text-gray-400">{e.horario}</p>
            </div>
            {e.itens.some((it) => it.voluntarioId === userId) && (
              <span className="ml-1 text-[10px] bg-vine-100 text-vine-700 font-bold px-2 py-0.5 rounded-full self-start">Você</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function EscalaMiniCard({ esc, userId }: { esc: Escala; userId: string }) {
  const d = esc.data ? new Date(esc.data + "T00:00:00") : null;
  const isPast = esc.data < new Date().toISOString().split("T")[0];
  return (
    <div className={clsx(
      "flex-shrink-0 w-52 rounded-2xl border border-gray-100 border-t-4 bg-white shadow-sm p-4 space-y-3 transition hover:shadow-md",
      corCard(esc.culto),
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
            <p className="text-xs font-semibold text-gray-400">{esc.ministerio}</p>
            <p className="text-sm font-bold text-gray-800 leading-tight">{esc.culto}</p>
            <p className="text-xs text-gray-400 mt-0.5">{esc.horario}</p>
            {esc.visivel
              ? <span className="inline-block text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full mt-1">Publicada</span>
              : <span className="inline-block text-[10px] bg-gray-100 text-gray-400 font-bold px-2 py-0.5 rounded-full mt-1">Rascunho</span>
            }
          </div>
        </div>
      )}
      {esc.itens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {esc.itens.slice(0, 4).map((it, i) => (
            <span
              key={i}
              className={clsx(
                "text-xs px-2 py-0.5 rounded-lg font-medium",
                it.voluntarioId === userId ? "bg-vine-200 text-vine-900" : "bg-gray-100 text-gray-600"
              )}
            >
              {it.voluntarioNome.split(" ")[0]}
            </span>
          ))}
          {esc.itens.length > 4 && (
            <span className="text-xs text-gray-400">+{esc.itens.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── MinistryRow ───────────────────────────────────────────────────────────────
function MinistryRow({
  ministerio, escalas, isLider, userId, onOpen,
}: {
  ministerio: Ministerio; escalas: Escala[]; isLider: boolean;
  userId: string; onOpen: (m: Ministerio) => void;
}) {
  const hojeStr = new Date().toISOString().split("T")[0];
  const proximas = escalas.filter((e) => e.data >= hojeStr);
  const passadas = escalas.filter((e) => e.data < hojeStr).reverse();

  return (
    <div className="flex border-b border-gray-100 last:border-0">
      {/* Nome do ministério */}
      <button
        onClick={() => onOpen(ministerio)}
        className="w-48 shrink-0 flex items-center gap-3 px-5 py-5 text-left hover:bg-gray-50 transition group"
      >
        <span className="text-2xl leading-none">{EMOJI[ministerio] ?? "📋"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate group-hover:text-vine-700 transition">{ministerio}</p>
          <p className="text-xs text-gray-400 mt-0.5">{escalas.length} escala{escalas.length !== 1 ? "s" : ""}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-vine-500 shrink-0 transition" />
      </button>

      {/* Divisor vertical */}
      <div className="w-px bg-gray-100 my-4 shrink-0" />

      {/* Escalas em scroll horizontal */}
      <div className="flex-1 min-w-0 px-5 py-4 flex items-center">
        {escalas.length === 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-300 italic">Sem escalas criadas.</p>
            {isLider && (
              <button
                onClick={() => onOpen(ministerio)}
                className="flex items-center gap-1.5 text-sm text-vine-600 hover:text-vine-800 font-semibold border border-vine-200 hover:border-vine-400 px-3 py-2 rounded-xl transition"
              >
                <Plus className="w-4 h-4" /> Criar
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-200 w-full">
            {proximas.map((esc) => (
              <EscalaMiniCard key={esc.id} esc={esc} userId={userId} />
            ))}
            {proximas.length > 0 && passadas.length > 0 && (
              <div className="flex items-center px-2 shrink-0">
                <div className="h-20 w-px bg-gray-200" />
              </div>
            )}
            {passadas.map((esc) => (
              <EscalaMiniCard key={esc.id} esc={esc} userId={userId} />
            ))}
            {isLider && (
              <button
                onClick={() => onOpen(ministerio)}
                className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 w-20 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-vine-300 hover:text-vine-600 transition min-h-[6rem]"
              >
                <Plus className="w-5 h-5" />
                <span className="text-xs font-semibold">Nova</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tabela por ministério × dia da semana ────────────────────────────────────
const DIAS_SEMANA = [
  { label: "Segunda", dow: 1 },
  { label: "Terça",   dow: 2 },
  { label: "Quinta",  dow: 4 },
  { label: "Sábado",  dow: 6 },
  { label: "Domingo", dow: 0 },
];

function corEscalaLeft(culto: string) {
  if (culto.includes("Quinta"))   return "border-l-grape-400";
  if (culto.includes("Domingo"))  return "border-l-gold-400";
  if (culto.includes("Especial")) return "border-l-blue-400";
  return "border-l-vine-500";
}

function TabelaEscalas({
  todasEscalas, lista, userId, isLider, onOpen, onOpenEscala,
}: {
  todasEscalas: Escala[]; lista: Ministerio[]; userId: string; isLider: boolean;
  onOpen: (m: Ministerio) => void; onOpenEscala: (esc: Escala) => void;
}) {
  const hojeStr = new Date().toISOString().split("T")[0];

  const porMinDow = useMemo(() => {
    const map: Partial<Record<Ministerio, Record<number, Escala[]>>> = {};
    for (const e of todasEscalas) {
      if (e.data < hojeStr) continue;
      const dow = new Date(e.data + "T00:00:00").getDay();
      if (!map[e.ministerio]) map[e.ministerio] = { 0: [], 1: [], 2: [], 4: [], 6: [] };
      map[e.ministerio]![dow]?.push(e);
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasEscalas]);

  // ── Versão Mobile: cards por ministério ──────────────────────────────────
  const MobileView = () => (
    <div className="space-y-3 md:hidden">
      {lista.map((m) => {
        const escalasMin = todasEscalas
          .filter((e) => e.ministerio === m && e.data >= hojeStr)
          .sort((a, b) => a.data.localeCompare(b.data));
        return (
          <div key={m} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header do ministério */}
            <button
              onClick={() => onOpen(m)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 text-left hover:bg-gray-50 transition active:bg-gray-100"
            >
              <span className="text-2xl leading-none">{EMOJI[m] ?? "📋"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{m}</p>
                <p className="text-xs text-gray-400">{escalasMin.length} escala{escalasMin.length !== 1 ? "s" : ""} próxima{escalasMin.length !== 1 ? "s" : ""}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
            {/* Escalas */}
            {escalasMin.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-300 italic">
                {isLider
                  ? <button onClick={() => onOpen(m)} className="text-vine-500 font-semibold text-sm">+ Criar escala</button>
                  : "Sem escalas criadas."}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {escalasMin.slice(0, 3).map((esc) => {
                  const d = new Date(esc.data + "T00:00:00");
                  const temMinha = esc.itens.some((it) => it.voluntarioId === userId);
                  return (
                    <button key={esc.id} onClick={() => onOpenEscala(esc)}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition active:bg-gray-50",
                        temMinha && "bg-vine-50"
                      )}
                    >
                      <div className={clsx("w-1 self-stretch rounded-full shrink-0", corEscalaLeft(esc.culto).replace("border-l-", "bg-"))} />
                      <div className="w-10 text-center shrink-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">
                          {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                        </p>
                        <p className="text-xl font-bold text-gray-800 leading-tight">{d.getDate()}</p>
                        <p className="text-[10px] text-gray-400 uppercase leading-none">
                          {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800">{esc.culto}</p>
                        <p className="text-xs text-gray-400">{esc.horario}</p>
                        {esc.itens.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {esc.itens.slice(0, 3).map((it, i) => (
                              <span key={i} className={clsx(
                                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                it.voluntarioId === userId ? "bg-vine-200 text-vine-900" : "bg-gray-100 text-gray-500"
                              )}>{it.voluntarioNome.split(" ")[0]}</span>
                            ))}
                            {esc.itens.length > 3 && <span className="text-[10px] text-gray-300">+{esc.itens.length - 3}</span>}
                          </div>
                        )}
                      </div>
                      {temMinha && <span className="w-2 h-2 rounded-full bg-vine-400 shrink-0" />}
                      <ChevronRight className="w-4 h-4 text-gray-200 shrink-0" />
                    </button>
                  );
                })}
                {escalasMin.length > 3 && (
                  <button onClick={() => onOpen(m)} className="w-full px-4 py-2.5 text-xs text-vine-600 font-semibold text-center hover:bg-gray-50 transition">
                    Ver mais {escalasMin.length - 3} escalas →
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const COL_MIN = "w-36 shrink-0";
  const COL_DIA = "flex-1 min-w-0";

  // ── Versão Desktop: tabela ────────────────────────────────────────────────
  return (
    <>
      <MobileView />
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex border-b border-gray-100">
          <div className={clsx(COL_MIN, "px-4 py-3 border-r border-gray-100 shrink-0")} />
          {DIAS_SEMANA.map((dia) => (
            <div key={dia.dow} className={clsx(COL_DIA, "px-3 py-3 text-center border-r border-gray-100 last:border-r-0")}>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{dia.label}</p>
            </div>
          ))}
        </div>
        {lista.map((m) => {
          const dowMap = porMinDow[m] ?? { 0: [], 1: [], 2: [], 4: [], 6: [] };
          return (
            <div key={m} className="flex border-b border-gray-100 last:border-0">
              <button
                onClick={() => onOpen(m)}
                className={clsx(COL_MIN, "flex items-center gap-2.5 px-4 py-4 border-r border-gray-100 hover:bg-gray-50 transition group text-left shrink-0")}
              >
                <span className="text-xl leading-none">{EMOJI[m] ?? "📋"}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-700 truncate group-hover:text-vine-700 transition">{m}</p>
                  <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-vine-400 mt-0.5 transition" />
                </div>
              </button>
              {DIAS_SEMANA.map((dia) => {
                const escalas = (dowMap[dia.dow] ?? []).sort((a, b) => a.data.localeCompare(b.data));
                return (
                  <div key={dia.dow} className={clsx(COL_DIA, "p-2 space-y-1.5 border-r border-gray-100 last:border-r-0 min-h-[60px]")}>
                    {escalas.length === 0 && (
                      <div className="flex items-center justify-center h-full min-h-[44px]">
                        {isLider ? (
                          <button onClick={() => onOpen(m)}
                            className="w-full h-full flex items-center justify-center rounded-lg border border-dashed border-gray-150 text-gray-200 hover:border-vine-300 hover:text-vine-400 transition min-h-[44px]">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-gray-150 text-sm select-none">—</span>
                        )}
                      </div>
                    )}
                    {escalas.map((esc) => {
                      const d = new Date(esc.data + "T00:00:00");
                      const temMinha = esc.itens.some((it) => it.voluntarioId === userId);
                      return (
                        <button key={esc.id} onClick={() => onOpenEscala(esc)}
                          className={clsx(
                            "w-full text-left rounded-lg border-l-4 px-2 py-1.5 space-y-1 transition hover:shadow-sm",
                            corEscalaLeft(esc.culto),
                            "bg-gray-50 hover:bg-white",
                            temMinha && "ring-1 ring-vine-300",
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-semibold text-gray-400">
                              {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
                            </span>
                            {temMinha && <span className="w-1.5 h-1.5 rounded-full bg-vine-400 shrink-0" />}
                          </div>
                          <p className="text-[11px] font-bold text-gray-700 leading-tight">{esc.culto}</p>
                          {esc.itens.length > 0 && (
                            <div className="flex flex-wrap gap-0.5">
                              {esc.itens.slice(0, 2).map((it, i) => (
                                <span key={i} className={clsx(
                                  "text-[9px] px-1 py-0.5 rounded font-medium leading-none",
                                  it.voluntarioId === userId ? "bg-vine-200 text-vine-900" : "bg-gray-200 text-gray-500"
                                )}>
                                  {it.voluntarioNome.split(" ")[0]}
                                </span>
                              ))}
                              {esc.itens.length > 2 && (
                                <span className="text-[9px] text-gray-300">+{esc.itens.length - 2}</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Barra de datas (fina) ─────────────────────────────────────────────────────
function BarraDatas({
  todasEscalas, userId, onDayClick,
}: {
  todasEscalas: Escala[]; userId: string; onDayClick: (date: string) => void;
}) {
  const hojeStr = new Date().toISOString().split("T")[0];
  const datasUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const e of todasEscalas) if (e.data >= hojeStr) set.add(e.data);
    return [...set].sort().slice(0, 20);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasEscalas]);

  if (datasUnicas.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
      {datasUnicas.map((iso) => {
        const d = new Date(iso + "T00:00:00");
        const ministeriosDia = [...new Set(todasEscalas.filter((e) => e.data === iso).map((e) => e.ministerio))];
        const temMinha = todasEscalas.some((e) => e.data === iso && e.itens.some((it) => it.voluntarioId === userId));
        return (
          <button key={iso} onClick={() => onDayClick(iso)}
            className={clsx(
              "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition text-[11px] font-semibold",
              temMinha ? "bg-vine-50 border-vine-200 text-vine-700 hover:border-vine-400" : "bg-white border-gray-100 text-gray-500 hover:border-gray-300"
            )}>
            {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").toUpperCase()}{" "}
            {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
            <div className="flex gap-0.5">
              {ministeriosDia.map((m) => (
                <span key={m} title={m} className={clsx("w-1 h-1 rounded-full", COR_MIN[m] ?? "bg-gray-300")} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Aba Minhas Escalas ────────────────────────────────────────────────────────
function MinhasEscalasList({
  escalas, userId, onOpenEscala,
}: {
  escalas: Escala[]; userId: string; onOpenEscala: (esc: Escala) => void;
}) {
  if (escalas.length === 0)
    return (
      <div className="py-16 text-center text-sm text-gray-400 italic">
        Você não está escalado em nenhuma escala futura.
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      {escalas.map((esc) => {
        const d = new Date(esc.data + "T00:00:00");
        return (
          <button key={esc.id} onClick={() => onOpenEscala(esc)}
            className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-5 py-4 text-left hover:shadow-md hover:border-vine-200 transition"
          >
            {/* Data */}
            <div className="text-center w-10 shrink-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">
                {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
              </p>
              <p className="text-2xl font-bold text-gray-800 leading-tight">{d.getDate()}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">
                {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
              </p>
            </div>
            {/* Separador */}
            <div className="w-px h-10 bg-gray-100 shrink-0" />
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm">{EMOJI[esc.ministerio]}</span>
                <p className="text-xs font-semibold text-gray-400">{esc.ministerio}</p>
              </div>
              <p className="text-sm font-bold text-gray-800">{esc.culto}</p>
              <p className="text-xs text-gray-400">{esc.horario}</p>
            </div>
            {/* Minha função */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {esc.itens
                .filter((it) => it.voluntarioId === userId)
                .map((it, i) => (
                  <span key={i} className="text-xs bg-vine-100 text-vine-700 font-bold px-2.5 py-0.5 rounded-full">
                    {it.funcao}
                  </span>
                ))}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function EscalasDashboardPage() {
  const { user, temPermissao } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "pastor";
  const meus = (user?.ministerios ?? []) as Ministerio[];
  const lista = isAdmin ? TODOS : meus;
  const [editing, setEditing] = useState<Ministerio | null>(null);
  const [todasEscalas, setTodasEscalas] = useState<Escala[]>([]);
  const [modalEscala, setModalEscala] = useState<Escala | null>(null);
  const [aba, setAba] = useState<"minhas" | "culto">("culto");

  async function carregarTodas() {
    const { data } = await supabase
      .from("escalas")
      .select("*, escala_itens(*), escala_musicas(*)")
      .order("data", { ascending: true });
    if (data) setTodasEscalas(data.map(parseEscala));
  }

  useEffect(() => { carregarTodas(); }, []);

  const hojeStr = new Date().toISOString().split("T")[0];

  const minhasEscalas = useMemo(() =>
    todasEscalas
      .filter((e) => e.itens.some((it) => it.voluntarioId === user?.id) && e.data >= hojeStr)
      .sort((a, b) => a.data.localeCompare(b.data)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todasEscalas, user?.id]
  );

  const porMinisterio = useMemo(() => {
    const map: Partial<Record<Ministerio, Escala[]>> = {};
    for (const e of todasEscalas) {
      if (!map[e.ministerio]) map[e.ministerio] = [];
      map[e.ministerio]!.push(e);
    }
    return map;
  }, [todasEscalas]);

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
            onClick={() => { setEditing(null); carregarTodas(); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-semibold transition"
          >
            ← Voltar
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-base font-bold text-vine-950">
            {EMOJI[editing]} {editing}
          </h1>
        </div>
        <EscalasTab ministerio={editing} isLider={temPermissao("criar_escala")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* Cabeçalho + abas */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-sans font-semibold text-vine-950">Escalas</h1>
          <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">
            {aba === "minhas" ? "Todas as escalas em que você participa." : "Calendário e escalas de todos os ministérios."}
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 self-start sm:self-auto">
          <button
            onClick={() => setAba("minhas")}
            className={clsx(
              "flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-sm font-semibold transition",
              aba === "minhas" ? "bg-white shadow-sm text-vine-700" : "text-gray-500 hover:text-gray-700"
            )}
          >
            ☆ Minhas
            {minhasEscalas.length > 0 && (
              <span className={clsx("text-xs font-bold px-1.5 py-0.5 rounded-full", aba === "minhas" ? "bg-vine-100 text-vine-700" : "bg-gray-200 text-gray-500")}>
                {minhasEscalas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setAba("culto")}
            className={clsx(
              "flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-sm font-semibold transition",
              aba === "culto" ? "bg-white shadow-sm text-vine-700" : "text-gray-500 hover:text-gray-700"
            )}
          >
            ▼ Do Culto
          </button>
        </div>
      </div>

      {aba === "minhas" ? (
        <MinhasEscalasList
          escalas={minhasEscalas}
          userId={user?.id ?? ""}
          onOpenEscala={setModalEscala}
        />
      ) : (
        <>
          {/* Tabela por dia da semana */}
          <TabelaEscalas
            todasEscalas={todasEscalas}
            lista={lista}
            userId={user?.id ?? ""}
            isLider={temPermissao("criar_escala")}
            onOpen={setEditing}
            onOpenEscala={setModalEscala}
          />
        </>
      )}

      {/* Modal de escala */}
      {modalEscala && (
        <EscalaModal
          escala={modalEscala}
          podeEditar={
            isAdmin ||
            (temPermissao("criar_escala") && lista.includes(modalEscala.ministerio))
          }
          onClose={() => setModalEscala(null)}
          onUpdate={(updated) => {
            setTodasEscalas((prev) => prev.map((e) => e.id === updated.id ? updated : e));
            setModalEscala(updated);
          }}
          onDelete={(id) => {
            setTodasEscalas((prev) => prev.filter((e) => e.id !== id));
            setModalEscala(null);
          }}
        />
      )}
    </div>
  );
}
