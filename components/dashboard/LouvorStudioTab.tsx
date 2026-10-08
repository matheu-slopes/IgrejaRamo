"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, CircleStop, Disc3, Download, LoaderCircle, Music2, Search, Sparkles, Trash2 } from "lucide-react";
import { LouvorStudioPlayer } from "./LouvorStudioPlayer";
import { supabase } from "@/lib/supabase";
import { withDeadline } from "@/lib/withDeadline";
import { useAppRefresh } from "@/hooks/useAppRefresh";

type SearchResult = {
  id: string;
  titulo: string;
  artista: string;
  duracao?: number;
  url: string;
  thumbnailUrl?: string;
};

type Projeto = {
  id: string;
  titulo: string;
  artista?: string | null;
  youtube_url: string;
  thumbnail_url?: string | null;
  status: "aguardando" | "baixando" | "analisando" | "separando" | "concluido" | "erro";
  progresso: number;
  tom_original?: string | null;
  tom_base_confirmado?: string | null;
  tom_alvo?: string | null;
  bpm?: number | null;
  duracao_segundos?: number | null;
  audio_url?: string | null;
  stem_urls?: Partial<Record<StemName, string | null>>;
  separation_mode?: string;
  visibilidade?: "equipe" | "pessoal";
  erro?: string | null;
  criado_em: string;
  musica_id?: string | null;
  escalas?: { id: string; culto: string; data: string; horario: string } | null;
  escala_usos?: { escala_id: string; musica_id: string | null }[];
  musicas?: { tom?: string | null } | null;
};

type EscalaOption = {
  id: string; culto: string; data: string; horario: string;
  escala_musicas: { musica_id: string | null; titulo: string; artista: string; tom: string | null; bpm: number | null; studio_projeto_id: string | null }[];
};

type StemName = "vocals" | "drums" | "bass" | "other" | "instrumental";

type MusicaDaFilaStudio = {
  musicaId: string;
  titulo: string;
  artista: string;
  youtubeUrl?: string;
};

export type AnaliseStudioInicial = MusicaDaFilaStudio & {
  id: string;
  escalaId?: string;
  escalaContexto?: { culto: string; data: string; horario: string; tom?: string; bpm?: number };
  fila?: MusicaDaFilaStudio[];
};

const STATUS_LABEL: Record<Projeto["status"], string> = {
  aguardando: "Na fila",
  baixando: "Baixando áudio",
  analisando: "Analisando tom e BPM",
  separando: "Separando instrumentos",
  concluido: "Pronto",
  erro: "Falha no processamento",
};

function projetoDaMusica(project: Projeto, analise: AnaliseStudioInicial, musicaId: string) {
  if (!analise.escalaId) return project.musica_id === musicaId || Boolean(project.escala_usos?.some((uso) => uso.musica_id === musicaId));
  return (project.musica_id === musicaId && project.escalas?.id === analise.escalaId)
    || Boolean(project.escala_usos?.some((uso) => uso.escala_id === analise.escalaId && uso.musica_id === musicaId));
}

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function studioFetch(url: string, init?: RequestInit) {
  const accessToken = await token();
  init?.signal?.throwIfAborted();
  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
}

function formatDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return "--:--";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

