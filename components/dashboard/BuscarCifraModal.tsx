"use client";

import { useMemo, useRef, useState } from "react";
import { X, Music2, Check, ExternalLink, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import clsx from "clsx";

// ── Transposição de cifra ──────────────────────────────────────────────────
const NOTES_S = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTES_F = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const NOTES_PARA_SELECAO = ["C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B"];
const TONS_IMPORTACAO = [...NOTES_PARA_SELECAO, ...NOTES_PARA_SELECAO.map((nota) => nota + "m")];

function noteIdx(n: string) {
  let i = NOTES_S.indexOf(n);
  if (i === -1) i = NOTES_F.indexOf(n);
  return i;
}

function tomIdx(tom: string) {
  // strip 'm' suffix for minor keys to get the root
  return noteIdx(tom.replace(/m$/, ""));
}

function transposeWord(word: string, semis: number): string {
  const m = word.match(/^([A-G][#b]?)(.*?)(\/?[A-G][#b]?)?$/);
  if (!m || noteIdx(m[1]) === -1) return word;
  const newRoot = NOTES_S[(noteIdx(m[1]) + semis + 12) % 12];
  let bass = "";
  if (m[3] && m[3].startsWith("/")) {
    const bassNote = m[3].slice(1);
    if (noteIdx(bassNote) !== -1) {
      bass = "/" + NOTES_S[(noteIdx(bassNote) + semis + 12) % 12];
    } else {
      bass = m[3];
    }
  }
  return newRoot + (m[2] || "") + bass;
}

// Suporta notação brasileira: F7M (Fmaj7), G7+ (Gaug7), Dm7b5, Csus4, etc.
const CHORD_RE = /^[A-G][#b]?(m(?:aj)?|M(?:aj)?|dim|aug|sus[24]?|add)?[0-9]*([\+Mb5])?(\/[A-G][#b]?)?$/;

function isChordLine(line: string) {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  return words.filter(w => CHORD_RE.test(w)).length / words.length >= 0.55;
}

function transposeCifra(lines: string[], semis: number): string[] {
  if (semis === 0) return lines;
  return lines.map(line =>
    isChordLine(line)
      ? line.replace(/\S+/g, w => transposeWord(w, semis))
      : line
  );
}
// ──────────────────────────────────────────────────────────────────────────

function slugManual(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "manual";
}

interface Sugestao {
  titulo: string;
  artista: string;
  url: string;
  artistaSlug: string;
  musicaSlug: string;
}

interface CifraResult {
  artist: string;
  name: string;
  tom_original?: string | null;
  forma_da_cifra?: string | null;
  capotraste?: string | null;
  youtube_url?: string;
  cifraclub_url?: string;
  cifra: string[];
  versao?: "principal" | "simplificada";
  versoes?: { id: "principal" | "simplificada"; label: string }[];
  tom_origem?: "cifraclub" | "inferido" | null;
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
  const [resultado, setResultado] = useState<CifraResult | null>(null);
  const [tomOriginal, setTomOriginal] = useState(""); // tom detectado da página
  const [tomPrevia, setTomPrevia] = useState("");
  const [erro, setErro] = useState("");
  const loadingCifra = false;
  const statusCifra = "Carregando cifra...";
  const [salvando, setSalvando] = useState(false);
  const [sugestaoSelecionada, setSugestaoSelecionada] = useState<Sugestao | null>(null);
  const [importacaoManual, setImportacaoManual] = useState<Sugestao | null>(() => ({
    titulo: buscaInicial.trim(), artista: "",
    url: `https://www.cifraclub.com.br/?q=${encodeURIComponent(buscaInicial.trim() || "cifras gospel")}`,
    artistaSlug: "manual", musicaSlug: "manual",
  }));
  const [cifraManual, setCifraManual] = useState("");
  const [tomManual, setTomManual] = useState("");
  const [tituloManual, setTituloManual] = useState(buscaInicial.trim());
  const [artistaManual, setArtistaManual] = useState("");
  const [youtubeManual, setYoutubeManual] = useState("");
  const salvandoRef = useRef(false);
  const salvamentoIdRef = useRef<string | null>(null);
  const urlCifraClubManual = useMemo(() => {
    const pesquisa = [tituloManual.trim(), artistaManual.trim()].filter(Boolean).join(" ");
    return `https://www.cifraclub.com.br/?q=${encodeURIComponent(pesquisa || "cifras gospel")}`;
  }, [tituloManual, artistaManual]);



  // Linha de tablatura: começa com nome de corda + | OU é cabeçalho/rodapé de bloco de tab
  function isTabLine(line: string) {
    if (/^\s*[EBGDAe]\s*\|/.test(line)) return true;
    // "[Tab - ...]", "[Tab]", "Parte N de N" que ficam em blocos de tablatura
    if (/^\s*\[Tab[\s\-]/i.test(line)) return true;
    if (/^\s*Parte\s+\d+\s+de\s+\d+/i.test(line)) return true;
    return false;
  }

  // Cifra transposta automaticamente quando o tom muda
  const cifraExibida = useMemo(() => {
    if (!resultado) return [];
    const orig = tomOriginal;
    const dest = tomPrevia;
    if (!orig || !dest || orig === dest) return resultado.cifra;
    const fromIdx = tomIdx(orig);
    const toIdx2  = tomIdx(dest);
    if (fromIdx === -1 || toIdx2 === -1) return resultado.cifra;
    const semis = (toIdx2 - fromIdx + 12) % 12;
    return transposeCifra(resultado.cifra, semis);
  }, [resultado, tomPrevia, tomOriginal]);

  // Na busca, a prévia fica focada em letra e acordes. A tablatura completa
  // continua salva com a música e pode ser aberta depois no Repertório.
  const cifraFiltrada = useMemo(() => {
    const filtered = cifraExibida.filter(line => !isTabLine(line));
    // Remove linhas em branco consecutivas que ficam após remover blocos de tab
    return filtered.reduce<string[]>((acc, line) => {
      if (line.trim() === "" && acc.length > 0 && acc[acc.length - 1].trim() === "") return acc;
      return [...acc, line];
    }, []);
  }, [cifraExibida]);

  async function buscarSugestoes(termo = query) {
    const pesquisa = termo.trim();
    setErro("");
    setSugestoes([]);
    setResultado(null);
    setSalvando(false);
    salvamentoIdRef.current = null;
    setImportacaoManual({
      titulo: pesquisa, artista: "",
      url: `https://www.cifraclub.com.br/?q=${encodeURIComponent(pesquisa || "cifras gospel")}`,
      artistaSlug: "manual", musicaSlug: "manual",
    });
    setTituloManual(pesquisa);
    setArtistaManual("");
    setTomManual("");
    setYoutubeManual("");
    setCifraManual("");
  }
  function confirmarImportacaoManual() {
    if (!importacaoManual) return;
    const youtube = youtubeManual.trim();
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

    if (youtube) {
      try {
        const host = new URL(youtube).hostname.replace(/^www\./, "");
        if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) throw new Error();
      } catch {
        setErro("Cole um link válido do YouTube ou deixe esse campo vazio.");
        return;
      }
    }
    const selecionada = { ...importacaoManual, titulo, artista, artistaSlug: slugManual(artista), musicaSlug: slugManual(titulo) };
    setSugestaoSelecionada(selecionada);
    setResultado({
      artist: artista,
      name: titulo,
      tom_original: tomManual || null,
      cifraclub_url: urlCifraClubManual,
      youtube_url: youtube || undefined,
      cifra: linhas,
      versao: "principal",
      versoes: [{ id: "principal", label: "Principal" }],
      tom_origem: null,
    });
    setTomOriginal(tomManual);
    setTomPrevia(tomManual);
    setErro("");
  }

  async function salvar() {
    if (!resultado || !sugestaoSelecionada || salvandoRef.current) return;
    const requestId = salvamentoIdRef.current ?? crypto.randomUUID();
    salvamentoIdRef.current = requestId;
    salvandoRef.current = true;

    setErro("");
    setSalvando(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const operacao = onSalva({
        requestId,
        titulo: resultado.name,
        artista: resultado.artist,
        tom: tomPrevia || tomOriginal || "",
        artistaSlug: sugestaoSelecionada.artistaSlug,
        musicaSlug: sugestaoSelecionada.musicaSlug,
        cifraUrl: resultado.cifraclub_url,
        youtubeUrl: resultado.youtube_url,
        formaDaCifra: resultado.forma_da_cifra ?? undefined,
        capotraste: resultado.capotraste ?? undefined,
        // Salva a cifra no tom escolhido pelo líder, enquanto a URL continua
        // apontando para a fonte original no Cifra Club.
        cifra: cifraExibida,
      });
      await Promise.race([
        operacao,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("A grava\u00e7\u00e3o demorou al\u00e9m do esperado. Verifique a conex\u00e3o e tente novamente.")),
            30_000,
          );
        }),
      ]);
      salvamentoIdRef.current = null;
      // O cadastro já terminou neste ponto. Fechar imediatamente evita deixar a
      // pessoa presa em “Adicionado!” se a tela pai atualizar o set do culto.
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

        {/* Campo de busca */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-2">
          <div className="flex min-w-0 gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarSugestoes()}
              placeholder="Título para pesquisar no Cifra Club (opcional)"
              className="min-w-0 flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-grape-400"
              autoFocus
            />
            <button
              onClick={() => void buscarSugestoes()}
              disabled={loadingCifra}
              className="flex items-center gap-1.5 bg-grape-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-grape-800 transition disabled:opacity-60 shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir formulário
            </button>
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {erro}
            </div>
          )}
        </div>

        {importacaoManual && !resultado && (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Confira e cole a versão que sua equipe usará</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Preencha título e artista, abra o Cifra Club e confira tom, letra e acordes da versão escolhida abaixo.
                Depois de salva, a cópia fica no Repertório; o sistema não tentará consultar sites de cifras.
              </p>
              <a
                href={urlCifraClubManual}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir Cifra Club
              </a>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-600">
                Título
                <input
                  value={tituloManual}
                  onChange={(e) => setTituloManual(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-grape-400 sm:text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Artista
                <input
                  value={artistaManual}
                  onChange={(e) => setArtistaManual(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-grape-400 sm:text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-600 sm:max-w-48">
                Tom mostrado na página
                <select
                  value={tomManual}
                  onChange={(e) => setTomManual(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-base outline-none focus:border-grape-400 sm:text-sm"
                >
                  <option value="">Não informado</option>
                  {TONS_IMPORTACAO.map((tom) => <option key={tom}>{tom}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600 sm:col-span-2">
                Link do YouTube <span className="font-normal text-gray-400">(opcional, para o Louvor Studio)</span>
                <input value={youtubeManual} onChange={(e) => setYoutubeManual(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-grape-400 sm:text-sm" />
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
                onClick={() => {
                  const selecionada = importacaoManual;
                  setImportacaoManual(null);
                  setSugestoes(selecionada ? [selecionada] : []);
                  setErro("");
                }}
                className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmarImportacaoManual}
                className="rounded-xl bg-grape-700 px-5 py-2 text-sm font-semibold text-white hover:bg-grape-800"
              >
                Conferir cifra copiada
              </button>
            </div>
          </div>
        )}

        {/* Sugestões */}
        {sugestoes.length > 0 && !resultado && (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-1">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-2">Selecione a música</p>
            {sugestoes.map((s, i) => (
              <button
                key={i}
                onClick={() => void buscarSugestoes(s.titulo)}
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
        {loadingCifra && !resultado && sugestoes.length === 0 && (
          <div className="flex-1 min-h-0 flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            {statusCifra}
          </div>
        )}

        {/* Resultado da cifra */}
        {resultado && (
          <>
            <div className="px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{resultado.name}</p>
                  <p className="text-sm text-gray-500">{resultado.artist}</p>
                  {resultado.cifraclub_url && (
                    <a href={resultado.cifraclub_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-grape-600 flex items-center gap-1 mt-0.5 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Ver no Cifra Club
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
                  <div className="flex flex-col items-start sm:items-end gap-0.5">
                    <span className="rounded-lg border border-grape-100 bg-grape-50 px-2.5 py-1.5 text-sm font-semibold text-grape-800">
                      {tomOriginal
                        ? `Tom original: ${tomOriginal}${resultado.tom_origem === "inferido" ? " (estimado)" : ""}`
                        : "Tom não informado"}
                    </span>
                    {(resultado.forma_da_cifra || resultado.capotraste) && (
                      <span className="text-xs text-gray-500">
                        {[
                          resultado.forma_da_cifra ? `Forma: ${resultado.forma_da_cifra}` : "",
                          resultado.capotraste ? `Capotraste: ${resultado.capotraste}` : "",
                        ].filter(Boolean).join(" | ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(resultado.versoes ?? [{ id: "principal", label: "Principal" }]).map((versao) => (
                  <button
                    key={versao.id}
                    type="button"
                    onClick={() => undefined}
                    disabled={loadingCifra}
                    className={clsx(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                      (resultado.versao ?? "principal") === versao.id
                        ? "border-grape-600 bg-grape-700 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-grape-300 hover:text-grape-700",
                    )}
                  >
                    {versao.label}
                  </button>
                ))}
                {resultado.versoes && resultado.versoes.length > 1 && (
                  <span className="text-xs text-gray-400">A versão simplificada é outra cifra da mesma música.</span>
                )}
              </div>
            </div>

            {/* Preview da cifra */}
            <div className="flex-1 min-h-0 bg-gray-50 flex flex-col">
              <div className="flex items-center justify-end px-5 py-1.5 border-b border-gray-100 bg-white shrink-0">
                {tomOriginal && (
                  <label className="mr-auto flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Tom da cifra</span>
                    <select
                      value={tomPrevia}
                      onChange={(e) => setTomPrevia(e.target.value)}
                      className="rounded-lg border border-grape-200 bg-grape-50 px-2 py-1 font-semibold text-grape-800 outline-none"
                    >
                      {NOTES_PARA_SELECAO.map((nota) => `${nota}${/m$/.test(tomOriginal) ? "m" : ""}`)
                        .map((tom) => <option key={tom}>{tom}</option>)}
                    </select>
                    {tomPrevia !== tomOriginal && <span className="text-grape-700">Será salvo neste tom</span>}
                  </label>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-auto px-5 py-3">
                <pre className="min-w-full w-max text-xs font-mono text-gray-700 whitespace-pre leading-5">
                  {cifraFiltrada.join("\n")}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 sm:py-4 border-t border-gray-100 shrink-0 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => setResultado(null)}
                className="self-start text-sm text-gray-400 hover:text-gray-600 transition sm:self-auto"
              >
                ← Voltar
              </button>
              <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
                <button onClick={onClose} className="flex-1 sm:flex-none text-xs sm:text-sm text-gray-500 px-3 sm:px-4 py-2 rounded-xl hover:bg-gray-100 transition">
                  Cancelar
                </button>
                <button
                  onClick={() => void salvar()}
                  disabled={salvando}
                  className={clsx(
                    "flex flex-1 sm:flex-none items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold px-3 sm:px-5 py-2 rounded-xl transition",
                    salvando ? "bg-grape-700 text-white disabled:opacity-60" : "bg-grape-700 text-white hover:bg-grape-800"
                  )}
                >
                  {salvando ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <Check className="w-4 h-4 shrink-0" />}
                  <span>{salvando ? "Adicionando…" : "Adicionar ao Repertório"}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
