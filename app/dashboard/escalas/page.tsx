"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { mockEscalas, mockMusicas } from "@/lib/mockData";
import { Escala, EscalaMusica, FuncaoEscala, ItemEscala, Ministerio, User } from "@/types";
import {
  Star, MessageCircle, Pencil, Trash2, Plus, X, Check,
  Save, Music, ChevronDown, ChevronUp, Filter, AlertTriangle, Calendar,
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

const HORARIOS = ["08:00","09:00","09:30","10:00","10:30","18:00","18:30","19:00","20:00","20:30"];
const TODOS_MINISTERIOS = Object.keys(MIN_COR) as Ministerio[];

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
  ministerio: Ministerio | "";
  itens: FormItem[];
  musicas: EscalaMusica[];
}
const EMPTY_FORM: FormState = { data: new Date().toISOString().split("T")[0], culto: "", horario: "18:30", ministerio: "", itens: [], musicas: [] };

// ─── main page ───────────────────────────────────────────────────────────────

export default function EscalasPage() {
  const { user, usuarios, temPermissao } = useAuth();
  const podeCriar = temPermissao("criar_escala");
  const meusMinisterios = (user?.ministerios ?? []) as Ministerio[];

  const [escalas, setEscalas] = useState<Escala[]>([...mockEscalas]);
  const [tab, setTab] = useState<"minhas" | "geral">("minhas");
  const [filterMin, setFilterMin] = useState<"todos" | "meus" | Ministerio>("todos");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; date: string; escalaId?: string; ministerio?: Ministerio } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [copied, setCopied] = useState<string | null>(null);

  // group escalas by date, filtered by ministry
  const escalasVisiveis = useMemo(() => {
    if (filterMin === "todos") return escalas;
    if (filterMin === "meus") return escalas.filter((e) => meusMinisterios.includes(e.ministerio));
    return escalas.filter((e) => e.ministerio === filterMin);
  }, [escalas, filterMin, meusMinisterios]);

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

  function openCreate(date: string, ministerio?: Ministerio) {
    const min = ministerio ?? meusMinisterios[0] ?? "" as Ministerio;
    setForm({ ...EMPTY_FORM, data: date, ministerio: min });
    setModal({ mode: "create", date, ministerio: min });
  }
  function openEdit(escala: Escala) {
    setForm({
      data: escala.data, culto: escala.culto, horario: escala.horario, ministerio: escala.ministerio,
      itens: escala.itens.map((i) => ({ funcao: i.funcao, voluntarioId: i.voluntarioId, voluntarioNome: i.voluntarioNome, observacao: i.observacao ?? "" })),
      musicas: escala.musicas ?? [],
    });
    setModal({ mode: "edit", date: escala.data, escalaId: escala.id });
  }
  function deleteEscala(id: string) {
    if (!confirm("Remover esta escala?")) return;
    setEscalas((prev) => prev.filter((e) => e.id !== id));
  }
  function saveModal() {
    if (!form.culto.trim() || !form.horario || !form.ministerio) return;
    if (modal?.mode === "create") {
      const nova: Escala = {
        id: `esc_${Date.now()}`,
        ministerio: form.ministerio as Ministerio,
        data: form.data,
        horario: form.horario,
        culto: form.culto.trim(),
        itens: form.itens.map((i) => ({ funcao: i.funcao as FuncaoEscala, voluntarioId: i.voluntarioId, voluntarioNome: i.voluntarioNome, observacao: i.observacao || undefined })),
        musicas: form.musicas.length > 0 ? form.musicas : undefined,
        criadoPor: user?.nome ?? "",
      };
      setEscalas((prev) => [...prev, nova]);
    } else if (modal?.mode === "edit" && modal.escalaId) {
      setEscalas((prev) => prev.map((e) => e.id !== modal.escalaId ? e : {
        ...e, culto: form.culto.trim(), horario: form.horario, ministerio: form.ministerio as Ministerio,
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
            onClick={() => openCreate(new Date().toISOString().split("T")[0])}
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
        <div className="space-y-5">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 shrink-0">
              <Filter className="w-3.5 h-3.5" /> Filtrar:
            </span>
            {([
              { id: "todos", label: "Todos" },
              ...(meusMinisterios.length > 0 ? [{ id: "meus", label: "Meus ministérios" }] : []),
              ...TODOS_MINISTERIOS.map((m) => ({ id: m, label: `${MIN_EMOJI[m]} ${m}` })),
            ] as { id: "todos" | "meus" | Ministerio; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilterMin(filterMin === id ? "todos" : id)}
                className={clsx(
                  "px-3 py-1 rounded-full text-xs font-semibold border transition whitespace-nowrap",
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

          {porDataOrdenada.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhuma escala encontrada.</p>
              {podeCriar && (
                <button onClick={() => openCreate(new Date().toISOString().split("T")[0])} className="mt-3 text-xs text-vine-600 font-semibold hover:underline">
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
                    meusMinisterios={meusMinisterios}
                    copied={copied}
                    ministeriosUsuarioNaData={conflitoPorData.get(data) ?? []}
                    onEdit={openEdit}
                    onDelete={deleteEscala}
                    onCopy={copiarWhatsApp}
                    onAddEscala={(min) => openCreate(data, min)}
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
          musicas={mockMusicas}
          onSave={saveModal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── EventoBlock ─────────────────────────────────────────────────────────────

function EventoBlock({
  data, escalas, isPast, userId, userName, podeCriar, meusMinisterios, copied,
  ministeriosUsuarioNaData, onEdit, onDelete, onCopy, onAddEscala,
}: {
  data: string;
  escalas: Escala[];
  isPast: boolean;
  userId?: string;
  userName?: string;
  podeCriar: boolean;
  meusMinisterios: Ministerio[];
  copied: string | null;
  ministeriosUsuarioNaData: string[];
  onEdit: (e: Escala) => void;
  onDelete: (id: string) => void;
  onCopy: (e: Escala) => void;
  onAddEscala: (min?: Ministerio) => void;
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

      {/* Ministry cards */}
      <div className="space-y-3">
        {escalas.map((escala) => (
          <MinisterioCard
            key={escala.id}
            escala={escala}
            userId={userId}
            userName={userName}
            podeEditar={podeCriar && meusMinisterios.includes(escala.ministerio)}
            copied={copied === escala.id}
            onEdit={() => onEdit(escala)}
            onDelete={() => onDelete(escala.id)}
            onCopy={() => onCopy(escala)}
          />
        ))}
        {podeCriar && (
          <button
            onClick={() => onAddEscala(meusMinisterios[0])}
            className="w-full flex items-center justify-center gap-1.5 border border-dashed border-gray-200 text-gray-400 hover:border-vine-300 hover:text-vine-600 text-xs font-semibold py-3 rounded-2xl transition"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar ministério a este culto
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MinisterioCard ───────────────────────────────────────────────────────────

function MinisterioCard({
  escala, userId, userName, podeEditar, copied, onEdit, onDelete, onCopy,
}: {
  escala: Escala;
  userId?: string;
  userName?: string;
  podeEditar: boolean;
  copied: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const cor = MIN_COR[escala.ministerio];
  const temMusicas = escala.musicas && escala.musicas.length > 0;
  const totalSlots = escala.itens.length;
  const preenchidos = escala.itens.filter((i) => i.voluntarioNome).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Ministry header */}
      <div className={clsx("px-4 py-3 flex items-center justify-between", cor?.header ?? "bg-vine-700 text-white")}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2.5 flex-1 text-left"
        >
          <span className="text-lg">{MIN_EMOJI[escala.ministerio] ?? "📋"}</span>
          <div>
            <p className="font-bold text-sm">{escala.ministerio}</p>
            <p className="text-[11px] opacity-70">
              {preenchidos}/{totalSlots} {totalSlots === 1 ? "vaga" : "vagas"} preenchidas
            </p>
          </div>
          <span className="ml-auto opacity-70">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        <div className="flex items-center gap-1 ml-3">
          {podeEditar && (
            <>
              <button
                onClick={onEdit}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
                title="Editar escala"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-red-400/40 flex items-center justify-center transition"
                title="Remover escala"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onCopy}
            className={clsx(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition",
              copied
                ? "bg-green-500/30 text-white"
                : "bg-white/20 hover:bg-white/30 text-white"
            )}
            title="Copiar para WhatsApp"
          >
            {copied ? <Check className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
            {copied ? "Copiado!" : "WhatsApp"}
          </button>
        </div>
      </div>

      {/* Team list */}
      {expanded && (
        <>
          {escala.itens.length === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-400 italic text-center">
              Nenhum membro escalado ainda.
              {podeEditar && (
                <button onClick={onEdit} className="ml-2 text-vine-600 font-semibold hover:underline">Preencher →</button>
              )}
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
                      "flex items-center gap-3 px-4 py-2.5",
                      soyEu ? "bg-gold-50" : vazio ? "bg-gray-50" : "hover:bg-gray-50"
                    )}
                  >
                    <div className={clsx(
                      "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                      soyEu ? "bg-gold-400 text-vine-950" : vazio ? "border-2 border-dashed border-gray-300 bg-transparent text-gray-300" : "bg-gray-100 text-gray-600"
                    )}>
                      {vazio ? "?" : iniciais(item.voluntarioNome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx("text-sm font-semibold truncate", soyEu ? "text-vine-800" : vazio ? "text-gray-400 italic" : "text-gray-700")}>
                        {vazio ? "Vaga em aberto" : item.voluntarioNome.split(" ")[0]}
                        {soyEu && <span className="ml-1.5 text-[9px] font-bold text-gold-700 bg-gold-100 px-1.5 py-0.5 rounded-full align-middle">Você</span>}
                      </p>
                      <p className="text-xs text-gray-400">{item.funcao}</p>
                    </div>
                    {item.observacao && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full max-w-[120px] truncate" title={item.observacao}>
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
              <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer text-xs font-semibold text-gold-700 hover:bg-gold-50 transition select-none">
                <Music className="w-3.5 h-3.5" /> Setlist ({escala.musicas!.length} músicas)
              </summary>
              <ol className="list-decimal list-inside px-6 pb-3 pt-1 space-y-1">
                {escala.musicas!.map((m, i) => (
                  <li key={i} className="text-xs text-gray-600">
                    {m.titulo} {m.tom && <span className="font-semibold">({m.tom})</span>} — <span className="text-gray-400">{m.artista}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
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

interface Musica { id: string; titulo: string; artista: string; tom?: string; }

function EscalaModal({
  mode, date, form, setForm, membros, meusMinisterios, musicas, onSave, onClose,
}: {
  mode: "create" | "edit";
  date: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  membros: User[];
  meusMinisterios: Ministerio[];
  musicas: Musica[];
  onSave: () => void;
  onClose: () => void;
}) {
  const [secao, setSecao] = useState<"info" | "equipe" | "setlist">("info");
  const funcoes = FUNCOES_POR_MIN[form.ministerio] ?? ["Função"];
  const canSave = !!form.culto.trim() && !!form.horario && !!form.ministerio;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900">{mode === "create" ? "Nova escala" : "Editar escala"}</p>
            <p className="text-xs text-gray-400 capitalize">
              {form.data ? new Date(form.data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "Selecione a data"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {secao === "info" && (
            <div className="space-y-4">
              {/* Ministry selector */}
              {meusMinisterios.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Ministério *</label>
                  <div className="flex flex-wrap gap-2">
                    {meusMinisterios.map((m) => {
                      const sel = form.ministerio === m;
                      const cor = MIN_COR[m];
                      return (
                        <button
                          key={m}
                          onClick={() => setForm((f) => ({ ...f, ministerio: m, itens: [] }))}
                          className={clsx(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition",
                            sel ? (cor?.header ?? "bg-vine-700 text-white") + " border-transparent" : "bg-white border-gray-200 text-gray-600 hover:border-vine-300"
                          )}
                        >
                          {MIN_EMOJI[m]} {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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

              {/* Date input */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Data *</label>
                <div className="relative">
                  <input
                    id="escala-date-input"
                    type="date"
                    value={form.data}
                    min={mode === "create" ? new Date().toISOString().split("T")[0] : undefined}
                    onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:border-vine-400 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      const el = document.getElementById("escala-date-input") as HTMLInputElement | null;
                      el?.showPicker?.();
                    }}
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
              {/* Modelo: Equipes (Louvor) vs Slots (outros) */}
              {form.ministerio === "Louvor" && membros.length >= 3 && form.itens.length === 0 && (
                <div className="bg-grape-50 border border-grape-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-grape-800 mb-2">⚡ Equipes pré-definidas</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { nome: "Equipe A", ids: membros.slice(0, 3) },
                      { nome: "Equipe B", ids: membros.slice(3, 6) },
                    ].filter((eq) => eq.ids.length > 0).map((eq) => (
                      <button
                        key={eq.nome}
                        onClick={() => setForm((f) => ({
                          ...f,
                          itens: eq.ids.map((u, i) => ({ funcao: funcoes[i] ?? funcoes[0] ?? "", voluntarioId: u.id, voluntarioNome: u.nome, observacao: "" })),
                        }))}
                        className="text-xs font-semibold bg-grape-700 text-white px-3 py-1.5 rounded-lg hover:bg-grape-600 transition"
                      >
                        {eq.nome}: {eq.ids.map((u) => u.nome.split(" ")[0]).join(", ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Slot list */}
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
                      return {
                        ...f,
                        musicas: exists
                          ? f.musicas.filter((x) => x.musicaId !== m.id)
                          : [...f.musicas, { musicaId: m.id, titulo: m.titulo, artista: m.artista, tom: m.tom }],
                      };
                    })}
                    className={clsx(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition",
                      selected ? "bg-vine-50 border-vine-300" : "bg-white border-gray-200 hover:border-vine-200 hover:bg-gray-50"
                    )}
                  >
                    <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition", selected ? "border-vine-600 bg-vine-600" : "border-gray-300")}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.titulo}</p>
                      <p className="text-xs text-gray-400">{m.artista}{m.tom && ` · Tom ${m.tom}`}</p>
                    </div>
                    {selected && <span className="text-[10px] text-vine-600 font-semibold bg-vine-100 px-2 py-0.5 rounded-full">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-200 transition">
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="flex items-center gap-1.5 bg-vine-700 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-vine-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Save className="w-4 h-4" /> {mode === "create" ? "Criar escala" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
