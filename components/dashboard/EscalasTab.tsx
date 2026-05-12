"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Trash2, Pencil, X, Save, Music2, Users, Eye, EyeOff, UserCheck,
  ChevronUp as ArrowUp, ChevronDown as ArrowDown, Star, Filter, Search,
} from "lucide-react";
import clsx from "clsx";
import {
  Escala, EscalaMusica, FuncaoEscala, ItemEscala,
  Ministerio, MembroMinisterio, Musica, FuncaoMinisterio,
} from "@/types";
import { supabase } from "@/lib/supabase";

// ─── Constantes ───────────────────────────────────────────────────────────────

export const TONS = [
  "C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B",
  "Cm","C#m","Dm","D#m","Ebm","Em","Fm","F#m","Gm","G#m","Am","A#m","Bbm","Bm",
];

export const FUNCOES_POR_MIN: Record<string, string[]> = {
  Louvor:        ["Ministro","Guitarra","Baixo","Bateria","Cajón","Teclado","Backing Vocal","Violão","Pandeiro"],
  "Mídias":      ["Transmissão","Projeção/Letras","Fotografia","Câmera"],
  Cantina:       ["Abertura/Oferta","Escala de Limpeza","Recepção"],
  Limpeza:       ["Escala de Limpeza"],
  Infantil:      ["Professora","Monitor","Auxiliar"],
  "Ação Social": ["Coordenação","Voluntário"],
  Jovens:        ["Líder","Auxiliar"],
  Ensino:        ["Professor","Auxiliar"],
};

// ─── Equipes fixas do Louvor ────────────────────────────────────────────────
export const EQUIPES_LOUVOR = [
  {
    numero: 1, label: "Equipe 1", responsavel: "Pr Flávio",
    membros: [
      { id: "093a4e47-e3b6-4ffe-9ac0-efcdf0800bf9", nome: "Pastor Flavio",       funcao: "Ministro",      obs: "" },
      { id: "2a5a89e6-0452-4643-af64-c17f7881e7e5", nome: "Isadora Fernandes",  funcao: "Backing Vocal", obs: "" },
      { id: null,                                   nome: "Tudes",              funcao: "Backing Vocal", obs: "" },
      { id: "af737764-2a81-4f89-8153-672571c5df16", nome: "Ricardo Bortot",     funcao: "Cajón",         obs: "" },
    ],
  },
  {
    numero: 2, label: "Equipe 2", responsavel: "Matheus Alves",
    membros: [
      { id: "4c646c5d-cf1a-401f-a8bf-5bc9af996cdf", nome: "Matheus Alves",      funcao: "Ministro",      obs: "" },
      { id: "4d729cce-d0a0-42b1-9d09-62d3cd4b7b87", nome: "Lívia Martins",      funcao: "Backing Vocal", obs: "" },
      { id: null,                                   nome: "Edeni",              funcao: "Backing Vocal", obs: "" },
      { id: null,                                   nome: "Victor",             funcao: "Cajón",         obs: "" },
      { id: "ad69a900-1be0-41fa-943b-20c30a5bfb3c", nome: "Thaíná Victoria",   funcao: "Backing Vocal", obs: "" },
    ],
  },
  {
    numero: 3, label: "Equipe 3", responsavel: "Matheus Lopes",
    membros: [
      { id: "253ebd74-151a-405b-ba2a-87e64107ab59", nome: "Matheus Lopes",      funcao: "Ministro",      obs: "" },
      { id: "01c938ee-69b0-430b-9fe3-cd6632d70982", nome: "Luisa Lopes",        funcao: "Backing Vocal", obs: "" },
      { id: "d153862e-bdc6-4769-8bbd-4814b10b3846", nome: "Melissa Vaz",        funcao: "Backing Vocal", obs: "" },
      { id: "c9db7bdf-0d50-4698-8728-d45b91e09c63", nome: "Larissa Pedro",      funcao: "Cajón",         obs: "" },
    ],
  },
];

