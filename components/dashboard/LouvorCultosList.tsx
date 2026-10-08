"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, LoaderCircle, Music2, Play, Plus, Users } from "lucide-react";
import clsx from "clsx";
import type { Escala, EscalaMusica } from "@/types";
import { prioridadeParticipanteLouvor } from "@/lib/louvorSchedule";

type Props = {
  escalas: Escala[];
  hoje: string;
  usuarioId?: string;
  podeVerConfirmacoes: boolean;
  statusStudio: Record<string, string>;
  onDetalhes: (escala: Escala) => void;
  onAdicionarMusica?: (escala: Escala) => void;
  onEnsaiar?: (escala: Escala, musica: EscalaMusica) => void;
  onPreparar?: (escala: Escala, musica: EscalaMusica) => void;
};

export function LouvorCultosList({ escalas, hoje, usuarioId, podeVerConfirmacoes, statusStudio, onDetalhes, onAdicionarMusica, onEnsaiar, onPreparar }: Props) {
  const [expandido, setExpandido] = useState<string | null | undefined>(undefined);
  const aberto = expandido === undefined ? (escalas.find((escala) => escala.data >= hoje) ?? escalas[0])?.id : expandido;

  return <div className="space-y-3">
    {escalas.map((escala) => {
      const data = new Date(`${escala.data}T12:00:00`);
      const isAberto = aberto === escala.id;
      const equipe = escala.observacoes?.match(/^(Equipe \d+)/)?.[1];
      const pessoas = [...new Set(escala.itens.map((item) => item.voluntarioId || item.voluntarioNome))].map((id) => {
        const itens = escala.itens.filter((item) => (item.voluntarioId || item.voluntarioNome) === id);
        const status = itens.some((item) => item.confirmacaoStatus === "recusado") ? "recusado"
          : itens.every((item) => (item.confirmacaoStatus ?? (item.confirmado ? "confirmado" : "pendente")) === "confirmado") ? "confirmado" : "pendente";
        return { id, nome: itens[0].voluntarioNome, funcoes: [...new Set(itens.map((item) => item.funcao))], status };
      }).sort((a, b) => prioridadeParticipanteLouvor(a.funcoes) - prioridadeParticipanteLouvor(b.funcoes));
      const musicas = escala.musicas ?? [];
      return <article key={escala.id} className={clsx("overflow-hidden rounded-2xl border border-l-4 border-gray-200 bg-white shadow-sm", escala.culto.includes("Domingo") ? "border-l-amber-400" : "border-l-rose-500")}>
        <div className="flex items-center gap-2 pr-3 sm:pr-5">
          <button type="button" aria-expanded={isAberto} aria-controls={`culto-${escala.id}`} onClick={() => setExpandido(isAberto ? null : escala.id)} className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left sm:gap-4 sm:p-5">
            <span className={clsx("flex w-14 shrink-0 flex-col items-center rounded-xl py-2", escala.culto.includes("Domingo") ? "bg-amber-50" : "bg-rose-50")}>
              <span className="text-[10px] font-bold uppercase text-gray-500">{data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
              <span className="text-2xl font-bold leading-7 text-gray-900">{data.getDate().toString().padStart(2, "0")}</span>
              <span className="text-[10px] font-semibold uppercase text-gray-500">{data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-gray-900">{escala.culto}</span>{equipe && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">{equipe}</span>}{!escala.visivel && <span className="text-xs text-gray-400">Rascunho</span>}</span>
              <span className="mt-1 block text-xs text-gray-500">{data.toLocaleDateString("pt-BR")} · {escala.horario.slice(0, 5)}</span>
              {!isAberto && <span className="mt-1 block text-xs text-gray-500 sm:hidden">{musicas.length ? `${musicas.length} músicas` : "Repertório pendente"}</span>}
            </span>
            {!isAberto && <span className={clsx("hidden items-center gap-1.5 text-xs sm:inline-flex", musicas.length ? "text-gray-500" : "text-amber-600")}><Music2 className="h-3.5 w-3.5" />{musicas.length ? `${musicas.length} músicas` : "Repertório pendente"}</span>}
            <ChevronDown className={clsx("h-4 w-4 shrink-0 text-gray-400 transition", isAberto && "rotate-180")} />
          </button>
          {isAberto && <button type="button" onClick={() => onDetalhes(escala)} className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Ver detalhes</button>}
        </div>
        {isAberto && <div id={`culto-${escala.id}`} className="space-y-4 px-4 pb-5 sm:px-5">
          <section className="rounded-xl border border-gray-100 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3"><h3 className="flex items-center gap-2 text-xs font-semibold text-gray-800"><Users className="h-4 w-4" />Equipe escalada</h3>{podeVerConfirmacoes && escala.confirmacaoParticipantes && <span className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{pessoas.filter((pessoa) => pessoa.status === "confirmado").length} de {pessoas.length} confirmados</span>}</div>
            {pessoas.length ? <div className="flex flex-wrap gap-2">{pessoas.map((pessoa) => <div key={pessoa.id} className={clsx("flex items-center gap-2 rounded-xl border px-3 py-2", pessoa.id === usuarioId ? "border-rose-200 bg-rose-50" : "border-gray-100 bg-gray-50/50")}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-800">{pessoa.nome.split(" ").filter(Boolean).map((parte) => parte[0]).slice(0, 2).join("")}</span>
              <span><span className="block text-xs font-semibold text-gray-800">{pessoa.nome}{pessoa.id === usuarioId ? " · você" : ""}</span><span className="block text-[11px] text-gray-500">{pessoa.funcoes.join(" · ")}</span></span>
              {podeVerConfirmacoes && escala.confirmacaoParticipantes && <span title={pessoa.status} aria-label={pessoa.status} className={clsx("h-2 w-2 rounded-full", pessoa.status === "confirmado" ? "bg-emerald-500" : pessoa.status === "recusado" ? "bg-red-500" : "bg-amber-400")} />}
            </div>)}</div> : <p className="text-xs text-gray-500">Nenhum participante definido.</p>}
          </section>
          <section className="overflow-hidden rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/50 px-3 py-3 text-xs"><Music2 className="h-4 w-4 text-gray-600" /><h3 className="font-semibold text-gray-800">Repertório do culto</h3><span className="text-gray-500">{musicas.length} músicas</span></div>
            {musicas.length ? <ol className="divide-y divide-gray-100">{musicas.map((musica, index) => {
              const status = statusStudio[`${escala.id}:${musica.musicaId}`];
              return <li key={musica.id || `${musica.musicaId}:${index}`} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-500">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-gray-900">{musica.titulo}</p><p className="mt-0.5 text-xs text-gray-500">{musica.artista} · Tom {musica.tom || "a definir"} · BPM {musica.bpm || "—"}</p></div>
                {status === "pronto" && onEnsaiar ? <button type="button" onClick={() => onEnsaiar(escala, musica)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Play className="h-3.5 w-3.5" />Ensaiar</button>
                  : status === "preparando" ? <div className="flex flex-wrap items-center gap-2"><span role="status" className="inline-flex items-center gap-1.5 text-xs text-amber-700"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Preparando ensaio</span>{onEnsaiar && <button type="button" onClick={() => onEnsaiar(escala, musica)} className="rounded-lg px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Ver andamento</button>}</div>
                    : onPreparar && musica.musicaId && escala.data >= hoje ? <div className="flex flex-wrap items-center gap-2">{status === "falhou" && <span role="status" className="text-xs text-red-600">Falha na preparação</span>}<button type="button" onClick={() => onPreparar(escala, musica)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{status === "falhou" ? "Tentar novamente" : "Preparar ensaio"}</button></div>
                      : <span className="text-xs text-gray-400">{status === "falhou" ? "Falha na preparação" : "Ensaio indisponível"}</span>}
              </li>;
            })}</ol> : <p className="px-4 py-5 text-xs text-gray-500">O repertório deste culto ainda não tem músicas.</p>}
          </section>
          {onAdicionarMusica && <div className="flex justify-end"><button type="button" onClick={() => onAdicionarMusica(escala)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Plus className="h-3.5 w-3.5" />Adicionar música</button></div>}
        </div>}
      </article>;
    })}
  </div>;
}
