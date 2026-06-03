"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Ministerio, Escala, FuncaoEscala, EscalaMusica } from "@/types";
import { EscalasTab } from "@/components/dashboard/EscalasTab";
import { EscalaModal } from "@/components/dashboard/EscalaModal";
import { supabase } from "@/lib/supabase";
import { store, STORE_KEYS } from "@/lib/dataStore";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Music2, Users, Calendar, Star, Settings2, ClipboardCopy, Check, UserCheck, AlertCircle,
} from "lucide-react";
import clsx from "clsx";

// ─── Constantes ───────────────────────────────────────────────────────────────
// Nomes de exibição (o valor do DB permanece igual)
const MIN_LABEL: Record<string, string> = {
  Ensino: "Pregação",
};
const minLabel = (m: string) => MIN_LABEL[m] ?? m;

const showFuncao = (it: { funcao: string; observacao?: string }) => {
  if (it.observacao && ["Cajón","Pandeiro","Violão"].includes(it.observacao)) return it.observacao;
  if (it.funcao === "Bateria") return "Cajón";
  if (it.funcao === "Professora" || it.funcao === "Professor") return "Professor(a)";
  if (it.funcao === "Monitor") return "Monitor(a)";
  if (it.funcao === "Voluntário") return "Voluntário(a)";
  return it.funcao;
};

// Agrupa itens de escala por pessoa, retornando funções concatenadas
function statusConfirmacaoItem(item: { confirmado?: boolean; confirmacaoStatus?: string }) {
  if (item.confirmacaoStatus) return item.confirmacaoStatus;
  return item.confirmado ? "confirmado" : "pendente";
}

function agruparItens(itens: Escala["itens"]) {
  const grupos: { key: string; voluntarioId?: string; voluntarioNome: string; funcoes: string[]; observacao?: string; status: "pendente" | "confirmado" | "recusado" }[] = [];
  const vistos = new Map<string, number>();
  for (const it of itens) {
    const k = it.voluntarioId ?? it.voluntarioNome;
    const funcaoDisplay = showFuncao(it);
    if (vistos.has(k)) {
      const grupo = grupos[vistos.get(k)!];
      grupo.funcoes.push(funcaoDisplay);
      const status = statusConfirmacaoItem(it) as "pendente" | "confirmado" | "recusado";
      if (grupo.status !== "recusado") grupo.status = status === "recusado" ? "recusado" : grupo.status;
      if (grupo.status === "confirmado" && status === "pendente") grupo.status = "pendente";
    } else {
      vistos.set(k, grupos.length);
      const obs = it.observacao && !["Cajón", "Pandeiro", "Violão"].includes(it.observacao) ? it.observacao : undefined;
      grupos.push({
        key: k,
        voluntarioId: it.voluntarioId,
        voluntarioNome: it.voluntarioNome,
        funcoes: [funcaoDisplay],
        observacao: obs,
        status: statusConfirmacaoItem(it) as "pendente" | "confirmado" | "recusado",
      });
    }
  }
  // Ministro sempre primeiro
  return grupos.sort((a, b) => {
    const aMin = a.funcoes.includes("Ministro") ? 0 : 1;
    const bMin = b.funcoes.includes("Ministro") ? 0 : 1;
    return aMin - bMin;
  });
}

function escalaPendenteParaUsuario(escala: Escala, userId?: string | null) {
  if (!userId || !escala.confirmacaoParticipantes) return false;
  const minhasFuncoes = escala.itens.filter((it) => it.voluntarioId === userId);
  return minhasFuncoes.some((it) => statusConfirmacaoItem(it) === "pendente");
}

// Ordem pelo fluxo do culto: Limpeza → Recepcionamento → Louvor → Mídias → Pregação(Ensino) → Infantil → Jovens
const MINISTERIOS_CULTO: Ministerio[] = ["Limpeza", "Recepcionamento", "Louvor", "Mídias", "Ensino", "Infantil", "Jovens"];
const TODOS: Ministerio[] = ["Limpeza", "Recepcionamento", "Louvor", "Mídias", "Ensino", "Infantil", "Jovens"];
const MINISTERIOS_ESCALAS_PRIVADAS = new Set<string>(["Jovens", "Ação Social"]);

const EMOJI: Record<string, string> = {
  Louvor: "🎸", "Mídias": "📹", Recepcionamento: "🤝",
  Infantil: "🧒", Jovens: "⚡", Ensino: "📖", Limpeza: "🧽",
};

