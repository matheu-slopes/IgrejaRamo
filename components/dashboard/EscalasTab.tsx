"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Trash2, Pencil, X, Save, Music2, Users, Eye, EyeOff, UserCheck,
  ChevronUp as ArrowUp, ChevronDown as ArrowDown, Star, Filter, Search, Youtube, ClipboardCopy, Check,
} from "lucide-react";
import clsx from "clsx";
import {
  Escala, EscalaMusica, FuncaoEscala, ItemEscala,
  Ministerio, MembroMinisterio, Musica, FuncaoMinisterio,
} from "@/types";
import { supabase } from "@/lib/supabase";
import BuscarCifraModal from "@/components/dashboard/BuscarCifraModal";

// ─── Constantes ───────────────────────────────────────────────────────────────

export const TONS = [
  "C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B",
  "Cm","C#m","Dm","D#m","Ebm","Em","Fm","F#m","Gm","G#m","Am","A#m","Bbm","Bm",
];

export const FUNCOES_POR_MIN: Record<string, string[]> = {
  Louvor:        ["Ministro","Guitarra","Baixo","Cajón","Teclado","Backing Vocal","Violão","Pandeiro"],
  "Mídias":      ["Transmissão","Projeção/Letras","Fotografia","Câmera"],
  Cantina:       ["Abertura","Oferta","Recepção"],
  Limpeza:       ["Escala de Limpeza"],
  Infantil:      ["Professor(a)","Monitor(a)","Auxiliar"],
  "Ação Social": ["Coordenação","Voluntário(a)"],
  Jovens:        ["Líder","Auxiliar"],
  Ensino:        ["Preletor(a)"],
};