export function LouvorStudioTab({
  podeGerenciar,
  podePrepararEnsaio,
  workerConfigurado,
  analiseInicial,
  projetoInicialId,
  onVoltarParaEscalas,
  onVoltar,
  origem = "escalas",
}: {
  podeGerenciar: boolean;
  podePrepararEnsaio: boolean;
  workerConfigurado: boolean;
  analiseInicial?: AnaliseStudioInicial | null;
  projetoInicialId?: string | null;
  onVoltarParaEscalas?: (escalaId: string) => void;
  onVoltar: () => void;
  origem?: "escalas" | "repertorio";
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [escalas, setEscalas] = useState<EscalaOption[]>([]);
  const [videoConfirmado, setVideoConfirmado] = useState<SearchResult | null>(null);
  const [buscandoOutraVersao, setBuscandoOutraVersao] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(projetoInicialId ?? null);
  const projetoInicialAberto = useRef<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [indiceDaFila, setIndiceDaFila] = useState(0);
  const podePreparar = podeGerenciar || podePrepararEnsaio;

  const filaDaEscala = analiseInicial
    ? (analiseInicial.fila?.length ? analiseInicial.fila : [analiseInicial])
    : [];
  const analiseAtual = filaDaEscala[indiceDaFila] ?? filaDaEscala[0] ?? null;

  useEffect(() => {
    if (!analiseAtual) return;
    setQuery(`${analiseAtual.titulo} ${analiseAtual.artista}`.trim());
    setVideoConfirmado(null);
    setBuscandoOutraVersao(false);
    setResults([]);
    setMessage(null);
  }, [analiseAtual?.musicaId, analiseAtual?.titulo, analiseAtual?.artista]);

  const videoSugeridoDoRepertorio: SearchResult | null = analiseAtual?.youtubeUrl
    ? {
      id: `repertorio-${analiseAtual.musicaId}`,
      titulo: analiseAtual.titulo,
      artista: analiseAtual.artista,
      url: analiseAtual.youtubeUrl,
    }
    : null;
  const fluxoDaEscala = Boolean(analiseInicial?.escalaId);
  const escalaDoFluxo = escalas.find((escala) => escala.id === analiseInicial?.escalaId)
    ?? (analiseInicial?.escalaId && analiseInicial.escalaContexto ? { id: analiseInicial.escalaId, ...analiseInicial.escalaContexto, escala_musicas: [] } : undefined);
  const videoDiretoDoRepertorio = Boolean(
    videoSugeridoDoRepertorio && !/youtube\.com\/results/i.test(videoSugeridoDoRepertorio.url),
  );

  const loadProjects = useCallback(async () => {
    try {
      const response = await studioFetch("/api/louvor-studio/projects");
      const data = await response.json().catch(() => ({})) as { projetos?: Projeto[]; escalas?: EscalaOption[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar o ensaio.");
      setErroCarregamento(null);
      setProjects(data.projetos ?? []);
      setEscalas(data.escalas ?? []);
      setSelectedId((current) => {
        const pertenceAoContexto = (project: Projeto) => !analiseAtual || !analiseInicial || projetoDaMusica(project, analiseInicial, analiseAtual.musicaId);
        if (data.projetos?.some((project) => project.id === current && pertenceAoContexto(project))) return current;
        if (!analiseAtual || !analiseInicial) return null;
        return data.projetos?.find((project) => pertenceAoContexto(project))?.id ?? null;
      });
    } catch (error) {
      setErroCarregamento(error instanceof Error ? error.message : "Não foi possível carregar o ensaio.");
    } finally {
      setCarregando(false);
    }
  }, [analiseAtual, analiseInicial]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProjects(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProjects]);

  useAppRefresh(() => { void loadProjects(); }, [loadProjects], { minIntervalMs: 2500 });

  const pending = projects.some((project) => !["concluido", "erro"].includes(project.status));
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => void loadProjects(), 5000);
    return () => window.clearInterval(timer);
  }, [loadProjects, pending]);

  async function pesquisar(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2 || !podePreparar || searching) return;
    setSearching(true);
    setMessage(null);
    setResults([]);
    setVideoConfirmado(null);
    try {
      const data = await withDeadline(async (signal) => {
        const response = await studioFetch("/api/louvor-studio/search", {
          method: "POST",
          body: JSON.stringify({ query }),
          signal,
        });
        const payload = await response.json().catch(() => ({})) as { resultados?: SearchResult[]; error?: string; detail?: string };
        if (!response.ok) throw new Error(payload.error ?? payload.detail ?? "A pesquisa falhou.");
        return payload;
      }, 22_000);
      setResults(data.resultados ?? []);
      if (!data.resultados?.length) setMessage("Nenhum resultado encontrado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A pesquisa falhou.");
    } finally {
      setSearching(false);
    }
  }

  async function processar(result: SearchResult) {
    if (preparando) return;
    setPreparando(true);
    setMessage(null);
    try {
      const data = await withDeadline(async (signal) => {
        const response = await studioFetch("/api/louvor-studio/projects", {
          method: "POST",
          body: JSON.stringify({
            url: result.url,
            titulo: result.titulo,
            artista: result.artista,
            thumbnailUrl: result.thumbnailUrl,
            // No fluxo vindo da Escala, ela continua sendo a fonte de verdade mesmo
            // enquanto a lista de cultos ainda estiver carregando.
            escalaId: analiseInicial?.escalaId,
            musicaId: analiseAtual?.musicaId,
          }),
          signal,
        });
        const payload = await response.json().catch(() => ({})) as { projeto?: Projeto; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível iniciar o processamento.");
        return payload;
      }, 25_000);
      setResults([]);
      setQuery("");
      setVideoConfirmado(null);
      setBuscandoOutraVersao(false);
      setSelectedId(data.projeto?.id ?? null);
      await loadProjects();
      if (fluxoDaEscala && indiceDaFila < filaDaEscala.length - 1) {
        setIndiceDaFila((indice) => indice + 1);
      }
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === "TimeoutError"
          ? "A criação da análise demorou demais. Verifique a conexão e tente novamente."
          : error instanceof Error ? error.message : "Não foi possível iniciar o processamento.",
      );
    } finally {
      setPreparando(false);
    }
  }

  async function excluir(project: Projeto) {
    if (
      !window.confirm(
        `Excluir “${project.titulo}”? As faixas preparadas e os downloads desta música serão removidos.`,
      )
    )
      return;
    setDeletingId(project.id);
    setMessage(null);
    try {
      const response = await studioFetch(
        `/api/louvor-studio/projects/${project.id}`,
        { method: "DELETE" },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw Error(data.error ?? "Não foi possível excluir.");
      setProjects((current) => current.filter((item) => item.id !== project.id));
      if (selectedId === project.id) onVoltar();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setDeletingId(null);
    }
  }

  async function cancelarProcessamento(project: Projeto) {
    if (cancellingId || ["concluido", "erro"].includes(project.status)) return;
    if (!window.confirm(`Cancelar o processamento de "${project.titulo}"? A musica sera removida da fila e os arquivos parciais serao apagados.`)) return;
    setCancellingId(project.id);
    setMessage(null);
    try {
      const response = await studioFetch(`/api/louvor-studio/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancelar" }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nao foi possivel cancelar o processamento.");
      setProjects((current) => current.filter((item) => item.id !== project.id));
      if (selectedId === project.id) onVoltar();
      await loadProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel cancelar o processamento.");
    } finally {
      setCancellingId(null);
    }
  }
  async function tentarNovamente(project: Projeto) {
    if (retryingId || project.status !== "erro") return;
    setRetryingId(project.id);
    setMessage(null);
    try {
      const response = await studioFetch(`/api/louvor-studio/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "retry" }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível tentar novamente.");
      await loadProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível tentar novamente.");
    } finally {
      setRetryingId(null);
    }
  }

  async function confirmarTomNaEscala(project: Projeto, escolha: { tom: string; bpm?: number }) {
    const escalaIdDaEscolha = analiseInicial?.escalaId;
    const musicaIdDaEscolha = analiseAtual?.musicaId;
    if (applyingId || !escalaIdDaEscolha || !musicaIdDaEscolha) return;
    setApplyingId(project.id);
    setMessage(null);
    try {
      const response = await studioFetch(`/api/louvor-studio/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "definir_tom_da_escala", tom: escolha.tom, bpm: escolha.bpm, escalaId: escalaIdDaEscolha, musicaId: musicaIdDaEscolha }),
      });
      const data = await response.json().catch(() => ({})) as { tom?: string | null; bpm?: number | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível confirmar o tom.");
      setMessage(`Tom ${data.tom ?? ""} confirmado nesta escala${data.bpm ? ` · ${Math.round(data.bpm)} BPM` : ""}.`);
      await loadProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar o tom.");
    } finally {
      setApplyingId(null);
    }
  }

  const selected = projects.find((project) => project.id === selectedId && (!analiseInicial || !analiseAtual || projetoDaMusica(project, analiseInicial, analiseAtual.musicaId))) ?? null;
  useEffect(() => {
    if (selected?.status !== "concluido" || projetoInicialAberto.current === selected.id) return;
    projetoInicialAberto.current = selected.id;
    void studioFetch(`/api/louvor-studio/projects/${selected.id}`, { method: "PATCH", body: JSON.stringify({ action: "usar" }) }).catch(() => {});
  }, [selected?.id, selected?.status]);
  const contextoEfetivo = analiseInicial?.escalaId && analiseAtual
    ? { escalaId: analiseInicial.escalaId, musicaId: analiseAtual.musicaId }
    : null;
  const escalaNoContexto = escalas.find((escala) => escala.id === contextoEfetivo?.escalaId)
    ?? (contextoEfetivo?.escalaId === analiseInicial?.escalaId ? escalaDoFluxo : undefined);
  const musicaNoContexto = escalaNoContexto?.escala_musicas.find((musica) => musica.musica_id === contextoEfetivo?.musicaId)
    ?? (analiseInicial && contextoEfetivo?.musicaId === analiseAtual?.musicaId && analiseInicial.escalaContexto
      ? { titulo: analiseAtual.titulo, tom: analiseInicial.escalaContexto.tom, bpm: analiseInicial.escalaContexto.bpm }
      : undefined);
  const selecionarVideo = (result: SearchResult) => {
    setVideoConfirmado(result);
    setBuscandoOutraVersao(false);
    setResults([]);
    setMessage(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <button type="button" onClick={onVoltar} className="mb-4 inline-flex items-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-rose-700 hover:underline">
          <ChevronLeft className="h-4 w-4" />{origem === "repertorio" ? "Voltar ao repertório" : "Voltar às escalas"}
        </button>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Sparkles className="h-5 w-5 text-rose-700" />Louvor Studio</h2>
        <p className="mt-1 text-sm text-gray-500">{selected ? "Ouça e ajuste as faixas para ensaiar." : "Confirme a gravação para preparar o ensaio desta música."}</p>
        {carregando && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin" />Carregando ensaio…</p>}
        {erroCarregamento && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3"><p role="alert" className="text-sm text-red-700">{erroCarregamento}</p><button type="button" onClick={() => void loadProjects()} className="mt-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Recarregar ensaio</button></div>}
        {!carregando && !erroCarregamento && !selected && !analiseAtual && <p className="mt-4 text-sm text-gray-500">Este ensaio não está disponível. Volte à música para conferir a preparação.</p>}
        {podePreparar && analiseAtual && !selected && !carregando && !erroCarregamento && !workerConfigurado && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">A preparação de ensaios está indisponível no momento.</p>}
        {podePreparar && analiseAtual && !selected && !carregando && !erroCarregamento && (
            <section className="mt-4 space-y-4" aria-label="Preparar ensaio">
              <div className="rounded-xl border border-rose-100 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-700">{fluxoDaEscala ? "Preparação para a escala" : "Preparação para o Repertório"}</p>
                {filaDaEscala.length > 1 && (
                  <p className="mt-1 text-xs font-semibold text-rose-700">Música {indiceDaFila + 1} de {filaDaEscala.length}</p>
                )}
                <h3 className="mt-1 text-base font-semibold text-gray-900">{analiseAtual?.titulo}</h3>
                <p className="text-sm text-gray-500">{analiseAtual?.artista || "Artista não informado"}</p>
                <p className="mt-2 text-xs text-gray-600">
                  {escalaDoFluxo
                    ? `${new Date(escalaDoFluxo.data + "T12:00:00").toLocaleDateString("pt-BR")} · ${escalaDoFluxo.culto} · ${escalaDoFluxo.horario.slice(0, 5)}`
                    : "Este ensaio ficará disponível nesta música do Repertório."}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-700 text-xs font-bold text-white">1</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900">Confirme o vídeo de referência</h3>
                    <p className="mt-1 text-xs text-gray-500">O tom e o BPM serão analisados a partir desta gravação.</p>
                  </div>
                </div>

                {videoConfirmado ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                    <div className="min-w-0">
                      <strong className="block truncate">{videoConfirmado.titulo}</strong>
                      <span className="text-xs text-emerald-800">Vídeo confirmado para esta análise</span>
                    </div>
                    <div className="flex gap-2">
                      <a href={videoConfirmado.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Conferir</a>
                      <button type="button" onClick={() => setVideoConfirmado(null)} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Trocar</button>
                    </div>
                  </div>
                ) : videoSugeridoDoRepertorio && videoDiretoDoRepertorio && !buscandoOutraVersao ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                    <div className="min-w-0">
                      <strong className="block">Vídeo de referência do Repertório</strong>
                      <span className="block truncate text-xs text-emerald-800">{videoSugeridoDoRepertorio.titulo} · {videoSugeridoDoRepertorio.artista}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={videoSugeridoDoRepertorio.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Abrir e conferir</a>
                      <button type="button" disabled={!workerConfigurado || preparando || Boolean(selected)} onClick={() => void processar(videoSugeridoDoRepertorio)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40">{selected ? "Análise iniciada" : preparando ? "Preparando…" : "Preparar análise"}</button>
                      <button type="button" onClick={() => setBuscandoOutraVersao(true)} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Buscar outra versão</button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={pesquisar} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, artista ou link do YouTube" aria-label="Vídeo de referência" maxLength={500} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
                    </div>
                    <button disabled={searching || query.trim().length < 2} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                      {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} {searching ? "Pesquisando…" : "Buscar vídeo"}
                    </button>
                  </form>
                )}
                {videoSugeridoDoRepertorio && !videoDiretoDoRepertorio && !videoConfirmado && !buscandoOutraVersao && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    Esta música ainda não tem um vídeo confirmado no Repertório. Pesquise a versão correta abaixo; ao selecioná-la, ela ficará vinculada à música para as próximas escalas.
                  </p>
                )}
              </div>

              {videoConfirmado && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-700 text-xs font-bold text-white">2</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">Preparação completa</h3>
                      <p className="mt-1 text-xs text-gray-500">A música será separada em voz, bateria, baixo e outros instrumentos.</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <strong className="block text-gray-800">Preparação completa</strong>
                    Voz, bateria, baixo e outros instrumentos serão separados para a equipe ensaiar.
                  </div>
                  <button type="button" disabled={!workerConfigurado || preparando} onClick={() => void processar(videoConfirmado)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40">
                    {preparando ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {preparando ? "Criando análise…" : "Preparar para análise"}
                  </button>
                  {message && <p role="alert" className="mt-3 text-xs font-medium text-red-700">{message}</p>}
                </div>
              )}
            </section>
        )}
        {!podePreparar && analiseAtual && !selected && !carregando && !erroCarregamento && <p className="mt-4 text-sm text-gray-500">O ensaio desta música ainda não está disponível.</p>}
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {message}
        </div>
      )}

      {results.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-3 md:p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">{fluxoDaEscala ? "Escolha outra versão" : "Escolha a música"} ({results.length})</h3>
          <div className="grid gap-2 lg:grid-cols-2">
            {results.map((result) => (
              <article key={result.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5">
                {result.thumbnailUrl ? (
                  // A miniatura vem diretamente do YouTube e não contém dados do usuário.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.thumbnailUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
                ) : <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-gray-100"><Music2 /></div>}
                <div className="min-w-0 flex-1">
                  <a href={result.url} target="_blank" rel="noopener noreferrer" title="Conferir vídeo no YouTube" className="block text-sm font-semibold text-gray-900 hover:text-rose-700 hover:underline">{result.titulo}</a>
                  <p className="truncate text-xs text-gray-500">{result.artista}{result.duracao ? ` · ${formatDuration(result.duracao)}` : ""}</p>
                </div>
                <button
                  onClick={() => selecionarVideo(result)}
                  disabled={!workerConfigurado}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Selecionar
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

        <main id="studio-player" className="min-w-0">
          {selected && (
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
              <Disc3 className="h-4 w-4 text-rose-700" />
              <p className="text-sm font-semibold text-gray-900">Ensaio: <span className="font-medium text-gray-600">{selected.titulo}</span></p>
              {(podeGerenciar || selected.visibilidade === "pessoal") && ["concluido", "erro"].includes(selected.status) && <button type="button" onClick={() => void excluir(selected)} disabled={deletingId === selected.id} aria-label={`Excluir ensaio de ${selected.titulo}`} className="ml-auto rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>}
            </div>
          )}
          {selected && selected.status !== "concluido" && (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-5 text-center">
              {selected.status === "erro" ? <AlertCircle className="mb-3 h-9 w-9 text-red-400" /> : <LoaderCircle className="mb-3 h-9 w-9 animate-spin text-rose-600" />}
              {selected.status === "erro" && <p className="font-semibold text-gray-900">{STATUS_LABEL[selected.status]}</p>}
              {selected.status !== "erro" && <p className="mb-2 font-semibold text-gray-900">{STATUS_LABEL[selected.status]}</p>}
              {selected.status !== "erro" && <p className="max-w-md text-sm text-gray-500" role="status" aria-live="polite">{"Voc\u00ea pode sair desta tela. O processamento continuar\u00e1."}</p>}
              {selected.status === "erro" && (
              <p className="mt-1 max-w-md text-sm text-gray-500">{selected.erro || "Você pode sair desta tela. O PC local continuará o processamento enquanto estiver ligado."}</p>
              )}
              {selected.status === "separando" && selected.progresso < 0 && (
                <p className="mt-2 max-w-md text-xs text-gray-500">A separação analisa a música inteira e pode levar vários minutos, dependendo da duração e do computador. O progresso avança conforme os trechos ficam prontos.</p>
              )}
              {selected.status !== "erro" && selected.progresso >= 0 && <p className="mt-3 text-xs font-medium text-rose-700" role="status" aria-live="polite">{selected.progresso}%</p>}
              {selected.status !== "erro" && (podeGerenciar || selected.visibilidade === "pessoal") && (
                <button
                  type="button"
                  disabled={cancellingId === selected.id}
                  onClick={() => void cancelarProcessamento(selected)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {cancellingId === selected.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CircleStop className="h-4 w-4" />}
                  {cancellingId === selected.id ? "Cancelando..." : "Cancelar processamento"}
                </button>
              )}
              {selected.status === "erro" && podeGerenciar && (
                <button
                  type="button"
                  disabled={!workerConfigurado || retryingId === selected.id}
                  onClick={() => void tentarNovamente(selected)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {retryingId === selected.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {retryingId === selected.id ? "Colocando na fila…" : "Tentar novamente"}
                </button>
              )}
            </div>
          )}
          {selected?.status === "concluido" && (
            <>
              {escalaNoContexto && musicaNoContexto && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-rose-700">Ensaio para este culto</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{escalaNoContexto.culto} · {new Date(escalaNoContexto.data + "T12:00:00").toLocaleDateString("pt-BR")} · {escalaNoContexto.horario.slice(0, 5)}</p>
                  <p className="mt-1 text-xs text-gray-600">{musicaNoContexto.titulo} · tom do culto {musicaNoContexto.tom || "a definir"} · BPM {musicaNoContexto.bpm || "—"}</p>
                  {musicaNoContexto.tom && <p className="mt-1 text-xs text-gray-500">Ajuste o tom do player para {musicaNoContexto.tom} antes de ensaiar.</p>}
                </div>
                <div className="flex gap-2">
                  <a href={selected.youtube_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700">Vídeo de referência</a>
                  {onVoltarParaEscalas && <button type="button" onClick={() => onVoltarParaEscalas(escalaNoContexto.id)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700">Voltar à escala</button>}
                </div>
              </div>}
              <LouvorStudioPlayer
                key={`${selected.id}-${selected.musicas?.tom || selected.tom_original || "sem-tom"}-${musicaNoContexto?.tom || "original"}`}
                project={selected}
                podePrepararDownload={podeGerenciar}
                tomBaseOverride={selected.musicas?.tom || undefined}
                tomDaEscala={musicaNoContexto?.tom}
                salvandoTomDaEscala={applyingId === selected.id}
                onEscolherTomDaEscala={podeGerenciar && contextoEfetivo?.escalaId && contextoEfetivo.musicaId
                  ? (escolha) => void confirmarTomNaEscala(selected, escolha)
                  : undefined}
              />
            </>
          )}
        </main>
    </div>
  );
}
