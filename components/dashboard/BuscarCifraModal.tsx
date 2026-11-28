"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Music2, ExternalLink, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

const NOTES_PARA_SELECAO = ["C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B"];
const TONS_IMPORTACAO = [...NOTES_PARA_SELECAO, ...NOTES_PARA_SELECAO.map((nota) => nota + "m")];

interface Sugestao {
  titulo: string;
  artista: string;
  url: string;
  artistaSlug: string;
  musicaSlug: string;
}

interface Props {
  onClose: () => void;
  onSalva: (musica: {
    requestId: string;
    titulo: string;
    artista: string;
    tom: string;
    artistaSlug: string;
    musicaSlug: string;
    cifraUrl?: string;
    youtubeUrl?: string;
    formaDaCifra?: string;
    capotraste?: string;
    cifra: string[];
  }) => void | Promise<void>;
  buscaInicial?: string;
}

export default function BuscarCifraModal({ onClose, onSalva, buscaInicial = "" }: Props) {
  const [query, setQuery] = useState(buscaInicial.trim());
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [erro, setErro] = useState("");
  const [loadingCifra, setLoadingCifra] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [importacaoManual, setImportacaoManual] = useState<Sugestao | null>(null);
  const [cifraManual, setCifraManual] = useState("");
  const [tomManual, setTomManual] = useState("");
  const [tituloManual, setTituloManual] = useState(buscaInicial.trim());
  const [artistaManual, setArtistaManual] = useState("");
  const salvandoRef = useRef(false);
  const salvamentoIdRef = useRef<string | null>(null);
  const urlCifraClubManual = importacaoManual?.url ?? "";



  const buscarSugestoes = useCallback(async (termo: string) => {
    const pesquisa = termo.trim();
    if (!pesquisa) {
      setErro("Informe o título da música para buscar as versões.");
      return;
    }
    setErro("");
    setSugestoes([]);
    setImportacaoManual(null);
    setLoadingCifra(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      if (!token) {
        setErro("Sua sessão expirou. Entre novamente para buscar versões.");
        return;
      }
      const resposta = await fetch(`/api/buscar-cifra?q=${encodeURIComponent(pesquisa)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await resposta.json();
      const itens = Array.isArray(dados.results) ? dados.results as Sugestao[] : [];
      setSugestoes(itens);
      if (itens.length === 0) setErro("Não encontramos versões agora. Tente informar mais palavras no título.");
    } catch {
      setErro("Não foi possível buscar versões agora. Tente novamente.");
    } finally {
      setLoadingCifra(false);
    }
  }, []);

  useEffect(() => {
    const pesquisaInicial = buscaInicial.trim();
    const timer = window.setTimeout(() => {
      if (pesquisaInicial) void buscarSugestoes(pesquisaInicial);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [buscaInicial, buscarSugestoes]);

  function selecionarSugestao(sugestao: Sugestao) {
    setImportacaoManual(sugestao);
    setTituloManual(sugestao.titulo);
    setArtistaManual(sugestao.artista);
    setTomManual("");
    setCifraManual("");
    setErro("");
  }
  function confirmarImportacaoManual() {
    if (!importacaoManual) return;
    const texto = cifraManual.replace(/\r\n?/g, "\n").trim();
    const linhas = texto.split("\n").map((linha) => linha.replace(/\s+$/, ""));
    if (texto.length < 30 || linhas.filter((linha) => linha.trim()).length < 3) {
      setErro("Cole pelo menos algumas linhas da cifra, incluindo acordes e letra.");
      return;
    }
    const titulo = tituloManual.trim();
    const artista = artistaManual.trim();
    if (!titulo || !artista) {
      setErro("Informe o título e o artista antes de continuar.");
      return;
    }

    void salvarImportacaoManual({
      titulo,
      artista,
      tom: tomManual,
      sugestao: importacaoManual,
      cifra: linhas,
      cifraUrl: urlCifraClubManual,
    });
  }

  async function salvarImportacaoManual({
    titulo,
    artista,
    tom,
    sugestao,
    cifra,
    cifraUrl,
  }: {
    titulo: string;
    artista: string;
    tom: string;
    sugestao: Sugestao;
    cifra: string[];
    cifraUrl: string;
  }) {
    if (salvandoRef.current) return;
    const requestId = salvamentoIdRef.current ?? crypto.randomUUID();
    salvamentoIdRef.current = requestId;
    salvandoRef.current = true;
    setErro("");
    setSalvando(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        onSalva({
          requestId,
          titulo,
          artista,
          tom,
          artistaSlug: sugestao.artistaSlug,
          musicaSlug: sugestao.musicaSlug,
          cifraUrl,
          cifra,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("A gravação demorou além do esperado. Verifique a conexão e tente novamente.")),
            30_000,
          );
        }),
      ]);
      salvamentoIdRef.current = null;
      onClose();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível adicionar a música ao Repertório.");
    } finally {
      if (timer) clearTimeout(timer);
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <div className="app-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="app-modal-panel w-full max-w-2xl flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            <Music2 className="w-5 h-5 text-grape-700" />
            <h2 className="truncate text-base font-bold text-gray-900">Adicionar cifra manualmente</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {erro && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {erro}
          </div>
        )}

        {!importacaoManual && sugestoes.length === 0 && !loadingCifra && (
          <div className="px-5 py-5">
            <p className="text-sm font-semibold text-gray-900">Qual música você quer adicionar?</p>
            <p className="mt-1 text-xs text-gray-500">Buscaremos somente os nomes e links das versões. A letra e os acordes continuam manuais.</p>
            <div className="mt-3 flex gap-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void buscarSugestoes(query)} placeholder="Ex.: Pra Onde Eu Irei" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-grape-400" autoFocus />
              <button type="button" onClick={() => void buscarSugestoes(query)} className="rounded-xl bg-grape-700 px-4 py-2 text-sm font-semibold text-white hover:bg-grape-800">Buscar versões</button>
            </div>
          </div>
        )}
        {importacaoManual && (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Abra a cifra e cole aqui</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Você escolheu <strong>{tituloManual}</strong> — {artistaManual}. Abra a cifra, copie a letra com os acordes e cole no campo abaixo.
              </p>
              <a href={urlCifraClubManual} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir cifra no Cifra Club
              </a>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-600">
                Título
                <input
                  value={tituloManual}
                  readOnly
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-grape-400 sm:text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Artista
                <input
                  value={artistaManual}
                  readOnly
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-grape-400 sm:text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-600 sm:max-w-48">
                Tom
                <select
                  value={tomManual}
                  onChange={(e) => setTomManual(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-base outline-none focus:border-grape-400 sm:text-sm"
                >
                  <option value="">Não informado</option>
                  {TONS_IMPORTACAO.map((tom) => <option key={tom}>{tom}</option>)}
                </select>
              </label>
            </div>

            <label className="mt-4 block text-xs font-medium text-gray-600">
              Cifra conferida
              <textarea
                value={cifraManual}
                onChange={(e) => setCifraManual(e.target.value)}
                placeholder={"[Intro] C  G  Am  F\n\nC                 G\nTrecho da letra..."}
                className="mt-1 min-h-64 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-base leading-6 outline-none focus:border-grape-400 sm:text-sm"
              />
            </label>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => { setImportacaoManual(null); setErro(""); }}
                className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmarImportacaoManual}
                disabled={salvando}
                className="rounded-xl bg-grape-700 px-5 py-2 text-sm font-semibold text-white hover:bg-grape-800 disabled:opacity-60"
              >
                {salvando ? "Salvando…" : "Salvar no Repertório"}
              </button>
            </div>
          </div>
        )}

        {/* Sugestões */}
        {!importacaoManual && sugestoes.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-1">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-2">Selecione a música</p>
            {sugestoes.map((s, i) => (
              <button
                key={i}
                onClick={() => selecionarSugestao(s)}
                disabled={loadingCifra}
                className="w-full flex items-center justify-between gap-3 bg-gray-50 hover:bg-grape-50 border border-gray-100 hover:border-grape-200 rounded-xl px-4 py-3 transition text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.titulo || s.musicaSlug.replace(/-/g, " ")}</p>
                  <p className="text-xs text-gray-400">{s.artista || s.artistaSlug.replace(/-/g, " ")}</p>
                </div>
                {loadingCifra
                  ? <Loader2 className="w-4 h-4 text-grape-400 animate-spin shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                }
              </button>
            ))}
          </div>
        )}

        {/* Loading cifra */}
        {loadingCifra && sugestoes.length === 0 && (
          <div className="flex-1 min-h-0 flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            Buscando versões...
          </div>
        )}
      </div>
    </div>
  );
}
