"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Escala, EscalaMusica, FuncaoEscala, ItemEscala, Ministerio, User, Musica } from "@/types";
import {
  Star, MessageCircle, Pencil, Trash2, Plus, X, Check,
  Save, Music, ChevronDown, ChevronUp, Filter, AlertTriangle, Calendar, Search,
} from "lucide-react";
import clsx from "clsx";

// ─── constants ───────────────────────────────────────────────────────────────

const MIN_COR: Record<string, { header: string; badge: string; dot: string }> = {
  Louvor:        { header: "bg-grape-700 text-white",     badge: "bg-grape-100 text-grape-800",  dot: "bg-grape-500" },
  "Mídias":      { header: "bg-vine-700 text-white",      badge: "bg-vine-100 text-vine-800",    dot: "bg-vine-500" },
  Cantina:       { header: "bg-amber-700 text-white",     badge: "bg-amber-100 text-amber-800",  dot: "bg-amber-500" },
  Infantil:      { header: "bg-gold-500 text-vine-950",   badge: "bg-gold-100 text-vine-900",    dot: "bg-gold-400" },
  "Ação Social": { header: "bg-green-700 text-white",     badge: "bg-green-100 text-green-800",  dot: "bg-green-500" },
  Jovens:        { header: "bg-blue-700 text-white",      badge: "bg-blue-100 text-blue-800",    dot: "bg-blue-500" },
  Ensino:        { header: "bg-purple-700 text-white",    badge: "bg-purple-100 text-purple-800",dot: "bg-purple-500" },
};

const MIN_EMOJI: Record<string, string> = {
  Louvor: "🎸", "Mídias": "📹", Cantina: "🧹",
  Infantil: "🧒", "Ação Social": "🤝", Jovens: "⚡", Ensino: "📖",
};

const FUNCOES_POR_MIN: Record<string, string[]> = {
  Louvor:        ["Ministro","Guitarra","Baixo","Bateria","Teclado","Backing Vocal","Violão","Pandeiro"],
  "Mídias":      ["Transmissão","Projeção/Letras","Fotografia","Câmera"],
  Cantina:       ["Abertura/Oferta","Escala de Limpeza","Recepção"],
  Infantil:      ["Professora","Monitor","Auxiliar"],
  "Ação Social": ["Coordenação","Voluntário"],
  Jovens:        ["Líder","Auxiliar"],
  Ensino:        ["Professor","Auxiliar"],
};

const TODOS_MINISTERIOS = Object.keys(MIN_COR) as Ministerio[];

// Culto types → auto-generated ministry cards (Ação Social is handled in Eventos module)
const MINISTERIOS_ESCALA: Ministerio[] = ["Louvor", "Mídias", "Cantina", "Infantil", "Jovens", "Ensino"];

// ─── helpers ─────────────────────────────────────────────────────────────────

function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatDataLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatDataCurta(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function diasAte(iso: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const alvo = new Date(iso + "T00:00:00");
  const diff = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff < 0) return `Há ${Math.abs(diff)} dia${Math.abs(diff) > 1 ? "s" : ""}`;
  return `Em ${diff} dias`;
}

function gerarTextoWhatsApp(culto: string, data: string, horario: string, ministerio: string, itens: ItemEscala[], musicas?: EscalaMusica[]) {
  const emoji = MIN_EMOJI[ministerio] ?? "📋";
  const linhas = [
    `${emoji} *${ministerio} — ${culto}*`,
    `📅 ${formatDataLabel(data)} às ${horario}`,
    "",
    "*Equipe:*",
    ...itens.map((i) => `• ${i.funcao}: *${i.voluntarioNome}*${i.observacao ? ` _(${i.observacao})_` : ""}`),
  ];
  if (musicas && musicas.length > 0) {
    linhas.push("", "*Setlist:*");
    musicas.forEach((m, i) => linhas.push(`${i + 1}. ${m.titulo}${m.tom ? ` (${m.tom})` : ""} — ${m.artista}`));
  }
  linhas.push("", "_Escala gerada pelo sistema Ramo Igreja_ 🌿");
  return linhas.join("\n");
}

// ─── types ───────────────────────────────────────────────────────────────────

interface FormItem { funcao: string; voluntarioId: string; voluntarioNome: string; observacao: string; }
interface FormState {
  data: string;
  culto: string;
  horario: string;
  ministerio: Ministerio | ""; // edit mode
  ministeriosSel: Ministerio[]; // template mode
  itens: FormItem[];
  musicas: EscalaMusica[];
}
const EMPTY_FORM: FormState = { data: new Date().toISOString().split("T")[0], culto: "", horario: "18:30", ministerio: "", ministeriosSel: [], itens: [], musicas: [] };

// ─── main page ───────────────────────────────────────────────────────────────