export const TEMPLATES_CULTO = [
  { id: "quinta",   label: "Culto de Quinta",  horario: "20:00", diaSemana: 4, cor: "bg-grape-100 text-grape-800 border-grape-200" },
  { id: "domingo",  label: "Culto de Domingo", horario: "18:30", diaSemana: 0, cor: "bg-gold-100 text-gold-800 border-gold-200" },
  { id: "especial", label: "Culto Especial",   horario: "19:00", diaSemana: null, cor: "bg-blue-100 text-blue-800 border-blue-200" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function proximasDatas(diaSemana: number, qtd = 5): string[] {
  const datas: string[] = [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(hoje);
  while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
  for (let i = 0; i < qtd; i++) {
    datas.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 7);
  }
  return datas;
}

export function formatDateSimples(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EscalaSubTab = "detalhes" | "participantes" | "musicas" | "roteiro";

interface EscalaForm {
  culto: string;
  data: string;
  horario: string;
  observacoes: string;  // notas livres (sem o prefixo de equipe)
  equipe: string;       // ex: "Equipe 1" | "Equipe 2" | "Equipe 3" | ""
  visivel: boolean;
  confirmacaoParticipantes: boolean;
  itens: ItemEscala[];
  musicas: EscalaMusica[];
}

/** Extrai equipe e notas livres do campo observacoes do banco */
function parseEquipeObs(raw: string | undefined): { equipe: string; notas: string } {
  if (!raw) return { equipe: "", notas: "" };
  const m = raw.match(/^(Equipe \d)\n?([\s\S]*)/);
  if (m) return { equipe: m[1], notas: m[2].trim() };
  return { equipe: "", notas: raw };
}

/** Reconstrói o campo observacoes para salvar no banco */
function buildObs(equipe: string, notas: string): string | null {
  const parts = [equipe, notas].filter(Boolean).join("\n");
  return parts || null;
}

// O DB usa ENUM funcao_escala que ainda não tem Cajón/Pandeiro/Violão.
// Mapeamos para o valor válido mais próximo e preservamos o nome real em observacao.
const FUNCAO_DB_MAP: Partial<Record<string, string>> = {
  "Cajón":   "Bateria",
  "Pandeiro": "Bateria",
  "Violão":  "Guitarra",
};
const FUNCAO_ALIAS_SET = new Set(["Cajón", "Pandeiro", "Violão"]);

/** Retorna a função a exibir: prioriza observação quando é um alias de instrumento */
export function displayFuncao(it: { funcao: string; observacao?: string }): string {
  return (it.observacao && FUNCAO_ALIAS_SET.has(it.observacao)) ? it.observacao : it.funcao;
}
/** Retorna a observação real (ocultando alias de instrumento que já aparece em displayFuncao) */
export function displayObs(it: { observacao?: string }): string | undefined {
  return (it.observacao && FUNCAO_ALIAS_SET.has(it.observacao)) ? undefined : it.observacao;
}
/** Normaliza funcao para salvar no DB (resolve aliases → enum válido + preserva em obs) */
function normalizeFuncaoParaDB(funcao: string, obs?: string): { funcao: string; observacao: string | null } {
  const mapped = FUNCAO_DB_MAP[funcao];
  if (mapped) {
    return { funcao: mapped, observacao: obs ? `${funcao} · ${obs}` : funcao };
  }
  return { funcao, observacao: obs || null };
}

const EMPTY_FORM: EscalaForm = {
  culto: "", data: "", horario: "", observacoes: "", equipe: "",
  visivel: true, confirmacaoParticipantes: false,
  itens: [], musicas: [],
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function EscalasTab({ ministerio, isLider }: { ministerio: Ministerio; isLider: boolean }) {
  const { user } = useAuth();
  const [membros, setMembros] = useState<MembroMinisterio[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [musicas, setMusicas] = useState<Musica[]>([]);

  useEffect(() => {
    supabase.from("perfis")
      .select("id, nome, email, telefone, role, data_ingresso")
      .contains("ministerios", [ministerio])
      .eq("ativo", true)
      .then(({ data }) => {
        if (data) setMembros(data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          nome: p.nome as string,
          email: (p.email ?? "") as string,
          telefone: (p.telefone as string) ?? undefined,
          funcao: (p.role === "pastor" || p.role === "lider" ? "Líder" : "Membro") as FuncaoMinisterio,
          ministerio,
          ativo: true,
          dataEntrada: (p.data_ingresso as string) ?? "",
        })));
      });
    supabase.from("escalas")
      .select("*, escala_itens(*), escala_musicas(*)")
      .eq("ministerio", ministerio)
      .order("data", { ascending: false })
      .then(({ data }) => {
        if (data) setEscalas(data.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          ministerio: e.ministerio as Ministerio,
          data: e.data as string,
          horario: e.horario as string,
          culto: e.culto as string,
          observacoes: (e.observacoes as string) ?? undefined,
          visivel: e.visivel as boolean,
          confirmacaoParticipantes: e.confirmacao_participantes as boolean,
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
        })));
      });
    supabase.from("musicas").select().order("titulo").then(({ data }) => {
      if (data) setMusicas(data as Musica[]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministerio]);

  const [modo, setModo] = useState<"lista" | "form">("lista");
  const [editId, setEditId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<EscalaSubTab>("detalhes");
  const [form, setForm] = useState<EscalaForm>(EMPTY_FORM);
  const [novoMembroId, setNovoMembroId] = useState("");
  const [novaFuncao, setNovaFuncao] = useState<string>((FUNCOES_POR_MIN[ministerio] ?? FUNCOES_POR_MIN.Louvor)[0]);
  const [novaObs, setNovaObs] = useState("");
  const [buscaMusica, setBuscaMusica] = useState("");
  const [tomOverride, setTomOverride] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"minhas" | "culto">("culto");
  const [busca, setBusca] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const funcoesMinisterio = FUNCOES_POR_MIN[ministerio] ?? FUNCOES_POR_MIN.Louvor;

  function abrirNova() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setSubTab("detalhes");
    setModo("form");
  }

  function abrirEdicao(esc: Escala) {
    const { equipe, notas } = parseEquipeObs(esc.observacoes);
    setForm({
      culto: esc.culto,
      data: esc.data,
      horario: esc.horario,
      observacoes: notas,
      equipe,
      visivel: esc.visivel ?? true,
      confirmacaoParticipantes: esc.confirmacaoParticipantes ?? false,
      itens: [...esc.itens],
      musicas: [...(esc.musicas ?? [])],
    });
    setEditId(esc.id);
    setSubTab("detalhes");
    setModo("form");
  }

  function carregarEquipe(label: string) {
    const equipe = EQUIPES_LOUVOR.find((e) => e.label === label);
    if (!equipe) { setForm((f) => ({ ...f, equipe: "" })); return; }
    const itens: import("@/types").ItemEscala[] = equipe.membros.map((m) => {
      const alias = FUNCAO_DB_MAP[m.funcao];
      return {
        funcao: (alias ?? m.funcao) as import("@/types").FuncaoEscala,
        voluntarioId: m.id ?? "",
        voluntarioNome: m.nome,
        observacao: alias ? m.funcao : (m.obs || undefined),
      };
    });
    setForm((f) => ({ ...f, equipe: label, itens }));
  }

  async function salvar() {
    if (!form.culto || !form.data || !form.horario) return;
    setSaving(true);
    const obsDB = buildObs(form.equipe, form.observacoes);
    try {
      if (editId) {
        await supabase.from("escalas").update({
          culto: form.culto, horario: form.horario, data: form.data,
          observacoes: obsDB,
          visivel: form.visivel,
          confirmacao_participantes: form.confirmacaoParticipantes,
        }).eq("id", editId);
        await supabase.from("escala_itens").delete().eq("escala_id", editId);
        if (form.itens.length > 0) {
          await supabase.from("escala_itens").insert(
            form.itens.map((i) => {
              const norm = normalizeFuncaoParaDB(i.funcao, i.observacao);
              return { escala_id: editId, funcao: norm.funcao, voluntario_id: i.voluntarioId || null, voluntario_nome: i.voluntarioNome, observacao: norm.observacao };
            })
          );
        }
        await supabase.from("escala_musicas").delete().eq("escala_id", editId);
        if (form.musicas.length > 0) {
          await supabase.from("escala_musicas").insert(
            form.musicas.map((m, idx) => ({
              escala_id: editId, musica_id: m.musicaId || null,
              titulo: m.titulo, artista: m.artista, tom: m.tom, ordem: idx,
            }))
          );
        }
        setEscalas((prev) => prev.map((e) => e.id === editId ? { ...e, ...form, observacoes: obsDB ?? undefined } : e));
      } else {
        const { data: inserted } = await supabase.from("escalas").insert({
          ministerio, data: form.data, horario: form.horario,
          culto: form.culto,
          observacoes: obsDB,
          visivel: form.visivel,
          confirmacao_participantes: form.confirmacaoParticipantes,
          criado_por: user?.id ?? null,
        }).select().single();
        if (inserted) {
          if (form.itens.length > 0) {
            await supabase.from("escala_itens").insert(
              form.itens.map((i) => {
                const norm = normalizeFuncaoParaDB(i.funcao, i.observacao);
                return { escala_id: inserted.id, funcao: norm.funcao, voluntario_id: i.voluntarioId || null, voluntario_nome: i.voluntarioNome, observacao: norm.observacao };
              })
            );
          }
          if (form.musicas.length > 0) {
            await supabase.from("escala_musicas").insert(
              form.musicas.map((m, idx) => ({
                escala_id: inserted.id, musica_id: m.musicaId || null,
                titulo: m.titulo, artista: m.artista, tom: m.tom, ordem: idx,
              }))
            );
          }
          const nova: Escala = {
            id: inserted.id, ministerio, criadoPor: user?.id ?? "",
            ...form, observacoes: obsDB ?? undefined,
          };
          setEscalas((prev) => [nova, ...prev]);
        }
      }
    } finally {
      setSaving(false);
    }
    setModo("lista");
  }

  async function excluir(id: string) {
    await supabase.from("escalas").delete().eq("id", id);
    setEscalas((prev) => prev.filter((e) => e.id !== id));
  }

  function addParticipante() {
    if (!novoMembroId) return;
    const membro = membros.find((m) => m.id === novoMembroId);
    if (!membro) return;
    if (form.itens.some((i) => i.voluntarioId === novoMembroId && i.funcao === novaFuncao)) return;
    setForm((f) => ({
      ...f,
      itens: [...f.itens, {
        funcao: novaFuncao as FuncaoEscala,
        voluntarioId: membro.id,
        voluntarioNome: membro.nome,
        observacao: novaObs.trim() || undefined,
      }],
    }));
    setNovoMembroId("");
    setNovaObs("");
  }

  function removeParticipante(idx: number) {
    setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
  }

  const musicasFiltradas = musicas.filter((m) =>
    m.titulo.toLowerCase().includes(buscaMusica.toLowerCase()) ||
    m.artista.toLowerCase().includes(buscaMusica.toLowerCase())
  );

  function addMusica(m: Musica) {
    if (form.musicas.some((em) => em.musicaId === m.id)) return;
    setForm((f) => ({
      ...f,
      musicas: [...f.musicas, {
        musicaId: m.id,
        titulo: m.titulo,
        artista: m.artista,
        tom: tomOverride[m.id] ?? m.tom ?? "",
      }],
    }));
  }

  function removeMusica(musicaId: string) {
    setForm((f) => ({ ...f, musicas: f.musicas.filter((m) => m.musicaId !== musicaId) }));
  }

  function moverMusica(idx: number, dir: -1 | 1) {
    const arr = [...form.musicas];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setForm((f) => ({ ...f, musicas: arr }));
  }

  function atualizarTomNaEscala(musicaId: string, tom: string) {
    setForm((f) => ({
      ...f,
      musicas: f.musicas.map((m) => m.musicaId === musicaId ? { ...m, tom } : m),
    }));
  }

  // ── LISTA ────────────────────────────────────────────────────────────────────
  if (modo === "lista") {
    const hojeStr = new Date().toISOString().split("T")[0];

    const escalasMinhas = escalas.filter((e) =>
      e.itens.some((it) => it.voluntarioId === user?.id)
    );
    const base = viewMode === "minhas" ? escalasMinhas : escalas;
    const escalasVisiveis = base
      .filter((e) => {
        if (!busca) return true;
        const q = busca.toLowerCase();
        return (
          e.culto.toLowerCase().includes(q) ||
          e.itens.some((it) => it.voluntarioNome.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.data.localeCompare(b.data));

    const proximas = escalasVisiveis.filter((e) => e.data >= hojeStr);
    const passadas = escalasVisiveis.filter((e) => e.data < hojeStr).reverse();
    const selectedEscala = selectedId ? escalas.find((e) => e.id === selectedId) ?? null : null;

    // Cores por tipo de culto (strings completas para o Tailwind não purgar)
    const corBorda = (culto: string) => {
      if (culto.includes("Quinta")) return "border-l-grape-500";
      if (culto.includes("Domingo")) return "border-l-gold-500";
      if (culto.includes("Especial")) return "border-l-blue-500";
      return "border-l-vine-500";
    };
    const corBadge = (culto: string) => {
      if (culto.includes("Quinta")) return "bg-grape-100 text-grape-900";
      if (culto.includes("Domingo")) return "bg-gold-100 text-gold-900";
      if (culto.includes("Especial")) return "bg-blue-100 text-blue-800";
      return "bg-vine-100 text-vine-900";
    };

    const renderCard = (esc: Escala) => {
      const isSel = selectedId === esc.id;
      const d = esc.data ? new Date(esc.data + "T00:00:00") : null;
      const isPast = esc.data < hojeStr;
      const equipeLabel = esc.observacoes?.match(/^(Equipe \d)/)?.[1];
      return (
        <button
          key={esc.id}
          onClick={() => setSelectedId(isSel ? null : esc.id)}
          className={clsx(
            "w-full text-left border-l-4 rounded-xl px-3 py-3 border border-gray-100 transition hover:shadow-sm",
            corBorda(esc.culto),
            isSel ? "bg-vine-50 shadow-sm ring-1 ring-vine-200" : "bg-white hover:bg-gray-50",
            isPast && "opacity-60"
          )}
        >
          <div className="flex items-center gap-3">
            {/* Bloco de data */}
            {d && (
              <div className="flex flex-col items-center w-11 shrink-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase leading-none">
                  {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                </span>
                <span className="text-2xl font-bold text-gray-800 leading-tight">{d.getDate()}</span>
                <span className="text-[10px] text-gray-400 uppercase leading-none">
                  {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={clsx("text-[11px] font-bold px-2 py-0.5 rounded-full", corBadge(esc.culto))}>
                  {esc.culto}
                </span>
                {equipeLabel && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vine-100 text-vine-800 border border-vine-200">
                    {equipeLabel}
                  </span>
                )}
                {esc.visivel
                  ? <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">✓</span>
                  : <span className="text-[10px] bg-gray-100 text-gray-400 font-semibold px-1.5 py-0.5 rounded-full">◦</span>
                }
              </div>
              <p className="text-xs text-gray-400">{esc.horario}</p>
              {esc.itens.length > 0 && !equipeLabel && (
                <div className="flex flex-wrap gap-1">
                  {esc.itens.slice(0, 4).map((it, i) => (
                    <span
                      key={i}
                      className={clsx(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                        it.voluntarioId === user?.id
                          ? "bg-vine-200 text-vine-900"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {it.voluntarioNome.split(" ")[0]}
                    </span>
                  ))}
                  {esc.itens.length > 4 && (
                    <span className="text-[10px] text-gray-400">+{esc.itens.length - 4}</span>
                  )}
                </div>
              )}
            </div>
            {(esc.musicas ?? []).length > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-gray-400 shrink-0">
                <Music2 className="w-3 h-3" /> {(esc.musicas ?? []).length}
              </span>
            )}
          </div>
        </button>
      );
    };

    return (
      <div className="flex flex-col w-full gap-4">
        {/* Header: tabs + botão */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode("minhas")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition",
                viewMode === "minhas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Star className="w-3.5 h-3.5" /> Minhas Escalas
            </button>
            <button
              onClick={() => setViewMode("culto")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition",
                viewMode === "culto" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Filter className="w-3.5 h-3.5" /> Escala do Culto
            </button>
          </div>
          {isLider && viewMode === "culto" && (
            <button
              onClick={abrirNova}
              className="flex items-center gap-1.5 bg-vine-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-vine-800 transition shrink-0"
            >
              <Plus className="w-4 h-4" /> Nova escala
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por culto ou membro..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-vine-400 bg-white"
          />
        </div>

        {/* Conteúdo: lista + painel de detalhe */}
        <div className="flex gap-4 items-start">

          {/* Lista */}
          <div className={clsx("flex flex-col gap-3 min-w-0", selectedEscala ? "w-full lg:w-72 shrink-0" : "w-full")}>
            {escalasVisiveis.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                <Users className="w-7 h-7 text-gray-300" />
                <p className="text-sm text-gray-400">
                  {viewMode === "minhas" ? "Você não está escalado em nenhum culto." : "Nenhuma escala criada."}
                </p>
                {isLider && viewMode === "culto" && (
                  <button onClick={abrirNova} className="text-sm text-vine-700 font-semibold hover:underline">
                    + Criar a primeira escala
                  </button>
                )}
              </div>
            ) : (
              <>
                {proximas.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
                      Próximas · {proximas.length}
                    </p>
                    {proximas.map(renderCard)}
                  </div>
                )}
                {passadas.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 pt-1">
                      Passadas · {passadas.length}
                    </p>
                    {passadas.map(renderCard)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Painel de detalhe (desktop) */}
          {selectedEscala && (
            <div className="hidden lg:flex flex-col flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm sticky top-4">
              {/* Header do painel */}
              <div className={clsx(
                "px-5 py-4 border-b border-gray-100",
                selectedEscala.culto.includes("Quinta") ? "bg-grape-50" :
                selectedEscala.culto.includes("Domingo") ? "bg-gold-50" :
                selectedEscala.culto.includes("Especial") ? "bg-blue-50" : "bg-vine-50"
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900 text-base">{selectedEscala.culto}</h3>
                      {selectedEscala.observacoes?.match(/^(Equipe \d)/)?.[1] && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-vine-100 text-vine-800 border border-vine-200">
                          {selectedEscala.observacoes.match(/^(Equipe \d)/)?.[1]}
                        </span>
                      )}
                      {selectedEscala.visivel
                        ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Publicada</span>
                        : <span className="text-[10px] bg-white/70 text-gray-500 font-bold px-2 py-0.5 rounded-full">Rascunho</span>
                      }
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      {formatDateSimples(selectedEscala.data)} · {selectedEscala.horario}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isLider && (
                      <>
                        <button
                          onClick={() => abrirEdicao(selectedEscala)}
                          className="p-2 text-gray-500 hover:text-vine-700 hover:bg-white/70 rounded-xl transition"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { excluir(selectedEscala.id); setSelectedId(null); }}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-white/70 rounded-xl transition"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedId(null)}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white/70 rounded-xl transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-5 px-5 py-4">
                {/* Tabela de participantes */}
                {selectedEscala.itens.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                      Participantes · {selectedEscala.itens.length}
                    </p>
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2">Função</th>
                            <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2">Nome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {selectedEscala.itens.map((it, i) => (
                            <tr key={i} className={it.voluntarioId === user?.id ? "bg-vine-50" : ""}>
                              <td className="px-3 py-2.5">
                                <span className="text-xs font-bold text-grape-800 bg-grape-50 px-2 py-0.5 rounded-full">
                                  {displayFuncao(it)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-medium text-gray-800 text-sm">
                                {it.voluntarioNome}
                                {it.voluntarioId === user?.id && (
                                  <span className="ml-1.5 text-[10px] bg-vine-700 text-white px-1.5 py-0.5 rounded-full font-bold">você</span>
                                )}
                                {displayObs(it) && (
                                  <p className="text-xs text-gray-400 font-normal mt-0.5">{displayObs(it)}</p>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Nenhum participante definido.</p>
                )}

                {/* Tabela de músicas */}
                {(selectedEscala.musicas ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                      Músicas · {(selectedEscala.musicas ?? []).length}
                    </p>
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-center text-xs font-semibold text-gray-400 px-2 py-2 w-7">#</th>
                            <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2">Música</th>
                            <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2">Tom</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(selectedEscala.musicas ?? []).map((m, i) => (
                            <tr key={i}>
                              <td className="text-center px-2 py-2.5 text-xs font-bold text-gray-300">{i + 1}</td>
                              <td className="px-3 py-2.5">
                                <p className="font-semibold text-gray-800 text-sm leading-tight">{m.titulo}</p>
                                <p className="text-xs text-gray-400">{m.artista}</p>
                              </td>
                              <td className="px-3 py-2.5">
                                {m.tom && (
                                  <span className="text-xs font-bold bg-grape-100 text-grape-800 px-2 py-0.5 rounded-full">
                                    {m.tom}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Observações */}
                {selectedEscala.observacoes && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Observações</p>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed">
                      {selectedEscala.observacoes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Detalhe mobile (abaixo da lista quando selecionado) */}
        {selectedEscala && (
          <div className="lg:hidden bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className={clsx(
              "px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2",
              selectedEscala.culto.includes("Quinta") ? "bg-grape-50" :
              selectedEscala.culto.includes("Domingo") ? "bg-gold-50" : "bg-vine-50"
            )}>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-bold text-gray-900">{selectedEscala.culto}</p>
                  {selectedEscala.observacoes?.match(/^(Equipe \d)/)?.[1] && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vine-100 text-vine-800 border border-vine-200">
                      {selectedEscala.observacoes.match(/^(Equipe \d)/)?.[1]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{formatDateSimples(selectedEscala.data)} · {selectedEscala.horario}</p>
              </div>
              <div className="flex gap-1">
                {isLider && (
                  <>
                    <button onClick={() => abrirEdicao(selectedEscala)} className="p-1.5 text-gray-500 hover:text-vine-700 rounded-xl transition"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => { excluir(selectedEscala.id); setSelectedId(null); }} className="p-1.5 text-gray-500 hover:text-red-600 rounded-xl transition"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
                <button onClick={() => setSelectedId(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl transition"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              {selectedEscala.itens.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEscala.itens.map((it, i) => (
                    <span key={i} className={clsx(
                      "text-xs px-2 py-1 rounded-full border font-medium",
                      it.voluntarioId === user?.id ? "bg-vine-100 text-vine-800 border-vine-200" : "bg-grape-50 text-grape-800 border-grape-100"
                    )}>
                      <strong>{displayFuncao(it)}</strong>: {it.voluntarioNome}
                    </span>
                  ))}
                </div>
              )}
              {(selectedEscala.musicas ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(selectedEscala.musicas ?? []).map((m, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-100">
                      <Music2 className="w-3 h-3" />{m.titulo}{m.tom && <strong> ({m.tom})</strong>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── FORMULÁRIO ────────────────────────────────────────────────────────────────
  // ── FORMULÁRIO ────────────────────────────────────────────────────────────────
  const subTabs: { id: EscalaSubTab; label: string; count?: number }[] = [
    { id: "detalhes",      label: "Detalhes" },
    { id: "participantes", label: "Participantes", count: form.itens.length },
    { id: "musicas",       label: "Músicas",       count: form.musicas.length },
    { id: "roteiro",       label: "Roteiro" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setModo("lista")}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
        >
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">
          {editId ? "Editar escala" : "Nova escala"}
        </h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition",
              subTab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={clsx(
                "text-[10px] font-bold rounded-full px-1.5",
                subTab === t.id ? "bg-vine-700 text-white" : "bg-gray-300 text-gray-600"
              )}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Detalhes ── */}
      {subTab === "detalhes" && (
        <div className="space-y-4">
          {/* Equipe (somente Louvor) */}
          {ministerio === "Louvor" && (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-widest">Equipe</p>
              <div className="flex gap-2 flex-wrap">
                {[{ label: "", responsavel: "" }, ...EQUIPES_LOUVOR].map((eq) => (
                  <button
                    key={eq.label}
                    onClick={() => carregarEquipe(eq.label)}
                    className={clsx(
                      "text-xs font-semibold px-3 py-1.5 rounded-full border transition",
                      form.equipe === eq.label
                        ? "bg-vine-700 text-white border-vine-700"
                        : "bg-white text-gray-600 border-gray-200 hover:border-vine-400"
                    )}
                  >
                    {eq.label || "Sem equipe"}
                  </button>
                ))}
              </div>
              {form.equipe && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Resp.: {EQUIPES_LOUVOR.find((e) => e.label === form.equipe)?.responsavel} · {form.itens.length} participantes carregados
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-widest">Tipo de culto</p>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES_CULTO.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    const primeiraData = t.diaSemana !== null ? proximasDatas(t.diaSemana, 1)[0] : "";
                    setForm((f) => ({
                      ...f,
                      culto: t.label,
                      horario: t.horario,
                      data: f.data || primeiraData,
                    }));
                  }}
                  className={clsx(
                    "text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:opacity-80",
                    form.culto === t.label ? t.cor + " ring-2 ring-offset-1 ring-vine-400" : t.cor
                  )}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {(form.culto === "Culto de Quinta" || form.culto === "Culto de Domingo") && (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-widest">Escolher data</p>
              <div className="flex flex-wrap gap-2">
                {proximasDatas(form.culto === "Culto de Quinta" ? 4 : 0, 6).map((iso) => (
                  <button
                    key={iso}
                    onClick={() => setForm((f) => ({ ...f, data: iso }))}
                    className={clsx(
                      "text-xs font-semibold px-3 py-1.5 rounded-xl border transition",
                      form.data === iso
                        ? "bg-vine-700 text-white border-vine-700"
                        : "bg-white text-gray-700 border-gray-200 hover:border-vine-400"
                    )}
                  >{formatDateSimples(iso)}</button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <input
              value={form.culto}
              onChange={(e) => setForm({ ...form, culto: e.target.value })}
              placeholder="Título *  ex: Culto Domingo 18h30"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Hora</label>
                <input
                  type="time"
                  value={form.horario}
                  onChange={(e) => setForm({ ...form, horario: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value.slice(0, 500) })}
              placeholder="Observações"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400 resize-none"
            />
            <p className="text-right text-[10px] text-gray-400">{form.observacoes.length}/500</p>
          </div>

          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              {form.visivel ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
              <div>
                <p className="text-sm font-semibold text-gray-800">Visibilidade</p>
                <p className="text-xs text-gray-500">
                  {form.visivel ? "Publicada, visível para todos os membros." : "Rascunho, só você vê."}
                </p>
              </div>
            </div>
            <button
              onClick={() => setForm({ ...form, visivel: !form.visivel })}
              className={clsx("w-11 h-6 rounded-full transition relative", form.visivel ? "bg-vine-700" : "bg-gray-300")}
            >
              <span className={clsx(
                "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                form.visivel ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>

          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-semibold text-gray-800">Solicitar confirmação dos participantes</p>
            </div>
            <button
              onClick={() => setForm({ ...form, confirmacaoParticipantes: !form.confirmacaoParticipantes })}
              className={clsx("w-11 h-6 rounded-full transition relative", form.confirmacaoParticipantes ? "bg-vine-700" : "bg-gray-300")}
            >
              <span className={clsx(
                "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                form.confirmacaoParticipantes ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>
        </div>
      )}

      {/* ── Participantes ── */}
      {subTab === "participantes" && (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Adicionar participante</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={novoMembroId}
                onChange={(e) => setNovoMembroId(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white col-span-1"
              >
                <option value="">Selecionar membro</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <select
                value={novaFuncao}
                onChange={(e) => setNovaFuncao(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400 bg-white"
              >
                {funcoesMinisterio.map((f) => <option key={f}>{f}</option>)}
              </select>
              <input
                value={novaObs}
                onChange={(e) => setNovaObs(e.target.value)}
                placeholder="Observação (opcional)"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-vine-400"
              />
            </div>
            <button
              onClick={addParticipante}
              className="flex items-center gap-1.5 bg-vine-700 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-vine-800 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {form.itens.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum participante adicionado.</p>
            )}
            {form.itens.map((it, i) => (
              <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{it.voluntarioNome}</p>
                  <p className="text-xs text-grape-700 font-medium">{displayFuncao(it)}</p>
                  {displayObs(it) && <p className="text-xs text-gray-400 mt-0.5">{displayObs(it)}</p>}
                </div>
                <button
                  onClick={() => removeParticipante(i)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Músicas ── */}
      {subTab === "musicas" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <input
              value={buscaMusica}
              onChange={(e) => setBuscaMusica(e.target.value)}
              placeholder="Buscar no repertório..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400"
            />
            <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-1 bg-gray-50">
              {musicasFiltradas.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma música encontrada.</p>
              )}
              {musicasFiltradas.map((m) => {
                const jaAdicionada = form.musicas.some((em) => em.musicaId === m.id);
                return (
                  <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{m.titulo}</p>
                      <p className="text-xs text-gray-400">{m.artista} {m.estilo && `· ${m.estilo}`}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <select
                        value={tomOverride[m.id] ?? m.tom ?? ""}
                        onChange={(e) => setTomOverride((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white w-16"
                      >
                        <option value="">Tom</option>
                        {TONS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <button
                        onClick={() => addMusica(m)}
                        disabled={jaAdicionada}
                        className={clsx(
                          "text-xs font-bold px-3 py-1.5 rounded-lg transition",
                          jaAdicionada ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-vine-700 text-white hover:bg-vine-800"
                        )}
                      >
                        {jaAdicionada ? "✓" : "+ Add"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {form.musicas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Na escala</p>
              {form.musicas.map((em, i) => (
                <div key={em.musicaId} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                  <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{em.titulo}</p>
                    <p className="text-xs text-gray-400">{em.artista}</p>
                  </div>
                  <select
                    value={em.tom ?? ""}
                    onChange={(e) => atualizarTomNaEscala(em.musicaId, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white w-16"
                  >
                    <option value="">Tom</option>
                    {TONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button
                    onClick={() => removeMusica(em.musicaId)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Roteiro ── */}
      {subTab === "roteiro" && (
        <div className="space-y-3">
          {form.musicas.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">
              Adicione músicas na aba "Músicas" primeiro.
            </p>
          )}
          {form.musicas.map((em, i) => (
            <div key={em.musicaId} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
              <span className="text-sm font-bold text-gray-300 w-5 text-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{em.titulo}</p>
                <p className="text-xs text-gray-400">
                  {em.artista}{em.tom && <span className="font-semibold text-grape-700"> · {em.tom}</span>}
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moverMusica(i, -1)}
                  disabled={i === 0}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 hover:bg-gray-100 rounded-lg transition"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moverMusica(i, 1)}
                  disabled={i === form.musicas.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 hover:bg-gray-100 rounded-lg transition"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botão salvar */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => setModo("lista")}
          className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-100 transition"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={!form.culto || !form.data || !form.horario || saving}
          className="flex items-center gap-1.5 bg-vine-700 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-vine-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