const COR_MIN_BADGE: Record<string, string> = {
  Louvor:   "bg-grape-100 text-grape-800",
  "Mídias": "bg-blue-100 text-blue-700",
  Recepcionamento: "bg-orange-100 text-orange-700",
  Infantil: "bg-yellow-100 text-yellow-700",
  Jovens:   "bg-gray-100 text-gray-900",
  Ensino:   "bg-teal-100 text-teal-700",
  Limpeza:  "bg-cyan-100 text-cyan-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      confirmado: (i.confirmado as boolean) ?? false,
      confirmadoEm: (i.confirmado_em as string) ?? undefined,
      confirmacaoStatus: (i.confirmacao_status as "pendente" | "confirmado" | "recusado") ?? ((i.confirmado as boolean) ? "confirmado" : "pendente"),
    })),
    musicas: ((e.escala_musicas as Record<string, unknown>[]) ?? [])
      .sort((a, b) => (a.ordem as number) - (b.ordem as number))
      .map((m) => ({
        musicaId: (m.musica_id as string) ?? "",
        titulo: m.titulo as string,
        artista: m.artista as string,
        tom: (m.tom as string) ?? "",
        bpm: (m.bpm as number) ?? undefined,
        artistaSlug: (m.artista_slug as string) ?? undefined,
        musicaSlug: (m.musica_slug as string) ?? undefined,
      })),
  };
}

