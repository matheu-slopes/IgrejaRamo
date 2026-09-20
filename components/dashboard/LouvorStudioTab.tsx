"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Disc3, Download, LibraryBig, LoaderCircle, Music2, Search, Sparkles, Trash2 } from "lucide-react";
import { LouvorStudioPlayer } from "./LouvorStudioPlayer";
import { supabase } from "@/lib/supabase";
import { withDeadline } from "@/lib/withDeadline";

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

type EscalaOption = { id: string; culto: string; data: string; horario: string };

type StemName = "vocals" | "drums" | "bass" | "other" | "instrumental";

type MusicaDaFilaStudio = {
  musicaId: string;
  titulo: string;
  artista: string;
  youtubeUrl?: string;
};

export type AnaliseStudioInicial = MusicaDaFilaStudio & {
  id: string;
  escalaId: string;
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
  onAjustarNaEscala,
}: {
  podeGerenciar: boolean;
  podePrepararEnsaio: boolean;
  workerConfigurado: boolean;
  analiseInicial?: AnaliseStudioInicial | null;
  onAjustarNaEscala?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [escalas, setEscalas] = useState<EscalaOption[]>([]);
  const [escalaId, setEscalaId] = useState("");
  const [vincularCulto, setVincularCulto] = useState(false);
  const [videoConfirmado, setVideoConfirmado] = useState<SearchResult | null>(null);
  const [buscandoOutraVersao, setBuscandoOutraVersao] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mostrarPreparacao, setMostrarPreparacao] = useState(false);
  const [buscaNaBiblioteca, setBuscaNaBiblioteca] = useState("");
  const [filtroDaBiblioteca, setFiltroDaBiblioteca] = useState<"todas" | "prontas" | "processando">("todas");
  const [message, setMessage] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [confirmandoTomBaseId, setConfirmandoTomBaseId] = useState<string | null>(null);
  const [tomBaseEmTeste, setTomBaseEmTeste] = useState<Record<string, string>>({});
  const [indiceDaFila, setIndiceDaFila] = useState(0);
  const podePreparar = podeGerenciar || podePrepararEnsaio;

  useEffect(() => {
    if (!analiseInicial) return;
    setIndiceDaFila(0);
    setEscalaId(analiseInicial.escalaId);
    setVincularCulto(true);
  }, [analiseInicial]);

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
  const fluxoDaEscala = Boolean(analiseInicial);
  const escalaDoFluxo = escalas.find((escala) => escala.id === analiseInicial?.escalaId);
  const videoDiretoDoRepertorio = Boolean(
    videoSugeridoDoRepertorio && !/youtube\.com\/results/i.test(videoSugeridoDoRepertorio.url),
  );

  const loadProjects = useCallback(async () => {
    const response = await studioFetch("/api/louvor-studio/projects");
    const data = await response.json().catch(() => ({})) as { projetos?: Projeto[]; escalas?: EscalaOption[]; error?: string };
    if (response.ok) {
      setProjects(data.projetos ?? []);
      setEscalas(data.escalas ?? []);
      // A biblioteca comum só abre sob ação da pessoa. Já o fluxo vindo da
      // escala volta direto para a preparação daquela música, se ela existir.
      setSelectedId((current) => {
        if (data.projetos?.some((project) => project.id === current)) return current;
        if (!analiseAtual) return null;
        return data.projetos?.find((project) =>
          project.musica_id === analiseAtual.musicaId &&
          (project.escalas?.id === analiseInicial?.escalaId ||
            project.escala_usos?.some((uso) =>
              uso.escala_id === analiseInicial?.escalaId && uso.musica_id === analiseAtual.musicaId,
            )),
        )?.id ?? null;
      });
    } else {
      setMessage(data.error ?? "Não foi possível carregar o Studio.");
    }
  }, [analiseAtual, analiseInicial?.escalaId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProjects(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProjects]);

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
            escalaId: analiseInicial?.escalaId ?? (vincularCulto ? escalaId : undefined),
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
      setMostrarPreparacao(false);
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

  function abrirProjeto(project: Projeto) {
    setSelectedId(project.id);
    if (project.status === "concluido") {
      void studioFetch(`/api/louvor-studio/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "usar" }),
      });
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
      if (selectedId === project.id) setSelectedId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setDeletingId(null);
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
    const escalaIdDaEscolha = analiseInicial?.escalaId ?? project.escalas?.id;
    const musicaIdDaEscolha = analiseAtual?.musicaId ?? project.musica_id;
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

  async function confirmarTomBase(project: Projeto, tom: string) {
    if (confirmandoTomBaseId) return;
    // Atualiza o player imediatamente para o líder ouvir o resultado, mesmo
    // antes da resposta do servidor chegar.
    setTomBaseEmTeste((atual) => ({ ...atual, [project.id]: tom }));
    setConfirmandoTomBaseId(project.id);
    setMessage(null);
    try {
      const response = await studioFetch(`/api/louvor-studio/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "confirmar_tom_base", tom }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível confirmar o tom-base.");
      setMessage(`Tom-base ${tom} confirmado para este vídeo.`);
      await loadProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar o tom-base.");
    } finally {
      setConfirmandoTomBaseId(null);
    }
  }

  const selected = fluxoDaEscala
    ? projects.find((project) =>
      project.id === selectedId &&
      project.musica_id === analiseAtual?.musicaId &&
      (project.escalas?.id === analiseInicial?.escalaId ||
        project.escala_usos?.some((uso) =>
          uso.escala_id === analiseInicial?.escalaId && uso.musica_id === analiseAtual?.musicaId,
        )),
    ) ?? null
    : projects.find((project) => project.id === selectedId) ?? null;

  const projetosProntos = projects.filter((project) => project.status === "concluido").length;
  const projetosEmProcessamento = projects.filter((project) => !["concluido", "erro"].includes(project.status)).length;
  const ensaiosPessoais = projects.filter((project) => project.visibilidade === "pessoal");
  const limiteDeEnsaiosAtingido = !podeGerenciar && ensaiosPessoais.length >= 3;
  const projetosDaBiblioteca = useMemo(() => {
    const termo = buscaNaBiblioteca
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("pt-BR");

    return projects.filter((project) => {
      const correspondeAoFiltro = filtroDaBiblioteca === "todas"
        || (filtroDaBiblioteca === "prontas" && project.status === "concluido")
        || (filtroDaBiblioteca === "processando" && !["concluido", "erro"].includes(project.status));
      const texto = `${project.titulo} ${project.artista ?? ""}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");
      return correspondeAoFiltro && (!termo || texto.includes(termo));
    });
  }, [buscaNaBiblioteca, filtroDaBiblioteca, projects]);

  const selecionarVideo = (result: SearchResult) => {
    if (!fluxoDaEscala) {
      void processar(result);
      return;
    }
    setVideoConfirmado(result);
    setBuscandoOutraVersao(false);
    setResults([]);
    setMessage(null);
  };

  return (
    <div className="space-y-6">
      <div className={fluxoDaEscala || mostrarPreparacao ? "rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white p-5 shadow-sm md:p-6" : "flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"}>
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-700" />
            <h2 className="text-lg font-semibold text-gray-900">Louvor Studio</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Prepare músicas quando precisar e use a biblioteca para abrir os ensaios da equipe.
          </p>
        </div>

        {podePreparar && !fluxoDaEscala && (
          <button
            type="button"
            disabled={limiteDeEnsaiosAtingido && !mostrarPreparacao}
            onClick={() => {
              if (limiteDeEnsaiosAtingido && !mostrarPreparacao) {
                setMessage("Você atingiu o limite de 3 ensaios pessoais. Exclua um ou aguarde a expiração para preparar outra música.");
                return;
              }
              setMostrarPreparacao((aberto) => !aberto);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> {mostrarPreparacao ? "Fechar preparação" : podeGerenciar ? "Preparar música" : "Novo ensaio"}
          </button>
        )}

        {podePreparar && !workerConfigurado && (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Configure o segredo do processador na Vercel. Depois, o PC local buscará as tarefas sem ficar exposto na internet.</span>
          </div>
        )}

        {podePreparar ? (
          fluxoDaEscala ? (
            selected?.status === "concluido" ? (
              <section className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4" aria-label="Música pronta para definir tom">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Base pronta para esta escala</p>
                <h3 className="mt-1 text-base font-semibold text-gray-900">{selected.titulo}</h3>
                <p className="mt-1 text-sm text-gray-600">Ouça no player abaixo, teste os tons e confirme o que a equipe usará neste culto.</p>
              </section>
            ) : (
            <section className="mt-4 space-y-4" aria-label="Preparar música da escala">
              <div className="rounded-xl border border-rose-100 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-700">Preparação para a escala</p>
                {filaDaEscala.length > 1 && (
                  <p className="mt-1 text-xs font-semibold text-rose-700">Música {indiceDaFila + 1} de {filaDaEscala.length}</p>
                )}
                <h3 className="mt-1 text-base font-semibold text-gray-900">{analiseAtual?.titulo}</h3>
                <p className="text-sm text-gray-500">{analiseAtual?.artista || "Artista não informado"}</p>
                <p className="mt-2 text-xs text-gray-600">
                  {escalaDoFluxo
                    ? `${new Date(escalaDoFluxo.data + "T12:00:00").toLocaleDateString("pt-BR")} · ${escalaDoFluxo.culto} · ${escalaDoFluxo.horario.slice(0, 5)}`
                    : "Este preparo será vinculado à música desta escala."}
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
            )
          ) : mostrarPreparacao ? <form onSubmit={pesquisar} className="mt-5 space-y-4">
          {videoSugeridoDoRepertorio && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <div>
                <strong className="block">Vídeo sugerido pelo Repertório</strong>
                <span className="text-xs text-emerald-800">Confira a versão antes de preparar. Você pode pesquisar outra gravação abaixo.</span>
              </div>
              <button
                type="button"
                disabled={!workerConfigurado}
                onClick={() => void processar(videoSugeridoDoRepertorio)}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Usar este vídeo
              </button>
            </div>
          )}
          <section aria-label="Destino da preparação">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Onde usar</p>
              <p className="text-xs text-gray-400">Etapa 1 de 3</p>
            </div>
          <div className={`grid gap-2 ${podeGerenciar ? "grid-cols-2" : "grid-cols-1"}`}>
            <button
              type="button"
              aria-pressed={!vincularCulto}
              onClick={() => setVincularCulto(false)}
              className={`rounded-xl border p-3 text-left text-sm transition ${!vincularCulto ? "border-rose-300 bg-rose-50 text-rose-900" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <strong className="block">{podeGerenciar ? "Biblioteca da equipe" : "Meu ensaio"}</strong>
              <span className="mt-0.5 block text-xs opacity-75">{podeGerenciar ? "Disponível para a equipe de Louvor" : "Privado e disponível por 7 dias"}</span>
            </button>
            {podeGerenciar && (
            <button
              type="button"
              aria-pressed={vincularCulto}
              onClick={() => setVincularCulto(true)}
              className={`rounded-xl border p-3 text-left text-sm transition ${vincularCulto ? "border-rose-300 bg-rose-50 text-rose-900" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <strong className="block">Usar em um culto</strong>
              <span className="mt-0.5 block text-xs opacity-75">Vincula a música à escala</span>
            </button>
            )}
          </div>
          {podeGerenciar && vincularCulto && (
            <label className="block text-xs font-medium text-gray-600">
              Selecione o culto
              <select
                value={escalaId}
                onChange={(event) => setEscalaId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-rose-400"
              >
                <option value="">Selecione um culto</option>
                {escalas.map((escala) => (
                  <option key={escala.id} value={escala.id}>
                    {new Date(escala.data + "T12:00:00").toLocaleDateString("pt-BR")} · {escala.culto} · {escala.horario.slice(0, 5)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="px-1 text-xs text-gray-500" aria-live="polite">
            {!podeGerenciar
              ? "Este ensaio é privado e será removido automaticamente após 7 dias."
              : vincularCulto
              ? "A música ficará disponível para a equipe que participa desse culto."
              : "A base ficará disponível na biblioteca da equipe por 90 dias desde o último uso."}
          </p>
          </section>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Como preparar</p>
                <p className="mt-1 font-medium text-gray-800">Preparação completa para a equipe</p>
              </div>
              <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">Etapa 2 de 3</span>
            </div>
            <p className="mt-1 text-xs text-gray-500" aria-live="polite">
              Esta música terá Voz, Bateria, Baixo e Outros instrumentos para controlar separadamente no player.
            </p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Buscar a música</label>
              <span className="text-xs text-gray-400">Etapa 3 de 3</span>
            </div>
          <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome da música, artista ou link do YouTube"
              aria-label="Nome da música, artista ou link do YouTube"
              maxLength={500}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <button
            disabled={searching || query.trim().length < 2}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {searching ? "Pesquisando…" : "Pesquisar no YouTube"}
          </button>
          </div>
          </div>
          <p className="text-xs text-gray-500" role="status" aria-live="polite">
            {searching ? "Buscando os vídeos no YouTube. Aguarde alguns segundos…" : "Escolha o vídeo e clique em Preparar. O tom será identificado automaticamente; depois você pode ouvir e ajustar."}
          </p>
        </form> : null) : (
          <p className="mt-4 rounded-xl bg-white p-3 text-sm text-gray-600 ring-1 ring-gray-100">
            As músicas preparadas pelos ministros aparecem abaixo para toda a equipe ensaiar.
          </p>
        )}
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {message}
        </div>
      )}

      {results.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-3 md:p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">{fluxoDaEscala ? "Escolha outra versão" : "Escolha a música"} ({results.length})</h3>
          {vincularCulto && !escalaId && !fluxoDaEscala && <p className="mb-3 text-xs text-gray-500">Selecione o culto acima para preparar a música escolhida.</p>}
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
                  disabled={!fluxoDaEscala && (!workerConfigurado || (vincularCulto && !escalaId))}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {fluxoDaEscala ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />} {fluxoDaEscala ? "Selecionar" : "Preparar"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className={fluxoDaEscala ? "" : "space-y-5"}>
        {!fluxoDaEscala && <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><LibraryBig className="h-5 w-5" /></span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Sua biblioteca</h3>
                <p className="mt-0.5 text-xs text-gray-500">Escolha uma música para abrir o ensaio</p>
                {!podeGerenciar && <p className="mt-1 text-[11px] text-gray-500">Meus ensaios: {ensaiosPessoais.length} de 3 · expiram em até 7 dias</p>}
              </div>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{projects.length}</span>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={buscaNaBiblioteca}
              onChange={(event) => setBuscaNaBiblioteca(event.target.value)}
              placeholder="Buscar por música ou artista"
              aria-label="Buscar na sua biblioteca"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </label>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar biblioteca">
            {([
              ["todas", `Todas (${projects.length})`],
              ["prontas", `Prontas (${projetosProntos})`],
              ["processando", `Processando (${projetosEmProcessamento})`],
            ] as const).map(([filtro, texto]) => (
              <button
                key={filtro}
                type="button"
                onClick={() => setFiltroDaBiblioteca(filtro)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${filtroDaBiblioteca === filtro ? "bg-rose-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {texto}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {!projects.length && <p className="w-full rounded-xl bg-gray-50 p-5 text-center text-xs text-gray-400">Nenhuma música preparada ainda.</p>}
            {projects.length > 0 && !projetosDaBiblioteca.length && <p className="w-full rounded-xl bg-gray-50 p-5 text-center text-xs text-gray-500">Nenhuma música encontrada nesta busca.</p>}
            {projetosDaBiblioteca.map((project) => (
              <div
                key={project.id}
                className={`relative w-full rounded-xl border transition ${selectedId === project.id ? "border-rose-200 bg-rose-50" : "border-gray-100 bg-white hover:bg-gray-50"}`}
              >
                <button
                  type="button"
                  onClick={() => abrirProjeto(project)}
                  className="w-full p-2.5 pr-10 text-left"
                >
                <p className="truncate text-sm font-semibold text-gray-900">{project.titulo}</p>
                <p className="mt-0.5 truncate text-xs text-gray-400">{project.artista || "YouTube"}</p>
                {project.visibilidade === "pessoal" && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-700">Meu ensaio · expira em 7 dias</p>
                )}
                {project.escalas && (
                  <p className="mt-1 truncate text-[11px] text-gray-500">
                    {new Date(project.escalas.data + "T12:00:00").toLocaleDateString("pt-BR")} · tom {project.tom_alvo || project.tom_original || "a identificar"}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
                  {project.status === "concluido" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> :
                    project.status === "erro" ? <AlertCircle className="h-3.5 w-3.5 text-red-500" /> :
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-500" />}
                  {project.status === "separando" && project.progresso >= 90 ? "Enviando faixas" : STATUS_LABEL[project.status]}
                </div>
                {!['concluido', 'erro'].includes(project.status) && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-rose-600 transition-all" style={{ width: `${project.progresso}%` }} />
                  </div>
                )}
                </button>
                {(podeGerenciar || project.visibilidade === "pessoal") && ["concluido", "erro"].includes(project.status) && (
                  <button
                    type="button"
                    aria-label={`Excluir ${project.titulo}`}
                    disabled={deletingId === project.id}
                    onClick={() => void excluir(project)}
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    {deletingId === project.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>}

        <main className={selected || fluxoDaEscala ? "min-w-0" : "hidden"}>
          {selected && !fluxoDaEscala && (
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Disc3 className="h-4 w-4 text-rose-700" />
              <p className="text-sm font-semibold text-gray-900">Ensaio: <span className="font-medium text-gray-600">{selected.titulo}</span></p>
            </div>
          )}
          {selected && selected.status !== "concluido" && (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-5 text-center">
              {selected.status === "erro" ? <AlertCircle className="mb-3 h-9 w-9 text-red-400" /> : <LoaderCircle className="mb-3 h-9 w-9 animate-spin text-rose-600" />}
              <p className="font-semibold text-gray-900">{selected.status === "separando" && selected.progresso >= 90 ? "Enviando faixas" : STATUS_LABEL[selected.status]}</p>
              <p className="mt-1 max-w-md text-sm text-gray-500">{selected.erro || "Você pode sair desta tela. O PC local continuará o processamento enquanto estiver ligado."}</p>
              {selected.status === "separando" && selected.progresso < 90 && (
                <p className="mt-2 max-w-md text-xs text-gray-500">A separação analisa a música inteira e pode levar vários minutos, dependendo da duração e do computador. O progresso avança conforme os trechos ficam prontos.</p>
              )}
              {selected.status !== "erro" && <p className="mt-3 text-xs font-medium text-rose-700" role="status" aria-live="polite">{selected.progresso}%</p>}
              {selected.status === "erro" && (podeGerenciar || selected.visibilidade === "pessoal") && (
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
              {selected.musicas?.tom && selected.tom_original && (
                <section className={`mb-4 rounded-2xl border p-4 ${selected.musicas.tom === selected.tom_original ? "border-emerald-100 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-700">Conferência do tom-base</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm">Cifra: {selected.musicas.tom}</span>
                    <span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm">Áudio detectado: {selected.tom_original}</span>
                    {selected.musicas.tom === selected.tom_original
                      ? <span className="rounded-full bg-emerald-700 px-3 py-1 font-semibold text-white">Tom confirmado</span>
                      : <span className="rounded-full bg-amber-600 px-3 py-1 font-semibold text-white">Confirme qual tom corresponde ao vídeo</span>}
                  </div>
                  {selected.musicas.tom !== selected.tom_original && podeGerenciar && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={confirmandoTomBaseId === selected.id}
                        onClick={() => void confirmarTomBase(selected, selected.tom_original!)}
                        className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        Usar tom do áudio ({selected.tom_original})
                      </button>
                      <button
                        type="button"
                        disabled={confirmandoTomBaseId === selected.id}
                        onClick={() => void confirmarTomBase(selected, selected.musicas!.tom!)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Usar tom da cifra ({selected.musicas.tom})
                      </button>
                      <p className="w-full text-xs text-gray-600">Teste no player e confirme o tom que realmente corresponde a esta gravação.</p>
                    </div>
                  )}
                  {(tomBaseEmTeste[selected.id] || selected.tom_base_confirmado) && (
                    <p className="mt-3 text-xs font-semibold text-emerald-800">Tom-base em uso no player: {tomBaseEmTeste[selected.id] || selected.tom_base_confirmado}</p>
                  )}
                </section>
              )}
              {selected.escalas && (
                <section className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Dados detectados na gravação</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm">Tom detectado: {selected.tom_original || "não identificado"}</span>
                    <span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm">BPM detectado: {selected.bpm ? Math.round(selected.bpm) : "não identificado"}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">Use o player abaixo para testar. O tom do culto só muda quando você confirmar a escolha.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onAjustarNaEscala}
                      className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                    >
                      Ajustar na escala
                    </button>
                  </div>
                </section>
              )}
              <LouvorStudioPlayer
                key={`${selected.id}-${tomBaseEmTeste[selected.id] || selected.tom_base_confirmado || selected.tom_original || "sem-tom"}`}
                project={selected}
                tomBaseOverride={tomBaseEmTeste[selected.id]}
                salvandoTomDaEscala={applyingId === selected.id}
                onEscolherTomDaEscala={selected.escalas && selected.musica_id && podeGerenciar
                  ? (escolha) => void confirmarTomNaEscala(selected, escolha)
                  : undefined}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
