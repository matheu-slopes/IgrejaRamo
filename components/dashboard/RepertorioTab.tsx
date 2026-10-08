"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Archive, Check, ChevronDown, ExternalLink, LoaderCircle,
  Music2, Pencil, Play, Plus, RotateCcw, Search, Trash2, X,
} from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { Musica } from "@/types";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { linhaDeTab, materiaisDaMusica, musicaDoBanco, TONS_REPERTORIO, transporCifra } from "@/lib/repertorioMusic";

type MusicaRepertorio = Musica & { arquivada?: boolean; created_at?: string };
type FormMusica = Pick<Musica, "titulo" | "artista" | "tom" | "linkYoutube" | "cifra" | "cifraUrl">;
type ProjetoResumo = { id: string; status: string; musica_id?: string | null; bpm?: number | null; escala_usos?: { musica_id?: string | null }[] };

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

export function RepertorioTab({ podeGerenciar, onAbrirEnsaio, onPrepararEnsaio }: {
  podeGerenciar: boolean;
  onAbrirEnsaio?: (projetoId: string) => void;
  onPrepararEnsaio?: (musica: Musica) => void;
}) {
  const [musicas, setMusicas] = useState<MusicaRepertorio[]>([]);
  const [usoPorMusica, setUsoPorMusica] = useState<Map<string, number>>(new Map());
  const [busca, setBusca] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState("todas");
  const [filtroArtista, setFiltroArtista] = useState("");
  const [filtroTom, setFiltroTom] = useState("");
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [studioDisponivel, setStudioDisponivel] = useState(false);
  const [studioCarregando, setStudioCarregando] = useState(true);
  const [tomDeLeitura, setTomDeLeitura] = useState<{ musicaId: string; tom: string } | null>(null);
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
    setStudioCarregando(true);
    const consultaStudio = supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.access_token) return null;
      const response = await fetch("/api/louvor-studio/projects?resumo=1", {
        cache: "no-store", signal: AbortSignal.timeout(8_000),
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) return null;
      return await response.json() as { projetos?: ProjetoResumo[] };
    }).catch(() => null);
    // Os áudios são complementares: uma indisponibilidade do Studio não atrasa o catálogo.
    void consultaStudio.then((studio) => {
      setStudioDisponivel(Boolean(studio));
      if (studio) setProjetos(studio.projetos ?? []);
      setStudioCarregando(false);
    });
    const [{ data: repertorio, error: erroRepertorio }, { data: escalasMusicas, error: erroUso }] = await Promise.all([
      supabase.from("musicas").select("*").order("titulo"),
      supabase.from("escala_musicas").select("musica_id"),
    ]);
    if (erroRepertorio) setErro(erroRepertorio.message);
    else {
      setMusicas((repertorio ?? []).map(musicaDoBanco));
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

  useEffect(() => {
    if (!projetos.some((projeto) => !["concluido", "erro"].includes(projeto.status))) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [carregar, projetos]);

  const ensaioPorMusica = useMemo(() => {
    const mapa = new Map<string, ProjetoResumo>();
    for (const projeto of projetos) {
      const ids = new Set([projeto.musica_id, ...(projeto.escala_usos ?? []).map((uso) => uso.musica_id)]);
      for (const id of ids) {
        if (!id) continue;
        const atual = mapa.get(id);
        if (!atual || (atual.status !== "concluido" && projeto.status === "concluido")) mapa.set(id, projeto);
      }
    }
    return mapa;
  }, [projetos]);
  const artistas = [...new Set(musicas.filter((musica) => !musica.arquivada).map((musica) => musica.artista))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const tons = [...new Set(musicas.filter((musica) => !musica.arquivada && musica.tom).map((musica) => musica.tom!))].sort();

  const visiveis = useMemo(() => {
    const termo = normalizar(busca).trim();
    return musicas
      .filter((musica) => mostrarArquivadas || !musica.arquivada)
      .filter((musica) => !termo || [musica.titulo, musica.artista, musica.cifra].some((valor) => normalizar(valor).includes(termo)))
      .filter((musica) => (!filtroArtista || musica.artista === filtroArtista) && (!filtroTom || musica.tom === filtroTom))
      .filter((musica) => {
        const materiais = materiaisDaMusica(musica);
        return filtroMaterial === "todas" || (filtroMaterial === "letra" && materiais.letra)
          || (filtroMaterial === "cifra" && materiais.cifra) || (filtroMaterial === "sem-cifra" && !materiais.cifra)
          || (filtroMaterial === "transposicao" && materiais.transposicao)
          || (filtroMaterial === "ensaio" && studioDisponivel && ensaioPorMusica.get(musica.id)?.status === "concluido");
      })
      .sort((a, b) => Number(a.arquivada) - Number(b.arquivada) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  }, [busca, mostrarArquivadas, musicas, filtroArtista, filtroTom, filtroMaterial, ensaioPorMusica, studioDisponivel]);

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
    const salva = musicaDoBanco(resultado.data);
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
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Repertório</h2>
          <p className="mt-1 text-sm text-gray-500">Organize as músicas, os tons e as referências do ministério.</p>
        </div>
        {podeGerenciar && <button onClick={abrirNovo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"><Plus className="h-4 w-4" /> Adicionar música</button>}
      </div>

      {erro && <div role="alert" className="flex gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{erro}</div>}

      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input aria-label="Buscar no repertório" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar música, artista ou trecho da letra" className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" /></label>
        <select aria-label="Filtrar por artista" value={filtroArtista} onChange={(event) => setFiltroArtista(event.target.value)} className="max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600"><option value="">Todos os artistas</option>{artistas.map((artista) => <option key={artista}>{artista}</option>)}</select>
        <select aria-label="Filtrar por tom" value={filtroTom} onChange={(event) => setFiltroTom(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600"><option value="">Todos os tons</option>{tons.map((tom) => <option key={tom}>{tom}</option>)}</select>
        <select aria-label="Filtrar por material disponível" value={filtroMaterial} onChange={(event) => setFiltroMaterial(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600"><option value="todas">Todos os materiais</option><option value="letra">Com letra</option><option value="cifra">Com cifra</option><option value="sem-cifra">Sem cifra</option><option value="transposicao">Com transposição</option><option value="ensaio">Com ensaio</option></select>
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
          <input aria-label="Link da cifra" value={form.cifraUrl} onChange={(event) => setForm((atual) => ({ ...atual, cifraUrl: event.target.value }))} placeholder="Link da cifra (opcional)" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400" />
          <textarea value={form.cifra} onChange={(event) => setForm((atual) => ({ ...atual, cifra: event.target.value }))} placeholder="Letra ou cifra com acordes (opcional)" rows={6} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-xs outline-none focus:border-rose-400" />
          <p className="mt-1 text-xs text-gray-500">Você pode cadastrar somente a letra e completar a cifra depois. Para transpor, informe também o tom original da cifra.</p>
          <div className="mt-3 flex justify-end gap-2"><button onClick={() => setEditando(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-white">Cancelar</button><button disabled={salvando || !form.titulo.trim() || !form.artista.trim()} onClick={() => void salvar()} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{salvando ? "Salvando…" : "Salvar"}</button></div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-500">{carregando ? "Carregando repertório…" : `${visiveis.length} música${visiveis.length === 1 ? "" : "s"}${mostrarArquivadas ? " (incluindo arquivadas)" : ""}`}</div>
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_70px_60px_140px_24px] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 md:grid"><span>Música e materiais</span><span>Artista</span><span>Tom</span><span>BPM</span><span>Ensaio</span><span /></div>
        {carregando && !dadosCarregados ? <div className="flex justify-center p-10"><LoaderCircle className="h-5 w-5 animate-spin text-rose-700" /></div> : !dadosCarregados ? <div className="flex flex-col items-center gap-2 p-10 text-center"><p className="text-sm text-gray-500">Não foi possível abrir o repertório.</p><button type="button" onClick={() => void carregar()} className="text-sm font-semibold text-rose-700 hover:underline">Tentar novamente</button></div> : visiveis.length === 0 ? <p className="p-10 text-center text-sm text-gray-400">Nenhuma música encontrada.</p> : <div className="divide-y divide-gray-100">{visiveis.map((musica) => {
          const aberta = selecionadaId === musica.id;
          const usos = usoPorMusica.get(musica.id) ?? 0;
          const materiais = materiaisDaMusica(musica);
          const ensaio = studioDisponivel ? ensaioPorMusica.get(musica.id) : undefined;
          const tomExibido = tomDeLeitura?.musicaId === musica.id ? tomDeLeitura.tom : musica.tom ?? "";
          const cifraExibida = transporCifra(musica.cifra ?? "", musica.tom ?? "", tomExibido);
          const temTabs = Boolean(musica.cifra?.split("\n").some(linhaDeTab));
          return <article key={musica.id} className={clsx(musica.arquivada && "bg-gray-50/70 opacity-70")}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_70px_60px_140px_24px]">
              <button aria-expanded={aberta} aria-controls={`musica-${musica.id}`} onClick={() => { setSelecionadaId(aberta ? null : musica.id); setTomDeLeitura(null); setTabsVisiveisDaMusica(null); }} className="min-w-0 text-left"><p className="break-words text-sm font-semibold text-gray-900">{musica.titulo}</p><p className="mt-1 text-xs text-gray-500 md:hidden">{musica.artista} · Tom {musica.tom || "a definir"}</p><span className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-medium">{materiais.letra && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">Letra</span>}{materiais.cifra && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">Cifra</span>}{materiais.transposicao && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Transposição</span>}{musica.linkYoutube && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">Referência</span>}{!materiais.cifra && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Sem cifra</span>}{musica.arquivada && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600">Arquivada</span>}</span></button>
              <span className="hidden text-xs text-gray-600 md:block">{musica.artista}</span>
              <span className="hidden text-xs font-semibold text-gray-600 md:block">{musica.tom || "A definir"}</span>
              <span className="hidden text-xs text-gray-500 md:block">{ensaio?.bpm ? Math.round(ensaio.bpm) : "—"}</span>
              <div className="col-start-1 row-start-2 text-xs md:col-auto md:row-auto">
                <p role="status" className={ensaio?.status === "concluido" ? "text-emerald-600" : ensaio?.status === "erro" ? "text-red-600" : "text-gray-400"}>{!studioDisponivel ? studioCarregando ? "Consultando ensaio…" : "Ensaio indisponível" : ensaio?.status === "concluido" ? "● Disponível" : ensaio?.status === "erro" ? "Falha na preparação" : ensaio ? "Preparando ensaio" : "Não preparado"}</p>
                {ensaio?.status === "concluido" && onAbrirEnsaio
                  ? <button type="button" onClick={() => onAbrirEnsaio(ensaio.id)} className="mt-1 inline-flex items-center gap-1 font-semibold text-rose-700 hover:underline"><Play className="h-3 w-3" />Ensaiar</button>
                  : ensaio && onAbrirEnsaio
                    ? <button type="button" onClick={() => onAbrirEnsaio(ensaio.id)} className="mt-1 font-semibold text-rose-700 hover:underline">{ensaio.status === "erro" ? "Ver falha" : "Ver andamento"}</button>
                    : studioDisponivel && onPrepararEnsaio && <button type="button" onClick={() => onPrepararEnsaio(musica)} className="mt-1 font-semibold text-rose-700 hover:underline">Preparar ensaio</button>}
              </div>
              <button type="button" aria-label={`${aberta ? "Recolher" : "Ver"} detalhes de ${musica.titulo}`} onClick={() => { setSelecionadaId(aberta ? null : musica.id); setTomDeLeitura(null); }} className="col-start-2 row-start-1 rounded-lg p-1 text-gray-400 hover:bg-gray-100 md:col-auto md:row-auto"><ChevronDown className={clsx("h-4 w-4 transition", aberta && "rotate-180")} /></button>
            </div>
            {aberta && <div id={`musica-${musica.id}`} className="border-t border-gray-100 bg-gray-50/50 px-4 py-4"><p className="mb-3 text-xs text-gray-500">{usos ? `Usada em ${usos} escala${usos === 1 ? "" : "s"}.` : "Ainda não usada em uma escala."}</p><div className="flex flex-wrap gap-2">
              {musica.linkYoutube && <a href={musica.linkYoutube} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"><ExternalLink className="h-3.5 w-3.5" /> Vídeo</a>}
              {musica.cifraUrl && <a href={musica.cifraUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Music2 className="h-3.5 w-3.5" /> Cifra Club</a>}
              {podeGerenciar && <button onClick={() => abrirEdicao(musica)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"><Pencil className="h-3.5 w-3.5" /> Editar</button>}
              {podeGerenciar && <button onClick={() => void arquivar(musica, !musica.arquivada)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100">{musica.arquivada ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{musica.arquivada ? "Restaurar" : "Arquivar"}</button>}
              {podeGerenciar && <button disabled={usos > 0} title={usos > 0 ? "Não é possível excluir uma música que já foi usada em escala" : "Excluir definitivamente"} onClick={() => void excluir(musica)} className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>}
            </div>{musica.cifra && <><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold text-gray-600">{materiais.cifra ? "Cifra e letra" : "Letra"}</p><div className="flex flex-wrap items-center gap-3">{materiais.transposicao && <label className="flex items-center gap-2 text-xs text-gray-500">Tom de leitura<select value={tomExibido} onChange={(event) => setTomDeLeitura({ musicaId: musica.id, tom: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-800">{TONS_REPERTORIO.filter((tom) => tom.endsWith("m") === Boolean(musica.tom?.endsWith("m"))).map((tom) => <option key={tom}>{tom}</option>)}</select></label>}{temTabs && <button type="button" onClick={() => setTabsVisiveisDaMusica((atual) => atual === musica.id ? null : musica.id)} className="text-xs font-medium text-rose-700 hover:text-rose-800">{tabsVisiveisDaMusica === musica.id ? "Ocultar tabs" : "Ver tabs"}</button>}</div></div>{materiais.transposicao && <p className="mt-2 text-[11px] text-gray-500">Tom original: {musica.tom}. A transposição altera somente esta leitura.{temTabs && tabsVisiveisDaMusica === musica.id && " A tablatura permanece no tom original."}</p>}<pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-gray-100 bg-white p-4 font-mono text-xs leading-6 text-gray-700">{tabsVisiveisDaMusica === musica.id ? cifraExibida : cifraSemTabs(cifraExibida)}</pre></>}{!musica.cifra && <p className="mt-3 text-xs text-gray-400">Letra e cifra ainda não cadastradas.</p>}{materiais.cifra && !materiais.transposicao && <p className="mt-2 text-xs text-amber-700">Informe o tom original para habilitar a transposição da cifra.</p>}</div>}
          </article>;
        })}</div>}
      </section>
    </div>
  );
}
