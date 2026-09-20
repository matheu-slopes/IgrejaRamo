"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Archive, Check, ChevronDown, ExternalLink, LoaderCircle,
  Music2, Pencil, Plus, RotateCcw, Search, Trash2, X,
} from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { Musica } from "@/types";
import { useAppRefresh } from "@/hooks/useAppRefresh";

type MusicaRepertorio = Musica & { arquivada?: boolean; created_at?: string };
type FormMusica = Pick<Musica, "titulo" | "artista" | "tom" | "linkYoutube" | "cifra" | "cifraUrl">;

const FORM_VAZIO: FormMusica = { titulo: "", artista: "", tom: "", linkYoutube: "", cifra: "", cifraUrl: "" };

function normalizar(valor: string | undefined) {
  return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function isLinhaDeTab(line: string) {
  return /^\s*[EBGDAe]\s*\|/.test(line)
    || /^\s*\[Tab[\s\-]/i.test(line)
    || /^\s*Parte\s+\d+\s+de\s+\d+/i.test(line);
}

function cifraSemTabs(cifra: string) {
  return cifra.split("\n")
    .filter((linha) => !isLinhaDeTab(linha))
    .reduce<string[]>((linhas, linha) => {
      if (linha.trim() === "" && linhas.at(-1)?.trim() === "") return linhas;
      linhas.push(linha);
      return linhas;
    }, [])
    .join("\n");
}

export function RepertorioTab({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [musicas, setMusicas] = useState<MusicaRepertorio[]>([]);
  const [usoPorMusica, setUsoPorMusica] = useState<Map<string, number>>(new Map());
  const [busca, setBusca] = useState("");
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [tabsVisiveisDaMusica, setTabsVisiveisDaMusica] = useState<string | null>(null);
  const [editando, setEditando] = useState<MusicaRepertorio | null>(null);
  const [form, setForm] = useState<FormMusica>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const [{ data: repertorio, error: erroRepertorio }, { data: escalasMusicas, error: erroUso }] = await Promise.all([
      supabase.from("musicas").select("*").order("titulo"),
      supabase.from("escala_musicas").select("musica_id"),
    ]);
    if (erroRepertorio) setErro(erroRepertorio.message);
    else {
      setMusicas((repertorio ?? []) as MusicaRepertorio[]);
      const usos = new Map<string, number>();
      for (const item of escalasMusicas ?? []) {
        const id = item.musica_id as string | null;
        if (id) usos.set(id, (usos.get(id) ?? 0) + 1);
      }
      setUsoPorMusica(usos);
      setDadosCarregados(true);
      if (erroUso) console.warn("Não foi possível contar usos do repertório:", erroUso.message);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useAppRefresh(() => { void carregar(); }, [carregar], { minIntervalMs: 2500 });

  const visiveis = useMemo(() => {
    const termo = normalizar(busca).trim();
    return musicas
      .filter((musica) => mostrarArquivadas || !musica.arquivada)
      .filter((musica) => !termo || [musica.titulo, musica.artista, musica.cifra].some((valor) => normalizar(valor).includes(termo)))
      .sort((a, b) => Number(a.arquivada) - Number(b.arquivada) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  }, [busca, mostrarArquivadas, musicas]);

  const selecionada = musicas.find((musica) => musica.id === selecionadaId) ?? null;

  function abrirNovo() {
    setErro(null);
    setEditando({ id: "", titulo: "", artista: "" });
    setForm(FORM_VAZIO);
  }

  function abrirEdicao(musica: MusicaRepertorio) {
    setErro(null);
    setEditando(musica);
    setForm({
      titulo: musica.titulo, artista: musica.artista, tom: musica.tom ?? "",
      linkYoutube: musica.linkYoutube ?? "", cifra: musica.cifra ?? "", cifraUrl: musica.cifraUrl ?? "",
    });
  }

  async function salvar() {
    if (!editando || !form.titulo.trim() || !form.artista.trim() || salvando) return;
    setSalvando(true);
    setErro(null);
    const payload = {
      titulo: form.titulo.trim(), artista: form.artista.trim(), tom: form.tom?.trim() || null,
      link_youtube: form.linkYoutube?.trim() || null, cifra: form.cifra?.trim() || null,
      cifra_url: form.cifraUrl?.trim() || null,
    };
    const resultado = editando.id
      ? await supabase.from("musicas").update(payload).eq("id", editando.id).select().single()
      : await supabase.from("musicas").insert(payload).select().single();
    setSalvando(false);
    if (resultado.error) { setErro(resultado.error.message); return; }
    const salva = resultado.data as MusicaRepertorio;
    setMusicas((atual) => editando.id
      ? atual.map((musica) => musica.id === salva.id ? salva : musica)
      : [...atual, salva]);
    setSelecionadaId(salva.id);
    setEditando(null);
  }

  async function arquivar(musica: MusicaRepertorio, arquivada: boolean) {
    setErro(null);
    const { error } = await supabase.from("musicas").update({ arquivada }).eq("id", musica.id);
    if (error) { setErro(error.message); return; }
    setMusicas((atual) => atual.map((item) => item.id === musica.id ? { ...item, arquivada } : item));
    if (arquivada && selecionadaId === musica.id) setSelecionadaId(null);
  }

  async function excluir(musica: MusicaRepertorio) {
    const usos = usoPorMusica.get(musica.id) ?? 0;
    if (usos > 0) return;
    if (!window.confirm(`Excluir “${musica.titulo}”? Esta ação não pode ser desfeita.`)) return;
    setErro(null);
    const { error } = await supabase.from("musicas").delete().eq("id", musica.id);
    if (error) { setErro(error.message); return; }
    setMusicas((atual) => atual.filter((item) => item.id !== musica.id));
    if (selecionadaId === musica.id) setSelecionadaId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-rose-700">Repertório do Louvor</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">Músicas da igreja</h2>
          <p className="mt-1 text-sm text-gray-500">{podeGerenciar ? "Você gerencia o catálogo. Arquive músicas antigas para preservar o histórico das escalas." : "Consulte cifras, letras e referências. Apenas líderes e administradores gerenciam o catálogo."}</p>
        </div>
        {podeGerenciar && <button onClick={abrirNovo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"><Plus className="h-4 w-4" /> Nova música</button>}
      </div>

      {erro && <div role="alert" className="flex gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{erro}</div>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Título, artista ou trecho da cifra..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" /></label>
        {podeGerenciar && <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600"><input type="checkbox" checked={mostrarArquivadas} onChange={(event) => setMostrarArquivadas(event.target.checked)} className="rounded border-gray-300 text-rose-700 focus:ring-rose-400" /> Ver arquivadas</label>}
      </div>

      {editando && (
        <section className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-gray-900">{editando.id ? "Editar música" : "Nova música"}</h3><button onClick={() => setEditando(null)} className="rounded-lg p-1.5 text-gray-500 hover:bg-white"><X className="h-4 w-4" /></button></div>
          <div className="grid gap-2 md:grid-cols-2">
            <input value={form.titulo} onChange={(event) => setForm((atual) => ({ ...atual, titulo: event.target.value }))} placeholder="Título" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400" />
            <input value={form.artista} onChange={(event) => setForm((atual) => ({ ...atual, artista: event.target.value }))} placeholder="Artista / banda" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400" />
            <input value={form.tom} onChange={(event) => setForm((atual) => ({ ...atual, tom: event.target.value }))} placeholder="Tom original (opcional)" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400" />
            <input value={form.linkYoutube} onChange={(event) => setForm((atual) => ({ ...atual, linkYoutube: event.target.value }))} placeholder="Link do vídeo de referência" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400" />
          </div>
          <textarea value={form.cifra} onChange={(event) => setForm((atual) => ({ ...atual, cifra: event.target.value }))} placeholder="Cifra e letra (opcional)" rows={6} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-xs outline-none focus:border-rose-400" />
          <div className="mt-3 flex justify-end gap-2"><button onClick={() => setEditando(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-white">Cancelar</button><button disabled={salvando || !form.titulo.trim() || !form.artista.trim()} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{salvando ? "Salvando…" : "Salvar"}</button></div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-500">{carregando ? "Carregando repertório…" : `${visiveis.length} música${visiveis.length === 1 ? "" : "s"}${mostrarArquivadas ? " (incluindo arquivadas)" : ""}`}</div>
        {carregando ? <div className="flex justify-center p-10"><LoaderCircle className="h-5 w-5 animate-spin text-rose-700" /></div> : !dadosCarregados ? <div className="flex flex-col items-center gap-2 p-10 text-center"><p className="text-sm text-gray-500">Não foi possível abrir o repertório.</p><button type="button" onClick={() => void carregar()} className="text-sm font-semibold text-rose-700 hover:underline">Tentar novamente</button></div> : visiveis.length === 0 ? <p className="p-10 text-center text-sm text-gray-400">Nenhuma música encontrada.</p> : <div className="divide-y divide-gray-100">{visiveis.map((musica) => {
          const aberta = selecionadaId === musica.id;
          const usos = usoPorMusica.get(musica.id) ?? 0;
          return <article key={musica.id} className={clsx(musica.arquivada && "bg-gray-50/70 opacity-70")}>
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => { setSelecionadaId(aberta ? null : musica.id); if (aberta) setTabsVisiveisDaMusica(null); }} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-semibold text-gray-900">{musica.titulo}</p><p className="truncate text-xs text-gray-500">{musica.artista}{musica.tom ? ` · tom original ${musica.tom}` : ""}{usos ? ` · usada em ${usos} escala${usos === 1 ? "" : "s"}` : ""}</p></button>
              {musica.arquivada && <span className="rounded-full bg-gray-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600">Arquivada</span>}
              <ChevronDown className={clsx("h-4 w-4 text-gray-400 transition", aberta && "rotate-180")} />
            </div>
            {aberta && <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3"><div className="flex flex-wrap gap-2">
              {musica.linkYoutube && <a href={musica.linkYoutube} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"><ExternalLink className="h-3.5 w-3.5" /> Vídeo</a>}
              {musica.cifraUrl && <a href={musica.cifraUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Music2 className="h-3.5 w-3.5" /> Cifra Club</a>}
              {podeGerenciar && <button onClick={() => abrirEdicao(musica)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"><Pencil className="h-3.5 w-3.5" /> Editar</button>}
              {podeGerenciar && <button onClick={() => void arquivar(musica, !musica.arquivada)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100">{musica.arquivada ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{musica.arquivada ? "Restaurar" : "Arquivar"}</button>}
              {podeGerenciar && <button disabled={usos > 0} title={usos > 0 ? "Não é possível excluir uma música que já foi usada em escala" : "Excluir definitivamente"} onClick={() => void excluir(musica)} className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>}
            </div>{musica.cifra && <><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-gray-500">Letra e acordes</p><button type="button" onClick={() => setTabsVisiveisDaMusica((atual) => atual === musica.id ? null : musica.id)} className="text-xs font-medium text-rose-700 hover:text-rose-800">{tabsVisiveisDaMusica === musica.id ? "Ocultar tabs" : "Ver tabs"}</button></div><pre className="mt-1.5 max-h-64 overflow-auto rounded-xl border border-gray-100 bg-white p-3 whitespace-pre-wrap font-mono text-xs leading-5 text-gray-700">{tabsVisiveisDaMusica === musica.id ? musica.cifra : cifraSemTabs(musica.cifra)}</pre></>}{!musica.cifra && <p className="mt-3 text-xs text-gray-400">Cifra ainda não cadastrada.</p>}</div>}
          </article>;
        })}</div>}
      </section>
    </div>
  );
}