// ─── Equipes fixas do Louvor ────────────────────────────────────────────────
export const EQUIPES_LOUVOR = [
  {
    numero: 1, label: "Equipe 1", responsavel: "Pr Flávio",
    membros: [
      { id: "093a4e47-e3b6-4ffe-9ac0-efcdf0800bf9", nome: "Pastor Flavio",       funcao: "Ministro",      obs: "" },
      { id: "2a5a89e6-0452-4643-af64-c17f7881e7e5", nome: "Isadora Fernandes",  funcao: "Backing Vocal", obs: "" },
      { id: "8ecd6e4e-67c0-437d-9e36-8edb80d5276c", nome: "Eduarda Tudes",     funcao: "Backing Vocal", obs: "" },
      { id: "af737764-2a81-4f89-8153-672571c5df16", nome: "Ricardo Bortot",     funcao: "Cajón",         obs: "" },
    ],
  },
  {
    numero: 2, label: "Equipe 2", responsavel: "Matheus Alves",
    membros: [
      { id: "4c646c5d-cf1a-401f-a8bf-5bc9af996cdf", nome: "Matheus Alves",      funcao: "Ministro",      obs: "" },
      { id: "4d729cce-d0a0-42b1-9d09-62d3cd4b7b87", nome: "Lívia Martins",      funcao: "Backing Vocal", obs: "" },
      { id: null,                                   nome: "Edeni",              funcao: "Backing Vocal", obs: "" },
      { id: "d935d257-c430-44fe-9577-2e15a2ab94fa", nome: "Victor Sabino",       funcao: "Cajón",         obs: "" },
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
  { id: "especial", label: "Outro",            horario: "19:00", diaSemana: null, cor: "bg-blue-100 text-blue-800 border-blue-200" },
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
  observacoes: string;    // notas livres (sem o prefixo de equipe)
  equipe: string;         // Louvor: "Equipe 1" | "Equipe 2" | "Equipe 3" | ""
  ageGroup: string;       // Infantil: "4-7 anos" | "8-11 anos" | "12-13 anos"
  temaInfantil: string;   // Infantil: tema do mês (ex: "Honra")
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

/** Extrai faixa etária e tema do mês do campo observacoes do Infantil (formato: "4-7 anos|Honra") */
function parseInfantilObs(raw: string | undefined): { ageGroup: string; tema: string } {
  if (!raw) return { ageGroup: "", tema: "" };
  const parts = raw.split("|");
  return { ageGroup: parts[0].trim(), tema: (parts[1] ?? "").trim() };
}

// O DB usa ENUM funcao_escala que ainda não tem Cajón/Pandeiro/Violão nem variantes gender-neutral.
// Mapeamos para o valor válido mais próximo e preservamos o nome real em observacao.
const FUNCAO_DB_MAP: Partial<Record<string, string>> = {
  "Cajón":        "Bateria",
  "Pandeiro":     "Bateria",
  "Violão":       "Guitarra",
  "Professor(a)": "Professora",
  "Monitor(a)":   "Monitor",
  "Voluntário(a)": "Voluntário",
  "Preletor(a)":  "Ministro",
  "Abertura":     "Abertura/Oferta",
  "Oferta":       "Abertura/Oferta",
};
const FUNCAO_ALIAS_SET = new Set(["Cajón", "Pandeiro", "Violão", "Professor(a)", "Monitor(a)", "Voluntário(a)", "Preletor(a)", "Abertura", "Oferta"]);

/** Retorna a função a exibir: prioriza observação quando é um alias de instrumento; Bateria → Cajón */
export function displayFuncao(it: { funcao: string; observacao?: string }): string {
  if (it.observacao && FUNCAO_ALIAS_SET.has(it.observacao)) return it.observacao;
  if (it.funcao === "Bateria") return "Cajón";
  if (it.funcao === "Professora") return "Professor(a)";
  if (it.funcao === "Monitor") return "Monitor(a)";
  if (it.funcao === "Voluntário") return "Voluntário(a)";
  return it.funcao;
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
  ageGroup: "", temaInfantil: "",
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
              artistaSlug: (m.artista_slug as string) ?? undefined,
              musicaSlug: (m.musica_slug as string) ?? undefined,
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
  const [modalCifra, setModalCifra] = useState(false);
  const [tomOverride, setTomOverride] = useState<Record<string, string>>({});
  const [addingNova, setAddingNova] = useState(false);
  const [novaMusica, setNovaMusica] = useState({ titulo: "", artista: "", tom: "" });
  const [savingNova, setSavingNova] = useState(false);
  const [saving, setSaving] = useState(false);
  const [salvarErro, setSalvarErro] = useState("");
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"minhas" | "culto">("culto");
  const [busca, setBusca] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // letras
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

  // cifra inline
  const [cifraAberta, setCifraAberta] = useState<{ idx: number; escalaId: string } | null>(null);
  const [cifraInline, setCifraInline] = useState<string[] | null>(null);
  const [loadingCifraInline, setLoadingCifraInline] = useState(false);
  // cache de cifras no formulário: índice → linhas no tom original
  const [cifraFormCache, setCifraFormCache] = useState<Record<number, { lines: string[]; tomOrig: string; tomAtFetch: string }>>({});
  const [cifraFormAberta, setCifraFormAberta] = useState<number | null>(null);
  const [loadingCifraForm, setLoadingCifraForm] = useState<number | null>(null);

  const funcoesMinisterio = FUNCOES_POR_MIN[ministerio] ?? FUNCOES_POR_MIN.Louvor;

  async function abrirCifraInline(escalaId: string, idx: number, m: EscalaMusica) {
    if (cifraAberta?.escalaId === escalaId && cifraAberta?.idx === idx) {
      setCifraAberta(null); setCifraInline(null); return;
    }
    if (!m.artistaSlug || !m.musicaSlug) return;
    setCifraAberta({ escalaId, idx });
    setCifraInline(null);
    setLoadingCifraInline(true);
    try {
      const res = await fetch(`/api/buscar-cifra?artista=${m.artistaSlug}&musica=${m.musicaSlug}`);
      const data = await res.json();
      if (data.cifra) {
        const cifra: string[] = data.cifra;
        const tomOrig: string = data.tom_original ?? "";
        const tomDest: string = m.tom ?? "";
        if (tomOrig && tomDest && tomOrig !== tomDest) {
          const NOTES_S = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
          const NOTES_F = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
          const noteIdx = (n: string) => { const i = NOTES_S.indexOf(n); return i !== -1 ? i : NOTES_F.indexOf(n); };
          const CHORD_RE = /^[A-G][#b]?(m(?:aj)?|M(?:aj)?|dim|aug|sus[24]?|add)?[0-9]*([\+Mb5])?(\/[A-G][#b]?)?$/;
          const fromIdx = noteIdx(tomOrig.replace(/m$/, ""));
          const toIdx2  = noteIdx(tomDest.replace(/m$/, ""));
          if (fromIdx !== -1 && toIdx2 !== -1) {
            const semis = (toIdx2 - fromIdx + 12) % 12;
            if (semis !== 0) {
              const transposed = cifra.map(line => {
                const words = line.trim().split(/\s+/).filter(Boolean);
                const isChord = words.length > 0 && words.filter(w => CHORD_RE.test(w)).length / words.length >= 0.55;
                if (!isChord) return line;
                return line.replace(/\S+/g, w => {
                  const wm = w.match(/^([A-G][#b]?)(.*?)(\/?[A-G][#b]?)?$/);
                  if (!wm || noteIdx(wm[1]) === -1) return w;
                  const nr = NOTES_S[(noteIdx(wm[1]) + semis + 12) % 12];
                  let bass = "";
                  if (wm[3]?.startsWith("/")) {
                    const bn = wm[3].slice(1);
                    bass = noteIdx(bn) !== -1 ? "/" + NOTES_S[(noteIdx(bn) + semis + 12) % 12] : wm[3];
                  }
                  return nr + (wm[2] || "") + bass;
                });
              });
              setCifraInline(transposed);
              return;
            }
          }
        }
        setCifraInline(cifra);
      }
    } finally {
      setLoadingCifraInline(false);
    }
  }

  function abrirNova() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setSubTab("detalhes");
    setModo("form");
  }

  function abrirEdicao(esc: Escala) {
    const { equipe, notas } = parseEquipeObs(esc.observacoes);
    const { ageGroup, tema } = esc.ministerio === "Infantil"
      ? parseInfantilObs(esc.observacoes)
      : { ageGroup: "", tema: "" };
    setForm({
      culto: esc.culto,
      data: esc.data,
      horario: esc.horario,
      observacoes: esc.ministerio === "Infantil" ? "" : notas,
      equipe: esc.ministerio === "Infantil" ? "" : equipe,
      ageGroup,
      temaInfantil: tema,
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

    // Auto-aplica edição de participante pendente (usuário trocou função mas não clicou Atualizar)
    let itensFinais = [...form.itens];
    if (editandoIdx !== null && novoMembroId) {
      const membro = membros.find((m) => m.id === novoMembroId);
      if (membro) {
        const novoItem: import("@/types").ItemEscala = {
          funcao: novaFuncao as FuncaoEscala,
          voluntarioId: membro.id,
          voluntarioNome: membro.nome,
          observacao: novaObs.trim() || undefined,
        };
        itensFinais = itensFinais.map((it, i) => i === editandoIdx ? novoItem : it);
        setForm((f) => ({ ...f, itens: itensFinais }));
        setEditandoIdx(null);
        setNovoMembroId("");
        setNovaObs("");
      }
    }

    setSaving(true);
    setSalvarErro("");
    const obsDB = ministerio === "Infantil"
      ? ([form.ageGroup, form.temaInfantil].filter(Boolean).join("|") || null)
      : buildObs(form.equipe, form.observacoes);
    try {
      if (editId) {
        const { error: upErr, data: upData } = await supabase.from("escalas").update({
          culto: form.culto, horario: form.horario, data: form.data,
          observacoes: obsDB,
          visivel: form.visivel,
          confirmacao_participantes: form.confirmacaoParticipantes,
        }).eq("id", editId).select("id");
        if (upErr) throw new Error(upErr.message);
        if (!upData || upData.length === 0) throw new Error("Sem permissão para atualizar esta escala.");

        const { error: delItens } = await supabase.from("escala_itens").delete().eq("escala_id", editId);
        if (delItens) throw new Error(delItens.message);

        if (itensFinais.length > 0) {
          const itensParaSalvar = itensFinais.map((i) => {
            const norm = normalizeFuncaoParaDB(i.funcao, i.observacao);
            return { escala_id: editId, funcao: norm.funcao, voluntario_id: i.voluntarioId || null, voluntario_nome: i.voluntarioNome, observacao: norm.observacao };
          });
          const { error: insItens, data: insData } = await supabase.from("escala_itens").insert(itensParaSalvar).select("id");
          if (insItens) throw new Error(insItens.message);
          if (!insData || insData.length !== itensFinais.length) {
            throw new Error(`Erro ao salvar participantes (${insData?.length ?? 0}/${itensFinais.length}). Possível função inválida.`);
          }
        }

        const { error: delMus } = await supabase.from("escala_musicas").delete().eq("escala_id", editId);
        if (delMus) throw new Error(delMus.message);

        if (form.musicas.length > 0) {
          const { error: insMus } = await supabase.from("escala_musicas").insert(
            form.musicas.map((m, idx) => ({
              escala_id: editId, musica_id: m.musicaId || null,
              titulo: m.titulo, artista: m.artista, tom: m.tom, ordem: idx,
              artista_slug: m.artistaSlug ?? null, musica_slug: m.musicaSlug ?? null,
            }))
          );
          if (insMus) throw new Error(insMus.message);
        }
        setEscalas((prev) => prev.map((e) => e.id === editId ? { ...e, ...form, itens: itensFinais, observacoes: obsDB ?? undefined } : e));
      } else {
        const { data: inserted, error: insEsc } = await supabase.from("escalas").insert({
          ministerio, data: form.data, horario: form.horario,
          culto: form.culto,
          observacoes: obsDB,
          visivel: form.visivel,
          confirmacao_participantes: form.confirmacaoParticipantes,
          criado_por: user?.id ?? null,
        }).select().single();
        if (insEsc) throw new Error(insEsc.message);
        if (inserted) {
          if (itensFinais.length > 0) {
            const { error: insItens } = await supabase.from("escala_itens").insert(
              itensFinais.map((i) => {
                const norm = normalizeFuncaoParaDB(i.funcao, i.observacao);
                return { escala_id: inserted.id, funcao: norm.funcao, voluntario_id: i.voluntarioId || null, voluntario_nome: i.voluntarioNome, observacao: norm.observacao };
              })
            );
            if (insItens) throw new Error(insItens.message);
          }
          if (form.musicas.length > 0) {
            const { error: insMus } = await supabase.from("escala_musicas").insert(
              form.musicas.map((m, idx) => ({
                escala_id: inserted.id, musica_id: m.musicaId || null,
                titulo: m.titulo, artista: m.artista, tom: m.tom, ordem: idx,
                artista_slug: m.artistaSlug ?? null, musica_slug: m.musicaSlug ?? null,
              }))
            );
            if (insMus) throw new Error(insMus.message);
          }
          const nova: Escala = {
            id: inserted.id, ministerio, criadoPor: user?.id ?? "",
            ...form, itens: itensFinais, observacoes: obsDB ?? undefined,
          };
          setEscalas((prev) => [nova, ...prev]);
        }
      }
      setModo("lista");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSalvarErro(msg.replace(/^TypeError:\s*/i, ""));
      console.error("[salvar escala]", e);
    } finally {
      setSaving(false);
    }
  }

  async function excluir(id: string) {
    await supabase.from("escalas").delete().eq("id", id);
    setEscalas((prev) => prev.filter((e) => e.id !== id));
  }

  function addParticipante() {
    if (!novoMembroId) return;
    const membro = membros.find((m) => m.id === novoMembroId);
    if (!membro) return;
    // Allow update if editing the same slot; block true duplicates otherwise
    if (form.itens.some((i, idx) => idx !== editandoIdx && i.voluntarioId === novoMembroId && i.funcao === novaFuncao)) return;
    const novoItem: import("@/types").ItemEscala = {
      funcao: novaFuncao as FuncaoEscala,
      voluntarioId: membro.id,
      voluntarioNome: membro.nome,
      observacao: novaObs.trim() || undefined,
    };
    if (editandoIdx !== null) {
      setForm((f) => ({ ...f, itens: f.itens.map((it, i) => i === editandoIdx ? novoItem : it) }));
      setEditandoIdx(null);
    } else {
      setForm((f) => ({ ...f, itens: [...f.itens, novoItem] }));
    }
    setNovoMembroId("");
    setNovaObs("");
  }

  function editarParticipante(idx: number) {
    const it = form.itens[idx];
    setNovoMembroId(it.voluntarioId ?? "");
    setNovaFuncao(displayFuncao(it));
    setNovaObs(displayObs(it) ?? "");
    setEditandoIdx(idx);
  }

  function cancelarEdicaoParticipante() {
    setEditandoIdx(null);
    setNovoMembroId("");
    setNovaObs("");
    setNovaFuncao(funcoesMinisterio[0]);
  }

  function removeParticipante(idx: number) {
    if (editandoIdx === idx) cancelarEdicaoParticipante();
    setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
    if (editandoIdx !== null && editandoIdx > idx) setEditandoIdx(editandoIdx - 1);
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

  function atualizarTomNaEscala(idx: number, tom: string) {
    setForm((f) => ({
      ...f,
      musicas: f.musicas.map((m, i) => i === idx ? { ...m, tom } : m),
    }));
  }

  // Transpõe linhas de cifra de tomOrig para tomDest
  function transposeCifraLocal(lines: string[], tomOrig: string, tomDest: string): string[] {
    if (!tomOrig || !tomDest || tomOrig === tomDest) return lines;
    const NOTES_S = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    const NOTES_F = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
    const noteIdx = (n: string) => { const i = NOTES_S.indexOf(n); return i !== -1 ? i : NOTES_F.indexOf(n); };
    const CHORD_RE = /^[A-G][#b]?(m(?:aj)?|M(?:aj)?|dim|aug|sus[24]?|add)?[0-9]*([\+Mb5])?(\/[A-G][#b]?)?$/;
    const fromIdx = noteIdx(tomOrig.replace(/m$/, ""));
    const toIdx2  = noteIdx(tomDest.replace(/m$/, ""));
    if (fromIdx === -1 || toIdx2 === -1) return lines;
    const semis = (toIdx2 - fromIdx + 12) % 12;
    if (semis === 0) return lines;
    return lines.map(line => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      if (!words.length || words.filter(w => CHORD_RE.test(w)).length / words.length < 0.55) return line;
      return line.replace(/\S+/g, w => {
        const wm = w.match(/^([A-G][#b]?)(.*?)(\/?[A-G][#b]?)?$/);
        if (!wm || noteIdx(wm[1]) === -1) return w;
        const nr = NOTES_S[(noteIdx(wm[1]) + semis + 12) % 12];
        let bass = "";
        if (wm[3]?.startsWith("/")) {
          const bn = wm[3].slice(1);
          bass = noteIdx(bn) !== -1 ? "/" + NOTES_S[(noteIdx(bn) + semis + 12) % 12] : wm[3];
        }
        return nr + (wm[2] || "") + bass;
      });
    });
  }

  async function toggleCifraForm(idx: number) {
    if (cifraFormAberta === idx) { setCifraFormAberta(null); return; }
    setCifraFormAberta(idx);
    const m = form.musicas[idx];
    if (!m.artistaSlug || !m.musicaSlug) return;
    // usa cache se já buscou
    if (cifraFormCache[idx]) return;
    setLoadingCifraForm(idx);
    try {
      const res = await fetch(`/api/buscar-cifra?artista=${m.artistaSlug}&musica=${m.musicaSlug}`);
      const data = await res.json();
      if (data.cifra) {
        setCifraFormCache(prev => ({
          ...prev,
          [idx]: {
            lines: data.cifra,
            tomOrig: data.tom_original ?? "",
            tomAtFetch: form.musicas[idx]?.tom ?? "",
          },
        }));
      }
    } finally {
      setLoadingCifraForm(null);
    }
  }

  function youtubeUrl(titulo: string, artista: string) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${titulo} ${artista}`)}` ;
  }

  async function salvarNovaMusica() {
    if (!novaMusica.titulo.trim() || !novaMusica.artista.trim()) return;
    setSavingNova(true);
    try {
      const { data, error } = await supabase
        .from("musicas")
        .insert({ titulo: novaMusica.titulo.trim(), artista: novaMusica.artista.trim(), tom: novaMusica.tom || null })
        .select()
        .single();
      if (error) throw error;
      const nova = data as Musica;
      setMusicas((prev) => [...prev, nova].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")));
      addMusica(nova);
      setNovaMusica({ titulo: "", artista: "", tom: "" });
      setAddingNova(false);
    } catch (err) {
      console.error("Erro ao salvar música:", err);
    } finally {
      setSavingNova(false);
    }
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
      return "border-l-gray-900";
    };
    const corBadge = (culto: string) => {
      if (culto.includes("Quinta")) return "bg-grape-100 text-grape-900";
      if (culto.includes("Domingo")) return "bg-gold-100 text-gold-900";
      if (culto.includes("Especial")) return "bg-blue-100 text-blue-800";
      return "bg-gray-100 text-black";
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
            isSel ? "bg-gray-50 shadow-sm ring-1 ring-gray-200" : "bg-white hover:bg-gray-50",
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-900 border border-gray-200">
                    {equipeLabel}
                  </span>
                )}
                {esc.ministerio === "Infantil" && esc.observacoes && (() => {
                  const { ageGroup, tema } = parseInfantilObs(esc.observacoes);
                  return (
                    <>
                      {ageGroup && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                          {ageGroup}
                        </span>
                      )}
                      {tema && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                          {tema}
                        </span>
                      )}
                    </>
                  );
                })()}
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
                          ? "bg-gray-200 text-black"
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
              className="flex items-center gap-1.5 bg-black text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-900 transition shrink-0"
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
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-gray-400 bg-white"
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
                  <button onClick={abrirNova} className="text-sm text-gray-900 font-semibold hover:underline">
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
                selectedEscala.culto.includes("Especial") ? "bg-blue-50" : "bg-gray-50"
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900 text-base">{selectedEscala.culto}</h3>
                      {selectedEscala.observacoes?.match(/^(Equipe \d)/)?.[1] && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-900 border border-gray-200">
                          {selectedEscala.observacoes.match(/^(Equipe \d)/)?.[1]}
                        </span>
                      )}
                      {selectedEscala.ministerio === "Infantil" && selectedEscala.observacoes && (() => {
                        const { ageGroup, tema } = parseInfantilObs(selectedEscala.observacoes);
                        return (
                          <>
                            {ageGroup && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                                {ageGroup}
                              </span>
                            )}
                            {tema && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                                Tema: {tema}
                              </span>
                            )}
                          </>
                        );
                      })()}
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
                          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white/70 rounded-xl transition"
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
                            <tr key={i} className={it.voluntarioId === user?.id ? "bg-gray-50" : ""}>
                              <td className="px-3 py-2.5">
                                <span className="text-xs font-bold text-grape-800 bg-grape-50 px-2 py-0.5 rounded-full">
                                  {displayFuncao(it)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-medium text-gray-800 text-sm">
                                {it.voluntarioNome}
                                {it.voluntarioId === user?.id && (
                                  <span className="ml-1.5 text-[10px] bg-black text-white px-1.5 py-0.5 rounded-full font-bold">você</span>
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
                            <React.Fragment key={i}>
                              <tr key={i} className={clsx(m.artistaSlug && m.musicaSlug ? "cursor-pointer hover:bg-gray-50" : "")} onClick={() => abrirCifraInline(selectedEscala.id, i, m)}>
                                <td className="text-center px-2 py-2.5 text-xs font-bold text-gray-300">{i + 1}</td>
                                <td className="px-3 py-2.5">
                                  <p className={clsx("font-semibold text-sm leading-tight", m.artistaSlug ? "text-grape-700" : "text-gray-800")}>{m.titulo}{m.artistaSlug && " ↓"}</p>
                                  <p className="text-xs text-gray-400">{m.artista}</p>
                                </td>
                                <td className="px-3 py-2.5">
                                  {m.tom && (
                                    <span className="text-xs font-bold bg-grape-100 text-grape-800 px-2 py-0.5 rounded-full">
                                      {m.tom}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => copiarLetra(i, m)}
                                    className={clsx(
                                      "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition whitespace-nowrap",
                                      copyLetraOk === i
                                        ? "border-green-300 bg-green-50 text-green-700"
                                        : "border-gray-200 bg-white text-gray-600 hover:border-grape-300 hover:text-grape-700 hover:bg-grape-50"
                                    )}
                                  >
                                    {copyLetraIdx === i ? (
                                      <span className="animate-pulse">Buscando...</span>
                                    ) : copyLetraOk === i ? (
                                      <><Check className="w-3 h-3" /> Copiada!</>
                                    ) : (
                                      <><ClipboardCopy className="w-3 h-3" /> Copiar letra</>
                                    )}
                                  </button>
                                </td>
                              </tr>
                              {cifraAberta?.escalaId === selectedEscala.id && cifraAberta?.idx === i && (
                                <tr key={`cifra-${i}`}>
                                  <td colSpan={3} className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                                    {loadingCifraInline ? (
                                      <p className="text-xs text-gray-400 animate-pulse">Carregando cifra...</p>
                                    ) : cifraInline ? (
                                      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{cifraInline.join("\n")}</pre>
                                    ) : (
                                      <p className="text-xs text-gray-400">Cifra não disponível.</p>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Observações (oculto para Infantil pois é dado estruturado) */}
                {selectedEscala.observacoes && selectedEscala.ministerio !== "Infantil" && (
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

        {/* Detalhe mobile — bottom sheet */}
        {selectedEscala && (
          <div className="lg:hidden">
            {/* Overlay escuro */}
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setSelectedId(null)}
            />
            {/* Sheet */}
            <div className={clsx(
              "fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden",
            )}>
              {/* Alça */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>

              {/* Header */}
              <div className={clsx(
                "px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0",
                selectedEscala.culto.includes("Quinta") ? "bg-grape-50" :
                selectedEscala.culto.includes("Domingo") ? "bg-gold-50" : "bg-gray-50"
              )}>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-gray-900">{selectedEscala.culto}</p>
                    {selectedEscala.observacoes?.match(/^(Equipe \d)/)?.[1] && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-900 border border-gray-200">
                        {selectedEscala.observacoes.match(/^(Equipe \d)/)?.[1]}
                      </span>
                    )}
                    {selectedEscala.visivel
                      ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Publicada</span>
                      : <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">Rascunho</span>
                    }
                  </div>
                  <p className="text-xs text-gray-500">{formatDateSimples(selectedEscala.data)} · {selectedEscala.horario}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {isLider && (
                    <>
                      <button onClick={() => { setSelectedId(null); abrirEdicao(selectedEscala); }} className="p-2 text-gray-500 hover:text-gray-900 rounded-xl transition"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => { excluir(selectedEscala.id); setSelectedId(null); }} className="p-2 text-gray-500 hover:text-red-600 rounded-xl transition"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                  <button onClick={() => setSelectedId(null)} className="p-2 text-gray-400 rounded-xl transition"><X className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Conteúdo com scroll */}
              <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
                {/* Participantes */}
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
                            <tr key={i} className={it.voluntarioId === user?.id ? "bg-gray-50" : ""}>
                              <td className="px-3 py-2.5">
                                <span className="text-xs font-bold text-grape-800 bg-grape-50 px-2 py-0.5 rounded-full">
                                  {displayFuncao(it)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-medium text-gray-800 text-sm">
                                {it.voluntarioNome}
                                {it.voluntarioId === user?.id && (
                                  <span className="ml-1.5 text-[10px] bg-black text-white px-1.5 py-0.5 rounded-full font-bold">você</span>
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

                {/* Músicas */}
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
                {selectedEscala.observacoes && selectedEscala.ministerio !== "Infantil" && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Observações</p>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed">
                      {selectedEscala.observacoes}
                    </p>
                  </div>
                )}

                {/* Espaço extra para não ficar atrás da bottom nav */}
                <div className="h-6" />
              </div>
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
                subTab === t.id ? "bg-black text-white" : "bg-gray-300 text-gray-600"
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
                        ? "bg-black text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
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
              {TEMPLATES_CULTO.map((t) => {
                const isOutro = t.id === "especial";
                const isActive = isOutro
                  ? (form.culto !== "Culto de Quinta" && form.culto !== "Culto de Domingo")
                  : form.culto === t.label;
                return (
                <button
                  key={t.id}
                  onClick={() => {
                    const primeiraData = t.diaSemana !== null ? proximasDatas(t.diaSemana, 1)[0] : "";
                    setForm((f) => ({
                      ...f,
                      culto: isOutro ? "" : t.label,
                      horario: t.horario,
                      data: f.data || primeiraData,
                    }));
                  }}
                  className={clsx(
                    "text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:opacity-80",
                    isActive ? t.cor + " ring-2 ring-offset-1 ring-gray-400" : t.cor
                  )}
                >{t.label}</button>
                );
              })}
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
                        ? "bg-black text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
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
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Hora</label>
                <input
                  type="time"
                  value={form.horario}
                  onChange={(e) => setForm({ ...form, horario: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Faixa etária + Tema (somente Infantil) */}
          {ministerio === "Infantil" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-widest">Faixa etária</p>
                <div className="flex gap-2 flex-wrap">
                  {["4-7 anos", "8-11 anos", "12-13 anos"].map((age) => (
                    <button
                      key={age}
                      onClick={() => setForm((f) => ({ ...f, ageGroup: age }))}
                      className={clsx(
                        "text-xs font-semibold px-3 py-1.5 rounded-full border transition",
                        form.ageGroup === age
                          ? "bg-yellow-500 text-white border-yellow-500"
                          : "bg-white text-gray-600 border-gray-200 hover:border-yellow-400"
                      )}
                    >
                      {age}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-semibold uppercase tracking-widest">Tema do mês</label>
                <input
                  value={form.temaInfantil}
                  onChange={(e) => setForm({ ...form, temaInfantil: e.target.value })}
                  placeholder="ex: Honra"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                />
              </div>
            </div>
          )}

          {ministerio !== "Infantil" && (
            <div>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value.slice(0, 500) })}
                placeholder="Observações"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none"
              />
              <p className="text-right text-[10px] text-gray-400">{form.observacoes.length}/500</p>
            </div>
          )}

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
              className={clsx("w-11 h-6 rounded-full transition relative", form.visivel ? "bg-black" : "bg-gray-300")}
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
              className={clsx("w-11 h-6 rounded-full transition relative", form.confirmacaoParticipantes ? "bg-black" : "bg-gray-300")}
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
          <div className={clsx("border rounded-xl p-3 space-y-2", editandoIdx !== null ? "bg-gray-50 border-gray-300" : "bg-gray-50 border-gray-200")}>
            <p className="text-xs font-semibold text-gray-600">
              {editandoIdx !== null ? `Editando participante #${editandoIdx + 1}` : "Adicionar participante"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={novoMembroId}
                onChange={(e) => setNovoMembroId(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white col-span-1"
              >
                <option value="">Selecionar membro</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <select
                value={novaFuncao}
                onChange={(e) => setNovaFuncao(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
              >
                {funcoesMinisterio.map((f) => <option key={f}>{f}</option>)}
              </select>
              <input
                value={novaObs}
                onChange={(e) => setNovaObs(e.target.value)}
                placeholder={ministerio === "Infantil" && novaFuncao === "Professor(a)" ? "Tópico (ex: Honrando meu corpo)" : "Observação (opcional)"}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={addParticipante}
                className={clsx(
                  "flex items-center gap-1.5 text-white text-xs font-semibold px-4 py-2 rounded-xl transition",
                  editandoIdx !== null ? "bg-black hover:bg-gray-900" : "bg-black hover:bg-gray-900"
                )}
              >
                {editandoIdx !== null ? <><Save className="w-3.5 h-3.5" /> Atualizar</> : <><Plus className="w-3.5 h-3.5" /> Adicionar</>}
              </button>
              {editandoIdx !== null && (
                <button
                  onClick={cancelarEdicaoParticipante}
                  className="text-xs text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {form.itens.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum participante adicionado.</p>
            )}
            {form.itens.map((it, i) => (
              <div key={i} className={clsx(
                "flex items-center justify-between bg-white border rounded-xl px-4 py-3 shadow-sm",
                editandoIdx === i ? "border-gray-400 ring-1 ring-gray-200" : "border-gray-100"
              )}>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{it.voluntarioNome}</p>
                  <p className="text-xs text-grape-700 font-medium">{displayFuncao(it)}</p>
                  {displayObs(it) && <p className="text-xs text-gray-400 mt-0.5">{displayObs(it)}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => editarParticipante(i)}
                    className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeParticipante(i)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                    title="Remover"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Músicas ── */}
      {subTab === "musicas" && (
        <div className="space-y-4">
          {modalCifra && (
            <BuscarCifraModal
              onClose={() => setModalCifra(false)}
              onSalva={(nova) => {
                setForm((f) => ({
                  ...f,
                  musicas: [...f.musicas, {
                    musicaId: "",
                    titulo: nova.titulo,
                    artista: nova.artista,
                    tom: nova.tom,
                    artistaSlug: nova.artistaSlug,
                    musicaSlug: nova.musicaSlug,
                  }],
                }));
                setModalCifra(false);
              }}
            />
          )}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={buscaMusica}
                onChange={(e) => setBuscaMusica(e.target.value)}
                placeholder="Buscar no repertório..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
              <button
                onClick={() => setModalCifra(true)}
                className="flex items-center gap-1.5 bg-grape-700 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-grape-800 transition shrink-0"
              >
                <Music2 className="w-3.5 h-3.5" />
                Buscar no Cifra Club
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-1 bg-gray-50">
              {musicasFiltradas.length === 0 && buscaMusica && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma música encontrada.</p>
              )}
              {musicasFiltradas.length === 0 && !buscaMusica && (
                <p className="text-xs text-gray-400 text-center py-4">Digite para buscar no repertório.</p>
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
                      <a
                        href={youtubeUrl(m.titulo, m.artista)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Ouvir no YouTube"
                      >
                        <Youtube className="w-3.5 h-3.5" />
                      </a>
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
                          jaAdicionada ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-black text-white hover:bg-gray-900"
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

          {/* Nova música */}
          <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setAddingNova((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition"
            >
              <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar música nova ao repertório</span>
              {addingNova ? <X className="w-4 h-4 text-gray-400" /> : null}
            </button>
            {addingNova && (
              <div className="px-3 pb-3 pt-1 space-y-2 bg-gray-50/40">
                <div className="flex gap-2">
                  <input
                    value={novaMusica.titulo}
                    onChange={(e) => setNovaMusica((n) => ({ ...n, titulo: e.target.value }))}
                    placeholder="Título da música"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
                  />
                  <select
                    value={novaMusica.tom}
                    onChange={(e) => setNovaMusica((n) => ({ ...n, tom: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none bg-white w-20"
                  >
                    <option value="">Tom</option>
                    {TONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    value={novaMusica.artista}
                    onChange={(e) => setNovaMusica((n) => ({ ...n, artista: e.target.value }))}
                    placeholder="Artista / Banda"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
                  />
                  <button
                    onClick={salvarNovaMusica}
                    disabled={savingNova || !novaMusica.titulo.trim() || !novaMusica.artista.trim()}
                    className="px-4 py-2 text-sm font-bold text-white bg-black rounded-lg hover:bg-gray-900 transition disabled:opacity-40"
                  >
                    {savingNova ? "..." : "+ Add"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {form.musicas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Na escala</p>
              {form.musicas.map((em, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{em.titulo}</p>
                      <p className="text-xs text-gray-400">{em.artista}</p>
                    </div>
                    <a
                      href={youtubeUrl(em.titulo, em.artista)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                      title="Ouvir no YouTube"
                    >
                      <Youtube className="w-3.5 h-3.5" />
                    </a>
                    <select
                      value={em.tom ?? ""}
                      onChange={(e) => atualizarTomNaEscala(i, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white w-16"
                    >
                      <option value="">Tom</option>
                      {TONS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    {em.artistaSlug && em.musicaSlug && (
                      <button
                        onClick={() => toggleCifraForm(i)}
                        className="p-1.5 text-grape-600 hover:bg-grape-50 rounded-lg transition shrink-0"
                        title="Ver cifra"
                      >
                        <Music2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeMusica(em.musicaId)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {cifraFormAberta === i && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                      {loadingCifraForm === i ? (
                        <p className="text-xs text-gray-400 animate-pulse">Carregando cifra...</p>
                      ) : cifraFormCache[i] ? (
                        <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                          {transposeCifraLocal(
                            cifraFormCache[i].lines,
                            cifraFormCache[i].tomOrig || cifraFormCache[i].tomAtFetch,
                            em.tom ?? cifraFormCache[i].tomOrig ?? cifraFormCache[i].tomAtFetch
                          ).join("\n")}
                        </pre>
                      ) : (
                        <p className="text-xs text-gray-400">Cifra não disponível.</p>
                      )}
                    </div>
                  )}
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
      {salvarErro && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          ⚠ {salvarErro}
        </p>
      )}
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
          className="flex items-center gap-1.5 bg-black text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
