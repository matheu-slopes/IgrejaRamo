"use client";

import { useState, useEffect, useRef } from "react";
import {
  X, Pencil, Trash2, Save, Plus, Music2,
  ChevronUp as ArrowUp, ChevronDown as ArrowDown, Search, Youtube,
} from "lucide-react";
import clsx from "clsx";
import {
  Escala, EscalaMusica, FuncaoEscala, ItemEscala,
  Ministerio, MembroMinisterio, Musica, FuncaoMinisterio,
} from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  FUNCOES_POR_MIN, TEMPLATES_CULTO, TONS,
  proximasDatas, formatDateSimples,
} from "@/components/dashboard/EscalasTab";

// ─── tipos locais ─────────────────────────────────────────────────────────────
type Mode = "view" | "edit";
type SubTab = "detalhes" | "participantes" | "musicas";

interface EscalaForm {
  culto: string;
  data: string;
  horario: string;
  observacoes: string;
  visivel: boolean;
  itens: ItemEscala[];
  musicas: EscalaMusica[];
}

function toForm(esc: Escala): EscalaForm {
  return {
    culto: esc.culto,
    data: esc.data,
    horario: esc.horario,
    observacoes: esc.observacoes ?? "",
    visivel: esc.visivel ?? true,
    itens: [...esc.itens],
    musicas: [...(esc.musicas ?? [])],
  };
}

// ─── cores ────────────────────────────────────────────────────────────────────
function corBg(culto: string) {
  if (culto.includes("Quinta"))   return "bg-grape-50";
  if (culto.includes("Domingo"))  return "bg-gold-50";
  if (culto.includes("Especial")) return "bg-blue-50";
  return "bg-gray-50";
}
function corBadge(culto: string) {
  if (culto.includes("Quinta"))   return "bg-grape-100 text-grape-900";
  if (culto.includes("Domingo"))  return "bg-gold-100 text-gold-900";
  if (culto.includes("Especial")) return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-black";
}

// ─── componente principal ─────────────────────────────────────────────────────
interface Props {
  escala: Escala;
  podeEditar: boolean;
  onClose: () => void;
  onUpdate: (esc: Escala) => void;
  onDelete: (id: string) => void;
}

