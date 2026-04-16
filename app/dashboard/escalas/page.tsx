"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { mockEscalas } from "@/lib/mockData";
import { Escala, Ministerio } from "@/types";
import {
  CalendarDays, Music, AlertCircle, Pin,
  Star, AlertTriangle, Layers, LayoutGrid,
} from "lucide-react";
import clsx from "clsx";

// --- helpers ------------------------------------------------------------------

function formatDateBR(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const MIN_COR: Record<string, string> = {
  Louvor:          "bg-grape-700 text-white",
  "Mídias":        "bg-vine-700 text-white",
  Cantina:         "bg-bark-600 text-white",
  Infantil:        "bg-gold-500 text-vine-950",
  "Ação Social":   "bg-green-600 text-white",
  Jovens:          "bg-blue-600 text-white",
  Ensino:          "bg-purple-700 text-white",
};

const MIN_BADGE: Record<string, string> = {
  Louvor:          "bg-grape-100 text-grape-800",
  "Mídias":        "bg-vine-100 text-vine-700",
  Cantina:         "bg-amber-100 text-amber-800",
  Infantil:        "bg-gold-100 text-gold-800",
  "Ação Social":   "bg-green-100 text-green-800",
  Jovens:          "bg-blue-100 text-blue-700",
  Ensino:          "bg-purple-100 text-purple-700",
};

const MIN_EMOJI: Record<string, string> = {
  Louvor: "??", "Mídias": "??", Cantina: "??",
  Infantil: "??", "Ação Social": "??", Jovens: "?", Ensino: "??",
};

type View = "minhas" | "culto" | "ministerio";

// --- Page ---------------------------------------------------------------------

export default function EscalasPage() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("minhas");
  const [activeMin, setActiveMin] = useState<Ministerio>("Louvor");

  const ministeriosComEscala = Array.from(new Set(mockEscalas.map((e) => e.ministerio)));

  const datasUnicas = Array.from(
    new Map(
      mockEscalas.map((e) => [
        `${e.data}_${e.culto}`,
        { data: e.data, culto: e.culto, horario: e.horario },
      ])
    ).values()
  ).sort((a, b) => a.data.localeCompare(b.data));

  const [dataSelecionada, setDataSelecionada] = useState(datasUnicas[0]?.data ?? "");

  // Minhas escalas
  const minhasEscalas = user
    ? mockEscalas
        .filter((e) =>
          e.itens.some(
            (i) => i.voluntarioId === user.id || i.voluntarioNome === user.nome
          )
        )
        .sort((a, b) => a.data.localeCompare(b.data))
    : [];

  // Conflitos (mesma data, mais de um ministério)
  const contagemPorData: Record<string, number> = {};
  minhasEscalas.forEach((e) => {
    contagemPorData[e.data] = (contagemPorData[e.data] ?? 0) + 1;
  });
  const datasConflito = new Set(
    Object.entries(contagemPorData)
      .filter(([, v]) => v > 1)
      .map(([k]) => k)
  );

  const escalasDoculto = mockEscalas
    .filter((e) => e.data === dataSelecionada)
    .sort((a, b) => a.ministerio.localeCompare(b.ministerio));

  const escalasDoMin = mockEscalas
    .filter((e) => e.ministerio === activeMin)
    .sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-sans font-semibold text-vine-950">Escalas de Serviço</h1>
        <p className="text-sm text-gray-500 mt-1">
          Veja suas escalas, o culto completo e as escalas por ministério.
        </p>
      </div>

      {/* View switcher */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            { id: "minhas" as View,     label: "Minhas Escalas",   icon: Star,        desc: "Apenas onde você está escalado" },
            { id: "culto" as View,      label: "Escala do Culto",  icon: Layers,      desc: "Todos os ministérios em um culto" },
            { id: "ministerio" as View, label: "Por Ministério",   icon: LayoutGrid,  desc: "Filtrar por ministério" },
          ] as { id: View; label: string; icon: React.ElementType; desc: string }[]
        ).map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition",
              view === id
                ? "bg-vine-700 text-white border-vine-700 shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-vine-300 hover:text-vine-700"
            )}
            title={desc}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* --- MINHAS ESCALAS ------------------------------- */}
      {view === "minhas" && (
        <div className="space-y-4">
          {datasConflito.size > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Você está escalado em mais de um ministério no mesmo dia!
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {Array.from(datasConflito)
                    .map((d) => formatDateBR(d))
                    .join(" · ")}{" "}
                  — confirme com seu líder se há necessidade de ajuste.
                </p>
              </div>
            </div>
          )}

          {minhasEscalas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center text-gray-400">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Você não está escalado em nenhum culto próximo.</p>
            </div>
          ) : (
            Object.entries(
              minhasEscalas.reduce<Record<string, Escala[]>>((acc, e) => {
                (acc[e.data] = acc[e.data] ?? []).push(e);
                return acc;
              }, {})
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([data, escalas]) => {
                const conflito = datasConflito.has(data);
                return (
                  <div
                    key={data}
                    className={clsx(
                      "rounded-2xl border overflow-hidden",
                      conflito ? "border-amber-300" : "border-gray-100"
                    )}
                  >
                    {/* Data header */}
                    <div
                      className={clsx(
                        "px-5 py-3 flex items-center justify-between",
                        conflito ? "bg-amber-50" : "bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays
                          className={clsx(
                            "w-4 h-4",
                            conflito ? "text-amber-500" : "text-vine-500"
                          )}
                        />
                        <span
                          className={clsx(
                            "text-sm font-semibold capitalize",
                            conflito ? "text-amber-800" : "text-gray-700"
                          )}
                        >
                          {formatDateBR(data)}
                        </span>
                      </div>
                      {conflito && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> {escalas.length} ministérios — mesmo dia
                        </span>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="bg-white divide-y divide-gray-50">
                      {escalas.map((e) => {
                        const meusItens = e.itens.filter(
                          (i) =>
                            i.voluntarioId === user?.id ||
                            i.voluntarioNome === user?.nome
                        );
                        return (
                          <div key={e.id} className="px-5 py-4 flex items-start gap-4">
                            <div
                              className={clsx(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0",
                                MIN_COR[e.ministerio] ?? "bg-vine-600 text-white"
                              )}
                            >
                              {MIN_EMOJI[e.ministerio] ?? "??"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span
                                  className={clsx(
                                    "text-[11px] font-bold px-2 py-0.5 rounded-full",
                                    MIN_BADGE[e.ministerio] ?? "bg-gray-100 text-gray-700"
                                  )}
                                >
                                  {e.ministerio}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {e.culto} · {e.horario}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {meusItens.map((item, i) => (
                                  <div key={i} className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-vine-800">
                                      {item.funcao}
                                    </span>
                                    {item.observacao && (
                                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                        <Pin className="w-3 h-3" /> {item.observacao}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {e.musicas && e.musicas.length > 0 && (
                                <details className="mt-2">
                                  <summary className="text-xs text-gold-700 font-semibold cursor-pointer flex items-center gap-1 select-none">
                                    <Music className="w-3 h-3" /> Ver setlist
                                  </summary>
                                  <ol className="mt-1.5 list-decimal list-inside space-y-0.5 pl-1">
                                    {e.musicas.map((m, i) => (
                                      <li key={i} className="text-xs text-gray-600">
                                        {m.titulo} {m.tom && <span className="font-semibold">({m.tom})</span>}
                                      </li>
                                    ))}
                                  </ol>
                                </details>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* --- ESCALA DO CULTO ------------------------------ */}
      {view === "culto" && (
        <div className="space-y-4">
          {/* Seletor de data/culto */}
          <div className="flex gap-2 flex-wrap">
            {datasUnicas.map((d) => (
              <button
                key={`${d.data}_${d.culto}`}
                onClick={() => setDataSelecionada(d.data)}
                className={clsx(
                  "flex flex-col items-start px-4 py-2.5 rounded-xl border text-left transition",
                  dataSelecionada === d.data
                    ? "bg-vine-700 text-white border-vine-700 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-vine-300 hover:text-vine-700"
                )}
              >
                <span className="font-semibold text-[11px] opacity-70 leading-tight capitalize">
                  {new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <span className="font-bold text-sm leading-tight">{d.culto}</span>
                <span className="text-[11px] opacity-60">{d.horario}</span>
              </button>
            ))}
          </div>

          {escalasDoculto.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhuma escala cadastrada para este culto.</p>
            </div>
          ) : (
            <>
              {/* Sumário: todos escalados */}
              <div className="bg-vine-50 border border-vine-100 rounded-2xl px-5 py-4">
                <p className="text-xs font-bold text-vine-600 uppercase tracking-wider mb-3">
                  Todos escalados — {formatDateBR(dataSelecionada)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    new Map(
                      escalasDoculto.flatMap((e) =>
                        e.itens.map((i) => [
                          i.voluntarioId,
                          { nome: i.voluntarioNome, id: i.voluntarioId },
                        ])
                      )
                    ).values()
                  ).map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1.5 bg-white border border-vine-200 rounded-full px-3 py-1 text-xs font-medium text-vine-800"
                    >
                      <span className="w-5 h-5 rounded-full bg-vine-700 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                        {iniciais(p.nome)}
                      </span>
                      {p.nome.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Grade de ministérios */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {escalasDoculto.map((e) => {
                  const meuItem = user
                    ? e.itens.find(
                        (i) =>
                          i.voluntarioId === user.id ||
                          i.voluntarioNome === user.nome
                      )
                    : null;
                  return (
                    <div
                      key={e.id}
                      className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
                    >
                      <div
                        className={clsx(
                          "px-4 py-3 flex items-center justify-between",
                          MIN_COR[e.ministerio] ?? "bg-vine-700 text-white"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{MIN_EMOJI[e.ministerio] ?? "??"}</span>
                          <div>
                            <p className="font-bold text-sm leading-tight">{e.ministerio}</p>
                            <p className="text-[11px] opacity-70">{e.horario}</p>
                          </div>
                        </div>
                        {meuItem && (
                          <span className="text-[10px] font-bold bg-white/20 border border-white/30 px-2 py-0.5 rounded-full">
                            Você: {meuItem.funcao}
                          </span>
                        )}
                      </div>

                      <div className="divide-y divide-gray-50">
                        {e.itens.map((item, idx) => {
                          const soyEu =
                            user &&
                            (item.voluntarioId === user.id ||
                              item.voluntarioNome === user.nome);
                          return (
                            <div
                              key={idx}
                              className={clsx(
                                "flex items-center gap-3 px-4 py-2.5 transition",
                                soyEu ? "bg-gold-50" : "hover:bg-gray-50"
                              )}
                            >
                              <div
                                className={clsx(
                                  "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                                  soyEu
                                    ? "bg-gold-400 text-vine-950"
                                    : "bg-gray-100 text-gray-600"
                                )}
                              >
                                {iniciais(item.voluntarioNome)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={clsx(
                                      "text-sm font-semibold",
                                      soyEu ? "text-vine-800" : "text-gray-700"
                                    )}
                                  >
                                    {item.voluntarioNome.split(" ")[0]}
                                  </span>
                                  {soyEu && (
                                    <span className="text-[9px] font-bold text-gold-700 bg-gold-100 px-1.5 py-0.5 rounded-full">
                                      Você
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 leading-tight">
                                  {item.funcao}
                                </p>
                              </div>
                              {item.observacao && (
                                <span
                                  className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full max-w-[110px] truncate"
                                  title={item.observacao}
                                >
                                  {item.observacao}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {e.musicas && e.musicas.length > 0 && (
                        <details className="border-t border-gray-100">
                          <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer text-xs font-semibold text-gold-700 hover:bg-gold-50 transition select-none">
                            <Music className="w-3.5 h-3.5" /> Setlist ({e.musicas.length} músicas)
                          </summary>
                          <ol className="list-decimal list-inside px-6 pb-3 pt-1 space-y-1">
                            {e.musicas.map((m, i) => (
                              <li key={i} className="text-xs text-gray-600">
                                {m.titulo} {m.tom && <span className="font-semibold">({m.tom})</span>}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* --- POR MINISTÉRIO ------------------------------- */}
      {view === "ministerio" && (
        <div className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            {ministeriosComEscala.map((m) => (
              <button
                key={m}
                onClick={() => setActiveMin(m)}
                className={clsx(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition",
                  activeMin === m
                    ? "bg-vine-700 text-white border-vine-700 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-vine-300 hover:text-vine-700"
                )}
              >
                {MIN_EMOJI[m] ?? "??"} {m}
              </button>
            ))}
          </div>

          {escalasDoMin.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhuma escala cadastrada para este ministério.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {escalasDoMin.map((escala) => (
                <div
                  key={escala.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  <div className="bg-vine-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-vine-800 text-base">{escala.culto}</p>
                      <p className="text-vine-600 text-sm flex items-center gap-1.5 mt-0.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {formatDateBR(escala.data)} · {escala.horario}
                      </p>
                    </div>
                    <div className="text-xs text-vine-400">
                      Criado por:{" "}
                      <span className="font-medium">{escala.criadoPor}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                          <th className="text-left px-6 py-3">Função</th>
                          <th className="text-left px-6 py-3">Voluntário</th>
                          <th className="text-left px-6 py-3">Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escala.itens.map((item, idx) => {
                          const soyEu =
                            user &&
                            (item.voluntarioId === user.id ||
                              item.voluntarioNome === user.nome);
                          return (
                            <tr
                              key={idx}
                              className={clsx(
                                "border-b border-gray-50 transition",
                                soyEu ? "bg-gold-50" : "hover:bg-gray-50"
                              )}
                            >
                              <td className="px-6 py-3 font-semibold text-gray-800">
                                {item.funcao}
                              </td>
                              <td className="px-6 py-3 text-gray-600">
                                <span className="flex items-center gap-1.5">
                                  <div
                                    className={clsx(
                                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                      soyEu
                                        ? "bg-gold-400 text-vine-950"
                                        : "bg-gray-100 text-gray-500"
                                    )}
                                  >
                                    {iniciais(item.voluntarioNome)}
                                  </div>
                                  <span className={soyEu ? "font-semibold text-vine-800" : ""}>
                                    {item.voluntarioNome}
                                  </span>
                                  {soyEu && (
                                    <span className="text-[9px] font-bold text-gold-700 bg-gold-100 px-1.5 py-0.5 rounded-full">
                                      Você
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-gray-400 text-xs">
                                {item.observacao ? (
                                  <span className="flex items-center gap-1">
                                    <Pin className="w-3 h-3" /> {item.observacao}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {escala.musicas && escala.musicas.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gold-50">
                      <p className="flex items-center gap-2 text-sm font-bold text-gold-700 mb-2">
                        <Music className="w-4 h-4" /> Setlist do dia
                      </p>
                      <ol className="list-decimal list-inside space-y-1">
                        {escala.musicas.map((m, i) => (
                          <li key={i} className="text-sm text-vine-800">
                            {m.titulo} {m.tom && <span className="font-semibold">({m.tom})</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