export default function EscalasPage() {
  const { user, usuarios, temPermissao } = useAuth();
  const podeCriar = temPermissao("criar_escala");
  const isAdmin = user?.role === "admin" || user?.role === "pastor";
  const meusMinisterios = (user?.ministerios ?? []) as Ministerio[];

  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [tab, setTab] = useState<"minhas" | "geral">("minhas");
  const [filterMin, setFilterMin] = useState<"todos" | "meus" | Ministerio>("todos");
  const [searchGeral, setSearchGeral] = useState("");
  const [modal, setModal] = useState<{ mode: "template" | "edit"; date: string; escalaId?: string } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("escalas")
      .select("*, escala_itens(*), escala_musicas(*)")
      .order("data", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setEscalas(
            data.map((e) => ({
              id: e.id, ministerio: e.ministerio, data: e.data,
              horario: e.horario, culto: e.culto,
              observacoes: e.observacoes, visivel: e.visivel,
              confirmacaoParticipantes: e.confirmacao_participantes,
              criadoPor: e.criado_por ?? "",
              itens: (e.escala_itens ?? []).map((i: any) => ({
                funcao: i.funcao, voluntarioId: i.voluntario_id ?? "",
                voluntarioNome: i.voluntario_nome, observacao: i.observacao,
              })),
              musicas: (e.escala_musicas ?? []).map((m: any) => ({
                musicaId: m.musica_id ?? "", titulo: m.titulo,
                artista: m.artista, tom: m.tom,
              })),
            }))
          );
        }
      });
  }, []);

  useEffect(() => {
    supabase
      .from("musicas")
      .select()
      .then(({ data }) => {
        if (data) setMusicas(data);
      });
  }, []);

  // group escalas by date, filtered by ministry + search
  const escalasVisiveis = useMemo(() => {
    let result = escalas;
    if (filterMin === "meus") result = result.filter((e) => meusMinisterios.includes(e.ministerio));
    else if (filterMin !== "todos") result = result.filter((e) => e.ministerio === filterMin);
    if (searchGeral.trim()) {
      const q = searchGeral.trim().toLowerCase();
      result = result.filter((e) =>
        e.ministerio.toLowerCase().includes(q) ||
        e.culto.toLowerCase().includes(q) ||
        e.itens.some((i) => i.voluntarioNome?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [escalas, filterMin, meusMinisterios, searchGeral]);

  const porData = useMemo(() => {
    const map = new Map<string, Escala[]>();
    escalasVisiveis
      .slice()
      .sort((a, b) => a.data.localeCompare(b.data))
      .forEach((e) => {
        const arr = map.get(e.data) ?? [];
        arr.push(e);
        map.set(e.data, arr);
      });
    return Array.from(map.entries());
  }, [escalasVisiveis]);

  // sorted upcoming dates first, then past
  const porDataOrdenada = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const futuras = porData.filter(([d]) => new Date(d + "T00:00:00") >= today);
    const passadas = porData.filter(([d]) => new Date(d + "T00:00:00") < today).reverse();
    return [...futuras, ...passadas];
  }, [porData]);

  function openCreate(date?: string) {
    const d = date ?? new Date().toISOString().split("T")[0];
    // Líderes começam com seus próprios ministérios pré-selecionados
    const presel: Ministerio[] = isAdmin ? [] : meusMinisterios;
    setForm({ ...EMPTY_FORM, data: d, ministeriosSel: presel });
    setModal({ mode: "template", date: d });
  }
  function openEdit(escala: Escala) {
    setForm({
      ministeriosSel: [],
      data: escala.data, culto: escala.culto, horario: escala.horario, ministerio: escala.ministerio,
      itens: escala.itens.map((i) => ({ funcao: i.funcao, voluntarioId: i.voluntarioId, voluntarioNome: i.voluntarioNome, observacao: i.observacao ?? "" })),
      musicas: escala.musicas ?? [],
    });
    setModal({ mode: "edit", date: escala.data, escalaId: escala.id });
  }
  function deleteEscala(id: string) {
    if (!confirm("Remover esta escala?")) return;
    supabase.from("escalas").delete().eq("id", id).then(() => {});
    setEscalas((prev) => prev.filter((e) => e.id !== id));
  }
  async function saveModal() {
    // ── Template creation: generate one Escala per ministry
    if (modal?.mode === "template") {
      if (!form.ministeriosSel.length || !form.culto.trim() || !form.horario || !form.data) return;
      if (form.ministeriosSel.some((m) => escalas.some((e) => e.data === form.data && e.ministerio === m))) return;
      for (const min of form.ministeriosSel) {
        const { data: inserted } = await supabase
          .from("escalas")
          .insert({ ministerio: min, data: form.data, horario: form.horario, culto: form.culto.trim(), criado_por: user?.nome ?? "" })
          .select()
          .single();
        if (inserted) {
          setEscalas((prev) => [...prev, {
            id: inserted.id, ministerio: inserted.ministerio, data: inserted.data,
            horario: inserted.horario, culto: inserted.culto,
            criadoPor: inserted.criado_por ?? "", itens: [], musicas: [],
          }]);
        }
      }
      setModal(null);
      return;
    }
    // ── Edit: update existing ministry escala
    if (!form.culto.trim() || !form.horario || !form.ministerio) return;
    if (modal?.mode === "edit" && modal.escalaId) {
      await supabase.from("escalas").update({ culto: form.culto.trim(), horario: form.horario }).eq("id", modal.escalaId);
      await supabase.from("escala_itens").delete().eq("escala_id", modal.escalaId);
      if (form.itens.length > 0) {
        await supabase.from("escala_itens").insert(
          form.itens.map((i) => ({ escala_id: modal.escalaId, funcao: i.funcao, voluntario_id: i.voluntarioId || null, voluntario_nome: i.voluntarioNome, observacao: i.observacao || null }))
        );
      }
      await supabase.from("escala_musicas").delete().eq("escala_id", modal.escalaId);
      if (form.musicas.length > 0) {
        await supabase.from("escala_musicas").insert(
          form.musicas.map((m) => ({ escala_id: modal.escalaId, musica_id: m.musicaId || null, titulo: m.titulo, artista: m.artista, tom: m.tom }))
        );
      }
      setEscalas((prev) => prev.map((e) => e.id !== modal.escalaId ? e : {
        ...e, culto: form.culto.trim(), horario: form.horario,
        itens: form.itens.map((i) => ({ funcao: i.funcao as FuncaoEscala, voluntarioId: i.voluntarioId, voluntarioNome: i.voluntarioNome, observacao: i.observacao || undefined })),
        musicas: form.musicas.length > 0 ? form.musicas : undefined,
      }));
    }
    setModal(null);
  }
  function podeEditarEscala(e: Escala) {
    return podeCriar && meusMinisterios.includes(e.ministerio);
  }
  function copiarWhatsApp(escala: Escala) {
    const txt = gerarTextoWhatsApp(escala.culto, escala.data, escala.horario, escala.ministerio, escala.itens, escala.musicas);
    navigator.clipboard.writeText(txt).then(() => {
      setCopied(escala.id);
      setTimeout(() => setCopied(null), 2500);
    });
  }

  // Detect days where the user is scheduled in 2+ ministries
  const conflitoPorData = useMemo(() => {
    if (!user) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    escalas.forEach((e) => {
      const estou = e.itens.some((i) => i.voluntarioId === user.id || i.voluntarioNome === user.nome);
      if (estou) {
        const arr = map.get(e.data) ?? [];
        if (!arr.includes(e.ministerio)) arr.push(e.ministerio);
        map.set(e.data, arr);
      }
    });
    return map;
  }, [escalas, user]);

  const diasComConflito = useMemo(() => {
    const dias: { data: string; ministerios: string[] }[] = [];
    conflitoPorData.forEach((mins, data) => {
      if (mins.length > 1) dias.push({ data, ministerios: mins });
    });
    return dias.sort((a, b) => a.data.localeCompare(b.data));
  }, [conflitoPorData]);

  const membrosDoForm = useMemo(() => {
    if (!form.ministerio) return [];
    return usuarios.filter((u: User) => u.ministerios.includes(form.ministerio as Ministerio) && u.ativo);
  }, [form.ministerio, usuarios]);

  const minhasEscalas = useMemo(() => {
    if (!user) return [];
    return escalas
      .filter((e) => e.itens.some((i) => i.voluntarioId === user.id || i.voluntarioNome === user.nome))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [escalas, user]);

  const minhasEscalasPorData = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const map = new Map<string, Escala[]>();
    minhasEscalas.forEach((e) => {
      const arr = map.get(e.data) ?? [];
      arr.push(e);
      map.set(e.data, arr);
    });
    const entries = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    const futuras = entries.filter(([d]) => new Date(d + "T00:00:00") >= today);
    const passadas = entries.filter(([d]) => new Date(d + "T00:00:00") < today).reverse();
    return [...futuras, ...passadas];
  }, [minhasEscalas]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-vine-950">Escalas de Serviço</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {podeCriar ? "Gerencie as escalas dos ministérios." : "Veja quando e onde você vai servir."}
          </p>
        </div>
        {podeCriar && (
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 bg-vine-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-vine-600 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova escala
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100 pb-0">
        {([
          { id: "minhas" as const, label: "Minhas Escalas", icon: Star },
          { id: "geral" as const, label: "Escala do Culto", icon: Filter },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px",
              tab === id
                ? "border-vine-700 text-vine-800"
                : "border-transparent text-gray-400 hover:text-gray-700"
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── MINHAS ESCALAS ── */}
      {tab === "minhas" && (
        <div className="space-y-5">
          {/* Conflict warning */}
          {diasComConflito.length > 0 && (
            <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Você está escalado em mais de um ministério no mesmo dia!
                </p>
                {diasComConflito.map(({ data, ministerios }) => (
                  <p key={data} className="text-xs text-amber-700 mt-0.5">
                    {formatDataLabel(data).split(",").slice(0, 2).join(",")} — confirme com seu líder se há necessidade de ajuste.
                    <span className="ml-1 font-semibold">({ministerios.join(", ")})</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {minhasEscalasPorData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Você não está escalado em nenhum culto próximo.</p>
            </div>
          ) : (
            minhasEscalasPorData.map(([data, escs]) => {
              const minsNaData = conflitoPorData.get(data) ?? [];
              const temConflito = minsNaData.length > 1;
              const isPast = new Date(data + "T00:00:00") < new Date(new Date().toISOString().split("T")[0] + "T00:00:00");
              return (
                <div
                  key={data}
                  className={clsx(
                    "rounded-2xl border shadow-sm overflow-hidden",
                    isPast ? "opacity-60" : "",
                    temConflito ? "border-amber-200" : "border-gray-100"
                  )}
                >
                  {/* Date header */}
                  <div className={clsx(
                    "flex items-center justify-between px-4 py-3",
                    temConflito ? "bg-amber-50" : "bg-gray-50"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">📅</span>
                      <div>
                        <p className={clsx("text-sm font-bold capitalize", temConflito ? "text-amber-900" : "text-vine-900")}>
                          {formatDataLabel(data).split(", ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(", ")}
                        </p>
                        <p className="text-[11px] text-gray-400">{diasAte(data)} · {escs[0]?.horario}</p>
                      </div>
                    </div>
                    {temConflito && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-1 rounded-full shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        {minsNaData.length} ministérios — mesmo dia
                      </span>
                    )}
                  </div>

                  {/* Grid of compact ministry cards — side by side */}
                  <div className={clsx(
                    "p-3",
                    escs.length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""
                  )}>
                    {escs.map((escala) => (
                      <MinhaEscalaCompactCard
                        key={escala.id}
                        escala={escala}
                        userId={user?.id}
                        userName={user?.nome}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── ESCALA DO CULTO (geral) ── */}
      {tab === "geral" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchGeral}
              onChange={(e) => setSearchGeral(e.target.value)}
              placeholder="Buscar por ministério, culto ou membro..."
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-vine-400 bg-white"
            />
            {searchGeral && (
              <button
                onClick={() => setSearchGeral("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3 h-3 text-gray-400 shrink-0" />
            {([
              { id: "todos", label: "Todos" },
              ...(meusMinisterios.length > 0 ? [{ id: "meus", label: "⭐ Meus" }] : []),
              ...TODOS_MINISTERIOS.map((m) => ({ id: m, label: `${MIN_EMOJI[m]} ${m}` })),
            ] as { id: "todos" | "meus" | Ministerio; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilterMin(filterMin === id ? "todos" : id)}
                className={clsx(
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition whitespace-nowrap",
                  filterMin === id
                    ? id === "todos" || id === "meus"
                      ? "bg-vine-700 text-white border-vine-700"
                      : (MIN_COR[id as string]?.header ?? "bg-vine-700 text-white") + " border-transparent"
                    : "bg-white text-gray-500 border-gray-200 hover:border-vine-300 hover:text-vine-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Active filter chips */}
          {(filterMin !== "todos" || searchGeral.trim()) && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
              <span>Filtrando:</span>
              {filterMin !== "todos" && (
                <span className="flex items-center gap-1 bg-vine-50 text-vine-700 border border-vine-200 rounded-full px-2 py-0.5 font-semibold">
                  {filterMin === "meus" ? "Meus ministérios" : `${MIN_EMOJI[filterMin as string] ?? ""} ${filterMin}`}
                  <button onClick={() => setFilterMin("todos")}><X className="w-3 h-3" /></button>
                </span>
              )}
              {searchGeral.trim() && (
                <span className="flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full px-2 py-0.5 font-semibold">
                  &ldquo;{searchGeral.trim()}&rdquo;
                  <button onClick={() => setSearchGeral("")}><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}

          {/* Results */}
          {porDataOrdenada.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhuma escala encontrada.</p>
              {podeCriar && (
                <button onClick={() => openCreate()} className="mt-3 text-xs text-vine-600 font-semibold hover:underline">
                  + Criar a primeira escala
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {porDataOrdenada.map(([data, escs]) => {
                const isPast = new Date(data + "T00:00:00") < new Date(new Date().toISOString().split("T")[0] + "T00:00:00");
                return (
                  <EventoBlock
                    key={data}
                    data={data}
                    escalas={escs}
                    isPast={isPast}
                    userId={user?.id}
                    userName={user?.nome}
                    podeCriar={podeCriar}
                    isAdmin={isAdmin}
                    meusMinisterios={meusMinisterios}
                    copied={copied}
                    ministeriosUsuarioNaData={conflitoPorData.get(data) ?? []}
                    onEdit={openEdit}
                    onDelete={deleteEscala}
                    onCopy={copiarWhatsApp}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <EscalaModal
          mode={modal.mode}
          date={modal.date}
          form={form}
          setForm={setForm}
          membros={membrosDoForm}
          meusMinisterios={meusMinisterios}
          musicas={musicas}
          escalas={escalas}
          isAdmin={isAdmin}
          onSave={saveModal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── EventoBlock ─────────────────────────────────────────────────────────────

function EventoBlock({
  data, escalas, isPast, userId, userName, podeCriar, isAdmin, meusMinisterios, copied,
  ministeriosUsuarioNaData, onEdit, onDelete, onCopy,
}: {
  data: string;
  escalas: Escala[];
  isPast: boolean;
  userId?: string;
  userName?: string;
  podeCriar: boolean;
  isAdmin: boolean;
  meusMinisterios: Ministerio[];
  copied: string | null;
  ministeriosUsuarioNaData: string[];
  onEdit: (e: Escala) => void;
  onDelete: (id: string) => void;
  onCopy: (e: Escala) => void;
}) {
  const nomeEvento = escalas[0]?.culto ?? "";
  const horario = escalas[0]?.horario ?? "";
  const temConflito = ministeriosUsuarioNaData.length > 1;

  return (
    <div className={clsx("relative", isPast && "opacity-60")}>
      {/* Date header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-gray-200" />
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-center">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{diasAte(data)}</span>
          <span className="text-sm font-bold text-vine-900 capitalize">{formatDataLabel(data)}</span>
          {horario && <span className="text-xs text-gray-400">· {horario}</span>}
          {temConflito && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {ministeriosUsuarioNaData.length} ministérios — mesmo dia
            </span>
          )}
        </div>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Culto name */}
      {nomeEvento && (
        <div className="text-center mb-3">
          <span className="inline-block bg-vine-50 border border-vine-100 text-vine-800 text-xs font-semibold px-3 py-1 rounded-full">
            {nomeEvento}
          </span>
        </div>
      )}

      {/* Ministry cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {escalas.map((escala) => (
          <MinisterioCard
            key={escala.id}
            escala={escala}
            userId={userId}
            userName={userName}
            podeEditar={podeCriar && meusMinisterios.includes(escala.ministerio)}
            isAdmin={isAdmin}
            copied={copied === escala.id}
            onEdit={() => onEdit(escala)}
            onDelete={() => onDelete(escala.id)}
            onCopy={() => onCopy(escala)}
          />
        ))}
        {/* Only admins/pastors can manually add extra ministries to a day */}
        {isAdmin && (
          <button
            onClick={() => {/* future: admin add ministry */}}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-400 hover:border-vine-300 hover:text-vine-600 text-xs font-semibold py-8 rounded-2xl transition min-h-[120px]"
          >
            <Plus className="w-5 h-5" />
            Adicionar ministério
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MinisterioCard ───────────────────────────────────────────────────────────

function MinisterioCard({
  escala, userId, userName, podeEditar, isAdmin, copied, onEdit, onDelete, onCopy,
}: {
  escala: Escala;
  userId?: string;
  userName?: string;
  podeEditar: boolean;
  isAdmin: boolean;
  copied: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cor = MIN_COR[escala.ministerio];
  const temMusicas = escala.musicas && escala.musicas.length > 0;
  const totalSlots = escala.itens.length;
  const preenchidos = escala.itens.filter((i) => i.voluntarioNome).length;
  const vagasAbertas = totalSlots - preenchidos;
  const semNinguem = escala.itens.length === 0;
  const euEstou = escala.itens.some(
    (i) => (userId && i.voluntarioId === userId) || (userName && i.voluntarioNome === userName)
  );

  return (
    <div className={clsx("bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col", semNinguem && !podeEditar ? "border-amber-200" : "border-gray-100")}>
      {/* Colored header */}
      <div className={clsx("px-3 py-2.5 flex items-center justify-between gap-2", cor?.header ?? "bg-vine-700 text-white")}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          <span className="text-base shrink-0">{MIN_EMOJI[escala.ministerio] ?? "📋"}</span>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{escala.ministerio}</p>
            <p className="text-[10px] opacity-70">
              {semNinguem ? (
                <span className="font-semibold opacity-90">⚠ Sem equipe</span>
              ) : (
                <>{preenchidos}/{totalSlots} vagas{vagasAbertas > 0 && <span className="ml-1 opacity-90">· {vagasAbertas} em aberto</span>}</>
              )}
            </p>
          </div>
          <span className="ml-auto opacity-60 shrink-0">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>
        {/* Actions — only show for the leader's own ministry or admin */}
        {(podeEditar || isAdmin) && (
          <div className="flex items-center gap-1 shrink-0">
            {(podeEditar || isAdmin) && (
              <button onClick={onEdit} className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition" title="Editar">
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {isAdmin && (
              <button onClick={onDelete} className="w-6 h-6 rounded-full bg-white/20 hover:bg-red-400/40 flex items-center justify-center transition" title="Remover">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={onCopy}
              className={clsx(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition",
                copied ? "bg-green-500/30 text-white" : "bg-white/20 hover:bg-white/30 text-white"
              )}
            >
              {copied ? <Check className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
              {copied ? "Copiado!" : "WA"}
            </button>
          </div>
        )}
      </div>

      {/* Collapsed preview: avatar row */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-50 transition w-full text-left"
        >
          {semNinguem ? (
            <span className="flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              Nenhum membro escalado — clique para {podeEditar ? "preencher" : "ver"}
            </span>
          ) : (
            <>
              {/* Avatar stack */}
              <div className="flex -space-x-1.5">
                {escala.itens.slice(0, 5).map((item, i) => {
                  const soyEu = (userId && item.voluntarioId === userId) || (userName && item.voluntarioNome === userName);
                  const vazio = !item.voluntarioNome;
                  return (
                    <div
                      key={i}
                      title={vazio ? "Vaga em aberto" : item.voluntarioNome}
                      className={clsx(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white shrink-0",
                        soyEu ? "bg-gold-400 text-vine-900" : vazio ? "bg-gray-100 text-gray-400" : "bg-gray-200 text-gray-600"
                      )}
                    >
                      {vazio ? "?" : iniciais(item.voluntarioNome)}
                    </div>
                  );
                })}
                {escala.itens.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-500">
                    +{escala.itens.length - 5}
                  </div>
                )}
              </div>
              {euEstou && (
                <span className="text-[9px] font-bold text-gold-700 bg-gold-100 px-1.5 py-0.5 rounded-full">Você</span>
              )}
              <span className="text-[10px] text-gray-400 ml-auto">Ver equipe</span>
            </>
          )}
        </button>
      )}

      {/* Expanded: full team list */}
      {expanded && (
        <div className="flex-1">
          {escala.itens.length === 0 ? (
            <div className="px-4 py-4 text-xs text-amber-600 font-medium flex flex-col items-center gap-1.5 text-center">
              <AlertTriangle className="w-4 h-4" />
              Nenhum membro escalado ainda.
              {podeEditar && <button onClick={onEdit} className="text-vine-600 font-semibold hover:underline">Preencher equipe →</button>}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {escala.itens.map((item, idx) => {
                const soyEu = (userId && item.voluntarioId === userId) || (userName && item.voluntarioNome === userName);
                const vazio = !item.voluntarioNome;
                return (
                  <div
                    key={idx}
                    className={clsx(
                      "flex items-center gap-2.5 px-3 py-2",
                      soyEu ? "bg-gold-50" : vazio ? "bg-gray-50" : "hover:bg-gray-50"
                    )}
                  >
                    <div className={clsx(
                      "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                      soyEu ? "bg-gold-400 text-vine-950" : vazio ? "border-2 border-dashed border-gray-300 text-gray-300" : "bg-gray-100 text-gray-600"
                    )}>
                      {vazio ? "?" : iniciais(item.voluntarioNome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx("text-sm font-semibold truncate", soyEu ? "text-vine-800" : vazio ? "text-gray-400 italic" : "text-gray-700")}>
                        {vazio ? "Vaga em aberto" : item.voluntarioNome.split(" ")[0]}
                        {soyEu && <span className="ml-1.5 text-[9px] font-bold text-gold-700 bg-gold-100 px-1.5 py-0.5 rounded-full align-middle">Você</span>}
                      </p>
                      <p className="text-[11px] text-gray-400">{item.funcao}</p>
                    </div>
                    {item.observacao && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full max-w-[100px] truncate" title={item.observacao}>
                        {item.observacao}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Setlist */}
          {temMusicas && (
            <details className="border-t border-gray-100">
              <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-[11px] font-semibold text-gold-700 hover:bg-gold-50 transition select-none">
                <Music className="w-3.5 h-3.5" /> Setlist ({escala.musicas!.length})
              </summary>
              <ol className="list-decimal list-inside px-5 pb-3 pt-1 space-y-1">
                {escala.musicas!.map((m, i) => (
                  <li key={i} className="text-xs text-gray-600">
                    {m.titulo} {m.tom && <span className="font-semibold">({m.tom})</span>}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MinhaEscalaCompactCard ──────────────────────────────────────────────────
// Compact card for personal "Minhas Escalas" grid view

function MinhaEscalaCompactCard({
  escala, userId, userName,
}: {
  escala: Escala;
  userId?: string;
  userName?: string;
}) {
  const [setlistOpen, setSetlistOpen] = useState(false);
  const cor = MIN_COR[escala.ministerio];
  const meusItens = escala.itens.filter(
    (i) => i.voluntarioId === userId || i.voluntarioNome === userName
  );

  return (
    <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:shadow-sm transition">
      {/* Colored circle icon */}
      <div className={clsx(
        "w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 shadow-sm",
        cor?.header ?? "bg-vine-700 text-white"
      )}>
        {MIN_EMOJI[escala.ministerio] ?? "📋"}
      </div>

      <div className="flex-1 min-w-0">
        {/* Ministry badge + culto */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full", cor?.badge ?? "bg-vine-100 text-vine-800")}>
            {escala.ministerio}
          </span>
          <span className="text-[11px] text-gray-400 truncate">
            {escala.culto} · {escala.horario}
          </span>
        </div>

        {/* My functions */}
        {meusItens.length > 0 ? (
          meusItens.map((item, i) => (
            <div key={i} className="mt-1">
              <p className="text-sm font-bold text-gray-800">{item.funcao}</p>
              {item.observacao && (
                <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3" /> {item.observacao}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm font-bold text-gray-800 mt-1">Participando</p>
        )}

        {/* Setlist toggle */}
        {escala.musicas && escala.musicas.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setSetlistOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-semibold text-vine-600 hover:text-vine-800 transition"
            >
              <Music className="w-3 h-3" />
              {setlistOpen ? "Fechar setlist" : `Ver setlist (${escala.musicas.length})`}
            </button>
            {setlistOpen && (
              <ol className="mt-1.5 space-y-0.5 border-t border-gray-100 pt-1.5">
                {escala.musicas.map((m, i) => (
                  <li key={i} className="text-[11px] text-gray-500">
                    {i + 1}. <span className="font-medium text-gray-700">{m.titulo}</span>
                    {m.tom && <span className="text-gray-400"> ({m.tom})</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EscalaModal ─────────────────────────────────────────────────────────────

function EscalaModal({
  mode, date, form, setForm, membros, meusMinisterios, musicas, escalas, isAdmin, onSave, onClose,
}: {
  mode: "template" | "edit";
  date: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  membros: User[];
  meusMinisterios: Ministerio[];
  musicas: Musica[];
  escalas: Escala[];
  isAdmin: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const [secao, setSecao] = useState<"info" | "equipe" | "setlist">("info");
  const funcoes = FUNCOES_POR_MIN[form.ministerio] ?? ["Função"];

  // ── Live duplicate detection (template mode)
  // Ministérios que o usuário pode criar (admin = todos, líder = só os seus)
  const ministeriosDisponiveis: Ministerio[] = isAdmin ? MINISTERIOS_ESCALA : meusMinisterios;

  // Conflito: ministérios selecionados que já têm escala na data escolhida
  const ministeriosConflito: Ministerio[] = mode === "template" && form.data
    ? form.ministeriosSel.filter((m) => escalas.some((e) => e.data === form.data && e.ministerio === m))
    : [];
  const conflito = ministeriosConflito.length > 0;

  // ── Template mode canSave
  const canSaveTemplate = form.ministeriosSel.length > 0 && !!form.culto.trim() && !!form.horario && !!form.data && !conflito;
  // ── Edit mode canSave
  const canSaveEdit = !!form.culto.trim() && !!form.horario && !!form.ministerio;

  const titulo = mode === "template" ? "Nova escala" : "Editar escala";
  const subtitulo = mode === "template"
    ? "Preencha os dados e selecione os ministérios"
    : (form.ministerio ? `${MIN_EMOJI[form.ministerio] ?? ""} ${form.ministerio}` : "Editar");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900">{titulo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{subtitulo}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Template mode ── */}
        {mode === "template" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Date + info */}
              <div className="space-y-3">
                  {/* Date */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Data *</label>
                    <div className="relative">
                      <input
                        id="tmpl-date-input"
                        type="date"
                        value={form.data}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                        className={clsx(
                          "w-full border rounded-xl px-3 py-2.5 pr-10 text-sm outline-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
                          conflito ? "border-red-400 bg-red-50 focus:border-red-500" : "border-gray-200 focus:border-vine-400"
                        )}
                      />
                      <button type="button" tabIndex={-1}
                        onClick={() => (document.getElementById("tmpl-date-input") as HTMLInputElement | null)?.showPicker?.()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-vine-600 transition pointer-events-none"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    </div>
                    {conflito && (
                      <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1">
                        <span>⚠</span> {ministeriosConflito.join(", ")} já {ministeriosConflito.length === 1 ? "tem" : "têm"} escala neste dia. Escolha outra data.
                      </p>
                    )}
                  </div>
                  {/* Culto name */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome do culto *</label>
                    <input
                      value={form.culto}
                      onChange={(e) => setForm((f) => ({ ...f, culto: e.target.value }))}
                      placeholder="Ex: Culto Domingo 18h30"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400"
                    />
                  </div>
                  {/* Time */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Horário *</label>
                    <input
                      type="time"
                      value={form.horario}
                      onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400"
                    />
                  </div>
              </div>

              {/* Ministry selection */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Ministérios *</p>
                <div className="flex flex-wrap gap-2">
                  {ministeriosDisponiveis.map((m) => {
                    const sel = form.ministeriosSel.includes(m);
                    const temConflito = ministeriosConflito.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => setForm((f) => ({
                          ...f,
                          ministeriosSel: sel
                            ? f.ministeriosSel.filter((x) => x !== m)
                            : [...f.ministeriosSel, m],
                        }))}
                        className={clsx(
                          "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition",
                          temConflito
                            ? "border-red-400 bg-red-50 text-red-600"
                            : sel
                              ? clsx(MIN_COR[m]?.badge ?? "bg-vine-100 text-vine-800", "border-transparent")
                              : "border-gray-200 text-gray-600 bg-white hover:border-vine-300"
                        )}
                      >
                        <span>{temConflito ? "⚠" : MIN_EMOJI[m]}</span> {m}
                        {sel && !temConflito && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {!isAdmin && (
                  <p className="text-[11px] text-gray-400 mt-2">Você pode criar escalas apenas para seu(s) ministério(s).</p>
                )}
                {form.ministeriosSel.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-2">Selecione ao menos um ministério.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-200 transition">
                Cancelar
              </button>
              <button
                onClick={onSave}
                disabled={!canSaveTemplate}
                className="flex items-center gap-1.5 bg-vine-700 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-vine-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Plus className="w-4 h-4" /> Criar{form.ministeriosSel.length > 0 ? ` (${form.ministeriosSel.length})` : " escalas"}
              </button>
            </div>
          </>
        )}

        {/* ── Edit mode ── */}
        {mode === "edit" && (
          <>
            {/* Ministry badge (read-only in edit) */}
            {form.ministerio && (
              <div className="px-5 pt-3">
                <span className={clsx("inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full", MIN_COR[form.ministerio]?.badge ?? "bg-gray-100 text-gray-700")}>
                  {MIN_EMOJI[form.ministerio] ?? "📋"} {form.ministerio}
                </span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(["info", "equipe", "setlist"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSecao(s)}
                  className={clsx(
                    "flex-1 py-2.5 text-xs font-semibold transition",
                    secao === s ? "text-vine-700 border-b-2 border-vine-700 bg-vine-50" : "text-gray-400 hover:text-gray-700"
                  )}
                >
                  {s === "info" ? "📋 Informações" : s === "equipe" ? "👥 Equipe" : "🎵 Setlist"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {secao === "info" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome do culto *</label>
                    <input
                      value={form.culto}
                      onChange={(e) => setForm((f) => ({ ...f, culto: e.target.value }))}
                      placeholder="Ex: Culto Domingo 18h30"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Horário *</label>
                    <input
                      type="time"
                      value={form.horario}
                      onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-vine-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Data</label>
                    <div className="relative">
                      <input
                        id="edit-date-input"
                        type="date"
                        value={form.data}
                        onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-vine-400 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <button type="button" tabIndex={-1}
                        onClick={() => (document.getElementById("edit-date-input") as HTMLInputElement | null)?.showPicker?.()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-vine-600 transition pointer-events-none"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {secao === "equipe" && (
                <div className="space-y-3">
                  {/* Quick team presets for Louvor */}
                  {form.ministerio === "Louvor" && membros.length >= 3 && form.itens.length === 0 && (
                    <div className="bg-grape-50 border border-grape-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-grape-800 mb-2">⚡ Equipes pré-definidas</p>
                      <div className="flex gap-2 flex-wrap">
                        {[{ nome: "Equipe A", ids: membros.slice(0, 3) }, { nome: "Equipe B", ids: membros.slice(3, 6) }]
                          .filter((eq) => eq.ids.length > 0).map((eq) => (
                            <button key={eq.nome}
                              onClick={() => setForm((f) => ({ ...f, itens: eq.ids.map((u, i) => ({ funcao: funcoes[i] ?? funcoes[0] ?? "", voluntarioId: u.id, voluntarioNome: u.nome, observacao: "" })) }))}
                              className="text-xs font-semibold bg-grape-700 text-white px-3 py-1.5 rounded-lg hover:bg-grape-600 transition"
                            >
                              {eq.nome}: {eq.ids.map((u) => u.nome.split(" ")[0]).join(", ")}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {form.itens.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-4">Nenhum slot adicionado ainda.</p>
                  )}
                  {form.itens.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400 font-semibold mb-0.5 block">Função</label>
                            <select
                              value={item.funcao}
                              onChange={(e) => setForm((f) => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, funcao: e.target.value } : it) }))}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-vine-400 bg-white"
                            >
                              {funcoes.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 font-semibold mb-0.5 block">Membro</label>
                            <select
                              value={item.voluntarioId}
                              onChange={(e) => {
                                const m = membros.find((u) => u.id === e.target.value);
                                setForm((f) => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, voluntarioId: e.target.value, voluntarioNome: m?.nome ?? "" } : it) }));
                              }}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-vine-400 bg-white"
                            >
                              <option value="">— Selecionar —</option>
                              {membros.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                            </select>
                          </div>
                        </div>
                        <input
                          value={item.observacao}
                          onChange={(e) => setForm((f) => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, observacao: e.target.value } : it) }))}
                          placeholder="Observação (opcional)"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-vine-400 bg-white"
                        />
                      </div>
                      <button
                        onClick={() => setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }))}
                        className="w-7 h-7 rounded-full hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition shrink-0 mt-5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => setForm((f) => ({ ...f, itens: [...f.itens, { funcao: funcoes[0] ?? "", voluntarioId: "", voluntarioNome: "", observacao: "" }] }))}
                    className="w-full flex items-center justify-center gap-1.5 border border-dashed border-vine-300 text-vine-600 text-xs font-semibold py-3 rounded-xl hover:bg-vine-50 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar slot / vaga
                  </button>

                  {membros.length === 0 && form.ministerio && (
                    <p className="text-xs text-amber-600 text-center bg-amber-50 rounded-xl py-2 px-3">
                      Nenhum membro ativo encontrado para {form.ministerio}.
                    </p>
                  )}
                </div>
              )}

              {secao === "setlist" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-3">Selecione as músicas do setlist para este culto.</p>
                  {musicas.map((m) => {
                    const selected = form.musicas.some((x) => x.musicaId === m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => setForm((f) => {
                          const exists = f.musicas.find((x) => x.musicaId === m.id);
                          return { ...f, musicas: exists ? f.musicas.filter((x) => x.musicaId !== m.id) : [...f.musicas, { musicaId: m.id, titulo: m.titulo, artista: m.artista, tom: m.tom }] };
                        })}
                        className={clsx("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition", selected ? "bg-vine-50 border-vine-300" : "bg-white border-gray-200 hover:border-vine-200 hover:bg-gray-50")}
                      >
                        <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition", selected ? "border-vine-600 bg-vine-600" : "border-gray-300")}>
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{m.titulo}</p>
                          <p className="text-xs text-gray-400">{m.artista}{m.tom && ` · Tom ${m.tom}`}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-200 transition">
                Cancelar
              </button>
              <button
                onClick={onSave}
                disabled={!canSaveEdit}
                className="flex items-center gap-1.5 bg-vine-700 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-vine-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Save className="w-4 h-4" /> Salvar alterações
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ─── (end of file) ───────────────────────────────────────────────────────────