export function EscalaModal({ escala, podeEditar, onClose, onUpdate, onDelete }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("view");
  const [subTab, setSubTab] = useState<SubTab>("detalhes");
  const [form, setForm] = useState<EscalaForm>(toForm(escala));
  const [membros, setMembros] = useState<MembroMinisterio[]>([]);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [novoMembroId, setNovoMembroId] = useState("");
  const [novaFuncao, setNovaFuncao] = useState<string>(
    (FUNCOES_POR_MIN[escala.ministerio] ?? FUNCOES_POR_MIN.Louvor)[0]
  );
  const [novaObs, setNovaObs] = useState("");
  const [buscaMusica, setBuscaMusica] = useState("");
  const [tomOverride, setTomOverride] = useState<Record<string, string>>({});
  const [addingNova, setAddingNova] = useState(false);
  const [novaMusica, setNovaMusica] = useState({ titulo: "", artista: "", tom: "" });
  const [savingNova, setSavingNova] = useState(false);
  const [saving, setSaving] = useState(false);
  const [salvarErro, setSalvarErro] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Busca membros e músicas ao abrir edit
  useEffect(() => {
    if (mode !== "edit") return;
    supabase.from("perfis")
      .select("id, nome, email, telefone, role")
      .contains("ministerios", [escala.ministerio])
      .eq("ativo", true)
      .then(({ data }) => {
        if (data) setMembros(data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          nome: p.nome as string,
          email: (p.email ?? "") as string,
          funcao: (p.role === "pastor" || p.role === "lider" ? "Líder" : "Membro") as FuncaoMinisterio,
          ministerio: escala.ministerio,
          ativo: true,
          dataEntrada: "",
        })));
      });
    supabase.from("musicas").select().order("titulo").then(({ data }) => {
      if (data) setMusicas(data as Musica[]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Fecha ao clicar no backdrop
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  // ESC fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── salvar ──────────────────────────────────────────────────────────────────
  async function salvar() {
    if (!form.culto || !form.data || !form.horario) return;
    setSaving(true);
    setSalvarErro("");
    try {
      const { error: errUpdate } = await supabase.from("escalas").update({
        culto: form.culto,
        horario: form.horario,
        data: form.data,
        observacoes: form.observacoes || null,
        visivel: form.visivel,
      }).eq("id", escala.id);
      if (errUpdate) throw new Error(errUpdate.message);

      const { error: errDelItens } = await supabase.from("escala_itens").delete().eq("escala_id", escala.id);
      if (errDelItens) throw new Error(errDelItens.message);
      if (form.itens.length > 0) {
        const { error: errInsItens } = await supabase.from("escala_itens").insert(
          form.itens.map((i) => ({
            escala_id: escala.id,
            funcao: i.funcao,
            voluntario_id: i.voluntarioId || null,
            voluntario_nome: i.voluntarioNome,
            observacao: i.observacao || null,
          }))
        );
        if (errInsItens) throw new Error(errInsItens.message);
      }

      const { error: errDelMusicas } = await supabase.from("escala_musicas").delete().eq("escala_id", escala.id);
      if (errDelMusicas) throw new Error(errDelMusicas.message);
      if (form.musicas.length > 0) {
        const { error: errInsMusicas } = await supabase.from("escala_musicas").insert(
          form.musicas.map((m, idx) => ({
            escala_id: escala.id,
            musica_id: m.musicaId || null,
            titulo: m.titulo,
            artista: m.artista,
            tom: m.tom,
            ordem: idx,
          }))
        );
        if (errInsMusicas) throw new Error(errInsMusicas.message);
      }

      const updated: Escala = { ...escala, ...form };
      onUpdate(updated);
      setMode("view");
    } catch (err) {
      setSalvarErro(err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  // ── participantes ────────────────────────────────────────────────────────────
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

  // ── músicas ──────────────────────────────────────────────────────────────────
  const musicasFiltradas = musicas.filter((m) =>
    m.titulo.toLowerCase().includes(buscaMusica.toLowerCase()) ||
    m.artista.toLowerCase().includes(buscaMusica.toLowerCase())
  );
  function youtubeUrl(titulo: string, artista: string) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${titulo} ${artista}`)}`;
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

  function moverMusica(idx: number, dir: -1 | 1) {
    const arr = [...form.musicas];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setForm((f) => ({ ...f, musicas: arr }));
  }

  // ── header info (view mode) ───────────────────────────────────────────────────
  const d = escala.data ? new Date(escala.data + "T00:00:00") : null;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle — mobile only */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* ── Header ── */}
        <div className={clsx("px-6 py-4 border-b border-gray-100", corBg(form.culto))}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-gray-900 text-lg leading-tight">{form.culto || escala.culto}</h2>
                {form.visivel
                  ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Publicada</span>
                  : <span className="text-[10px] bg-white/70 text-gray-500 font-bold px-2 py-0.5 rounded-full">Rascunho</span>
                }
              </div>
              {d && (
                <p className="text-sm text-gray-600 font-medium">
                  {d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  {" · "}{form.horario || escala.horario}
                </p>
              )}
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{escala.ministerio}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {podeEditar && mode === "view" && (
                <>
                  <button
                    onClick={() => { setForm(toForm(escala)); setMode("edit"); setSubTab("detalhes"); }}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white/70 rounded-xl transition"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-white/70 rounded-xl transition"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white/70 rounded-xl transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Confirm delete ── */}
        {confirmDelete && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 rounded-2xl">
            <div className="text-center space-y-4 px-8">
              <p className="text-base font-bold text-gray-800">Excluir esta escala?</p>
              <div className="text-left text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 space-y-1">
                <p><span className="font-semibold">Culto:</span> {escala.culto}</p>
                <p><span className="font-semibold">Ministério:</span> {escala.ministerio}</p>
                <p><span className="font-semibold">Data:</span> {formatDateSimples(escala.data)}</p>
                <p><span className="font-semibold">Horário:</span> {escala.horario}</p>
              </div>
              <p className="text-sm text-gray-500">Esta ação não pode ser desfeita.</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { onDelete(escala.id); onClose(); }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Conteúdo scrollável ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ VIEW MODE ══════════════════════════════════════════════════════ */}
          {mode === "view" && (
            <div className="px-6 py-5 space-y-6">
              {/* Participantes */}
              {escala.itens.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Participantes · {escala.itens.length}
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
                        {escala.itens.map((it, i) => (
                          <tr key={i} className={it.voluntarioId === user?.id ? "bg-gray-50" : ""}>
                            <td className="px-3 py-2.5">
                              <span className="text-xs font-bold text-grape-800 bg-grape-50 px-2 py-0.5 rounded-full">
                                {it.funcao}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-800 text-sm">
                              {it.voluntarioNome}
                              {it.voluntarioId === user?.id && (
                                <span className="ml-1.5 text-[10px] bg-black text-white px-1.5 py-0.5 rounded-full font-bold">você</span>
                              )}
                              {it.observacao && (
                                <p className="text-xs text-gray-400 font-normal mt-0.5">{it.observacao}</p>
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
              {(escala.musicas ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Músicas · {(escala.musicas ?? []).length}
                  </p>
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-center text-xs font-semibold text-gray-400 px-2 py-2 w-7">#</th>
                          <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2">Música</th>
                          <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2 w-16">Tom</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(escala.musicas ?? []).map((m, i) => (
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
              {escala.observacoes && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Observações</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed">
                    {escala.observacoes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══ EDIT MODE ══════════════════════════════════════════════════════ */}
          {mode === "edit" && (
            <div className="px-6 py-4 space-y-4">
              {/* Sub-tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                {(["detalhes", "participantes", "musicas"] as SubTab[]).map((t) => {
                  return (
                    <button
                      key={t}
                      onClick={() => setSubTab(t)}
                      className={clsx(
                        "flex-1 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition truncate px-1",
                        subTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      {t === "detalhes" && "Detalhes"}
                      {t === "participantes" && (
                        <>
                          <span className="hidden sm:inline">Participantes</span>
                          <span className="sm:hidden">Membros</span>
                          {form.itens.length ? ` · ${form.itens.length}` : ""}
                        </>
                      )}
                      {t === "musicas" && (
                        <>
                          <span>Músicas</span>
                          {form.musicas.length ? ` · ${form.musicas.length}` : ""}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ─── Detalhes ─── */}
              {subTab === "detalhes" && (
                <div className="space-y-4">
                  {/* Tipo de culto */}
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
                            form.culto === t.label ? t.cor + " ring-2 ring-offset-1 ring-gray-400" : t.cor
                          )}
                        >{t.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Datas rápidas */}
                  {(form.culto === "Culto de Quinta" || form.culto === "Culto de Domingo") && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-widest">Data</p>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1">Data</label>
                      <input
                        type="date"
                        value={form.data}
                        onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1">Horário</label>
                      <input
                        type="time"
                        value={form.horario}
                        onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1">Observações</label>
                    <textarea
                      value={form.observacoes}
                      onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.visivel}
                      onChange={(e) => setForm((f) => ({ ...f, visivel: e.target.checked }))}
                      className="w-4 h-4 accent-black"
                    />
                    <span className="text-sm text-gray-700 font-medium">Publicar escala (visível para os membros)</span>
                  </label>
                </div>
              )}

              {/* ─── Participantes ─── */}
              {subTab === "participantes" && (
                <div className="space-y-4">
                  {/* Add row */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex gap-2 flex-1">
                      <select
                        value={novaFuncao}
                        onChange={(e) => setNovaFuncao(e.target.value)}
                        className="flex-1 sm:flex-initial border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
                      >
                        {(FUNCOES_POR_MIN[escala.ministerio] ?? FUNCOES_POR_MIN.Louvor).map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                      <select
                        value={novoMembroId}
                        onChange={(e) => setNovoMembroId(e.target.value)}
                        className="flex-[2] sm:flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 min-w-0 bg-white"
                      >
                        <option value="">Selecionar membro...</option>
                        {membros.map((m) => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={addParticipante}
                      disabled={!novoMembroId}
                      className="flex items-center justify-center gap-1 px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition disabled:opacity-40 w-full sm:w-auto shrink-0"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span className="sm:hidden">Adicionar Integrante</span>
                    </button>
                  </div>

                  {/* Lista */}
                  {form.itens.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhum participante adicionado.</p>
                  ) : (
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2">Função</th>
                            <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2">Nome</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {form.itens.map((it, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2.5">
                                <span className="text-xs font-bold text-grape-800 bg-grape-50 px-2 py-0.5 rounded-full">{it.funcao}</span>
                              </td>
                              <td className="px-3 py-2.5 font-medium text-gray-800">{it.voluntarioNome}</td>
                              <td className="pr-2">
                                <button
                                  onClick={() => setForm((f) => ({ ...f, itens: f.itens.filter((_, j) => j !== i) }))}
                                  className="p-1.5 text-gray-300 hover:text-red-500 transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Músicas ─── */}
              {subTab === "musicas" && (
                <div className="space-y-4">
                  {/* Lista atual */}
                  {form.musicas.length > 0 && (
                    <div className="space-y-1">
                      {form.musicas.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                          <span className="w-5 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{m.titulo}</p>
                            <p className="text-xs text-gray-400 truncate">{m.artista}</p>
                          </div>
                          <select
                            value={m.tom}
                            onChange={(e) => setForm((f) => ({
                              ...f,
                              musicas: f.musicas.map((ms, j) => j === i ? { ...ms, tom: e.target.value } : ms)
                            }))}
                            className="text-xs border border-gray-200 rounded-lg px-1 py-1 outline-none w-16 text-center"
                          >
                            <option value="">Tom</option>
                            {TONS.map((t) => <option key={t}>{t}</option>)}
                          </select>
                          <div className="flex flex-col">
                            <button onClick={() => moverMusica(i, -1)} disabled={i === 0} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"><ArrowUp className="w-3 h-3" /></button>
                            <button onClick={() => moverMusica(i, 1)} disabled={i === form.musicas.length - 1} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"><ArrowDown className="w-3 h-3" /></button>
                          </div>
                          <button
                            onClick={() => setForm((f) => ({ ...f, musicas: f.musicas.filter((_, j) => j !== i) }))}
                            className="p-1.5 text-gray-300 hover:text-red-500 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Busca para adicionar */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      <input
                        value={buscaMusica}
                        onChange={(e) => setBuscaMusica(e.target.value)}
                        placeholder="Buscar música..."
                        className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-sm outline-none focus:border-gray-400"
                      />
                    </div>
                    {buscaMusica && (
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                        {musicasFiltradas.slice(0, 8).map((m) => {
                          const jaAdicionada = form.musicas.some((em) => em.musicaId === m.id);
                          return (
                            <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50 transition">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{m.titulo}</p>
                                <p className="text-xs text-gray-400 truncate">{m.artista}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <a
                                  href={youtubeUrl(m.titulo, m.artista)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                  title="Ouvir no YouTube"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Youtube className="w-3.5 h-3.5" />
                                </a>
                                <select
                                  value={tomOverride[m.id] ?? m.tom ?? ""}
                                  onChange={(e) => setTomOverride((prev) => ({ ...prev, [m.id]: e.target.value }))}
                                  className="text-xs border border-gray-200 rounded-lg px-1 py-0.5 outline-none w-16 text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="">Tom</option>
                                  {TONS.map((t) => <option key={t}>{t}</option>)}
                                </select>
                                <button
                                  onClick={() => addMusica(m)}
                                  disabled={jaAdicionada}
                                  className="p-1.5 text-white bg-black rounded-lg hover:bg-gray-900 transition disabled:opacity-30"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {musicasFiltradas.length === 0 && (
                          <p className="text-xs text-gray-400 px-3 py-3 text-center">Nenhuma música encontrada.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Nova música */}
                  <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setAddingNova((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition"
                    >
                      <span className="flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> Nova música</span>
                      {addingNova ? <X className="w-3.5 h-3.5 text-gray-400" /> : null}
                    </button>
                    {addingNova && (
                      <div className="px-3 pb-3 pt-1 space-y-2 bg-gray-50/40">
                        <div className="flex gap-2">
                          <input
                            value={novaMusica.titulo}
                            onChange={(e) => setNovaMusica((n) => ({ ...n, titulo: e.target.value }))}
                            placeholder="Título"
                            className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-gray-400 bg-white"
                          />
                          <select
                            value={novaMusica.tom}
                            onChange={(e) => setNovaMusica((n) => ({ ...n, tom: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none bg-white w-20"
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
                            className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-gray-400 bg-white"
                          />
                          <button
                            onClick={salvarNovaMusica}
                            disabled={savingNova || !novaMusica.titulo.trim() || !novaMusica.artista.trim()}
                            className="px-3 py-1.5 text-sm font-bold text-white bg-black rounded-lg hover:bg-gray-900 transition disabled:opacity-40"
                          >
                            {savingNova ? "..." : "+ Add"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer de ações (edit mode) ── */}
        {mode === "edit" && (
          <div className="px-6 py-3 border-t border-gray-100 bg-white flex flex-col gap-2">
            {salvarErro && (
              <p className="text-xs text-red-600 text-right font-medium">{salvarErro}</p>
            )}
             <div className="flex items-center justify-end gap-2 shrink-0">
               <button
                 onClick={() => { setMode("view"); setSalvarErro(""); }}
                 className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 rounded-xl hover:bg-gray-200 transition whitespace-nowrap"
               >
                 Cancelar
               </button>
               <button
                 onClick={salvar}
                 disabled={saving || !form.culto || !form.data || !form.horario}
                 className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-black rounded-xl hover:bg-gray-900 transition disabled:opacity-50 whitespace-nowrap shrink-0"
               >
                 <Save className="w-4 h-4 shrink-0" />
                 <span>{saving ? "Salvando..." : "Salvar"}</span>
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