function semanaInicio(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function labelMes(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Extrai faixa etária e tema do mês do campo observacoes do Infantil (formato: "4-7 anos|Honra") */
function parseInfantilObs(raw: string | undefined): { ageGroup: string; tema: string } {
  if (!raw) return { ageGroup: "", tema: "" };
  const parts = raw.split("|");
  return { ageGroup: parts[0].trim(), tema: (parts[1] ?? "").trim() };
}

// ─── Seção de músicas (repertório) ───────────────────────────────────────────

function MusicasSection({ musicas }: { musicas: EscalaMusica[] }) {
  const [open, setOpen] = useState(false);
  const [copyLetraIdx, setCopyLetraIdx] = useState<number | null>(null);
  const [copyLetraOk, setCopyLetraOk] = useState<number | null>(null);

  async function copiarLetra(idx: number, m: EscalaMusica) {
    if (copyLetraIdx === idx) return;
    setCopyLetraIdx(idx);
    try {
      const artista = m.artistaSlug ?? m.artista;
      const musica  = m.musicaSlug  ?? m.titulo;
      const res = await fetch(`/api/buscar-letra?artista=${encodeURIComponent(artista)}&musica=${encodeURIComponent(musica)}`);
      const data = await res.json();
      if (data.letra) {
        await navigator.clipboard.writeText(data.letra);
        setCopyLetraOk(idx);
        setTimeout(() => setCopyLetraOk(null), 2500);
      } else {
        alert(data.error ?? "Letra não encontrada.");
      }
    } catch {
      alert("Erro ao buscar a letra.");
    } finally {
      setCopyLetraIdx(null);
    }
  }

  return (
    <div className="px-4 py-3 bg-grape-50/30 border-t border-grape-100/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Music2 className="w-3.5 h-3.5 text-grape-500 shrink-0" />
        <span className="text-xs font-bold text-grape-700">
          Repertório · {musicas.length} música{musicas.length !== 1 ? "s" : ""}
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-grape-300 ml-auto" />
          : <ChevronDown className="w-3.5 h-3.5 text-grape-300 ml-auto" />
        }
      </button>
      {open && (
        <div className="mt-2.5 space-y-1">
          {musicas.map((m, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-white border border-grape-100">
              <span className="text-[10px] font-bold text-grape-300 w-4 text-center shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{m.titulo}</p>
                <p className="text-xs text-gray-400 truncate">{m.artista}</p>
              </div>
              {m.tom && (
                <span className="text-xs font-bold bg-grape-100 text-grape-700 px-2 py-0.5 rounded-full shrink-0">
                  {m.tom}
                </span>
              )}
              {m.bpm && (
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                  {m.bpm}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); copiarLetra(i, m); }}
                className={clsx(
                  "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition whitespace-nowrap shrink-0",
                  copyLetraOk === i
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-grape-300 hover:text-grape-700 hover:bg-grape-50"
                )}
              >
                {copyLetraIdx === i ? (
                  <span className="animate-pulse">...</span>
                ) : copyLetraOk === i ? (
                  <><Check className="w-3 h-3" /> Copiada!</>
                ) : (
                  <><ClipboardCopy className="w-3 h-3" /> Letra</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Seção de um ministério dentro do CultoCard ───────────────────────────────

function ConfirmacaoEscalaPanel({
  escala, userId, onConfirmar, confirmando,
}: {
  escala: Escala;
  userId: string;
  onConfirmar: (escalaId: string, acao: "confirmar" | "recusar") => void;
  confirmando: boolean;
}) {
  const minhasFuncoes = escala.itens.filter((it) => it.voluntarioId === userId);
  if (!escala.confirmacaoParticipantes || minhasFuncoes.length === 0) return null;

  const recusado = minhasFuncoes.some((it) => statusConfirmacaoItem(it) === "recusado");
  const confirmado = !recusado && minhasFuncoes.every((it) => statusConfirmacaoItem(it) === "confirmado");
  return (
    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <UserCheck className={clsx("w-4 h-4", confirmado ? "text-green-600" : recusado ? "text-red-600" : "text-amber-600")} />
        <div>
          <p className="text-xs font-bold text-gray-800">
            {confirmado ? "Participação confirmada" : recusado ? "Você marcou que não consegue" : "Confirme sua participação"}
          </p>
          <p className="text-[11px] text-gray-500">
            {confirmado
              ? "O líder já consegue ver que você confirmou."
              : recusado
                ? "O líder foi avisado e pode ajustar a escala."
                : "Avise pelo sistema se você pode servir nessa data."}
          </p>
        </div>
      </div>
      {confirmado ? (
        <span className="self-start sm:self-auto text-[11px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-1 rounded-full">
          Confirmado
        </span>
      ) : recusado ? (
        <span className="self-start sm:self-auto text-[11px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-1 rounded-full">
          Não consegue
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={confirmando}
            onClick={(e) => {
              e.stopPropagation();
              onConfirmar(escala.id, "recusar");
            }}
            className="text-xs font-bold bg-white text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            Não consigo
          </button>
          <button
            type="button"
            disabled={confirmando}
            onClick={(e) => {
              e.stopPropagation();
              onConfirmar(escala.id, "confirmar");
            }}
            className="text-xs font-bold bg-black text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {confirmando ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      )}
    </div>
  );
}

function MinisterioSection({
  ministerio, escala, userId, isLider, onGerenciar, onConfirmar, confirmando,
}: {
  ministerio: Ministerio;
  escala: Escala;
  userId: string;
  isLider: boolean;
  onGerenciar: () => void;
  onConfirmar: (escalaId: string, acao: "confirmar" | "recusar") => void;
  confirmando: boolean;
}) {
  const [open, setOpen] = useState(true);
  const temMinha = escala.itens.some((it) => it.voluntarioId === userId);

  return (
    <div className={clsx("px-4 py-3", temMinha && "bg-gray-50/40")}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base leading-none">{EMOJI[ministerio] ?? "📋"}</span>
          <span className={clsx("text-[11px] font-bold px-2 py-0.5 rounded-full", COR_MIN_BADGE[ministerio])}>
            {minLabel(ministerio)}
          </span>
          {temMinha && (
            <span className="text-[10px] bg-black text-white font-bold px-1.5 py-0.5 rounded-full">você</span>
          )}
          {ministerio === "Louvor" && escala.observacoes?.match(/^(Equipe \d)/) && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-900 border border-gray-200">
              {escala.observacoes.match(/^(Equipe \d)/)?.[1]}
            </span>
          )}
          {ministerio === "Infantil" && escala.observacoes && (() => {
            const { ageGroup } = parseInfantilObs(escala.observacoes);
            return ageGroup ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                {ageGroup}
              </span>
            ) : null;
          })()}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isLider && (
            <button
              onClick={(e) => { e.stopPropagation(); onGerenciar(); }}
              className="p-1 text-gray-300 hover:text-gray-800 rounded-lg transition"
              title="Gerenciar escala"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          )}
          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
          }
        </div>
      </div>

      {open && (
        <div className="mt-2.5">
          {escala.itens.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Equipe não definida.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {agruparItens(escala.itens).map((grp) => {
                const isMinistro = grp.funcoes.includes("Ministro");
                return (
                <div
                  key={grp.key}
                  className={clsx(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
                    grp.voluntarioId === userId
                      ? "bg-gray-100 border border-gray-200"
                      : "bg-gray-50 border border-gray-100"
                  )}
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0 w-20 truncate">
                    {grp.funcoes.join(" · ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={clsx("text-sm truncate block", isMinistro ? "font-bold text-gray-900" : "font-semibold text-gray-800")}>
                      {grp.voluntarioNome}
                    </span>
                    {grp.observacao && (
                      <span className="text-[10px] text-gray-400 italic truncate block">{grp.observacao}</span>
                    )}
                  </div>
                  {grp.voluntarioId === userId && (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                  )}
                </div>
                );
              })}
            </div>
          )}
          <ConfirmacaoEscalaPanel
            escala={escala}
            userId={userId}
            onConfirmar={onConfirmar}
            confirmando={confirmando}
          />
        </div>
      )}
    </div>
  );
}

// ─── Seção unificada do Infantil (uma só, com sub-seções por faixa etária) ────

function InfantilSection({
  escalas, userId, isLider, onGerenciar, onConfirmar, confirmandoIds,
}: {
  escalas: Escala[];
  userId: string;
  isLider: boolean;
  onGerenciar: () => void;
  onConfirmar: (escalaId: string, acao: "confirmar" | "recusar") => void;
  confirmandoIds: Set<string>;
}) {
  const [open, setOpen] = useState(true);
  const temMinha = escalas.some((e) => e.itens.some((it) => it.voluntarioId === userId));

  return (
    <div className={clsx("px-4 py-3", temMinha && "bg-gray-50/40")}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base leading-none">🧒</span>
          <span className={clsx("text-[11px] font-bold px-2 py-0.5 rounded-full", COR_MIN_BADGE["Infantil"])}>
            Infantil
          </span>
          {temMinha && (
            <span className="text-[10px] bg-black text-white font-bold px-1.5 py-0.5 rounded-full">você</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isLider && (
            <button
              onClick={(e) => { e.stopPropagation(); onGerenciar(); }}
              className="p-1 text-gray-300 hover:text-gray-800 rounded-lg transition"
              title="Gerenciar escala"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          )}
          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
          }
        </div>
      </div>

      {open && (
        <div className="mt-2.5 space-y-2">
          {escalas.map((esc) => {
            const { ageGroup, tema } = parseInfantilObs(esc.observacoes);
            const temMinhaEsc = esc.itens.some((it) => it.voluntarioId === userId);
            return (
              <div
                key={esc.id}
                className={clsx("rounded-xl border overflow-hidden", temMinhaEsc ? "border-gray-200" : "border-gray-100")}
              >
                <div className={clsx("px-3 py-2 flex items-center gap-2 flex-wrap", temMinhaEsc ? "bg-gray-50" : "bg-yellow-50/40")}>
                  {ageGroup && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                      {ageGroup}
                    </span>
                  )}
                  {tema && (
                    <span className="text-[10px] text-orange-600 font-medium italic">Tema: {tema}</span>
                  )}
                </div>
                {esc.itens.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400 italic">Equipe não definida.</p>
                ) : (
                  <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {agruparItens(esc.itens).map((grp) => {
                      const isMinistro = grp.funcoes.includes("Ministro");
                      return (
                      <div
                        key={grp.key}
                        className={clsx(
                          "flex items-start gap-2 px-2.5 py-1.5 rounded-lg",
                          grp.voluntarioId === userId
                            ? "bg-gray-100 border border-gray-200"
                            : "bg-gray-50 border border-gray-100"
                        )}
                      >
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0 w-20 truncate pt-0.5">
                          {grp.funcoes.join(" · ")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={clsx("truncate block", isMinistro ? "text-sm font-bold text-gray-900" : "text-sm font-semibold text-gray-800")}>{grp.voluntarioNome}</span>
                          {grp.observacao && (
                            <span className="text-[10px] text-gray-400 italic truncate block">{grp.observacao}</span>
                          )}
                        </div>
                        {grp.voluntarioId === userId && (
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0 mt-1.5" />
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
                <div className="px-3 pb-2">
                  <ConfirmacaoEscalaPanel
                    escala={esc}
                    userId={userId}
                    onConfirmar={onConfirmar}
                    confirmando={confirmandoIds.has(esc.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Card de um culto (agrupa todos os ministérios) ───────────────────────────

function CultoCard({
  data, escalas, userId, isLider, onGerenciarMinisterio, onConfirmar, confirmandoIds,
}: {
  data: string;
  escalas: Escala[];
  userId: string;
  isLider: boolean;
  onGerenciarMinisterio: (m: Ministerio) => void;
  onConfirmar: (escalaId: string, acao: "confirmar" | "recusar") => void;
  confirmandoIds: Set<string>;
}) {
  const d = new Date(data + "T00:00:00");
  const hojeStr = new Date().toISOString().split("T")[0];
  const isPast = data < hojeStr;
  const isHoje = data === hojeStr;
  const diaSemana = d.getDay(); // 0=dom, 6=sab
  const isDomingo = diaSemana === 0;
  const isSabado  = diaSemana === 6;

  const cultoLabel = escalas[0]?.culto ?? (isDomingo ? "Culto de Domingo" : isSabado ? "Culto de Jovens" : "Culto de Quinta");
  const horario = escalas[0]?.horario ?? "";

  const ministeriosNeste = MINISTERIOS_CULTO.filter((m) => {
    if (m === "Infantil" && !isDomingo) return false;
    if (m === "Jovens"   && !isSabado)  return false;
    return escalas.some((e) => e.ministerio === m);
  });

  const temMinha = escalas.some((e) => e.itens.some((it) => it.voluntarioId === userId));

  return (
    <div className={clsx(
      "rounded-2xl border overflow-hidden shadow-sm",
      isPast && "opacity-55",
      isHoje ? "ring-2 ring-gray-300 border-gray-200" : "border-gray-100",
      isDomingo ? "border-t-4 border-t-gold-400" : isSabado ? "border-t-4 border-t-gray-600" : "border-t-4 border-t-bark-500",
    )}>
      {/* Header */}
      <div className={clsx(
        "px-5 py-4 flex items-center gap-4",
        isDomingo ? "bg-gold-50" : isSabado ? "bg-gray-50" : "bg-bark-50",
      )}>
        <div className={clsx(
          "flex flex-col items-center w-12 shrink-0 rounded-xl px-1 py-1.5 text-center",
          isDomingo ? "bg-gold-100" : isSabado ? "bg-gray-100" : "bg-bark-100",
        )}>
          <span className={clsx("text-[10px] font-bold uppercase leading-none", isDomingo ? "text-gold-700" : isSabado ? "text-gray-900" : "text-bark-700")}>
            {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
          </span>
          <span className={clsx("text-2xl font-bold leading-tight", isDomingo ? "text-gold-900" : isSabado ? "text-black" : "text-bark-900")}>
            {d.getDate()}
          </span>
          <span className={clsx("text-[10px] uppercase leading-none font-medium", isDomingo ? "text-gold-600" : isSabado ? "text-gray-800" : "text-bark-600")}>
            {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-base leading-tight">{cultoLabel}</h3>
            {isHoje && <span className="text-[10px] bg-black text-white font-bold px-2 py-0.5 rounded-full">Hoje</span>}
            {temMinha && <span className="text-[10px] bg-gray-100 text-gray-900 font-bold px-2 py-0.5 rounded-full">Você serve</span>}
          </div>
          {horario && <p className="text-sm text-gray-500 mt-0.5">{horario.slice(0, 5)}</p>}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {ministeriosNeste.map((m) => (
              <span key={m} className="text-[10px] font-medium text-gray-400">{EMOJI[m]}</span>
            ))}
            {ministeriosNeste.length === 0 && (
              <span className="text-xs text-gray-300 italic">Sem escalas publicadas</span>
            )}
          </div>
        </div>
      </div>

      {/* Ministérios */}
      {ministeriosNeste.length > 0 && (
        <div className="bg-white divide-y divide-gray-50">
          {ministeriosNeste.map((min) => {
            if (min === "Infantil") {
              const escalasInfantil = escalas.filter((e) => e.ministerio === "Infantil");
              if (escalasInfantil.length === 0) return null;
              return (
                <InfantilSection
                  key="infantil"
                  escalas={escalasInfantil}
                  userId={userId}
                  isLider={isLider}
                  onGerenciar={() => onGerenciarMinisterio("Infantil")}
                  onConfirmar={onConfirmar}
                  confirmandoIds={confirmandoIds}
                />
              );
            }
            const escalasMin = escalas.filter((e) => e.ministerio === min);
            if (escalasMin.length === 0) return null;
            return escalasMin.map((escala) => (
              <React.Fragment key={escala.id}>
                <MinisterioSection
                  ministerio={min}
                  escala={escala}
                  userId={userId}
                  isLider={isLider}
                  onGerenciar={() => onGerenciarMinisterio(min)}
                  onConfirmar={onConfirmar}
                  confirmando={confirmandoIds.has(escala.id)}
                />
                {min === "Louvor" && (escala.musicas ?? []).length > 0 && (
                  <MusicasSection musicas={escala.musicas ?? []} />
                )}
              </React.Fragment>
            ));
          })}
        </div>
      )}
    </div>
  );
}

// ─── Lista "Meus Serviços" ────────────────────────────────────────────────────

function MinhasEscalasList({
  escalas, userId, onOpen,
}: {
  escalas: Escala[];
  userId: string;
  onOpen: (e: Escala) => void;
}) {
  if (escalas.length === 0)
    return (
      <div className="py-20 text-center text-sm text-gray-400 italic">
        Você não está escalado em nenhum culto futuro.
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {escalas.map((esc) => {
        const d = new Date(esc.data + "T00:00:00");
        const isDomingo = d.getDay() === 0;
        const minhasFuncoes = esc.itens.filter((it) => it.voluntarioId === userId);
        const precisaConfirmar = esc.confirmacaoParticipantes && minhasFuncoes.length > 0;
        const recusado = precisaConfirmar && minhasFuncoes.some((it) => statusConfirmacaoItem(it) === "recusado");
        const confirmado = precisaConfirmar && !recusado && minhasFuncoes.every((it) => statusConfirmacaoItem(it) === "confirmado");
        const pendente = precisaConfirmar && !confirmado && !recusado;
        return (
          <button
            key={esc.id}
            onClick={() => onOpen(esc)}
            className={clsx(
              "flex items-center gap-4 rounded-2xl border px-5 py-4 text-left hover:shadow-md transition",
              pendente ? "bg-amber-50/70 border-amber-200 ring-1 ring-amber-200" : "bg-white border-gray-100",
              isDomingo ? "border-t-2 border-t-gold-400" : "border-t-2 border-t-bark-500"
            )}
          >
            <div className={clsx(
              "flex flex-col items-center w-11 shrink-0 rounded-xl py-1.5 text-center",
              isDomingo ? "bg-gold-50" : "bg-bark-50"
            )}>
              <span className={clsx("text-[10px] font-bold uppercase leading-none", isDomingo ? "text-gold-600" : "text-bark-600")}>
                {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
              </span>
              <span className={clsx("text-2xl font-bold leading-tight", isDomingo ? "text-gold-900" : "text-bark-900")}>
                {d.getDate()}
              </span>
              <span className={clsx("text-[10px] uppercase leading-none font-medium", isDomingo ? "text-gold-500" : "text-bark-500")}>
                {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm">{EMOJI[esc.ministerio] ?? "📋"}</span>
                <span className="text-xs font-semibold text-gray-400">{esc.ministerio}</span>
              </div>
              <p className="text-sm font-bold text-gray-800">{esc.culto}</p>
              <p className="text-xs text-gray-400">{esc.horario.slice(0, 5)}</p>
              {precisaConfirmar && (
                <span className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold mt-1",
                  confirmado ? "bg-green-50 text-green-700" : recusado ? "bg-red-50 text-red-700" : "bg-amber-100 text-amber-800"
                )}>
                  {pendente && <AlertCircle className="w-3 h-3" />}
                  {confirmado ? "Confirmado" : recusado ? "Voce marcou que nao consegue" : "Resposta pendente"}
                </span>
              )}
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              {minhasFuncoes.map((it, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-900 font-bold px-2.5 py-0.5 rounded-full">
                  {showFuncao(it)}
                </span>
              ))}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-200 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EscalasDashboardPage() {
  const searchParams = useSearchParams();
  const { user, isLoading, temPermissao, temPermissaoNoMinisterio } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "pastor";
  const meus = (user?.ministerios ?? []) as Ministerio[];
  const lista = isAdmin ? TODOS : meus;

  // Hidrata instantaneamente do cache — sem tela em branco ao navegar
  const [todasEscalas, setTodasEscalas] = useState<Escala[]>(
    store.get<Escala[]>(STORE_KEYS.ESCALAS_TODAS) ?? []
  );
  const [editing, setEditing] = useState<Ministerio | null>(null);
  const [modalEscala, setModalEscala] = useState<Escala | null>(null);
  const [aba, setAba] = useState<"minhas" | "culto">(() => searchParams.get("aba") === "minhas" ? "minhas" : "culto");
  const [visaoMes, setVisaoMes] = useState(false);
  const [semanaBase, setSemanaBase] = useState(() => semanaInicio(new Date()));
  const [confirmandoIds, setConfirmandoIds] = useState<Set<string>>(new Set());
  const fetchSeqRef = useRef(0);

  const hojeStr = new Date().toISOString().split("T")[0];
  const podeVerEscalaMinisterio = useCallback((ministerio: string) => {
    if (!MINISTERIOS_ESCALAS_PRIVADAS.has(ministerio)) return true;
    return isAdmin || meus.includes(ministerio as Ministerio);
  }, [isAdmin, meus]);

  const escalasVisiveis = useMemo(
    () => todasEscalas.filter((e) => podeVerEscalaMinisterio(e.ministerio)),
    [podeVerEscalaMinisterio, todasEscalas]
  );

  const carregarTodas = useCallback(async () => {
    if (isLoading || !user?.id) return;

    const requestSeq = ++fetchSeqRef.current;
    const { data, error } = await supabase
      .from("escalas")
      .select("*, escala_itens(*), escala_musicas(*)")
      .order("data", { ascending: true });
    // Ignora resposta antiga para evitar sobrescrever estado com snapshot defasado.
    if (requestSeq !== fetchSeqRef.current) return;

    if (error) {
      console.error("Erro ao carregar escalas:", error.message);
      return;
    }

    const parsed = (data ?? []).map(parseEscala);
    setTodasEscalas(parsed);
    store.set(STORE_KEYS.ESCALAS_TODAS, parsed);
  }, [isLoading, user?.id]);

  useAppRefresh(() => { void carregarTodas(); }, [carregarTodas], { minIntervalMs: 2000 });

  useEffect(() => {
    if (isLoading || !user?.id) return;
    void carregarTodas();
  }, [carregarTodas, isLoading, user?.id]);

  useEffect(() => {
    if (searchParams.get("aba") === "minhas") setAba("minhas");
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || !user?.id) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void carregarTodas();
      }, 180);
    };

    const channel = supabase
      .channel("dashboard-escalas-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "escalas" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "escala_itens" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "escala_musicas" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [carregarTodas, isLoading, user?.id]);

  useEffect(() => {
    if (modalEscala && !todasEscalas.some((e) => e.id === modalEscala.id)) {
      setModalEscala(null);
    }
  }, [modalEscala, todasEscalas]);

  const semanaFim = useMemo(() => {
    const f = new Date(semanaBase);
    f.setDate(f.getDate() + 6);
    return f;
  }, [semanaBase]);

  const datasVisiveis = useMemo(() => {
    const set = new Set<string>();
    for (const e of escalasVisiveis) {
      if (!visaoMes) {
        const ini = isoDate(semanaBase);
        const fim = isoDate(semanaFim);
        if (e.data >= ini && e.data <= fim) set.add(e.data);
      } else {
        if (e.data >= hojeStr) set.add(e.data);
      }
    }
    return [...set].sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escalasVisiveis, semanaBase, semanaFim, visaoMes]);

  const escalasPorData = useMemo(() => {
    const map: Record<string, Escala[]> = {};
    for (const e of escalasVisiveis) {
      if (!map[e.data]) map[e.data] = [];
      map[e.data].push(e);
    }
    return map;
  }, [escalasVisiveis]);

  const minhasEscalas = useMemo(() =>
    escalasVisiveis
      .filter((e) => e.itens.some((it) => it.voluntarioId === user?.id) && e.data >= hojeStr)
      .sort((a, b) => a.data.localeCompare(b.data)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [escalasVisiveis, user?.id]
  );

  const pendenciasMinhas = useMemo(
    () => minhasEscalas.filter((e) => escalaPendenteParaUsuario(e, user?.id)).length,
    [minhasEscalas, user?.id]
  );

  const isLider = isAdmin || temPermissao("criar_escala");

  const confirmarEscala = useCallback(async (escalaId: string, acao: "confirmar" | "recusar") => {
    if (!user?.id || confirmandoIds.has(escalaId)) return;
    setConfirmandoIds((prev) => new Set(prev).add(escalaId));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");

      const res = await fetch("/api/escalas/confirmar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ escalaId, acao }),
      });
      const data = await res.json().catch(() => null) as { confirmadoEm?: string; status?: "pendente" | "confirmado" | "recusado"; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível confirmar a escala.");

      const confirmadoEm = data?.confirmadoEm ?? new Date().toISOString();
      const status = data?.status ?? (acao === "recusar" ? "recusado" : "confirmado");
      setTodasEscalas((prev) => {
        const updated = prev.map((escala) => escala.id === escalaId
          ? {
              ...escala,
              itens: escala.itens.map((item) => item.voluntarioId === user.id
                ? { ...item, confirmado: status === "confirmado", confirmadoEm, confirmacaoStatus: status }
                : item),
            }
          : escala);
        store.set(STORE_KEYS.ESCALAS_TODAS, updated);
        return updated;
      });
      setModalEscala((prev) => prev && prev.id === escalaId
        ? {
            ...prev,
            itens: prev.itens.map((item) => item.voluntarioId === user.id
              ? { ...item, confirmado: status === "confirmado", confirmadoEm, confirmacaoStatus: status }
              : item),
          }
        : prev);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível confirmar a escala.");
    } finally {
      setConfirmandoIds((prev) => {
        const next = new Set(prev);
        next.delete(escalaId);
        return next;
      });
    }
  }, [confirmandoIds, user?.id]);

  // ── Modo de edição por ministério ──────────────────────────────────────────
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
          <h1 className="text-base font-bold text-black">
            {EMOJI[editing] ?? "📋"} {editing}
          </h1>
        </div>
        <EscalasTab
          ministerio={editing}
          isLider={isAdmin || temPermissaoNoMinisterio("criar_escala", editing)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-sans font-semibold text-black">Escalas</h1>
          <p className="text-sm text-gray-400 mt-0.5 hidden sm:block">
            {aba === "minhas"
              ? "Todos os cultos em que você vai servir."
              : "Escala completa de todos os ministérios por culto."
            }
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 self-start sm:self-auto">
          <button
            onClick={() => setAba("minhas")}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition",
              aba === "minhas" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Star className="w-3.5 h-3.5" /> Meus Serviços
            {minhasEscalas.length > 0 && (
              <span className={clsx(
                "text-xs font-bold px-1.5 py-0.5 rounded-full",
                aba === "minhas" ? "bg-gray-100 text-gray-900" : "bg-gray-200 text-gray-500"
              )}>
                {minhasEscalas.length}
              </span>
            )}
            {pendenciasMinhas > 0 && (
              <span
                className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shadow-sm"
                title={`${pendenciasMinhas} resposta${pendenciasMinhas > 1 ? "s" : ""} pendente${pendenciasMinhas > 1 ? "s" : ""}`}
                aria-label={`${pendenciasMinhas} resposta${pendenciasMinhas > 1 ? "s" : ""} pendente${pendenciasMinhas > 1 ? "s" : ""}`}
              >
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-40 animate-ping" />
                <AlertCircle className="w-3 h-3" />
              </span>
            )}
          </button>
          <button
            onClick={() => setAba("culto")}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition",
              aba === "culto" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Calendar className="w-3.5 h-3.5" /> Por Culto
          </button>
        </div>
      </div>

      {/* ── Meus Serviços ── */}
      {aba === "minhas" && (
        <MinhasEscalasList
          escalas={minhasEscalas}
          userId={user?.id ?? ""}
          onOpen={setModalEscala}
        />
      )}

      {/* ── Por Culto ── */}
      {aba === "culto" && (
        <>
          {/* Navegador semana / mês */}
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
            <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg text-xs font-bold mr-1 shrink-0">
              <button
                onClick={() => setVisaoMes(false)}
                className={clsx(
                  "px-2.5 py-1 rounded-md transition",
                  !visaoMes ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                Semana
              </button>
              <button
                onClick={() => setVisaoMes(true)}
                className={clsx(
                  "px-2.5 py-1 rounded-md transition",
                  visaoMes ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                Mês
              </button>
            </div>

            {!visaoMes && (
              <>
                <button
                  onClick={() => setSemanaBase(addWeeks(semanaBase, -1))}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center">
                  <p className="text-sm font-semibold text-gray-800">
                    {semanaBase.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    {" — "}
                    {semanaFim.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </p>
                  {isoDate(semanaBase) !== isoDate(semanaInicio(new Date())) && (
                    <button
                      onClick={() => setSemanaBase(semanaInicio(new Date()))}
                      className="text-[11px] text-gray-800 font-semibold hover:underline"
                    >
                      Ir para semana atual
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSemanaBase(addWeeks(semanaBase, 1))}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            {visaoMes && (
              <div className="flex-1 text-center">
                <p className="text-sm font-semibold text-gray-800">Próximas escalas</p>
              </div>
            )}
          </div>

          {/* Cards por culto */}
          {datasVisiveis.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
              <Users className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-400">
                {visaoMes ? "Nenhuma escala publicada ainda." : "Nenhuma escala para esta semana."}
              </p>
              {isLider && (
                <button
                  onClick={() => setEditing(lista[0] ?? "Louvor")}
                  className="text-sm text-gray-800 font-semibold hover:underline"
                >
                  + Criar escala
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {datasVisiveis.reduce<{ mes: string; datas: string[] }[]>((acc, data) => {
                const mes = labelMes(data);
                const last = acc[acc.length - 1];
                if (last && last.mes === mes) { last.datas.push(data); }
                else { acc.push({ mes, datas: [data] }); }
                return acc;
              }, []).map(({ mes, datas }) => (
                <div key={mes} className="flex flex-col gap-4">
                  {visaoMes && (
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 px-1 capitalize">{mes}</p>
                  )}
                  {datas.map((data) => (
                    <CultoCard
                      key={data}
                      data={data}
                      escalas={escalasPorData[data] ?? []}
                      userId={user?.id ?? ""}
                      isLider={isLider}
                      onGerenciarMinisterio={setEditing}
                      onConfirmar={confirmarEscala}
                      confirmandoIds={confirmandoIds}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

        </>
      )}

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
